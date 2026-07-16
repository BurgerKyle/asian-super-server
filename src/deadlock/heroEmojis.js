const fs = require('fs');
const path = require('path');
const { config } = require('../config');
const { ensureHeroes } = require('./heroes');

const CACHE_FILE = path.join(config.dataDir, 'hero_emojis.json');

/** @type {Map<number, string>} heroId -> <:name:id> */
let emojiByHeroId = new Map();
let synced = false;

function loadDiskCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    const next = new Map();
    for (const [k, v] of Object.entries(raw.emojis || {})) {
      next.set(Number(k), String(v));
    }
    emojiByHeroId = next;
  } catch {
    /* ignore */
  }
}

function saveDiskCache() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const emojis = {};
  for (const [k, v] of emojiByHeroId) emojis[String(k)] = v;
  fs.writeFileSync(
    CACHE_FILE,
    JSON.stringify({ updatedAt: new Date().toISOString(), emojis }, null, 2) + '\n'
  );
}

function emojiNameForHero(heroId) {
  return `dl_${Number(heroId)}`;
}

function heroEmoji(heroId) {
  return emojiByHeroId.get(Number(heroId)) || '';
}

/**
 * Sync Deadlock hero icons as Discord application emojis (bot-only).
 * Safe on every boot — skips heroes that already exist.
 *
 * @param {import('discord.js').Client} client
 */
async function ensureHeroEmojis(client) {
  if (synced && emojiByHeroId.size) return emojiByHeroId;
  loadDiskCache();

  if (!client.application) {
    console.warn('[hero-emojis] client.application missing');
    return emojiByHeroId;
  }

  const heroMap = await ensureHeroes(config.deadlockApiKey);
  await client.application.emojis.fetch().catch(() => null);

  const byName = new Map();
  for (const emoji of client.application.emojis.cache.values()) {
    byName.set(emoji.name, emoji);
  }

  let created = 0;
  let reused = 0;

  for (const [id, hero] of heroMap) {
    const name = emojiNameForHero(id);
    const existing = byName.get(name);
    if (existing) {
      emojiByHeroId.set(id, existing.toString());
      reused += 1;
      continue;
    }

    if (!hero.icon) continue;

    try {
      const emoji = await client.application.emojis.create({
        attachment: hero.icon,
        name,
      });
      emojiByHeroId.set(id, emoji.toString());
      byName.set(name, emoji);
      created += 1;
      await new Promise((r) => setTimeout(r, 350));
    } catch (err) {
      console.warn(`[hero-emojis] failed ${name}:`, err.message);
    }
  }

  saveDiskCache();
  synced = true;
  console.log(`[hero-emojis] ready: ${emojiByHeroId.size} (created=${created}, reused=${reused})`);
  return emojiByHeroId;
}

loadDiskCache();

module.exports = {
  ensureHeroEmojis,
  heroEmoji,
  emojiNameForHero,
};
