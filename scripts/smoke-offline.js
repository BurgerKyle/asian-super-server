#!/usr/bin/env node
/**
 * Offline smoke: boot critical modules with fake env and render board payloads.
 * Does not call Discord or external APIs.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const outDir = process.argv[2] || path.join(os.tmpdir(), 'ass-smoke');
fs.mkdirSync(outDir, { recursive: true });

process.env.DISCORD_TOKEN = process.env.DISCORD_TOKEN || 'smoke-token';
process.env.DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || 'smoke-client';
process.env.DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || 'smoke-guild';
process.env.DATA_DIR = process.env.DATA_DIR || path.join(outDir, 'data');
fs.mkdirSync(process.env.DATA_DIR, { recursive: true });

const { steam32FromInput } = require('../src/util/steamId');
const { sanitizeStreamUrl } = require('../src/util/sanitize');
const { buildEmptyEmbed, buildEarlyMatchEmbed, buildMatchEmbed } = require('../src/jobs/lobbyBoard');
const { buildLeaderboardEmbed } = require('../src/jobs/leaderboard');
const { buildPresenceEmbed } = require('../src/jobs/presenceBoard');
const { commands } = require('../src/commands/handlers');

const lines = [];
lines.push('# Asian Super Server — offline smoke');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push('');

// Critical parsers
const sid = steam32FromInput('76561198000000000');
lines.push(`## Parsers`);
lines.push(`- steam32FromInput(Steam64 sample) => ${sid}`);
lines.push(`- sanitizeStreamUrl(twitch) ok=${sanitizeStreamUrl('https://twitch.tv/demo').ok}`);
lines.push(`- slash commands registered in code: ${commands.map((c) => c.name).join(', ')}`);
lines.push('');

const empty = buildEmptyEmbed();
const early = buildEarlyMatchEmbed([{ displayName: 'DemoPlayer', since: Date.now() - 120000 }]);
const match = buildMatchEmbed(
  {
    match_id: 12345,
    region_mode_parsed: 'Asia',
    match_mode_parsed: 'Ranked',
    duration_s: 600,
    spectators: 2,
    players: [
      { account_id: 111, team: 0, team_parsed: 'Amber', hero_id: 1 },
      { account_id: 222, team: 1, team_parsed: 'Sapphire', hero_id: 2 },
    ],
  },
  new Map([[111, { displayName: 'ASS_One', streamUrl: 'https://twitch.tv/ass_one' }]]),
  new Map([[222, 'Pub_Two']])
);

const lb = buildLeaderboardEmbed({
  season: 'smoke',
  players: {
    111: { displayName: 'ASS_One', wins: 3, losses: 1, winRate: 75, games: 4 },
  },
  rule: { threshold: 0.7, lobbySize: 12, minAssPlayers: 9, countedMatches: 2 },
});

const presence = buildPresenceEmbed(
  {
    searching: [{ displayName: 'Queuer', timer: '1:12', label: 'in queue', streamUrl: '' }],
    loading_match: [],
    in_match: [{ displayName: 'ASS_One', timer: '10:00', label: 'in match #12345', streamUrl: '' }],
    in_deadlock: [],
  },
  true
);

function dumpEmbed(name, embed) {
  lines.push(`## ${name}`);
  lines.push('```');
  lines.push(`title: ${embed.data.title || ''}`);
  lines.push(`description: ${(embed.data.description || '').slice(0, 400)}`);
  if (embed.data.fields) {
    for (const f of embed.data.fields) {
      lines.push(`field ${f.name}: ${(f.value || '').slice(0, 200)}`);
    }
  }
  lines.push('```');
  lines.push('');
}

dumpEmbed('Live lobbies (empty)', empty);
dumpEmbed('Live lobbies (early match)', early);
dumpEmbed('Live lobbies (match)', match);
dumpEmbed('Leaderboard', lb);
dumpEmbed('Presence board', presence);

const outFile = path.join(outDir, 'smoke-demo.md');
fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
console.log(`smoke ok -> ${outFile}`);
console.log(`commands: ${commands.length}`);
