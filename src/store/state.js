const fs = require('fs');
const path = require('path');
const { config } = require('../config');

function filePath(name) {
  return path.join(config.dataDir, name);
}

function readJson(name, fallback) {
  const p = filePath(name);
  if (!fs.existsSync(p)) return structuredClone(fallback);
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return structuredClone(fallback);
  }
}

function writeJson(name, data) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const tmp = filePath(`${name}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, filePath(name));
}

/** Persistent bot state: Discord message IDs we edit in-place, last notify stamps */
const EMPTY_STATE = {
  liveLobbiesMessageId: null,
  leaderboardMessageId: null,
  presenceMessageId: null,
  lastQueueNotifyKey: null,
};

function loadState() {
  return readJson('state.json', EMPTY_STATE);
}

function saveState(state) {
  writeJson('state.json', state);
}

/**
 * Schedule shape:
 * {
 *   enabled: boolean,
 *   timezone: "Asia/Manila",
 *   days: [0-6] Sunday=0,
 *   hour: 21,
 *   minute: 0,
 *   serverLabel: "Asia Super Server",
 *   remindMinutes: [15, 0]
 * }
 */
const EMPTY_SCHEDULE = {
  enabled: false,
  timezone: 'Asia/Manila',
  days: [5, 6],
  hour: 21,
  minute: 0,
  serverLabel: '',
  remindMinutes: [15, 0],
};

function loadSchedule() {
  const s = readJson('schedule.json', EMPTY_SCHEDULE);
  if (!s.serverLabel) s.serverLabel = config.defaultServerLabel;
  return s;
}

function saveSchedule(schedule) {
  writeJson('schedule.json', schedule);
}

/**
 * Queue-night scores:
 * {
 *   season: "2026-Q3",
 *   players: { "<steam32>": { wins, losses, games, attendance } }
 * }
 */
const EMPTY_SCORES = { season: 'default', players: {} };

function loadScores() {
  return readJson('scores.json', EMPTY_SCORES);
}

function saveScores(scores) {
  writeJson('scores.json', scores);
}

module.exports = {
  loadState,
  saveState,
  loadSchedule,
  saveSchedule,
  loadScores,
  saveScores,
};
