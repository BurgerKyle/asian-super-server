const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { upsertPlayer, removeByDiscord, loadRoster, findByDiscord } = require('../store/roster');
const { loadSchedule, saveSchedule } = require('../store/state');
const { forceQueueNotify } = require('../jobs/queueNotify');
const { config } = require('../config');

function steam32FromInput(raw) {
  const s = String(raw).trim();
  // Accept Steam64 (7656119...) or Steam32
  if (/^\d{17}$/.test(s)) {
    return Number(BigInt(s) - 76561197960265728n);
  }
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

const commands = [
  new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Discord account to a Deadlock / Steam account ID')
    .addStringOption((o) =>
      o
        .setName('steam_id')
        .setDescription('Steam32 account ID (or Steam64). Find it on deadlock-api.com / Dotabuff.')
        .setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('stream_url').setDescription('Optional Twitch/YouTube stream URL').setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Remove your Steam link from the Asian Super Server roster'),

  new SlashCommandBuilder()
    .setName('roster')
    .setDescription('Show who is on the tracked Asia Super Server roster'),

  new SlashCommandBuilder()
    .setName('mystats')
    .setDescription('Show your linked Steam ID and stream URL'),

  new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Show or set the queue-night schedule (admins set)')
    .addSubcommand((sc) => sc.setName('show').setDescription('Show the current queue schedule'))
    .addSubcommand((sc) =>
      sc
        .setName('set')
        .setDescription('Set queue nights (admin)')
        .addIntegerOption((o) => o.setName('hour').setDescription('Hour 0-23 local').setRequired(true).setMinValue(0).setMaxValue(23))
        .addIntegerOption((o) => o.setName('minute').setDescription('Minute 0-59').setRequired(true).setMinValue(0).setMaxValue(59))
        .addStringOption((o) =>
          o
            .setName('days')
            .setDescription('Comma days: 0=Sun … 6=Sat (e.g. 5,6 for Fri+Sat)')
            .setRequired(true)
        )
        .addStringOption((o) =>
          o.setName('timezone').setDescription('IANA timezone, default Asia/Manila').setRequired(false)
        )
        .addStringOption((o) =>
          o.setName('server').setDescription('Server label shown in pings').setRequired(false)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('queuecall')
    .setDescription('Force a queue-now announcement (admin)')
    .addStringOption((o) => o.setName('note').setDescription('Extra note').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map((c) => c.toJSON());

async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;

  const name = interaction.commandName;

  if (name === 'link') {
    const steam32 = steam32FromInput(interaction.options.getString('steam_id', true));
    if (steam32 == null) {
      await interaction.reply({ content: 'Invalid Steam ID. Use Steam32 (e.g. 123456789) or Steam64.', flags: MessageFlags.Ephemeral });
      return;
    }
    const streamUrl = interaction.options.getString('stream_url') || '';
    const row = upsertPlayer({
      discordId: interaction.user.id,
      steam32,
      displayName: interaction.member?.displayName || interaction.user.username,
      streamUrl,
    });
    await interaction.reply({
      content: `Linked **${row.displayName}** ? Steam32 \`${row.steam32}\`${streamUrl ? `\nStream: ${streamUrl}` : ''}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (name === 'unlink') {
    const ok = removeByDiscord(interaction.user.id);
    await interaction.reply({
      content: ok ? 'Unlinked. You are off the live-lobby roster.' : 'You were not linked.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (name === 'roster') {
    const { players } = loadRoster();
    if (!players.length) {
      await interaction.reply({ content: 'Roster is empty. Use `/link` to join.', flags: MessageFlags.Ephemeral });
      return;
    }
    const lines = players
      .slice(0, 40)
      .map((p) => `• <@${p.discordId}> — \`${p.steam32}\`${p.streamUrl ? ' ??' : ''}`);
    await interaction.reply({
      content: `**Asian Super Server roster** (${players.length})\n${lines.join('\n')}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (name === 'mystats') {
    const row = findByDiscord(interaction.user.id);
    if (!row) {
      await interaction.reply({ content: 'Not linked. Use `/link steam_id:...`', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply({
      content: `Steam32: \`${row.steam32}\`\nStream: ${row.streamUrl || '(none)'}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (name === 'schedule') {
    const sub = interaction.options.getSubcommand();
    if (sub === 'show') {
      const s = loadSchedule();
      await interaction.reply({
        content: [
          `**Enabled:** ${s.enabled}`,
          `**Days:** ${(s.days || []).join(', ')} (0=Sun … 6=Sat)`,
          `**Time:** ${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')} (${s.timezone})`,
          `**Server:** ${s.serverLabel || config.defaultServerLabel}`,
          `**Remind at:** T-${(s.remindMinutes || []).join(', T-')} min`,
        ].join('\n'),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (sub === 'set') {
      const days = interaction.options
        .getString('days', true)
        .split(',')
        .map((x) => Number.parseInt(x.trim(), 10))
        .filter((n) => n >= 0 && n <= 6);
      if (!days.length) {
        await interaction.reply({ content: 'Provide at least one day 0–6.', flags: MessageFlags.Ephemeral });
        return;
      }
      const schedule = {
        enabled: true,
        timezone: interaction.options.getString('timezone') || 'Asia/Manila',
        days,
        hour: interaction.options.getInteger('hour', true),
        minute: interaction.options.getInteger('minute', true),
        serverLabel: interaction.options.getString('server') || config.defaultServerLabel,
        remindMinutes: [15, 0],
      };
      saveSchedule(schedule);
      await interaction.reply({
        content: `Schedule saved. Queue nights: days [${days.join(',')}] at ${schedule.hour}:${String(schedule.minute).padStart(2, '0')} ${schedule.timezone} ? **${schedule.serverLabel}**`,
      });
      return;
    }
  }

  if (name === 'queuecall') {
    const note = interaction.options.getString('note') || '';
    await forceQueueNotify(interaction.client, note);
    await interaction.reply({ content: 'Queue call sent.', flags: MessageFlags.Ephemeral });
  }
}

module.exports = { commands, handleInteraction, steam32FromInput };
