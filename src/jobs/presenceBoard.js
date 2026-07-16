const { EmbedBuilder } = require('discord.js');
const { config } = require('../config');
const { getActiveMatches } = require('../deadlock/client');
const { getPlayerSummaries, classifyPresence } = require('../deadlock/steamPresence');
const {
  refineStatus,
  getMemory,
  getLikelyMatchPlayers,
  formatElapsed,
  matchElapsedMs,
} = require('../store/presenceMemory');
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
        ? 'Timers: queue = since we saw Searching | match = API duration_s/start_time'
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
        const timer = p.timer ? ` \`${p.timer}\`` : '';
        const label = p.label ? ` ${p.label}` : '';
        const stream = p.streamUrl ? ` ([stream](${p.streamUrl}))` : '';
        return `${STAR} **${p.displayName}**${timer}${label}${stream}`;
      })
      .join('\n');
  };

  embed.setDescription(
    [
      'Live ASS roster via Steam + Deadlock.',
      'Timers update every poll. Match clocks use watch-tab `duration_s` / `start_time` when available.',
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
      name: `In match (${groups.in_match.length})`,
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
  const now = Date.now();

  /** @type {Set<number>} */
  const inMatchSet = new Set();
  /** @type {Map<number, { matchId: *, elapsedMs: number|null }>} */
  const matchInfoBySteam = new Map();

  if (steamIds.length) {
    try {
      const matches = await getActiveMatches(steamIds, config.deadlockApiKey);
      for (const m of matches || []) {
        const elapsed = matchElapsedMs(m, now);
        for (const p of m.players || []) {
          const id = Number(p.account_id);
          if (!steamIds.includes(id)) continue;
          inMatchSet.add(id);
          // Prefer longest/known elapsed if player appears somehow twice
          const prev = matchInfoBySteam.get(id);
          if (!prev || (elapsed != null && (prev.elapsedMs == null || elapsed > prev.elapsedMs))) {
            matchInfoBySteam.set(id, { matchId: m.match_id, elapsedMs: elapsed });
          }
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

    const mem = getMemory(steam32);
    let timer = null;
    let label = '';

    if (status === 'searching') {
      const started = mem?.searchingAt;
      timer = started != null ? formatElapsed(now - started) : null;
      label = 'in queue';
    } else if (status === 'loading_match') {
      const hit = getLikelyMatchPlayers().find((x) => x.steam32 === steam32);
      const since = hit?.since || mem?.likelyMatchSince;
      timer = since != null ? formatElapsed(now - since) : null;
      label = 'since queue popped';
    } else if (status === 'in_match') {
      const info = matchInfoBySteam.get(steam32);
      if (info?.elapsedMs != null) {
        timer = formatElapsed(info.elapsedMs);
        label = info.matchId != null ? `in match #${info.matchId}` : 'in match';
      } else if (mem?.likelyMatchSince) {
        // Fell back before watch-tab duration existed
        timer = formatElapsed(now - mem.likelyMatchSince);
        label = 'in match (est.)';
      } else {
        label = 'in match';
      }
    } else if (status === 'in_deadlock') {
      label = 'menu / hideout';
    }

    groups[status].push({
      displayName: p.displayName,
      steam32,
      streamUrl: p.streamUrl || '',
      timer,
      label,
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
