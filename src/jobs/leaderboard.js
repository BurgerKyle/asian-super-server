const { EmbedBuilder } = require('discord.js');
const { config } = require('../config');
const { getMatchHistory } = require('../deadlock/client');
const { loadRoster } = require('../store/roster');
const { loadScores, saveScores, loadState, saveState, loadSchedule } = require('../store/state');

function isWin(entry) {
  // deadlock-api match-history rows vary; prefer explicit match_result / won flags
  if (typeof entry.match_result === 'number') return entry.match_result === 1 || entry.match_result === entry.player_team;
  if (typeof entry.won === 'boolean') return entry.won;
  if (typeof entry.is_win === 'boolean') return entry.is_win;
  return null;
}

/**
 * Soft scoring: last ~50 games per rostered player.
 * Queue-night weighting can be tightened later (time windows from schedule).
 */
async function recomputeScores() {
  const roster = loadRoster();
  const scores = loadScores();
  const next = { season: scores.season || 'default', players: { ...scores.players }, updatedAt: new Date().toISOString() };

  for (const p of roster.players) {
    try {
      const history = await getMatchHistory(p.steam32, config.deadlockApiKey);
      const rows = Array.isArray(history) ? history : history?.matches || [];
      const recent = rows.slice(0, 50);
      let wins = 0;
      let losses = 0;
      let games = 0;
      for (const m of recent) {
        const w = isWin(m);
        if (w == null) continue;
        games += 1;
        if (w) wins += 1;
        else losses += 1;
      }
      const prev = next.players[String(p.steam32)] || {};
      next.players[String(p.steam32)] = {
        discordId: p.discordId,
        displayName: p.displayName,
        wins,
        losses,
        games,
        attendance: prev.attendance || 0,
        winRate: games ? Math.round((wins / games) * 1000) / 10 : 0,
      };
    } catch (err) {
      console.warn(`[leaderboard] history failed for ${p.steam32}:`, err.message);
    }
  }

  saveScores(next);
  return next;
}

function buildLeaderboardEmbed(scores) {
  const rows = Object.values(scores.players || {})
    .filter((p) => p.games > 0)
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate)
    .slice(0, 20);

  const embed = new EmbedBuilder()
    .setTitle('Asian Super Server — Leaderboard')
    .setColor(0x3498db)
    .setTimestamp(new Date())
    .setFooter({ text: `Season: ${scores.season || 'default'} · Recent match history` });

  if (!rows.length) {
    embed.setDescription('No scored games yet. Link Steam with `/link` and play on Asia nights.');
    return embed;
  }

  const lines = rows.map((p, i) => {
    const medal = i === 0 ? '1.' : i === 1 ? '2.' : i === 2 ? '3.' : `${i + 1}.`;
    return `${medal} **${p.displayName}** — ${p.wins}W ${p.losses}L (${p.winRate}%) · ${p.games} games`;
  });
  embed.setDescription(lines.join('\n'));
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

module.exports = { runLeaderboard, recomputeScores, buildLeaderboardEmbed };
