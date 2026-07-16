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
 * Roster entry:
 * {
 *   discordId: string | null,   // set by /link; null for /track-only
 *   steam32: number,
 *   displayName: string,
 *   streamUrl?: string,
 *   linkedAt: string (ISO),
 *   source: 'link' | 'track'
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
  return loadRoster().players.find((p) => p.discordId && p.discordId === String(discordId));
}

function findBySteam(steam32) {
  return loadRoster().players.find((p) => Number(p.steam32) === Number(steam32));
}

/** Self-link: Discord user <-> Steam (keyed by discordId, merges if steam already tracked). */
function upsertPlayer(entry) {
  const roster = loadRoster();
  const steam32 = Number(entry.steam32);
  const discordId = String(entry.discordId);

  let i = roster.players.findIndex((p) => p.discordId === discordId);
  if (i < 0) i = roster.players.findIndex((p) => Number(p.steam32) === steam32);

  const prev = i >= 0 ? roster.players[i] : {};
  const row = {
    discordId,
    steam32,
    displayName: entry.displayName || prev.displayName || discordId,
    streamUrl: entry.streamUrl != null ? entry.streamUrl : prev.streamUrl || '',
    linkedAt: prev.linkedAt || new Date().toISOString(),
    source: 'link',
  };

  if (i >= 0) roster.players[i] = row;
  else roster.players.push(row);
  saveRoster(roster);
  return row;
}

/** Track a Steam ID without tying it to the caller's Discord account. */
function upsertTracked(entry) {
  const roster = loadRoster();
  const steam32 = Number(entry.steam32);
  const i = roster.players.findIndex((p) => Number(p.steam32) === steam32);
  const prev = i >= 0 ? roster.players[i] : {};

  const row = {
    discordId: prev.discordId || null,
    steam32,
    displayName: entry.displayName || prev.displayName || `Player ${steam32}`,
    streamUrl: entry.streamUrl != null ? entry.streamUrl : prev.streamUrl || '',
    linkedAt: prev.linkedAt || new Date().toISOString(),
    source: prev.source === 'link' ? 'link' : 'track',
  };

  if (i >= 0) roster.players[i] = row;
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

function removeBySteam(steam32) {
  const roster = loadRoster();
  const before = roster.players.length;
  roster.players = roster.players.filter((p) => Number(p.steam32) !== Number(steam32));
  saveRoster(roster);
  return before !== roster.players.length;
}

function allSteamIds() {
  return loadRoster()
    .players.map((p) => Number(p.steam32))
    .filter((n) => Number.isFinite(n) && n > 0);
}

module.exports = {
  loadRoster,
  saveRoster,
  findByDiscord,
  findBySteam,
  upsertPlayer,
  upsertTracked,
  removeByDiscord,
  removeBySteam,
  allSteamIds,
};
