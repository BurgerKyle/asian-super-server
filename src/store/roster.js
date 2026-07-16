const fs = require('fs');
const path = require('path');
const { config } = require('../config');

function filePath(name) {
  return path.join(config.dataDir, name);
}

function readJson(name, fallback) {
  const p = filePath(name);
  if (!fs.existsSync(p)) return structuredClone(fallback);
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return structuredClone(fallback);
  }
}

function writeJson(name, data) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const tmp = filePath(`${name}.tmp`);
  const dest = filePath(name);
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, dest);
}

/**
 * Roster entry shape:
 * {
 *   discordId: string,
 *   steam32: number,
 *   displayName: string,
 *   streamUrl?: string,
 *   linkedAt: string (ISO)
 * }
 */
const EMPTY_ROSTER = { players: [] };

function loadRoster() {
  return readJson('roster.json', EMPTY_ROSTER);
}

function saveRoster(roster) {
  writeJson('roster.json', roster);
}

function findByDiscord(discordId) {
  return loadRoster().players.find((p) => p.discordId === String(discordId));
}

function findBySteam(steam32) {
  return loadRoster().players.find((p) => Number(p.steam32) === Number(steam32));
}

function upsertPlayer(entry) {
  const roster = loadRoster();
  const i = roster.players.findIndex((p) => p.discordId === String(entry.discordId));
  const row = {
    discordId: String(entry.discordId),
    steam32: Number(entry.steam32),
    displayName: entry.displayName || entry.discordId,
    streamUrl: entry.streamUrl || '',
    linkedAt: entry.linkedAt || new Date().toISOString(),
  };
  if (i >= 0) roster.players[i] = { ...roster.players[i], ...row };
  else roster.players.push(row);
  saveRoster(roster);
  return row;
}

function removeByDiscord(discordId) {
  const roster = loadRoster();
  const before = roster.players.length;
  roster.players = roster.players.filter((p) => p.discordId !== String(discordId));
  saveRoster(roster);
  return before !== roster.players.length;
}

function allSteamIds() {
  return loadRoster().players.map((p) => Number(p.steam32)).filter((n) => Number.isFinite(n) && n > 0);
}

module.exports = {
  loadRoster,
  saveRoster,
  findByDiscord,
  findBySteam,
  upsertPlayer,
  removeByDiscord,
  allSteamIds,
};
