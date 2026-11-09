import { DatabaseSync } from "node:sqlite";
import { createJourneyRouter } from "./journey.js";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
const DB_PATH = process.env.SKINSCOPE_DB_PATH || join(DATA_DIR, "skinscope.sqlite");
const OUTBOX_PATH = process.env.SKINSCOPE_OUTBOX_PATH || join(DATA_DIR, "email-outbox.json");
const PORT = Number(process.env.PORT || process.env.SKINSCOPE_PORT || 8787);
const ALLOWED_ORIGINS = (process.env.SKINSCOPE_ALLOWED_ORIGINS || "http://127.0.0.1:8766,http://localhost:8766,https://ilovepiton.github.io")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);
const DEV_OUTBOX_ENABLED = process.env.SKINSCOPE_DEV_OUTBOX !== "0";
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === "1";
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || "SkinScope <no-reply@skinscope.local>";
const SESSION_DAYS = 30;
const CODE_MINUTES = 15;

mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    avatar_data_url TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS email_codes (
    email TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'trial',
    status TEXT NOT NULL DEFAULT 'trialing',
    trial_ends_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    referrer_code TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    trial_ends_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

function nowIso() {
  return new Date().toISOString();
}

function addDays(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function addMinutes(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function getCorsOrigin(req) {
  const origin = req.headers.origin || "";
  if (!origin) return ALLOWED_ORIGINS[0] || "*";
  if (ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin)) return origin;
  return ALLOWED_ORIGINS[0] || origin;
}

function jsonResponse(req, res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": getCorsOrigin(req),
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 7_000_000) {
        reject(new Error("Request is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("Invalid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    email_confirmed_at: row.verified ? row.created_at : null,
    confirmed_at: row.verified ? row.created_at : null,
    user_metadata: {
      name: row.name,
      skinscope_verified: Boolean(row.verified)
    },
    name: row.name,
    avatar_url: row.avatar_data_url || ""
  };
}

function publicProfile(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatar_url: row.avatar_data_url || ""
  };
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const actual = Buffer.from(hashPassword(password, salt).hash, "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function makeToken() {
  return randomBytes(32).toString("base64url");
}

function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function appendOutbox(message) {
  let outbox = [];
  try {
    outbox = JSON.parse(readFileSync(OUTBOX_PATH, "utf8"));
  } catch (error) {
    outbox = [];
  }

  outbox.unshift(message);
  writeFileSync(OUTBOX_PATH, JSON.stringify(outbox.slice(0, 50), null, 2));
}

async function sendVerificationEmail(message) {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    appendOutbox(message);
    console.log(`[SkinScope email] ${message.to} code: ${message.code}`);
    return { sent: false, outbox: true };
  }

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: SMTP_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text
    });

    console.log(`[SkinScope email] sent verification code to ${message.to}`);
    return { sent: true, outbox: false };
  } catch (error) {
    appendOutbox({
      ...message,
      delivery_error: error.message || "SMTP delivery failed"
    });
    console.error("[SkinScope email] SMTP failed; saved to outbox:", error.message || error);
    return { sent: false, outbox: true, error: error.message || "SMTP delivery failed" };
  }
}

async function saveVerificationCode(email, name) {
  const code = makeCode();
  const message = {
    to: email,
    subject: "Your SkinScope verification code",
    code,
    text: `Hi ${name || "there"}, your SkinScope verification code is ${code}. It expires in ${CODE_MINUTES} minutes.`,
    created_at: nowIso()
  };

  db.prepare(`
    INSERT INTO email_codes (email, code, expires_at, attempts, created_at)
    VALUES (?, ?, ?, 0, ?)
    ON CONFLICT(email) DO UPDATE SET
      code = excluded.code,
      expires_at = excluded.expires_at,
      attempts = 0,
      created_at = excluded.created_at
  `).run(email, code, addMinutes(CODE_MINUTES), nowIso());

  return sendVerificationEmail(message);
}

function createSession(userId) {
  const token = makeToken();
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .run(hashToken(token), userId, addDays(SESSION_DAYS), nowIso());
  return token;
}

