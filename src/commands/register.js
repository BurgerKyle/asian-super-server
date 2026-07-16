/**
 * Register slash commands to the guild (run once after .env is filled, and after adding commands).
 *   npm run register-commands
 */
const { REST, Routes } = require('discord.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { commands } = require('./handlers');

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !clientId || !guildId) {
    console.error('Set DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID in .env first.');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(token);
  console.log(`Registering ${commands.length} commands to guild ${guildId}...`);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
  console.log('Done. Slash commands should appear in Discord within a minute.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
