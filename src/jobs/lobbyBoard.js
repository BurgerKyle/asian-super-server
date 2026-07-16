const { EmbedBuilder } = require('discord.js');
const { config } = require('../config');
const { getActiveMatches } = require('../deadlock/client');
const { ensureHeroes, heroLabel, getHero } = require('../deadlock/heroes');
const { resolveSteamNames } = require('../deadlock/steamNames');
const { loadRoster, allSteamIds } = require('../store/roster');
const { loadState, saveState } = require('../store/state');

const STAR = '\u2605'; // black star

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

function playerLine(p, rosterBySteam, nameBySteam) {
  const steam = Number(p.account_id);
  const tracked = rosterBySteam.get(steam);
  const name =
    (tracked && tracked.displayName) ||
    nameBySteam.get(steam) ||
    (steam ? `Player ${steam}` : 'Unknown');
  const hero = heroLabel(p.hero_id);
  const star = tracked ? `${STAR} ` : '';
  const stream = tracked?.streamUrl ? ` ([stream](${tracked.streamUrl}))` : '';
  return `${star}**${name}** | ${hero}${stream}`;
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

  // Prefer team order 0 then 1, then any others
  const keys = [...byTeam.keys()].sort((a, b) => Number(a) - Number(b));

  const fields = keys.slice(0, 2).map((k) => {
    const roster = byTeam.get(k) || [];
    // Pad / show up to 6
    const lines = roster.slice(0, 6).map((p) => playerLine(p, rosterBySteam, nameBySteam));
    while (lines.length < 6 && lines.length < roster.length) {
      /* noop */
    }
    const sample = roster[0];
    const trackedOnTeam = roster.filter((p) => rosterBySteam.has(Number(p.account_id))).length;
    const name = teamTitle(k, sample);
    const value = lines.length ? lines.join('\n') : '_empty_';
    return {
      name: `${name}${trackedOnTeam ? ` (${STAR} ${trackedOnTeam})` : ''}`,
      value: value.slice(0, 1024),
      inline: true,
    };
  });

  const embed = new EmbedBuilder()
    .setColor(0xe8a838)
    .setTitle(`Match #${mid}`)
    .setDescription(
      [
        `**${mode}** | \`${region}\` | \`${dur}\` | ${spectators} spectating`,
        `${STAR} = Asian Super Server tracked`,
        '_Hero name links open the character icon._',
      ].join('\n')
    )
    .addFields(fields)
    .setTimestamp(new Date())
    .setFooter({ text: 'Updates every ~15s | Asia queue nights' });

  // Thumbnail: first tracked player's hero portrait
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
      'No tracked players in active matches right now.\nUse `/track` or `/link`, then queue on Asia.'
    )
    .setTimestamp(new Date())
    .setFooter({ text: 'Updates every ~15s | Asia queue nights' });
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

  // Only keep matches that actually include at least one tracked player
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

  const embeds = matches.length
    ? matches.slice(0, 8).map((m) => buildMatchEmbed(m, rosterBySteam, nameBySteam))
    : [buildEmptyEmbed()];

  // Discord: max 10 embeds per message
  const state = loadState();
  if (state.liveLobbiesMessageId) {
    try {
      const msg = await channel.messages.fetch(state.liveLobbiesMessageId);
      await msg.edit({ content: '**Asian Super Server | Live Lobbies**', embeds });
      return;
    } catch {
      state.liveLobbiesMessageId = null;
    }
  }

  const sent = await channel.send({ content: '**Asian Super Server | Live Lobbies**', embeds });
  state.liveLobbiesMessageId = sent.id;
  saveState(state);
  await sent.pin().catch(() => {});
}

module.exports = { runLobbyBoard, buildMatchEmbed, buildEmptyEmbed };
