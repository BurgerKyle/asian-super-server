# Asian Super Server — Deadlock

Discord bot for **Asia queue nights**: live lobby board, queue-time pings, and a community leaderboard.

Runs as a background Node process on the shop kiosk hosting box (same NSSM pattern as WinFactory / Il Porto Sicuro). Kids never interact with it — it only talks outbound to Discord + [deadlock-api](https://api.deadlock-api.com).

## What it does

| Feature | How |
|---------|-----|
| **Live lobbies** | Every ~15s polls `GET /v1/matches/active?account_ids=…` for the roster and edits one Discord message |
| **Queue nights** | Posts reminders (T-15 / T-0) with the Asia Super Server label |
| **Leaderboard** | Periodically scores rostered players from match history and edits a pinned message |
| **Slash commands** | `/link`, `/unlink`, `/roster`, `/schedule`, `/queuecall` |

Deadlock API client patterns (headers, optional Bearer key, 429 backoff) are adapted from the WinFactory codebase, but this repo is standalone.

## Quick start (dev machine)

```bash
cd F:\Coding\asian-super-server
npm install
copy .env.example .env
# fill DISCORD_* and CHANNEL_* — see SETUP.md
npm run register-commands
npm start
```

## Docs

- **[SETUP.md](./SETUP.md)** — fresh-start plan from “I only have a Discord account + server” through kiosk NSSM install
- **`deploy/install-kiosk-service.ps1`** — one-time service registration on the hosting box

## Layout

```
src/
  index.js              bot entry + poll loops
  deadlock/client.js    API client
  jobs/                 lobbyBoard, queueNotify, leaderboard
  commands/             slash command handlers + registrar
  store/                roster / schedule / scores JSON
data/                   runtime JSON (gitignored except examples)
deploy/                 NSSM install scripts
```
