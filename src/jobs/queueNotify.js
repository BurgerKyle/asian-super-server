const { EmbedBuilder } = require('discord.js');
const { config } = require('../config');
const { loadSchedule, loadState, saveState } = require('../store/state');

/** Format parts in a given IANA timezone */
function zonedParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    day: weekdayMap[parts.weekday] ?? 0,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

function minutesUntilTonight(nowParts, schedule) {
  if (!schedule.days.includes(nowParts.day)) return null;
  const target = schedule.hour * 60 + schedule.minute;
  const now = nowParts.hour * 60 + nowParts.minute;
  return target - now;
}

/**
 * Check schedule and post queue reminders (T-15, T-0 by default).
 * @param {import('discord.js').Client} client
 */
async function runQueueNotify(client) {
  const channelId = config.channels.queueNights;
  if (!channelId) return;

  const schedule = loadSchedule();
  if (!schedule.enabled) return;

  const now = new Date();
  const parts = zonedParts(now, schedule.timezone || 'Asia/Manila');
  const until = minutesUntilTonight(parts, schedule);
  if (until == null) return;

  const reminds = (schedule.remindMinutes || [15, 0]).slice().sort((a, b) => b - a);
  const hit = reminds.find((m) => until === m);
  if (hit == null) return;

  const key = `${parts.ymd}-T${hit}`;
  const state = loadState();
  if (state.lastQueueNotifyKey === key) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const server = schedule.serverLabel || config.defaultServerLabel;
  const when =
    hit === 0
      ? '**Queue now!**'
      : `Queue in **${hit} minutes**`;

  const embed = new EmbedBuilder()
    .setTitle('Asian Super Server | Queue Night')
    .setColor(0x2ecc71)
    .setDescription(
      [
        when,
        '',
        `**Server:** ${server}`,
        `**Local time:** ${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')} (${schedule.timezone})`,
        '',
        'Stack with the community so we land on the same Asia games.',
      ].join('\n')
    )
    .setTimestamp(now);

  const role = config.queuePingRoleId ? `<@&${config.queuePingRoleId}>` : '';
  await channel.send({ content: role || undefined, embeds: [embed] });

  state.lastQueueNotifyKey = key;
  saveState(state);
  console.log(`[queue] notified ${key}`);
}

/**
 * Manual force-notify (slash command).
 */
async function forceQueueNotify(client, extraNote = '') {
  const channelId = config.channels.queueNights;
  if (!channelId) throw new Error('CHANNEL_QUEUE_NIGHTS not set');
  const schedule = loadSchedule();
  const channel = await client.channels.fetch(channelId);
  const server = schedule.serverLabel || config.defaultServerLabel;
  const embed = new EmbedBuilder()
    .setTitle('Asian Super Server | Queue Call')
    .setColor(0x2ecc71)
    .setDescription(
      [`**Queue up now** on **${server}**.`, extraNote ? `\n${extraNote}` : ''].join('')
    )
    .setTimestamp(new Date());
  const role = config.queuePingRoleId ? `<@&${config.queuePingRoleId}>` : '';
  await channel.send({ content: role || undefined, embeds: [embed] });
}

module.exports = { runQueueNotify, forceQueueNotify, zonedParts };
