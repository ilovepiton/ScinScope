const CODE_LENGTH = 6;
const CODE_TTL_SECONDS = 10 * 60;
const RESEND_COOLDOWN_SECONDS = 30;
const MAX_CONFIRM_ATTEMPTS = 5;

function getCorsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigins = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function jsonResponse(request, env, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(request, env),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function makeCode() {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 10 ** CODE_LENGTH).padStart(CODE_LENGTH, "0");
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(secret, value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toHex(signature);
}

function getClientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (error) {
    return {};
  }
}

function requireEnvironment(env) {
  const missing = [];

  if (!env.VERIFY_CODES) missing.push("VERIFY_CODES");
  if (!env.VERIFY_SECRET) missing.push("VERIFY_SECRET");
  if (!env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (!env.FROM_EMAIL) missing.push("FROM_EMAIL");

  return missing;
}

async function sendEmail(env, email, code) {
  const appName = env.APP_NAME || "SkinScope";
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h1 style="margin: 0 0 12px;">${appName} verification code</h1>
      <p>Your verification code is:</p>
      <p style="font-size: 32px; font-weight: 800; letter-spacing: 8px; margin: 20px 0;">${code}</p>
      <p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: [email],
      subject: `${appName} verification code`,
      html,
      text: `Your ${appName} verification code is ${code}. It expires in 10 minutes.`
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Email provider rejected the message.");
  }
}

async function startVerification(request, env) {
  const missing = requireEnvironment(env);
  if (missing.length) {
    return jsonResponse(
      request,
      env,
      {
        ok: false,
        message: `Verification server is missing: ${missing.join(", ")}.`
      },
      503
    );
  }

  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const name = String(body.name || "").trim().slice(0, 80);

  if (!isValidEmail(email)) {
    return jsonResponse(request, env, { ok: false, message: "Please enter a valid email." }, 400);
  }

  const ip = getClientIp(request);
  const emailCooldownKey = `cooldown:email:${email}`;
  const ipCooldownKey = `cooldown:ip:${ip}`;
  const emailCooldown = await env.VERIFY_CODES.get(emailCooldownKey);
  const ipCooldown = await env.VERIFY_CODES.get(ipCooldownKey);

  if (emailCooldown || ipCooldown) {
    return jsonResponse(
      request,
      env,
      {
        ok: false,
        message: "Please wait before requesting another code.",
        cooldownSeconds: RESEND_COOLDOWN_SECONDS
      },
      429
    );
  }

  const code = makeCode();
  const codeHash = await hmacHex(env.VERIFY_SECRET, `${email}:${code}`);
  const now = Date.now();

  await env.VERIFY_CODES.put(
    `code:${email}`,
    JSON.stringify({
      codeHash,
      name,
      attempts: 0,
      createdAt: now,
      expiresAt: now + CODE_TTL_SECONDS * 1000
    }),
    { expirationTtl: CODE_TTL_SECONDS }
  );

  await env.VERIFY_CODES.put(emailCooldownKey, "1", { expirationTtl: RESEND_COOLDOWN_SECONDS });
  await env.VERIFY_CODES.put(ipCooldownKey, "1", { expirationTtl: RESEND_COOLDOWN_SECONDS });

  await sendEmail(env, email, code);

  return jsonResponse(request, env, {
    ok: true,
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
    expiresInSeconds: CODE_TTL_SECONDS
  });
}

async function confirmVerification(request, env) {
  if (!env.VERIFY_CODES || !env.VERIFY_SECRET) {
    return jsonResponse(request, env, { ok: false, message: "Verification server is not configured." }, 503);
  }

  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const code = String(body.code || "").replace(/\D/g, "");

  if (!isValidEmail(email) || code.length !== CODE_LENGTH) {
    return jsonResponse(request, env, { ok: false, message: "Invalid verification code." }, 400);
  }

  const key = `code:${email}`;
  const raw = await env.VERIFY_CODES.get(key);

  if (!raw) {
    return jsonResponse(request, env, { ok: false, message: "This code is expired. Request a new one." }, 400);
  }

  const record = JSON.parse(raw);

  if (Date.now() > record.expiresAt) {
    await env.VERIFY_CODES.delete(key);
    return jsonResponse(request, env, { ok: false, message: "This code is expired. Request a new one." }, 400);
  }

  if (record.attempts >= MAX_CONFIRM_ATTEMPTS) {
    await env.VERIFY_CODES.delete(key);
    return jsonResponse(request, env, { ok: false, message: "Too many attempts. Request a new code." }, 429);
  }

  const codeHash = await hmacHex(env.VERIFY_SECRET, `${email}:${code}`);

  if (codeHash !== record.codeHash) {
    record.attempts += 1;
    await env.VERIFY_CODES.put(key, JSON.stringify(record), { expirationTtl: CODE_TTL_SECONDS });
    return jsonResponse(request, env, { ok: false, message: "That code is not correct." }, 400);
  }

  await env.VERIFY_CODES.delete(key);

  const verifiedAt = new Date().toISOString();
  const verificationToken = await hmacHex(env.VERIFY_SECRET, `${email}:${verifiedAt}`);

  return jsonResponse(request, env, {
    ok: true,
    verifiedAt,
    verificationToken
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request, env)
      });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse(request, env, { ok: true, service: "skinscope-verification" });
    }

    if (request.method !== "POST") {
      return jsonResponse(request, env, { ok: false, message: "Method not allowed." }, 405);
    }

    try {
      if (url.pathname === "/verification/start") {
        return startVerification(request, env);
      }

      if (url.pathname === "/verification/confirm") {
        return confirmVerification(request, env);
      }

      return jsonResponse(request, env, { ok: false, message: "Not found." }, 404);
    } catch (error) {
      return jsonResponse(
        request,
        env,
        {
          ok: false,
          message: "Verification service failed to send the email.",
          detail: String(error && error.message ? error.message : error)
        },
        502
      );
    }
  }
};
