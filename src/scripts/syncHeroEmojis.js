/**
 * One-shot: upload Deadlock hero icons as Discord application emojis.
 *   npm run sync-hero-emojis
 *
 * Also runs automatically on bot boot (skips already-uploaded heroes).
 */
const { Client, GatewayIntentBits } = require('discord.js');
const { config } = require('../config');
const { ensureHeroEmojis } = require('../deadlock/heroEmojis');

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once('clientReady', async () => {
    // discord.js v14 may still emit 'ready'; ignore if both fire
  });
  await client.login(config.token);
  await new Promise((resolve) => {
    if (client.isReady()) resolve();
    else client.once('ready', resolve);
  });
  console.log(`Logged in as ${client.user.tag}`);
  await ensureHeroEmojis(client);
  await client.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
