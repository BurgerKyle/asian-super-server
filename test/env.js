/** Loaded via `node --require` before tests so config.js can boot without a real .env. */
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DISCORD_TOKEN ||= 'test-token';
process.env.DISCORD_CLIENT_ID ||= 'test-client';
process.env.DISCORD_GUILD_ID ||= 'test-guild';

if (!process.env.DATA_DIR) {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ass-data-'));
}
