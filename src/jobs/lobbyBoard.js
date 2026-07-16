const { EmbedBuilder } = require('discord.js');
const { config } = require('../config');
const { getActiveMatches } = require('../deadlock/client');
const { ensureHeroes, heroName, getHero } = require('../deadlock/heroes');
const { heroEmoji } = require('../deadlock/heroEmojis');
const { resolveSteamNames } = require('../deadlock/steamNames');
const { loadRoster, allSteamIds } = require('../store/roster');
const { loadState, saveState } = require('../store/state');
const { getLikelyMatchPlayers, minutesSince } = require('../store/presenceMemory');

const STAR = '\u2605';

/** Keep one visual line even in narrow Discord layouts. */
const NAME_MAX = 14;

function formatDuration(seconds, startTime) {
  let total = seconds;
  if ((total == null || !Number.isFinite(total)) && startTime) {
    total = Math.max(0, Math.floor(Date.now() / 1000) - Number(startTime));
  }
  if (total == null || !Number.isFinite(total)) return '--:--';
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function teamKey(player) {
  if (player.team != null) return Number(player.team);
  if (player.team_parsed != null) return String(player.team_parsed);
  return 0;
}

function teamTitle(key, samplePlayer) {
  const parsed = samplePlayer?.team_parsed;
  if (parsed != null && String(parsed).trim()) return String(parsed);
  if (key === 0 || key === '0') return 'Team 0';
  if (key === 1 || key === '1') return 'Team 1';
  return `Team ${key}`;
}

function shortName(raw) {
  const s = String(raw || 'Unknown')
    .replace(/[`*_~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length <= NAME_MAX) return s;
  return `${s.slice(0, NAME_MAX - 1)}…`;
}

/**
 * One compact line: ? Name [heroEmoji] (no wrapping hero-on-next-line).
 * Custom emojis only render outside ```code``` blocks.
 */
function playerLine(p, rosterBySteam, nameBySteam) {
  const steam = Number(p.account_id);
  const tracked = rosterBySteam.get(steam);
  const name = shortName(
    (tracked && tracked.displayName) ||
      nameBySteam.get(steam) ||
      (steam ? `Player ${steam}` : 'Unknown')
  );
  const emoji = heroEmoji(p.hero_id);
  const hero = shortName(heroName(p.hero_id));
  const mark = tracked ? STAR : '·';
  const nameBit = tracked ? `**${name}**` : name;
  const heroBit = emoji || `\`${hero}\``;
  const stream = tracked?.streamUrl ? ' [live]' : '';
  return `${mark} ${nameBit} ${heroBit}${stream}`;
}

/**
 * Build one embed per match: both teams of up to 6, stars on ASS roster.
 */
function buildMatchEmbed(match, rosterBySteam, nameBySteam) {
  const region = match.region_mode_parsed || match.region_mode || '?';
  const mode = match.match_mode_parsed || match.game_mode_parsed || 'Match';
  const dur = formatDuration(match.duration_s, match.start_time);
  const mid = match.match_id ?? '?';
  const spectators = match.spectators ?? 0;

  const players = match.players || [];
  const byTeam = new Map();
  for (const p of players) {
    const k = teamKey(p);
    if (!byTeam.has(k)) byTeam.set(k, []);
    byTeam.get(k).push(p);
  }

  const keys = [...byTeam.keys()].sort((a, b) => Number(a) - Number(b));

  // Stack teams full-width (inline:false) so names don't wrap mid-field.
  const fields = keys.slice(0, 2).map((k) => {
    const roster = byTeam.get(k) || [];
    const lines = roster.slice(0, 6).map((p) => playerLine(p, rosterBySteam, nameBySteam));
    const sample = roster[0];
    const trackedOnTeam = roster.filter((p) => rosterBySteam.has(Number(p.account_id))).length;
    const name = teamTitle(k, sample);
    return {
      name: `${name}${trackedOnTeam ? ` (${STAR}${trackedOnTeam})` : ''}`,
      value: (lines.length ? lines.join('\n') : '_empty_').slice(0, 1024),
      inline: false,
    };
  });

  const embed = new EmbedBuilder()
    .setColor(0xe8a838)
    .setTitle(`Match #${mid}`)
    .setDescription(
      [
        `**${mode}** | \`${region}\` | \`${dur}\` | ${spectators} spectating`,
        `${STAR} = Asian Super Server tracked  ·  hero icon = character`,
      ].join('\n')
    )
    .addFields(fields)
    .setTimestamp(new Date())
    .setFooter({ text: 'Updates every ~15s | Asia queue nights' });

  const trackedPlayer = players.find((p) => rosterBySteam.has(Number(p.account_id)));
  if (trackedPlayer) {
    const hero = getHero(trackedPlayer.hero_id);
    if (hero?.icon) embed.setThumbnail(hero.icon);
  }

  return embed;
}

function buildEmptyEmbed() {
  return new EmbedBuilder()
    .setTitle('Asian Super Server | Live Lobbies')
    .setColor(0xe8a838)
    .setDescription(
      [
        'No tracked players on the **public watch-tab** list yet.',
        '',
        'Valve only exposes active lobbies via the in-game watch tab (top ~200).',
        'Asia / early-game matches often take **~10-15 minutes** to appear here.',
        '',
        'For earlier signal, check **Who is around** (Finding match / Match found).',
        'Use `/track` or `/link` so we can watch your Steam status.',
      ].join('\n')
    )
    .setTimestamp(new Date())
    .setFooter({ text: 'Updates every ~15s | Watch-tab delay is Valve-side' });
}

function buildEarlyMatchEmbed(earlyPlayers) {
  const lines = earlyPlayers.map((p) => {
    const ago = p.since ? ` (~${minutesSince(p.since)}m since queue popped)` : '';
    return `${STAR} **${shortName(p.displayName)}**${ago}`;
  });
  return new EmbedBuilder()
    .setTitle('Match found - lobby roster pending')
    .setColor(0xf39c12)
    .setDescription(
      [
        'These ASS players left matchmaking and are still in Deadlock, but their lobby is **not on the watch tab yet**.',
        '',
        lines.join('\n') || '_nobody_',
        '',
        '_Full 6v6 roster + heroes will show automatically once Valve lists the match._',
      ].join('\n')
    )
    .setTimestamp(new Date())
    .setFooter({ text: 'Early signal from Steam presence | Not watch-tab data' });
}

/**
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
  matches = (matches || []).filter((m) =>
    (m.players || []).some((p) => rosterBySteam.has(Number(p.account_id)))
  );

  const allAccountIds = [];
  for (const m of matches) {
    for (const p of m.players || []) {
      if (p.account_id != null) allAccountIds.push(Number(p.account_id));
    }
  }
  const nameBySteam = await resolveSteamNames(allAccountIds);

  const inWatchTab = new Set();
  for (const m of matches) {
    for (const p of m.players || []) {
      if (rosterBySteam.has(Number(p.account_id))) inWatchTab.add(Number(p.account_id));
    }
  }

  const earlyPlayers = getLikelyMatchPlayers()
    .filter((x) => !inWatchTab.has(x.steam32) && rosterBySteam.has(x.steam32))
    .map((x) => ({
      displayName: rosterBySteam.get(x.steam32).displayName,
      since: x.since,
    }));

  /** @type {import('discord.js').EmbedBuilder[]} */
  const embeds = [];
  if (earlyPlayers.length) embeds.push(buildEarlyMatchEmbed(earlyPlayers));
  if (matches.length) {
    embeds.push(...matches.slice(0, 8).map((m) => buildMatchEmbed(m, rosterBySteam, nameBySteam)));
  } else if (!earlyPlayers.length) {
    embeds.push(buildEmptyEmbed());
  }

  const state = loadState();
  if (state.liveLobbiesMessageId) {
    try {
      const msg = await channel.messages.fetch(state.liveLobbiesMessageId);
      await msg.edit({ content: '**Asian Super Server | Live Lobbies**', embeds: embeds.slice(0, 10) });
      return;
    } catch {
      state.liveLobbiesMessageId = null;
    }
  }

  const sent = await channel.send({
    content: '**Asian Super Server | Live Lobbies**',
    embeds: embeds.slice(0, 10),
  });
  state.liveLobbiesMessageId = sent.id;
  saveState(state);
  await sent.pin().catch(() => {});
}

module.exports = { runLobbyBoard, buildMatchEmbed, buildEmptyEmbed, buildEarlyMatchEmbed };
