const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ass-test-'));
process.env.DISCORD_TOKEN = 'test-token';
process.env.DISCORD_CLIENT_ID = 'test-client';
process.env.DISCORD_GUILD_ID = 'test-guild';
process.env.DATA_DIR = tmp;
process.env.LOBBY_POLL_MS = '100'; // should clamp up to 5000

const { intEnv, config } = require('../src/config');
const { writeJsonAtomic, readJsonSafe } = require('../src/store/safeJson');
const { patchState, loadState, saveState } = require('../src/store/state');
const { classifyPresence } = require('../src/deadlock/steamPresence');
const {
  refineStatus,
  formatElapsed,
  matchElapsedMs,
} = require('../src/store/presenceMemory');
const { zonedParts } = require('../src/jobs/queueNotify');
const { minAssPlayers, ASS_THRESHOLD, LOBBY_SIZE, buildLeaderboardEmbed } = require('../src/jobs/leaderboard');

describe('intEnv / config clamps', () => {
  it('clamps lobby poll floor', () => {
    assert.equal(config.lobbyPollMs, 5000);
  });
  it('intEnv falls back and clamps', () => {
    assert.equal(intEnv('MISSING_ENV_XYZ', 42, { min: 10, max: 100 }), 42);
    process.env.TMP_INTENV = '9999';
    assert.equal(intEnv('TMP_INTENV', 1, { min: 0, max: 50 }), 50);
    process.env.TMP_INTENV = 'nope';
    assert.equal(intEnv('TMP_INTENV', 7, { min: 0, max: 50 }), 7);
  });
});

describe('safeJson', () => {
  it('round-trips atomically', () => {
    const file = path.join(tmp, 'round.json');
    writeJsonAtomic(file, { a: 1 });
    assert.deepEqual(readJsonSafe(file, {}), { a: 1 });
  });
  it('returns fallback on missing/corrupt', () => {
    assert.deepEqual(readJsonSafe(path.join(tmp, 'nope.json'), { z: 1 }), { z: 1 });
    const bad = path.join(tmp, 'bad.json');
    fs.writeFileSync(bad, '{not-json', 'utf8');
    assert.deepEqual(readJsonSafe(bad, { ok: true }), { ok: true });
  });
});

describe('patchState race safety', () => {
  before(() => {
    saveState({
      liveLobbiesMessageId: null,
      leaderboardMessageId: null,
      presenceMessageId: null,
      lastQueueNotifyKey: null,
    });
  });

  it('merges patches without wiping sibling keys', () => {
    patchState({ liveLobbiesMessageId: 'lobby-1' });
    patchState({ presenceMessageId: 'pres-1' });
    const s = loadState();
    assert.equal(s.liveLobbiesMessageId, 'lobby-1');
    assert.equal(s.presenceMessageId, 'pres-1');
  });
});

describe('classifyPresence', () => {
  it('prefers active match', () => {
    assert.equal(classifyPresence({ gameid: '1422450' }, true), 'in_match');
  });
  it('detects searching via gameextrainfo', () => {
    assert.equal(
      classifyPresence({ gameid: '1422450', gameextrainfo: 'Finding a match', personastate: 1 }, false),
      'searching'
    );
  });
  it('marks other games / offline', () => {
    assert.equal(classifyPresence({ gameid: '570', personastate: 1 }, false), 'other_game');
    assert.equal(classifyPresence({ personastate: 0 }, false), 'offline');
    assert.equal(classifyPresence(null, false), 'hidden');
  });
});

describe('presenceMemory', () => {
  it('formats elapsed clocks', () => {
    assert.equal(formatElapsed(125000), '2:05');
    assert.equal(formatElapsed(3661000), '1:01:01');
    assert.equal(formatElapsed(null), null);
  });
  it('matchElapsedMs prefers duration_s', () => {
    assert.equal(matchElapsedMs({ duration_s: 90 }), 90000);
  });
  it('refines searching -> loading_match transition', () => {
    const id = 424242;
    const t0 = 1_000_000;
    assert.equal(refineStatus(id, 'searching', t0), 'searching');
    assert.equal(refineStatus(id, 'in_deadlock', t0 + 5_000), 'loading_match');
  });
});

describe('zonedParts', () => {
  it('returns finite hour in Asia/Manila', () => {
    const parts = zonedParts(new Date('2026-07-17T13:00:00Z'), 'Asia/Manila');
    assert.ok(parts.hour >= 0 && parts.hour <= 23);
    assert.ok(parts.ymd.includes('2026'));
  });
});

describe('leaderboard rules', () => {
  it('computes min ASS players from threshold', () => {
    assert.equal(minAssPlayers(), Math.ceil(ASS_THRESHOLD * LOBBY_SIZE - 1e-9));
    assert.ok(minAssPlayers() >= 1);
  });
  it('builds empty embed without throwing', () => {
    const embed = buildLeaderboardEmbed({ season: 'default', players: {}, rule: { threshold: 0.7, lobbySize: 12, minAssPlayers: 9 } });
    assert.ok(embed.data.title.includes('Leaderboard'));
  });
});
