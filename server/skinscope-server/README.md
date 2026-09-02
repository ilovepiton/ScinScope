# SkinScope Server

This is SkinScope's own local backend. It does not use Supabase.

It stores:

- accounts
- password hashes
- email verification codes
- login sessions
- profile pictures
- trial/subscription status
- referral trial records

## Run

```sh
cd server/skinscope-server
npm start
```

The API starts on:

```text
http://127.0.0.1:8787
```

The SQLite database is created at:

```text
server/skinscope-server/data/skinscope.sqlite
```

Verification emails are currently written to:

```text
server/skinscope-server/data/email-outbox.json
```

The code is also printed in the server terminal. Real email delivery can be added later with SMTP credentials.
