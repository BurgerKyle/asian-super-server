const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function optional(name, fallback = '') {
  return process.env[name] || fallback;
}

/**
 * Parse a positive int env var with inclusive min/max clamps.
 * Invalid / missing values fall back to `fallback` (also clamped).
 */
function intEnv(name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[name];
  let n = fallback;
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) n = parsed;
  }
  return Math.min(max, Math.max(min, n));
}

const config = {
  token: required('DISCORD_TOKEN'),
  clientId: required('DISCORD_CLIENT_ID'),
  guildId: required('DISCORD_GUILD_ID'),
  channels: {
    liveLobbies: optional('CHANNEL_LIVE_LOBBIES'),
    leaderboard: optional('CHANNEL_LEADERBOARD'),
    queueNights: optional('CHANNEL_QUEUE_NIGHTS'),
    // Optional; defaults to CHANNEL_QUEUE_NIGHTS for the "who's around" board
    presence: optional('CHANNEL_PRESENCE'),
  },
  queuePingRoleId: optional('QUEUE_PING_ROLE_ID'),
  deadlockApiKey: optional('DEADLOCK_API_KEY'),
  steamApiKey: optional('STEAM_API_KEY'),
  // Floor poll intervals so a typo like 0 cannot hammer Discord / Steam / Deadlock APIs.
  lobbyPollMs: intEnv('LOBBY_POLL_MS', 15_000, { min: 5_000, max: 3_600_000 }),
  leaderboardPollMs: intEnv('LEADERBOARD_POLL_MS', 300_000, { min: 60_000, max: 3_600_000 }),
  queueCheckMs: intEnv('QUEUE_CHECK_MS', 60_000, { min: 15_000, max: 3_600_000 }),
  presencePollMs: intEnv('PRESENCE_POLL_MS', 20_000, { min: 5_000, max: 3_600_000 }),
  defaultServerLabel: optional('DEFAULT_SERVER_LABEL', 'Asia Super Server'),
  dataDir: process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(__dirname, '..', 'data'),
};

module.exports = { config, intEnv, required, optional };
