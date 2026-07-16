const path = require('path');
const { config } = require('../config');
const { writeJsonAtomic, readJsonSafe } = require('./safeJson');

function filePath(name) {
  return path.join(config.dataDir, name);
}

function readJson(name, fallback) {
  return readJsonSafe(filePath(name), fallback);
}

function writeJson(name, data) {
  writeJsonAtomic(filePath(name), data);
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
