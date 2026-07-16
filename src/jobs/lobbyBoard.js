const { EmbedBuilder } = require('discord.js');
const { config } = require('../config');
const { getActiveMatches } = require('../deadlock/client');
const { ensureHeroes, heroName } = require('../deadlock/heroes');
const { loadRoster, allSteamIds } = require('../store/roster');
const { loadState, saveState } = require('../store/state');

function formatDuration(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return '?—?';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function buildLobbyEmbed(matches, rosterBySteam) {
  const embed = new EmbedBuilder()
    .setTitle('Asian Super Server — Live Lobbies')
    .setColor(0xe8a838)
    .setTimestamp(new Date())
    .setFooter({ text: 'Updates every ~15s · Asia queue nights' });

  if (!matches.length) {
    embed.setDescription('No rostered players in active matches right now.\nQueue up on the Asia Super Server!');
    return embed;
  }

  const lines = [];
  for (const match of matches.slice(0, 10)) {
    const region = match.region_mode_parsed || match.region_mode || '?';
    const mode = match.match_mode_parsed || match.game_mode_parsed || 'Match';
    const dur = formatDuration(match.duration_s);
    const mid = match.match_id ?? '?';

    const known = (match.players || [])
      .map((p) => {
        const row = rosterBySteam.get(Number(p.account_id));
        if (!row) return null;
        const hero = heroName(p.hero_id);
        const stream = row.streamUrl ? ` · [stream](${row.streamUrl})` : '';
        return `• **${row.displayName}** — ${hero}${stream}`;
      })
      .filter(Boolean);

    if (!known.length) continue;

    lines.push(
      `**#${mid}** · ${mode} · ${region} · \`${dur}\` · ${match.spectators ?? 0} spectating\n${known.join('\n')}`
    );
  }

  embed.setDescription(lines.length ? lines.join('\n\n') : 'Rostered players found, but no displayable lobby details yet.');
  return embed;
}

/**
 * Poll active matches for roster Steam IDs and edit the live-lobbies channel message.
 * @param {import('discord.js').Client} client
 */
async function runLobbyBoard(client) {
  const channelId = config.channels.liveLobbies;
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    console.warn('[lobby] CHANNEL_LIVE_LOBBIES missing or not text');
    return;
  }

  const steamIds = allSteamIds();
  await ensureHeroes(config.deadlockApiKey);

  let matches = [];
  if (steamIds.length) {
    matches = await getActiveMatches(steamIds, config.deadlockApiKey);
  }

  const roster = loadRoster();
  const rosterBySteam = new Map(roster.players.map((p) => [Number(p.steam32), p]));
  const embed = buildLobbyEmbed(matches, rosterBySteam);

  const state = loadState();
  if (state.liveLobbiesMessageId) {
    try {
      const msg = await channel.messages.fetch(state.liveLobbiesMessageId);
      await msg.edit({ embeds: [embed] });
      return;
    } catch {
      state.liveLobbiesMessageId = null;
    }
  }

  const sent = await channel.send({ embeds: [embed] });
  state.liveLobbiesMessageId = sent.id;
  saveState(state);

  // Pin once so the board stays visible
  await sent.pin().catch(() => {});
}

module.exports = { runLobbyBoard, buildLobbyEmbed };
