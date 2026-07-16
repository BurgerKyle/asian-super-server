/**
 * In-memory presence transitions so we can detect "match found" before
 * deadlock-api's watch-tab active list includes the lobby (~10-15+ min),
 * and track how long someone has been queuing / in an early match.
 */

/** @type {Map<number, { lastStatus: string, searchingAt: number|null, likelyMatchSince: number|null }>} */
const memory = new Map();

/** How long after leaving queue we treat "In Deadlock" as early match. */
const LIKELY_MATCH_TTL_MS = Number(process.env.LIKELY_MATCH_TTL_MS || 25 * 60 * 1000);

/**
 * @param {number} steam32
 * @param {string} rawStatus from classifyPresence
 * @returns {string} refined status (may become loading_match)
 */
function refineStatus(steam32, rawStatus, now = Date.now()) {
  const id = Number(steam32);
  const prev = memory.get(id) || {
    lastStatus: 'unknown',
    searchingAt: null,
    likelyMatchSince: null,
  };

  let searchingAt = prev.searchingAt;
  let likelyMatchSince = prev.likelyMatchSince;

  if (rawStatus === 'searching') {
    // Keep original queue-start time across polls (don't reset the timer)
    if (prev.lastStatus !== 'searching' || searchingAt == null) {
      searchingAt = now;
    }
    likelyMatchSince = null;
    memory.set(id, { lastStatus: rawStatus, searchingAt, likelyMatchSince });
    return 'searching';
  }

  if (rawStatus === 'in_match') {
    memory.set(id, { lastStatus: rawStatus, searchingAt, likelyMatchSince: null });
    return 'in_match';
  }

  if (rawStatus === 'in_deadlock') {
    const recentlySearching =
      prev.lastStatus === 'searching' ||
      (searchingAt != null && now - searchingAt < LIKELY_MATCH_TTL_MS);

    if (recentlySearching || likelyMatchSince) {
      if (!likelyMatchSince) likelyMatchSince = now;
      if (now - likelyMatchSince < LIKELY_MATCH_TTL_MS) {
        memory.set(id, { lastStatus: rawStatus, searchingAt, likelyMatchSince });
        return 'loading_match';
      }
    }

    memory.set(id, { lastStatus: rawStatus, searchingAt: null, likelyMatchSince: null });
    return 'in_deadlock';
  }

  memory.set(id, {
    lastStatus: rawStatus,
    searchingAt: null,
    likelyMatchSince: null,
  });
  return rawStatus;
}

function getMemory(steam32) {
  return memory.get(Number(steam32)) || null;
}

function getLikelyMatchPlayers() {
  const now = Date.now();
  const out = [];
  for (const [steam32, row] of memory) {
    if (row.likelyMatchSince && now - row.likelyMatchSince < LIKELY_MATCH_TTL_MS) {
      out.push({ steam32, since: row.likelyMatchSince });
    }
  }
  return out;
}

function minutesSince(ts, now = Date.now()) {
  return Math.max(0, Math.floor((now - ts) / 60000));
}

/** Format elapsed ms as `m:ss` or `h:mm:ss` (e.g. 2:45). */
function formatElapsed(ms) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return null;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Match clock from deadlock-api ActiveMatch fields.
 * Prefers duration_s; falls back to start_time (unix seconds).
 */
function matchElapsedMs(match, now = Date.now()) {
  if (!match) return null;
  if (match.duration_s != null && Number.isFinite(Number(match.duration_s))) {
    return Number(match.duration_s) * 1000;
  }
  if (match.start_time != null && Number.isFinite(Number(match.start_time))) {
    return Math.max(0, now - Number(match.start_time) * 1000);
  }
  return null;
}

module.exports = {
  refineStatus,
  getMemory,
  getLikelyMatchPlayers,
  minutesSince,
  formatElapsed,
  matchElapsedMs,
  LIKELY_MATCH_TTL_MS,
};
