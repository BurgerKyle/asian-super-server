# SETUP — Fresh start (Discord account + server only)

Follow these plans **in order**. When you finish Plan A on any machine with Node, you can run the bot locally. Plan D is for the kiosk hosting box (`C:\Apps\…` + NSSM), same pattern as WinFactory.

---

## Plan A — Create the Discord bot application

Do this in a browser while logged into Discord.

### A1. Open the developer portal

1. Go to [https://discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **New Application**
3. Name it: `Asian Super Server`
4. Accept the ToS ? **Create**

### A2. Copy IDs you’ll need

On the app’s **General Information** page:

| Field | Where | Save as |
|-------|--------|---------|
| Application ID | “Application ID” ? Copy | `DISCORD_CLIENT_ID` |

### A3. Create the bot user + token

1. Left sidebar ? **Bot**
2. Click **Add Bot** ? **Yes**
3. Under **Privileged Gateway Intents**: leave them **off** (this bot only needs Guilds)
4. Click **Reset Token** ? **Yes** ? **Copy**  
   ? save as `DISCORD_TOKEN`  
   **Never commit this. Never paste it in Discord chat.**

Optional: set bot avatar / username to “Asian Super Server”.

### A4. Invite the bot to your server

1. Left sidebar ? **OAuth2** ? **URL Generator**
2. **Scopes:** check `bot` and `applications.commands`
3. **Bot Permissions:** check:
   - View Channels
   - Send Messages
   - Embed Links
   - Manage Messages (for editing/pinning the lobby + leaderboard posts)
   - Mention Everyone *(only if you will ping @everyone; prefer a role instead)*
4. Copy the generated URL at the bottom ? open it ? pick your server ? **Authorize**

### A5. Enable Developer Mode (for copying IDs)

In Discord desktop/web:

1. User Settings ? **App Settings** ? **Advanced**
2. Turn on **Developer Mode**

Then:

| What | How | Env var |
|------|-----|---------|
| Server ID | Right-click server icon ? **Copy Server ID** | `DISCORD_GUILD_ID` |
| Channel ID | Right-click channel ? **Copy Channel ID** | `CHANNEL_*` |
| Role ID | Right-click role ? **Copy Role ID** | `QUEUE_PING_ROLE_ID` |

---

## Plan B — Prepare the Discord server

### B1. Create channels

Create a category e.g. `ASIAN SUPER SERVER`, then:

| Channel | Purpose | Env var |
|---------|---------|---------|
| `#live-lobbies` | Bot edits one pinned embed of active games | `CHANNEL_LIVE_LOBBIES` |
| `#leaderboard` | Bot edits one pinned leaderboard embed | `CHANNEL_LEADERBOARD` |
| `#queue-nights` | Queue reminders + `/queuecall` | `CHANNEL_QUEUE_NIGHTS` |

### B2. Create a ping role (recommended)

1. Server Settings ? Roles ? create `Queue Night`
2. Let members self-assign (Reaction Roles / just assign manually), **or** keep it admin-only
3. Copy Role ID ? `QUEUE_PING_ROLE_ID`
4. In channel `#queue-nights` permissions, allow the bot to mention that role

### B3. Channel permissions for the bot

Ensure the bot role can: View, Send, Embed Links, Manage Messages, Add Reactions (optional) in those three channels.

---

## Plan C — Run on this dev PC (prove it works)

### C1. Clone / open the repo

```powershell
cd F:\Coding\asian-super-server
npm install
copy .env.example .env
notepad .env
```

Fill at minimum:

```env
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_GUILD_ID=...
CHANNEL_LIVE_LOBBIES=...
CHANNEL_LEADERBOARD=...
CHANNEL_QUEUE_NIGHTS=...
QUEUE_PING_ROLE_ID=...
DEFAULT_SERVER_LABEL=Asia Super Server
```

`DEADLOCK_API_KEY` is optional (public active-match endpoint usually works without it).

### C2. Register slash commands

```powershell
npm run register-commands
```

You should see: `Done. Slash commands should appear…`

### C3. Start the bot

```powershell
npm start
```

Expect: `[boot] Asian Super Server online as …`

In Discord:

1. Run `/link steam_id:<your Steam32>` (or Steam64)
2. Watch `#live-lobbies` get a pinned board (empty until someone on the roster is in a match)
3. Run `/schedule set` as an admin for your queue nights
4. Run `/queuecall` to test pings

### C4. Find your Steam32

- Search your name on [https://deadlock-api.com](https://deadlock-api.com) / player pages  
- Or convert Steam64 ? Steam32: `steam32 = steam64 - 76561197960265728`  
- Dotabuff / OpenDota profile URLs also expose the 32-bit id

---

## Plan D — Deploy to the kiosk hosting box

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

## Plan E — Operating queue nights

1. Players run `/link` once (optional stream URL for lobby board).
2. Admin runs `/schedule set hour:21 minute:0 days:5,6 timezone:Asia/Manila server:Asia Super Server`
3. Bot auto-pings `#queue-nights` at T-15 and T-0.
4. `#live-lobbies` shows who is in games + stream links ? others can wait or watch.
5. `#leaderboard` updates from recent match history for rostered players.

Manual override anytime: `/queuecall note:Stack on Asia now`

---

## Checklist (print / keep)

- [ ] Discord application created  
- [ ] Bot token saved in `.env` only  
- [ ] Bot invited with `bot` + `applications.commands`  
- [ ] `#live-lobbies`, `#leaderboard`, `#queue-nights` created  
- [ ] Channel + guild IDs in `.env`  
- [ ] `npm run register-commands` succeeded  
- [ ] `npm start` shows online  
- [ ] `/link` works for you  
- [ ] Kiosk: cloned to `C:\Apps\asian-super-server`  
- [ ] Kiosk: NSSM service `asian-super-server` running  

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Slash commands missing | Re-run `npm run register-commands`; wait ~1 min; check bot is in the server |
| `Missing required env var` | Fill `.env`; restart process |
| Lobby board never updates | Need at least one `/link`; player must be in an **active** match visible to the API watch tab |
| 401/403 from Discord | Reset bot token; update `.env`; restart |
| Service won’t start on kiosk | Check `logs\*.err.log`; confirm Node path; confirm `.env` exists under `C:\Apps\asian-super-server` |
| Rate limit (429) | Bot backs off automatically; increase `LOBBY_POLL_MS` if needed |
