const { EmbedBuilder } = require('discord.js');
const { config } = require('../config');
const { getActiveMatches } = require('../deadlock/client');
const { getPlayerSummaries, classifyPresence, presenceDetail } = require('../deadlock/steamPresence');
const { refineStatus, minutesSince, getLikelyMatchPlayers } = require('../store/presenceMemory');
const { loadRoster, allSteamIds } = require('../store/roster');
const { loadState, saveState } = require('../store/state');

const STAR = '\u2605';

function presenceChannelId() {
  return config.channels.presence || config.channels.queueNights || '';
}

function buildPresenceEmbed(groups, steamEnabled) {
  const embed = new EmbedBuilder()
    .setTitle('Asian Super Server | Who is around')
    .setColor(0x1b2838)
    .setTimestamp(new Date())
    .setFooter({
      text: steamEnabled
        ? 'Steam presence + active matches | Full lobby roster needs watch-tab (~10-15m)'
        : 'Set STEAM_API_KEY to enable queue detection',
    });

  if (!steamEnabled) {
    embed.setDescription(
      [
        'Steam status polling is **off**.',
        '',
        '1. Get a key: https://steamcommunity.com/dev/apikey',
        '2. Add `STEAM_API_KEY=...` to `.env`',
        '3. Restart the bot',
        '',
        'Tracked players also need **public** Steam profiles (game details visible).',
      ].join('\n')
    );
    return embed;
  }

  const fmt = (list) => {
    if (!list.length) return '_nobody_';
    return list
      .map((p) => {
        const detail = p.detail ? ` - ${p.detail}` : '';
        const stream = p.streamUrl ? ` ([stream](${p.streamUrl}))` : '';
        return `${STAR} **${p.displayName}**${detail}${stream}`;
      })
      .join('\n');
  };

  embed.setDescription(
    [
      'Live ASS roster via Steam + Deadlock.',
      '**Match found / loading** = left queue, not yet on the public watch-tab list (often ~10-15 min before full lobby shows in #live-lobbies).',
    ].join('\n')
  );

  embed.addFields(
    {
      name: `Finding match (${groups.searching.length})`,
      value: fmt(groups.searching).slice(0, 1024),
      inline: false,
    },
    {
      name: `Match found / loading (${groups.loading_match.length})`,
      value: fmt(groups.loading_match).slice(0, 1024),
      inline: false,
    },
    {
      name: `In match - watch tab (${groups.in_match.length})`,
      value: fmt(groups.in_match).slice(0, 1024),
      inline: false,
    },
    {
      name: `In Deadlock - menu/hideout (${groups.in_deadlock.length})`,
      value: fmt(groups.in_deadlock).slice(0, 1024),
      inline: false,
    }
  );

  const quiet =
    !groups.searching.length &&
    !groups.loading_match.length &&
    !groups.in_match.length &&
    !groups.in_deadlock.length;
  if (quiet) {
    embed.addFields({
      name: 'Tip',
      value:
        'Nobody on the roster is in Deadlock right now. Use `/track` / `/link`, keep Steam game details **public**, then queue together.',
      inline: false,
    });
  }

  return embed;
}

/**
 * @param {import('discord.js').Client} client
 */
async function runPresenceBoard(client) {
  const channelId = presenceChannelId();
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    console.warn('[presence] presence/queue channel missing or not text');
    return;
  }

  const roster = loadRoster();
  const steamIds = allSteamIds();
  const steamEnabled = Boolean(config.steamApiKey);

  /** @type {Set<number>} */
  const inMatchSet = new Set();
  if (steamIds.length) {
    try {
      const matches = await getActiveMatches(steamIds, config.deadlockApiKey);
      for (const m of matches || []) {
        for (const p of m.players || []) {
          const id = Number(p.account_id);
          if (steamIds.includes(id)) inMatchSet.add(id);
        }
      }
    } catch (err) {
      console.warn('[presence] active matches failed:', err.message);
    }
  }

  /** @type {Map<number, object>} */
  let summaries = new Map();
  if (steamEnabled && steamIds.length) {
    try {
      summaries = await getPlayerSummaries(config.steamApiKey, steamIds);
    } catch (err) {
      console.warn('[presence] steam summaries failed:', err.message);
    }
  }

  const groups = {
    searching: [],
    loading_match: [],
    in_match: [],
    in_deadlock: [],
  };

  const now = Date.now();

  for (const p of roster.players) {
    const steam32 = Number(p.steam32);
    const summary = summaries.get(steam32);
    const raw = steamEnabled
      ? classifyPresence(summary, inMatchSet.has(steam32))
      : inMatchSet.has(steam32)
        ? 'in_match'
        : 'hidden';

    const status = steamEnabled ? refineStatus(steam32, raw, now) : raw;

    if (!['searching', 'loading_match', 'in_match', 'in_deadlock'].includes(status)) continue;

    let detail = presenceDetail(summary, status === 'loading_match' ? 'in_deadlock' : status);
    if (status === 'loading_match') {
      const hit = getLikelyMatchPlayers().find((x) => x.steam32 === steam32);
      detail = hit
        ? `Left queue ~${minutesSince(hit.since, now)}m ago - full lobby on watch tab soon`
        : 'Match found / loading - full lobby on watch tab soon';
    }

    groups[status].push({
      displayName: p.displayName,
      steam32,
      streamUrl: p.streamUrl || '',
      detail,
      status,
    });
  }

  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  const embed = buildPresenceEmbed(groups, steamEnabled);
  const state = loadState();

  if (state.presenceMessageId) {
    try {
      const msg = await channel.messages.fetch(state.presenceMessageId);
      await msg.edit({ embeds: [embed] });
      return;
    } catch {
      state.presenceMessageId = null;
    }
  }

  const sent = await channel.send({ embeds: [embed] });
  state.presenceMessageId = sent.id;
  saveState(state);
  await sent.pin().catch(() => {});
}

module.exports = { runPresenceBoard, buildPresenceEmbed, presenceChannelId };
