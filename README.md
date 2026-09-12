# Asian Super Server — Deadlock

Discord bot for **Asia queue nights**: live lobby board, queue-time pings, and a community leaderboard.

Runs as a background Node process on the shop kiosk hosting box (same NSSM pattern as WinFactory / Il Porto Sicuro). Kids never interact with it — it only talks outbound to Discord + [deadlock-api](https://api.deadlock-api.com).

## What it does

| Feature | How |
|---------|-----|
| **Live lobbies** | Every ~15s polls `GET /v1/matches/active?account_ids=...` for the roster and edits one Discord message |
| **Queue nights** | Posts reminders (T-15 / T-0) with the Asia Super Server label |
| **Leaderboard** | Periodically scores rostered players from match history and edits a pinned message |
| **Presence board** | Steam + Deadlock "who's around" with queue/match timers |
| **Slash commands** | `/link`, `/unlink`, `/track`, `/untrack`, `/roster`, `/mystats`, `/schedule`, `/queuecall` |

Deadlock API client patterns (headers, optional Bearer key, 429 backoff) are adapted from the WinFactory codebase, but this repo is standalone.

## Quick start (dev machine)

```bash
cd F:\Coding\asian-super-server
npm install
copy .env.example .env
# fill DISCORD_* and CHANNEL_* — see DISCORD-SETUP.md then SETUP.md
npm run register-commands
npm start
```

## Checks

```bash
npm run check   # syntax + unit tests
npm test
npm run smoke   # offline embed/command smoke (no Discord token needed)
```

After pulling command permission changes (e.g. `/track` admin-only), re-run `npm run register-commands`.

## Docs

- **[DISCORD-SETUP.md](./DISCORD-SETUP.md)** — every Discord step (account ? server ? bot app ? invite ? channels ? roles ? IDs)
- **[SETUP.md](./SETUP.md)** — full path from Discord through local smoke test and kiosk NSSM install
- **`deploy/install-kiosk-service.ps1`** — one-time service registration on the hosting box

## Layout

```
src/
  index.js              bot entry + poll loops
  util/                 steam id + sanitize helpers
  deadlock/             API client, Steam presence, heroes
  jobs/                 lobbyBoard, queueNotify, leaderboard, presenceBoard
  commands/             slash command handlers + registrar
  store/                roster / schedule / scores JSON
data/                   runtime JSON (gitignored except examples)
deploy/                 NSSM install scripts
test/                   node:test unit tests
```
