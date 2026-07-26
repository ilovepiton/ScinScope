# SkinScope Email Verification Worker

This is SkinScope's own email-code verification service. It does not use Supabase email templates or GitHub email.

## What It Does

- `POST /verification/start` validates an email, creates a 6-digit code, stores only a hashed version, and sends the code by email.
- `POST /verification/confirm` checks the code, expires it after use, and returns a short verification result.
- Codes expire after 10 minutes.
- Resends are rate-limited.
- Confirmation attempts are capped.

## Required Runtime Secrets

- `RESEND_API_KEY`: API key from Resend or a compatible mail-sending account.
- `VERIFY_SECRET`: long random secret used to hash verification codes.
- `VERIFY_CODES`: Cloudflare KV namespace binding.

## Frontend Switch

After deploying the worker, set this in `js/custom-verification-config.js`:

```js
const SKINSCOPE_VERIFY_ENDPOINT = "https://your-worker.your-subdomain.workers.dev";
```

Until that value is set, the GitHub Pages frontend keeps using the current Supabase fallback so the site does not call a missing server.

## Cloudflare Deploy Outline

1. Copy `wrangler.toml.example` to `wrangler.toml`.
2. Create a KV namespace and place its id in `wrangler.toml`.
3. Set secrets:

```sh
wrangler secret put RESEND_API_KEY
wrangler secret put VERIFY_SECRET
```

4. Deploy:

```sh
wrangler deploy
```
