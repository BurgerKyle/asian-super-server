const { EmbedBuilder } = require('discord.js');
const { config } = require('../config');
const { getMatchHistory } = require('../deadlock/client');
const { loadRoster } = require('../store/roster');
const { loadScores, saveScores, loadState, saveState } = require('../store/state');

/** Fraction of a full lobby that must be ASS-tracked for the game to count. */
const ASS_THRESHOLD = Number(process.env.ASS_LOBBY_THRESHOLD || 0.7);
/** Standard Deadlock lobby size used for the 70% check. */
const LOBBY_SIZE = Number(process.env.ASS_LOBBY_SIZE || 12);
/** How many recent games to inspect per tracked player. */
const HISTORY_LIMIT = Number(process.env.LEADERBOARD_HISTORY_LIMIT || 80);

function isWin(entry) {
  if (typeof entry.won === 'boolean') return entry.won;
  if (typeof entry.is_win === 'boolean') return entry.is_win;
  if (typeof entry.match_result === 'number' && typeof entry.player_team === 'number') {
    return entry.match_result === entry.player_team;
  }
  return null;
}

function minAssPlayers() {
  return Math.ceil(ASS_THRESHOLD * LOBBY_SIZE - 1e-9);
}

/**
 * A match counts only when enough ASS-tracked players share that match_id
 * in their histories (proxy for lobby composition without per-match metadata).
 *
 * Example: 70% of 12 => need at least 9 tracked players in the same lobby.
 */
async function recomputeScores() {
  const roster = loadRoster();
  const rosterIds = new Set(roster.players.map((p) => Number(p.steam32)));
  const bySteam = new Map(roster.players.map((p) => [Number(p.steam32), p]));

  /** @type {Map<string, Map<number, boolean>>} matchId -> steam32 -> won */
  const matchParticipants = new Map();

  for (const p of roster.players) {
    const steam32 = Number(p.steam32);
    try {
      const history = await getMatchHistory(steam32, config.deadlockApiKey);
      const rows = Array.isArray(history) ? history : history?.matches || [];
      for (const m of rows.slice(0, HISTORY_LIMIT)) {
        const matchId = m.match_id != null ? String(m.match_id) : null;
        if (!matchId) continue;
        const w = isWin(m);
        if (w == null) continue;
        if (!matchParticipants.has(matchId)) matchParticipants.set(matchId, new Map());
        matchParticipants.get(matchId).set(steam32, w);
      }
    } catch (err) {
      console.warn(`[leaderboard] history failed for ${steam32}:`, err.message);
    }
  }

  const needed = minAssPlayers();
  /** @type {Map<number, { wins: number, losses: number, games: number }>} */
  const tallies = new Map();
  for (const id of rosterIds) tallies.set(id, { wins: 0, losses: 0, games: 0 });

  let countedMatches = 0;
  let skippedMatches = 0;

  for (const [, participants] of matchParticipants) {
    const assCount = participants.size;
    if (assCount / LOBBY_SIZE < ASS_THRESHOLD) {
      skippedMatches += 1;
      continue;
    }
    countedMatches += 1;
    for (const [steam32, won] of participants) {
      const t = tallies.get(steam32);
      if (!t) continue;
      t.games += 1;
      if (won) t.wins += 1;
      else t.losses += 1;
    }
  }

  const prev = loadScores();
  const next = {
    season: prev.season || 'default',
    players: {},
    updatedAt: new Date().toISOString(),
    rule: {
      threshold: ASS_THRESHOLD,
      lobbySize: LOBBY_SIZE,
      minAssPlayers: needed,
      countedMatches,
      skippedMatches,
    },
  };

  for (const [steam32, t] of tallies) {
    const p = bySteam.get(steam32);
    if (!p) continue;
    const prevRow = (prev.players || {})[String(steam32)] || {};
    next.players[String(steam32)] = {
      discordId: p.discordId,
      displayName: p.displayName,
      wins: t.wins,
      losses: t.losses,
      games: t.games,
      attendance: prevRow.attendance || 0,
      winRate: t.games ? Math.round((t.wins / t.games) * 1000) / 10 : 0,
    };
  }

  console.log(
    `[leaderboard] ASS rule >=${Math.round(ASS_THRESHOLD * 100)}% (${needed}/${LOBBY_SIZE}): counted=${countedMatches} skipped=${skippedMatches}`
  );
  saveScores(next);
  return next;
}

function buildLeaderboardEmbed(scores) {
  const rows = Object.values(scores.players || {})
    .filter((p) => p.games > 0)
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate)
    .slice(0, 20);

  const pct = Math.round((scores.rule?.threshold ?? ASS_THRESHOLD) * 100);
  const need = scores.rule?.minAssPlayers ?? minAssPlayers();
  const lobby = scores.rule?.lobbySize ?? LOBBY_SIZE;

  const embed = new EmbedBuilder()
    .setTitle('Asian Super Server | Leaderboard')
    .setColor(0x3498db)
    .setTimestamp(new Date())
    .setFooter({
      text: `Only games with ${pct}%+ ASS in lobby (${need}/${lobby}) | Season: ${scores.season || 'default'}`,
    });

  if (!rows.length) {
    embed.setDescription(
      [
        'No qualifying games yet.',
        '',
        `A match counts only when **${need}+** of **${lobby}** players are on the ASS roster (\`/link\` or \`/track\`).`,
        'Stack together on Asia queue nights, then check back here.',
      ].join('\n')
    );
    return embed;
  }

  const lines = rows.map((p, i) => {
    const medal = `${i + 1}.`;
    return `${medal} **${p.displayName}** | ${p.wins}W ${p.losses}L (${p.winRate}%) | ${p.games} games`;
  });

  const counted = scores.rule?.countedMatches;
  const header =
    counted != null
      ? `_Qualifying stack games in window: **${counted}**_\n\n`
      : '';
  embed.setDescription(header + lines.join('\n'));
  return embed;
}

/**
 * @param {import('discord.js').Client} client
 */
async function runLeaderboard(client) {
  const channelId = config.channels.leaderboard;
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const scores = await recomputeScores();
  const embed = buildLeaderboardEmbed(scores);
  const state = loadState();

  if (state.leaderboardMessageId) {
    try {
      const msg = await channel.messages.fetch(state.leaderboardMessageId);
      await msg.edit({ embeds: [embed] });
      return;
    } catch {
      state.leaderboardMessageId = null;
    }
  }

  const sent = await channel.send({ embeds: [embed] });
  state.leaderboardMessageId = sent.id;
  saveState(state);
  await sent.pin().catch(() => {});
}

module.exports = {
  runLeaderboard,
  recomputeScores,
  buildLeaderboardEmbed,
  ASS_THRESHOLD,
  LOBBY_SIZE,
  minAssPlayers,
};
