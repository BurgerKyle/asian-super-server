# SETUP ù Fresh start

Follow these plans **in order**.

**Discord-only steps (detailed):** see **[DISCORD-SETUP.md](./DISCORD-SETUP.md)** ù every click from ùI have a Discord accountù through bot invite, channels, roles, and copying IDs.

| Plan | Where | What |
|------|--------|------|
| AùB | Discord | Create bot app, invite, channels, roles, copy IDs ? [DISCORD-SETUP.md](./DISCORD-SETUP.md) |
| C | This PC | `.env`, register slash commands, `npm start`, smoke test |
| D | Kiosk | Clone to `C:\Apps\`, NSSM service |
| E | Ongoing | Queue-night ops |

---

## Plan A + B ù Discord

Do **all** of [DISCORD-SETUP.md](./DISCORD-SETUP.md) sections 0ù13.

When finished you should have a filled notepad / `.env` with:

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
CHANNEL_LIVE_LOBBIES=
CHANNEL_LEADERBOARD=
CHANNEL_QUEUE_NIGHTS=
QUEUE_PING_ROLE_ID=
DEFAULT_SERVER_LABEL=Asia Super Server
```

---

## Plan C ù Run on this dev PC (prove it works)

### C1. Install and configure

```powershell
cd F:\Coding\asian-super-server
npm install
copy .env.example .env
notepad .env
```

Paste the values from Discord setup. `DEADLOCK_API_KEY` is optional.

**Steam presence / ìwho is queuingî board** (optional but recommended):

1. Open [https://steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey) while logged into Steam  
2. Register a key (domain can be `localhost` or `winfactory.pro`)  
3. Add to `.env`: `STEAM_API_KEY=...`  
4. Tell players: Steam profile ? **Privacy** ? Game details = **Public** (otherwise the bot canít see Deadlock / Finding Match)  
5. The board posts in `#queue-nights` (or `CHANNEL_PRESENCE` if set) and updates every ~20s

### C2. Register slash commands (talks to Discordùs API)

```powershell
npm run register-commands
```

You should see: `Done. Slash commands should appear in Discord within a minute.`

This uploads `/link`, `/unlink`, `/roster`, `/mystats`, `/schedule`, `/queuecall` to **your server only** (guild commands ù instant).

### C3. Start the bot

```powershell
npm start
```

Expect: `[boot] Asian Super Server online as ù`

Then in Discord (details in DISCORD-SETUP ù11):

1. Confirm the bot is **online** in the member list.
2. Type `/` and confirm Asian Super Server commands appear.
3. Run `/link steam_id:<your Steam32 or Steam64>`.
4. Check `#live-lobbies` for a pinned board (~15s).
5. As admin: `/schedule set` then `/queuecall` to test `#queue-nights`.

### C4. Find your Steam32

- Search your name on [https://deadlock-api.com](https://deadlock-api.com)
- Or: `steam32 = steam64 - 76561197960265728`
- Dotabuff / OpenDota profile URLs also expose the 32-bit id

---

## Plan D ù Deploy to the kiosk hosting box

Same ops model as WinFactory: code under `C:\Apps\`, NSSM service, auto-start, crash restart, no visible window.

### D1. On the kiosk (Admin PowerShell)

Prereqs (you likely already have these from IPS/WinFactory):

- Node.js 18+ on PATH
- NSSM on PATH (`winget install NSSM.NSSM` if needed)
- Git (optional; or copy the folder from this PC)

```powershell
mkdir C:\Apps -Force
cd C:\Apps
git clone https://github.com/BurgerKyle/asian-super-server.git asian-super-server
cd C:\Apps\asian-super-server
npm install --omit=dev
copy .env.example .env
notepad .env
```

Paste the **same** `.env` values you used on the dev PC (token + channel IDs).

Register commands once from the kiosk (or from any machine with that `.env`):

```powershell
npm run register-commands
```

### D2. Install the Windows service

```powershell
cd C:\Apps\asian-super-server
powershell -ExecutionPolicy Bypass -File .\deploy\install-kiosk-service.ps1
```

Check:

```powershell
nssm status asian-super-server
Get-Content C:\Apps\asian-super-server\logs\asian-super-server.out.log -Tail 30
```

### D3. Day-2 updates

```powershell
cd C:\Apps\asian-super-server
git pull
npm install --omit=dev
nssm restart asian-super-server
```

If you added new slash commands:

```powershell
npm run register-commands
nssm restart asian-super-server
```

### D4. Uninstall (if needed)

```powershell
powershell -ExecutionPolicy Bypass -File C:\Apps\asian-super-server\deploy\uninstall-kiosk-service.ps1
```

---

## Plan E ù Operating queue nights

1. Players run `/link` once (optional stream URL for lobby board).
2. Admin runs `/schedule set hour:21 minute:0 days:5,6 timezone:Asia/Manila server:Asia Super Server`
3. Bot auto-pings `#queue-nights` at T-15 and T-0.
4. `#live-lobbies` shows who is in games + stream links so others can wait or watch.
5. `#leaderboard` updates from recent match history for rostered players.

Manual override anytime: `/queuecall note:Stack on Asia now`

---

## Checklist

**Discord** (see [DISCORD-SETUP.md](./DISCORD-SETUP.md) ù13 for the full list):

- [ ] Server ready + Developer Mode on
- [ ] Application + bot created; token saved in `.env` only
- [ ] Bot invited (`bot` + `applications.commands`)
- [ ] Channels + Queue Night role + all IDs in `.env`

**Runtime:**

- [ ] `npm run register-commands` succeeded
- [ ] `npm start` shows online
- [ ] `/link` works for you
- [ ] Kiosk: `C:\Apps\asian-super-server` + NSSM service running

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Slash commands missing | Re-run `npm run register-commands`; wait ~1 min; check bot is in the server; confirm `DISCORD_GUILD_ID` |
| `Missing required env var` | Fill `.env`; restart process |
| Lobby board never updates | Need at least one `/link`; player must be in an **active** match visible to the API watch tab |
| 401/403 from Discord | Reset bot token; update `.env`; restart |
| Bot cannot send / pin | Channel permissions ù see DISCORD-SETUP ù8 |
| Role ping does nothing | Role mentionable? Correct `QUEUE_PING_ROLE_ID`? Bot role above Queue Night? |
| Service will not start on kiosk | Check `logs\*.err.log`; confirm Node path; confirm `.env` exists under `C:\Apps\asian-super-server` |
| Rate limit (429) | Bot backs off automatically; increase `LOBBY_POLL_MS` if needed |