function getAuthUser(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const tokenHash = hashToken(match[1]);
  const row = db.prepare(`
    SELECT users.*
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(tokenHash, nowIso());

  return row || null;
}

function requireUser(req, res) {
  const user = getAuthUser(req);
  if (!user) {
    jsonResponse(req, res, 401, { ok: false, message: "Please log in first." });
    return null;
  }
  return user;
}

async function handleRegister(req, res) {
  const body = await readJson(req);
  const name = String(body.name || "").trim().slice(0, 24);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");

  if (name.length < 2) return jsonResponse(req, res, 400, { ok: false, message: "Name is too short." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse(req, res, 400, { ok: false, message: "Please enter a valid email." });
  if (password.length < 8) return jsonResponse(req, res, 400, { ok: false, message: "Password must be at least 8 characters." });

  const existing = db.prepare("SELECT id, verified FROM users WHERE email = ?").get(email);
  if (existing && existing.verified) {
    return jsonResponse(req, res, 409, { ok: false, message: "This email already has an account. Please log in." });
  }

  const { salt, hash } = hashPassword(password);
  const id = existing?.id || randomBytes(16).toString("hex");

  db.prepare(`
    INSERT INTO users (id, email, name, password_hash, password_salt, verified, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?)
    ON CONFLICT(email) DO UPDATE SET
      name = excluded.name,
      password_hash = excluded.password_hash,
      password_salt = excluded.password_salt
  `).run(id, email, name, hash, salt, nowIso());

  const delivery = await saveVerificationCode(email, name);
  jsonResponse(req, res, 200, {
    ok: true,
    message: delivery.sent ? "SkinScope sent a verification code." : "SkinScope saved your verification code in the local outbox.",
    email,
    delivery
  });
}

async function handleVerify(req, res) {
  const body = await readJson(req);
  const email = normalizeEmail(body.email);
  const code = String(body.code || "").trim();
  const codeRow = db.prepare("SELECT * FROM email_codes WHERE email = ?").get(email);

  if (!codeRow || codeRow.expires_at <= nowIso()) {
    return jsonResponse(req, res, 400, { ok: false, message: "This code is expired. Request a new code." });
  }

  if (codeRow.attempts >= 5) {
    return jsonResponse(req, res, 429, { ok: false, message: "Too many code attempts. Request a new code." });
  }

  if (codeRow.code !== code) {
    db.prepare("UPDATE email_codes SET attempts = attempts + 1 WHERE email = ?").run(email);
    return jsonResponse(req, res, 400, { ok: false, message: "This code is wrong. Check the latest email." });
  }

  db.prepare("UPDATE users SET verified = 1 WHERE email = ?").run(email);
  db.prepare("DELETE FROM email_codes WHERE email = ?").run(email);

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  const token = createSession(user.id);

  db.prepare(`
    INSERT INTO subscriptions (user_id, plan, status, trial_ends_at)
    VALUES (?, 'trial', 'trialing', ?)
    ON CONFLICT(user_id) DO NOTHING
  `).run(user.id, addDays(7));

  jsonResponse(req, res, 200, { ok: true, token, user: publicUser(user), profile: publicProfile(user) });
}

async function handleLogin(req, res) {
  const body = await readJson(req);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

  if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
    return jsonResponse(req, res, 401, { ok: false, message: "Email or password is incorrect." });
  }

  if (!user.verified) {
    await saveVerificationCode(email, user.name);
    return jsonResponse(req, res, 403, { ok: false, code: "email_not_verified", message: "Enter the SkinScope code from your email to finish login." });
  }

  jsonResponse(req, res, 200, { ok: true, token: createSession(user.id), user: publicUser(user), profile: publicProfile(user) });
}

function handleMe(req, res) {
  const user = requireUser(req, res);
  if (!user) return;

  jsonResponse(req, res, 200, { ok: true, user: publicUser(user), profile: publicProfile(user) });
}

function handleSubscription(req, res) {
  const user = requireUser(req, res);
  if (!user) return;

  let subscription = db.prepare("SELECT plan, status, trial_ends_at FROM subscriptions WHERE user_id = ?").get(user.id);
  if (!subscription) {
    const trialEndsAt = addDays(7);
    db.prepare("INSERT INTO subscriptions (user_id, plan, status, trial_ends_at) VALUES (?, 'trial', 'trialing', ?)")
      .run(user.id, trialEndsAt);
    subscription = { plan: "trial", status: "trialing", trial_ends_at: trialEndsAt };
  }

  jsonResponse(req, res, 200, { ok: true, subscription });
}

async function handleAvatar(req, res) {
  const user = requireUser(req, res);
  if (!user) return;

  const body = await readJson(req);
  const avatar = String(body.avatar || "");
  if (avatar && !avatar.startsWith("data:image/")) {
    return jsonResponse(req, res, 400, { ok: false, message: "Please upload an image file." });
  }

  if (avatar.length > 6_500_000) {
    return jsonResponse(req, res, 413, { ok: false, message: "Profile picture is too large." });
  }

  db.prepare("UPDATE users SET avatar_data_url = ? WHERE id = ?").run(avatar, user.id);
  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
  jsonResponse(req, res, 200, { ok: true, profile: publicProfile(updated) });
}

async function handleResend(req, res) {
  const body = await readJson(req);
  const email = normalizeEmail(body.email);
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

  if (!user) return jsonResponse(req, res, 404, { ok: false, message: "Create an account first." });
  if (user.verified) return jsonResponse(req, res, 200, { ok: true, message: "This account is already verified." });

  const delivery = await saveVerificationCode(email, user.name);
  jsonResponse(req, res, 200, {
    ok: true,
    message: delivery.sent ? "A new SkinScope code was sent." : "A new SkinScope code was saved in the local outbox.",
    delivery
  });
}

async function handleTrial(req, res) {
  const user = requireUser(req, res);
  if (!user) return;

  const body = await readJson(req);
  const trialEndsAt = String(body.trial_ends_at || addDays(7));
  const status = String(body.status || "trialing").slice(0, 32);
  const referrerCode = String(body.referrer_code || "").slice(0, 80);

  db.prepare(`
    INSERT INTO subscriptions (user_id, plan, status, trial_ends_at)
    VALUES (?, 'trial', ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET status = excluded.status, trial_ends_at = excluded.trial_ends_at
  `).run(user.id, status, trialEndsAt);

  db.prepare("INSERT INTO referrals (id, user_id, email, referrer_code, status, trial_ends_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(randomBytes(16).toString("hex"), user.id, user.email, referrerCode, status, trialEndsAt, nowIso());

  jsonResponse(req, res, 200, { ok: true });
}

async function handleLogout(req, res) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (match) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(match[1]));
  jsonResponse(req, res, 200, { ok: true });
}

function handleOutbox(req, res) {
  if (!DEV_OUTBOX_ENABLED) {
    return jsonResponse(req, res, 404, { ok: false, message: "Dev outbox is disabled." });
  }

  let outbox = [];
  try {
    outbox = JSON.parse(readFileSync(OUTBOX_PATH, "utf8"));
  } catch (error) {
    outbox = [];
  }

  jsonResponse(req, res, 200, { ok: true, outbox });
}

function handleHealth(req, res) {
  const users = db.prepare("SELECT count(*) AS count FROM users").get().count;
  jsonResponse(req, res, 200, {
    ok: true,
    service: "skinscope-server",
    database: "sqlite",
    users,
    time: nowIso()
  });
}

const handleJourney = createJourneyRouter({ db, getAuthUser, jsonResponse, readJson });

const routes = {
  "GET /api/health": handleHealth,
  "POST /api/register": handleRegister,
  "POST /api/login": handleLogin,
  "POST /api/verify": handleVerify,
  "POST /api/resend-code": handleResend,
  "POST /api/logout": handleLogout,
  "POST /api/profile/avatar": handleAvatar,
  "POST /api/trial": handleTrial,
  "GET /api/me": handleMe,
  "GET /api/subscription": handleSubscription,
  "GET /api/dev/outbox": handleOutbox
};

const server = await import("node:http").then(({ createServer }) =>
  createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      return jsonResponse(req, res, 204, {});
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/journey/")) return handleJourney(req, res, url);
    const route = routes[`${req.method} ${url.pathname}`];

    if (!route) {
      return jsonResponse(req, res, 404, { ok: false, message: "SkinScope API route not found." });
    }

    try {
      await route(req, res);
    } catch (error) {
      console.error(error);
      jsonResponse(req, res, 500, { ok: false, message: error.message || "SkinScope server error." });
    }
  })
);

server.listen(PORT, () => {
  console.log(`SkinScope server running on http://127.0.0.1:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
  console.log(`Email outbox: ${OUTBOX_PATH}`);
});
