/**
 * In-memory presence transitions so we can detect "match found" before
 * deadlock-api's watch-tab active list includes the lobby (~10-15+ min).
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
    searchingAt = now;
    likelyMatchSince = null;
    memory.set(id, { lastStatus: rawStatus, searchingAt, likelyMatchSince });
    return 'searching';
  }

  if (rawStatus === 'in_match') {
    // Confirmed by watch-tab / rich presence — clear early heuristic
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

    // Idle in menu/hideout
    memory.set(id, { lastStatus: rawStatus, searchingAt: null, likelyMatchSince: null });
    return 'in_deadlock';
  }

  // Left Deadlock entirely
  memory.set(id, {
    lastStatus: rawStatus,
    searchingAt: null,
    likelyMatchSince: null,
  });
  return rawStatus;
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

module.exports = {
  refineStatus,
  getLikelyMatchPlayers,
  minutesSince,
  LIKELY_MATCH_TTL_MS,
};
