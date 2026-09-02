# ScinScope

AI skincare app with its own local SkinScope backend.

## Run With SkinScope Database

Start the backend database server:

```sh
cd server/skinscope-server
npm start
```

In another terminal, start the site:

```sh
cd ../..
python3 -m http.server 8766
```

Open:

```text
http://127.0.0.1:8766/ScinScope/pages/account.html
```

Verification codes are saved in:

```text
server/skinscope-server/data/email-outbox.json
```

The server also prints each code in the terminal.
