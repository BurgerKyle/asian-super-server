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

function intEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
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
  lobbyPollMs: intEnv('LOBBY_POLL_MS', 15_000),
  leaderboardPollMs: intEnv('LEADERBOARD_POLL_MS', 300_000),
  queueCheckMs: intEnv('QUEUE_CHECK_MS', 60_000),
  presencePollMs: intEnv('PRESENCE_POLL_MS', 20_000),
  defaultServerLabel: optional('DEFAULT_SERVER_LABEL', 'Asia Super Server'),
  dataDir: path.join(__dirname, '..', 'data'),
};

module.exports = { config };
