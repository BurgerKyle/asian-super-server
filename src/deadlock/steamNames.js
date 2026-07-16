const fs = require('fs');
const path = require('path');
const { config } = require('../config');

const CACHE_FILE = path.join(config.dataDir, 'steam_names.json');
const STEAM64_BASE = 76561197960265728n;

/** @type {Record<string, { name: string, fetchedAt: number }>} */
let cache = null;

function loadCache() {
  if (cache) return cache;
  try {
    if (fs.existsSync(CACHE_FILE)) {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      return cache;
    }
  } catch {
    /* ignore */
  }
  cache = {};
  return cache;
}

function saveCache() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2) + '\n', 'utf8');
}

function toSteam64(steam32) {
  return (BigInt(steam32) + STEAM64_BASE).toString();
}

/**
 * Resolve a display name for a Steam32 id (PlayerDB, cached 7 days).
 * @param {number} steam32
 * @returns {Promise<string>}
 */
async function resolveSteamName(steam32) {
  const key = String(steam32);
  const c = loadCache();
  const hit = c[key];
  if (hit && Date.now() - hit.fetchedAt < 7 * 24 * 60 * 60 * 1000) {
    return hit.name;
  }

  const steam64 = toSteam64(steam32);
  try {
    const res = await fetch(`https://playerdb.co/api/player/steam/${steam64}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'AsianSuperServer/1.0' },
    });
    if (res.ok) {
      const data = await res.json();
      const name =
        data?.data?.player?.meta?.name ||
        data?.data?.player?.username ||
        data?.data?.player?.name ||
        null;
      if (name) {
        c[key] = { name, fetchedAt: Date.now() };
        saveCache();
        return name;
      }
    }
  } catch {
    /* fall through */
  }

  const fallback = `Player ${steam32}`;
  c[key] = { name: fallback, fetchedAt: Date.now() };
  saveCache();
  return fallback;
}

/**
 * Resolve many Steam32 ids (sequential to be polite).
 * @param {number[]} steam32s
 * @returns {Promise<Map<number, string>>}
 */
async function resolveSteamNames(steam32s) {
  const map = new Map();
  const unique = [...new Set(steam32s.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
  for (const id of unique) {
    map.set(id, await resolveSteamName(id));
  }
  return map;
}

module.exports = { resolveSteamName, resolveSteamNames, toSteam64 };
