# ScinScope

AI skincare app with its own local SkinScope backend.

## Run With SkinScope Database

Start the backend database server manually:

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

## Keep The Server Running On This Mac

Install the macOS LaunchAgent:

```sh
./server/skinscope-server/install-launch-agent.sh
```

Check it:

```sh
launchctl print gui/$(id -u)/com.skinscope.server
curl http://127.0.0.1:8787/api/health
```

This keeps SkinScope running while this Mac is awake and logged in. For true public 24/7 access, deploy `server/skinscope-server` to a VPS or app host and set `SKINSCOPE_API_URL` in `js/skinscope-api-config.js` to that public API URL.
