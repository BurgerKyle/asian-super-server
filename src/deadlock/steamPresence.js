const { toSteam64 } = require('./steamNames');

/** Deadlock on Steam */
const DEADLOCK_APP_ID = '1422450';

/**
 * Phrases Steam sometimes puts in gameextrainfo while matchmaking.
 * Verified empirically per-game; keep loose.
 */
const SEARCHING_RE =
  /\b(finding(\s+a)?\s+match|searching(\s+for)?(\s+a)?\s+match|matchmaking|in\s+queue|looking\s+for\s+match)\b/i;

const IN_MATCH_RE = /\b(in\s+(a\s+)?match|playing\s+match|game\s+in\s+progress)\b/i;

/**
 * @param {string} apiKey
 * @param {number[]} steam32Ids
 * @returns {Promise<Map<number, object>>} steam32 -> Steam player summary
 */
async function getPlayerSummaries(apiKey, steam32Ids) {
  const map = new Map();
  if (!apiKey || !steam32Ids.length) return map;

  const unique = [...new Set(steam32Ids.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
  // Steam allows up to 100 ids per call
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const steamids = chunk.map((id) => toSteam64(id)).join(',');
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(apiKey)}&steamids=${steamids}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'AsianSuperServer/1.0' },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Steam API ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const players = data?.response?.players || [];
    for (const p of players) {
      const steam64 = BigInt(p.steamid);
      const steam32 = Number(steam64 - 76561197960265728n);
      map.set(steam32, p);
    }
  }
  return map;
}

/**
 * Classify a Steam summary (+ whether they're in a deadlock-api active match).
 * @returns {'searching'|'in_match'|'in_deadlock'|'other_game'|'online'|'offline'|'hidden'}
 */
function classifyPresence(summary, inActiveMatch) {
  if (inActiveMatch) return 'in_match';
  if (!summary) return 'hidden';

  const gameId = summary.gameid != null ? String(summary.gameid) : '';
  const extra = String(summary.gameextrainfo || '');
  const state = Number(summary.personastate || 0);

  if (gameId === DEADLOCK_APP_ID) {
    if (SEARCHING_RE.test(extra)) return 'searching';
    if (IN_MATCH_RE.test(extra)) return 'in_match';
    // In Deadlock but not clearly searching — often menu/hideout OR queue with generic "Deadlock" text.
    // Heuristic: if extra is empty or exactly "Deadlock", treat as in_deadlock (includes possible silent queue).
    return 'in_deadlock';
  }

  if (gameId) return 'other_game';
  if (state > 0) return 'online';
  return 'offline';
}

/**
 * When Steam only shows "Deadlock" with no rich presence, players who are
 * searching look the same as hideout. Expose raw extra for the board.
 */
function presenceDetail(summary, status) {
  const extra = String(summary?.gameextrainfo || '').trim();
  if (status === 'searching') return extra || 'Finding match';
  if (status === 'in_match') return extra || 'In match';
  if (status === 'in_deadlock') {
    if (extra && !/^deadlock$/i.test(extra)) return extra;
    return 'In Deadlock (menu / hideout / maybe queue)';
  }
  if (status === 'other_game') return extra || `App ${summary?.gameid}`;
  return '';
}

module.exports = {
  DEADLOCK_APP_ID,
  getPlayerSummaries,
  classifyPresence,
  presenceDetail,
  SEARCHING_RE,
};
