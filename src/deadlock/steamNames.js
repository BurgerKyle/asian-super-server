const path = require('path');
const { config } = require('../config');
const { writeJsonAtomic, readJsonSafe } = require('../store/safeJson');

const CACHE_FILE = path.join(config.dataDir, 'steam_names.json');
const STEAM64_BASE = 76561197960265728n;
const FETCH_TIMEOUT_MS = 8000;

/** @type {Record<string, { name: string, fetchedAt: number }>} */
let cache = null;

function loadCache() {
  if (cache) return cache;
  cache = readJsonSafe(CACHE_FILE, {});
  return cache;
}

function saveCache() {
  try {
    writeJsonAtomic(CACHE_FILE, cache);
  } catch (err) {
    console.warn('[steam-names] save failed:', err.message);
  }
}

function toSteam64(steam32) {
  return (BigInt(steam32) + STEAM64_BASE).toString();
}

async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'AsianSuperServer/1.0' },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
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
    const res = await fetchWithTimeout(`https://playerdb.co/api/player/steam/${steam64}`, FETCH_TIMEOUT_MS);
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
  } catch (err) {
    console.warn(`[steam-names] lookup ${steam32} failed:`, err.message);
  }

  const fallback = `Player ${steam32}`;
  c[key] = { name: fallback, fetchedAt: Date.now() };
  saveCache();
  return fallback;
}

async function resolveSteamNames(steam32s) {
  const map = new Map();
  const unique = [...new Set(steam32s.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
  for (const id of unique) {
    map.set(id, await resolveSteamName(id));
  }
  return map;
}

module.exports = { resolveSteamName, resolveSteamNames, toSteam64 };
