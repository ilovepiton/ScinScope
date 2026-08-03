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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function requireEnvironment(env) {
  const missing = [];

  if (!env.VERIFY_CODES) missing.push("VERIFY_CODES");
  if (!env.VERIFY_SECRET) missing.push("VERIFY_SECRET");
  if (!env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (!env.FROM_EMAIL) missing.push("FROM_EMAIL");

  return missing;
}

async function sendEmail(env, email, code, name = "") {
  const appName = escapeHtml(env.APP_NAME || "SkinScope");
  const safeEmail = escapeHtml(email);
  const safeName = escapeHtml(name);
  const greeting = safeName ? `Hi ${safeName},` : "Hi,";
  const spacedCode = code.split("").join(" ");
  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="color-scheme" content="light dark">
        <meta name="supported-color-schemes" content="light dark">
        <title>${appName} verification code</title>
      </head>
      <body style="margin:0; padding:0; background:#f6f3ef;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%; min-width:100%; background:linear-gradient(135deg,#f6f3ef 0%,#e9f4ef 48%,#f7e1d6 100%);">
          <tr>
            <td align="center" style="padding:32px 14px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%; max-width:620px; border-collapse:separate;">
                <tr>
                  <td style="padding:0 0 16px;">
                    <div style="font-family:Arial,Helvetica,sans-serif; color:#111827; font-size:24px; line-height:1.1; font-weight:900; letter-spacing:0;">${appName}</div>
                  </td>
                </tr>
                <tr>
                  <td style="background:rgba(255,255,255,0.72); background-color:#ffffff; border:1px solid rgba(255,255,255,0.78); border-radius:28px; box-shadow:0 24px 70px rgba(17,24,39,0.12); overflow:hidden;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding:34px 30px 26px; font-family:Arial,Helvetica,sans-serif; color:#111827;">
                          <div style="display:inline-block; padding:8px 14px; border-radius:999px; background:#e7f8ef; color:#16834a; font-size:13px; font-weight:900;">Secure sign-in</div>
                          <h1 style="margin:18px 0 12px; color:#111827; font-family:Arial,Helvetica,sans-serif; font-size:34px; line-height:1.08; font-weight:900; letter-spacing:0;">Your ${appName} code</h1>
                          <p style="margin:0 0 18px; color:#374151; font-size:16px; line-height:1.55; font-weight:700;">${greeting} we received a request to sign in to ${appName} with <span style="color:#111827;">${safeEmail}</span>. Enter the code below to continue.</p>

                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;">
                            <tr>
                              <td align="center" style="padding:24px 12px; border-radius:24px; background:linear-gradient(135deg,#111827 0%,#1f2937 100%); background-color:#111827;">
                                <div style="font-family:Arial,Helvetica,sans-serif; color:#ffffff; font-size:42px; line-height:1; font-weight:900; letter-spacing:10px; text-align:center;">${spacedCode}</div>
                              </td>
                            </tr>
                          </table>

                          <p style="margin:0; color:#4b5563; font-size:14px; line-height:1.55; font-weight:700;">This code expires in 10 minutes. Use it only if you requested this sign-in. ${appName} will never ask you to share your verification code.</p>

                          <div style="height:1px; background:#e5e7eb; margin:26px 0;"></div>

                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7fbf8; border:1px solid #e4f3ea; border-radius:20px;">
                            <tr>
                              <td style="padding:18px 18px 16px;">
                                <p style="margin:0 0 6px; color:#111827; font-size:15px; line-height:1.35; font-weight:900;">A more complete SkinScope experience</p>
                                <p style="margin:0; color:#4b5563; font-size:13px; line-height:1.5; font-weight:700;">Advanced insights and additional features can help make your skin tracking feel clearer and more personal.</p>
                              </td>
                            </tr>
                          </table>

                          <p style="margin:22px 0 0; color:#6b7280; font-size:12px; line-height:1.5; font-weight:700;">If you did not request this email, you can ignore it. No changes will be made unless the code is entered in ${appName}.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
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
      text: `${greeting}\n\nWe received a request to sign in to ${appName} with ${email}.\n\nYour verification code is: ${code}\n\nThis code expires in 10 minutes. Use it only if you requested this sign-in. ${appName} will never ask you to share your verification code.\n\nIf you did not request this email, you can ignore it.`
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

  await sendEmail(env, email, code, name);

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
