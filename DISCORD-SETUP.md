# Discord setup — every step

This guide assumes you only have a **Discord account**. It walks through creating a server (if needed), creating the bot application, inviting it, building channels/roles, and copying every ID the `.env` file needs.

Keep a notepad open. You will collect these values:

```
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
CHANNEL_LIVE_LOBBIES=
CHANNEL_LEADERBOARD=
CHANNEL_QUEUE_NIGHTS=
QUEUE_PING_ROLE_ID=
```

---

## 0. Log into Discord

1. Open [https://discord.com/app](https://discord.com/app) (browser) **or** the Discord desktop app.
2. Sign in with the account that will **own** the Asian Super Server community.
3. Stay logged in — the Developer Portal uses the same login.

---

## 1. Create a Discord server (skip if you already have one)

1. In Discord, look at the left sidebar (server list).
2. Click the **+** button (Add a Server).
3. Choose **Create My Own**.
4. Choose **For a club or community** (or Skip — either is fine).
5. Server name: `Asian Super Server` (or whatever you prefer).
6. Optional: upload an icon.
7. Click **Create**.
8. You should land inside the new server with default channels like `#general`.

You are now the server owner. That is enough permission for everything below.

---

## 2. Turn on Developer Mode (required to copy IDs)

### Discord desktop / browser

1. Click your **user avatar** (bottom-left) ? **User Settings** (gear icon).
2. In the left settings list, scroll to **App Settings**.
3. Click **Advanced**.
4. Toggle **Developer Mode** **ON**.
5. Close settings (X).

You can now right-click almost anything ? **Copy … ID**.

---

## 3. Copy your Server ID

1. In the left server list, **right-click** the Asian Super Server icon.
2. Click **Copy Server ID**.
3. Paste into notepad as:

```
DISCORD_GUILD_ID=1234567890123456789
```

(Your number will be different — that is fine.)

---

## 4. Create the bot application (Developer Portal)

Do this in a **browser** while logged into the same Discord account.

### 4.1 Open the portal

1. Go to [https://discord.com/developers/applications](https://discord.com/developers/applications)
2. If prompted, authorize / log in with Discord.

### 4.2 Create the application

1. Click the blue **New Application** button (top-right).
2. **Name:** `Asian Super Server`
3. Check the box to agree to the Developer Terms of Service.
4. Click **Create**.
5. You should now see the app dashboard (**General Information**).

### 4.3 Copy the Application (Client) ID

Still on **General Information**:

1. Find **Application ID**.
2. Click **Copy**.
3. Paste into notepad:

```
DISCORD_CLIENT_ID=1234567890123456789
```

Optional on this page:

- **Description:** `Deadlock Asia queue nights — live lobbies, queue pings, leaderboard.`
- **App Icon / Cover Image:** upload a logo if you want.
- Click **Save Changes** if you edit anything.

### 4.4 Create the Bot user

1. Left sidebar ? click **Bot**.
2. If you see **Add Bot**, click it ? confirm **Yes, do it!**
3. (Newer portals sometimes create the bot automatically — if you already see a bot username and token controls, you are done with this step.)

### 4.5 Set the bot username / avatar (optional but nice)

On the **Bot** page:

1. **Username:** `Asian Super Server` (may need to be unique; Discord can append numbers).
2. **Icon:** upload an image.
3. Click **Save Changes**.

### 4.6 Privileged Gateway Intents

Still on **Bot**, scroll to **Privileged Gateway Intents**.

Leave **all three OFF** for this project:

- [ ] Presence Intent
- [ ] Server Members Intent
- [ ] Message Content Intent

This bot only uses slash commands + posting/editing embeds. It does not need those privileged intents.

Click **Save Changes** if Discord shows a save button after toggles.

### 4.7 Create and copy the bot token

Still on **Bot**:

1. Under **Token**, click **Reset Token** (or **View Token** if you have never reset).
2. Confirm with password / 2FA if asked.
3. Click **Copy** immediately.
4. Paste into notepad:

```
DISCORD_TOKEN=paste.the.long.token.here
```

**Security rules:**

- Treat this like a password.
- Never paste it into a Discord channel, GitHub issue, or screenshot.
- Never commit `.env` to git (already gitignored).
- If it ever leaks: return here ? **Reset Token** ? update `.env` ? restart the bot.

---

## 5. Invite the bot into your server

Still in the Developer Portal.

### 5.1 Build the invite URL

1. Left sidebar ? **OAuth2**.
2. Click **URL Generator** (under OAuth2).
3. Under **Scopes**, check exactly these two:

   - [x] `bot`
   - [x] `applications.commands`

4. A **Bot Permissions** panel appears. Check:

   | Permission | Why |
   |------------|-----|
   | [x] **View Channels** | See your channels |
   | [x] **Send Messages** | Post lobby / leaderboard / queue embeds |
   | [x] **Embed Links** | Rich embeds |
   | [x] **Manage Messages** | Edit + pin the live board messages |
   | [x] **Read Message History** | Fetch old message IDs if needed |
   | [x] **Mention @everyone, @here, and All Roles** | Only needed if you ping a role from the bot |

   Do **not** grant Administrator unless you knowingly want that.

5. Scroll to **Generated URL** at the bottom.
6. Click **Copy**.

### 5.2 Authorize in Discord

1. Paste the URL into a new browser tab and open it.
2. Under **Add to Server**, select your **Asian Super Server** server.
3. Click **Continue**.
4. Review permissions ? click **Authorize**.
5. Complete the CAPTCHA if shown.
6. You should see a success screen. Close it.

### 5.3 Confirm the bot joined

1. Open Discord ? your server.
2. Open the member list (right side) or check `#general`.
3. You should see **Asian Super Server** (or your bot name) online or offline with a bot tag.
4. It may show **Offline** until you run `npm start` later — that is normal.

---

## 6. Create roles for queue pings

### 6.1 Create the Queue Night role

1. Open your server.
2. Click the server name (top-left) ? **Server Settings**.
3. Left sidebar ? **Roles**.
4. Click **Create Role**.
5. Name: `Queue Night`.
6. Color: pick anything visible (e.g. gold/orange).
7. Leave permissions at defaults (this role is for **pinging**, not admin powers).
8. Important: open the role ? ensure **Allow anyone to @mention this role** is **ON**  
   (wording varies: “Display role members separately” is optional; mentionable must be on so the bot can ping it).
9. Click **Save Changes**.
10. Drag the role **below** your personal Admin/Owner roles if you care about hierarchy. The **bot’s role** must sit **above** roles it needs to mention in some setups — safest: put the bot role reasonably high (see §8).

### 6.2 Copy the Role ID

1. Stay in **Roles**, or go back to the server.
2. Right-click the **Queue Night** role (in Server Settings ? Roles list, or on a member who has it).
3. Click **Copy Role ID**.
4. Paste:

```
QUEUE_PING_ROLE_ID=1234567890123456789
```

### 6.3 Give yourself the role (for testing)

1. Server Settings ? **Members** (or right-click your name in the member list ? **Roles**).
2. Assign **Queue Night** to yourself.
3. Later, assign it to regular players who want pings (manually, or with a reaction-role bot later).

---

## 7. Create the channels

### 7.1 Create a category (optional but tidy)

1. Next to your channel list, click the **+** near channels / right-click empty space ? **Create Category**.
2. Name: `ASIAN SUPER SERVER`.
3. Create.

### 7.2 Create the three text channels

Inside that category (or at the top level), create **three text channels**:

| Channel name | Purpose |
|--------------|---------|
| `live-lobbies` | Bot keeps one pinned “who is in game” embed updated |
| `leaderboard` | Bot keeps one pinned leaderboard embed updated |
| `queue-nights` | Bot posts “queue in 15 / queue now” announcements |

How to create each:

1. Right-click the category ? **Create Channel**.
2. Type: **Text**.
3. Name: `live-lobbies` (Discord may show it as `#live-lobbies`).
4. Click **Create Channel**.
5. Repeat for `leaderboard` and `queue-nights`.

### 7.3 Copy each Channel ID

For **each** of the three channels:

1. Right-click the channel name in the sidebar.
2. Click **Copy Channel ID**.
3. Paste into notepad:

```
CHANNEL_LIVE_LOBBIES=...
CHANNEL_LEADERBOARD=...
CHANNEL_QUEUE_NIGHTS=...
```

Triple-check you did not mix them up.

---

## 8. Channel permissions (so the bot can post / edit / pin)

Do this for **each** of: `#live-lobbies`, `#leaderboard`, `#queue-nights`.

1. Right-click the channel ? **Edit Channel**.
2. Open **Permissions**.
3. Under **Roles/Members**, click **Add** / **+** and add the **Asian Super Server** bot role  
   (the role named after your bot — Discord creates a role matching the bot when it joins).
4. For that bot role in this channel, set:

   | Permission | Setting |
   |------------|---------|
   | View Channel | Allow |
   | Send Messages | Allow |
   | Embed Links | Allow |
   | Attach Files | Allow (optional) |
   | Manage Messages | Allow |
   | Read Message History | Allow |
   | Mention @everyone, @here, and All Roles | Allow (needed on `#queue-nights` for role pings) |

5. Save.

### Optional: reduce noise for humans

On `#live-lobbies` and `#leaderboard` you can deny **Send Messages** for `@everyone` so only the bot posts there (admins can still bypass). Keep `#queue-nights` writable if you want human chat under announcements.

### Bot role hierarchy tip

1. Server Settings ? **Roles**.
2. Find the role Discord created for the bot (same name as the bot).
3. Drag it **above** the `Queue Night` role.
4. Save. This avoids “missing permissions” when mentioning `Queue Night`.

---

## 9. Sanity-check: your notepad should look like this

```env
DISCORD_TOKEN=MT....................................very.long
DISCORD_CLIENT_ID=14.................
DISCORD_GUILD_ID=14.................
CHANNEL_LIVE_LOBBIES=14.................
CHANNEL_LEADERBOARD=14.................
CHANNEL_QUEUE_NIGHTS=14.................
QUEUE_PING_ROLE_ID=14.................
DEFAULT_SERVER_LABEL=Asia Super Server
```

All IDs are long numbers (usually 17–19 digits). The token is a long string with dots.

---

## 10. Put values into `.env` (dev PC)

Back in the project folder (this is the first non-Discord step after collecting IDs):

```powershell
cd F:\Coding\asian-super-server
copy .env.example .env
notepad .env
```

Paste your notepad values. Save. Close.

Then continue with **Plan C** in [SETUP.md](./SETUP.md):

```powershell
npm install
npm run register-commands
npm start
```

---

## 11. Discord checks after the bot is online

When the terminal shows `Asian Super Server online as …`:

### 11.1 Bot appears online

1. Open your Discord server.
2. Member list ? bot should show a **green** online status (or at least not grey forever).

### 11.2 Slash commands appear

1. In any channel, type `/`
2. You should see commands under the **Asian Super Server** app:
   - `/link`
   - `/unlink`
   - `/roster`
   - `/mystats`
   - `/schedule`
   - `/queuecall`
3. If missing: wait 1–2 minutes, restart Discord (Ctrl+R), re-run `npm run register-commands`.

### 11.3 Link yourself

1. Type `/link`
2. For `steam_id`, enter your Steam32 (or Steam64).
3. Optional: `stream_url` = your Twitch/YouTube link.
4. Submit. You should get an ephemeral confirmation only you see.

### 11.4 Watch the boards populate

1. Open `#live-lobbies` — within ~15 seconds the bot should post (and pin) an embed. Empty roster games is normal until someone linked is in a match.
2. Open `#leaderboard` — within a few minutes an embed should appear/pin.
3. As a server admin with **Manage Server**, run:

   `/schedule set hour:21 minute:0 days:5,6 timezone:Asia/Manila server:Asia Super Server`

4. Run `/queuecall note:Test ping` — `#queue-nights` should get an embed and ping `@Queue Night` if the role ID is set.

---

## 12. Common Discord-only mistakes

| What you see | Likely cause | Fix |
|--------------|--------------|-----|
| Invite URL says “bot requires code grant” | Wrong OAuth flow | Use **URL Generator** with scopes `bot` + `applications.commands` only |
| Bot missing from server | Invite never finished / wrong server | Re-open Generated URL and Authorize again |
| Slash commands invisible | Commands not registered, or wrong guild ID | Confirm `DISCORD_GUILD_ID`; run `npm run register-commands` |
| `Missing Access` / cannot send | Channel perms | §8 — allow View/Send/Embed/Manage on those channels |
| Role ping shows `@deleted-role` or no ping | Wrong role ID / not mentionable / bot role too low | Recopy role ID; make role mentionable; raise bot role |
| Token invalid | Reset or typo in `.env` | Reset token in portal; update `.env`; restart |
| Two bots in the server | Old test app | Kick the unused bot; keep one application |

---

## 13. Discord checklist

- [ ] Logged into Discord
- [ ] Server created (or existing server chosen)
- [ ] Developer Mode ON
- [ ] `DISCORD_GUILD_ID` copied
- [ ] Application created at discord.com/developers
- [ ] `DISCORD_CLIENT_ID` copied
- [ ] Bot created; privileged intents OFF
- [ ] `DISCORD_TOKEN` copied into notepad / `.env` only
- [ ] Invite URL generated with `bot` + `applications.commands`
- [ ] Bot authorized into the correct server
- [ ] Role `Queue Night` created + mentionable + ID copied
- [ ] Channels `#live-lobbies`, `#leaderboard`, `#queue-nights` created + IDs copied
- [ ] Bot role can View/Send/Embed/Manage Messages (and mention roles on queue channel)
- [ ] `.env` filled
- [ ] `npm run register-commands` + `npm start`
- [ ] `/link` works; boards appear; `/queuecall` test ping works

When this checklist is done, return to [SETUP.md](./SETUP.md) Plan D for kiosk install.
