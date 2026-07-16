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
      console.error(`[${label}]`, err.message || err);
    }
  };

  // Kick off immediately, then on intervals
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
  // Start poll loops immediately — hero emoji upload must not block readiness
  startLoops();
  ensureHeroEmojisBackground(c);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    await handleInteraction(interaction);
  } catch (err) {
    console.error('[command]', err);
    const msg = { content: `Error: ${err.message}`, ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
    else await interaction.reply(msg).catch(() => {});
  }
});

client.login(config.token).catch((err) => {
  console.error('[boot] login failed:', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err);
});
