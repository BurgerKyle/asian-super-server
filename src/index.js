const { Client, GatewayIntentBits, Events, Partials } = require('discord.js');
const { config } = require('./config');
const { handleInteraction } = require('./commands/handlers');
const { runLobbyBoard } = require('./jobs/lobbyBoard');
const { runQueueNotify } = require('./jobs/queueNotify');
const { runLeaderboard } = require('./jobs/leaderboard');
const { runPresenceBoard } = require('./jobs/presenceBoard');
const { ensureHeroEmojisBackground } = require('./deadlock/heroEmojis');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

function startLoops() {
  const safe = (label, fn) => async () => {
    try {
      await fn();
    } catch (err) {
      console.error(`[${label}]`, err && err.stack ? err.stack : err);
    }
  };

  safe('lobby', () => runLobbyBoard(client))();
  safe('queue', () => runQueueNotify(client))();
  safe('leaderboard', () => runLeaderboard(client))();
  safe('presence', () => runPresenceBoard(client))();

  setInterval(safe('lobby', () => runLobbyBoard(client)), config.lobbyPollMs);
  setInterval(safe('queue', () => runQueueNotify(client)), config.queueCheckMs);
  setInterval(safe('leaderboard', () => runLeaderboard(client)), config.leaderboardPollMs);
  setInterval(safe('presence', () => runPresenceBoard(client)), config.presencePollMs);

  console.log(
    `[boot] loops: lobby=${config.lobbyPollMs}ms queue=${config.queueCheckMs}ms leaderboard=${config.leaderboardPollMs}ms presence=${config.presencePollMs}ms steam=${config.steamApiKey ? 'on' : 'off'}`
  );
}

client.once(Events.ClientReady, (c) => {
  console.log(`[boot] Asian Super Server online as ${c.user.tag}`);
  startLoops();
  ensureHeroEmojisBackground(c);
});

// Without this listener, Discord.js "error" events crash the process with little useful context.
client.on('error', (err) => {
  console.error('[discord:error]', err && err.stack ? err.stack : err);
});
client.on('warn', (msg) => {
  console.warn('[discord:warn]', msg);
});
client.on('shardError', (err) => {
  console.error('[discord:shardError]', err && err.stack ? err.stack : err);
});
client.on('invalidated', () => {
  console.error('[discord:invalidated] session invalidated - restart the bot');
});

client.on(Events.InteractionCreate, async (interaction) => {
  const cmd = interaction.isChatInputCommand?.() ? interaction.commandName : 'unknown';
  try {
    await handleInteraction(interaction);
  } catch (err) {
    console.error(`[command:/${cmd}]`, err && err.stack ? err.stack : err);
    const payload = { content: `Error: ${err.message || 'unknown'}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
      else await interaction.reply(payload);
    } catch (replyErr) {
      console.error('[command:reply-failed]', replyErr.message);
    }
  }
});

client.login(config.token).catch((err) => {
  console.error('[boot] login failed:', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err && err.stack ? err.stack : err);
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err && err.stack ? err.stack : err);
  // Stay alive for transient filesystem / Discord blips; exit only on truly fatal cases later if needed.
});

process.on('exit', (code) => {
  console.log(`[exit] code=${code}`);
});
