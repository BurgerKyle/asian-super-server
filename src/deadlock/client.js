/**
 * Deadlock API client — patterns adapted from WinFactory (browser-like headers,
 * optional Bearer key, 429 backoff). Used for active matches + history scoring.
 */

const BASE = 'https://api.deadlock-api.com';

function buildHeaders(apiKey) {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {string} pathWithQuery e.g. /v1/matches/active?account_ids=1,2
 * @param {{ apiKey?: string, retries?: number }} opts
 */
async function fetchDeadlockJson(pathWithQuery, opts = {}) {
  const { apiKey, retries = 3 } = opts;
  const url = pathWithQuery.startsWith('http') ? pathWithQuery : `${BASE}${pathWithQuery}`;
  let delayMs = 2000;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: buildHeaders(apiKey) });

    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after');
      const wait = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : delayMs;
      if (attempt === retries) throw new Error('Deadlock API rate limit exceeded');
      await sleep(wait);
      delayMs *= 2;
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Deadlock API ${res.status}: ${body.slice(0, 200)}`);
    }

    return res.json();
  }

  throw new Error('Deadlock API request failed');
}

/**
 * Active matches containing any of the given Steam32 account IDs.
 * @param {number[]} accountIds
 * @param {string} [apiKey]
 */
async function getActiveMatches(accountIds, apiKey) {
  if (!accountIds.length) return [];
  // API accepts comma-separated account_ids (max 1000)
  const ids = accountIds.slice(0, 1000).join(',');
  const data = await fetchDeadlockJson(`/v1/matches/active?account_ids=${ids}`, { apiKey });
  return Array.isArray(data) ? data : [];
}

/**
 * Player match history summaries (for scoring finished games).
 * @param {number|string} accountId Steam32
 */
async function getMatchHistory(accountId, apiKey) {
  return fetchDeadlockJson(`/v1/players/${accountId}/match-history`, { apiKey });
}

async function getHeroes(apiKey) {
  return fetchDeadlockJson('/v1/assets/heroes', { apiKey });
}

async function getAsiaLeaderboard(apiKey) {
  return fetchDeadlockJson('/v1/leaderboard/Asia', { apiKey });
}

module.exports = {
  fetchDeadlockJson,
  getActiveMatches,
  getMatchHistory,
  getHeroes,
  getAsiaLeaderboard,
  BASE,
};
