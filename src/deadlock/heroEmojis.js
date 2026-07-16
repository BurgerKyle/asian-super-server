const path = require('path');
const { config } = require('../config');
const { ensureHeroes } = require('./heroes');
const { writeJsonAtomic, readJsonSafe } = require('../store/safeJson');

const CACHE_FILE = path.join(config.dataDir, 'hero_emojis.json');
/** Don't upload every hero in one boot - Discord rate-limits and blocks readiness. */
const MAX_CREATE_PER_BOOT = Number(process.env.HERO_EMOJI_CREATE_PER_BOOT || 15);

/** @type {Map<number, string>} heroId -> <:name:id> */
let emojiByHeroId = new Map();
let syncPromise = null;

function loadDiskCache() {
  try {
    const raw = readJsonSafe(CACHE_FILE, { emojis: {} });
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
  const emojis = {};
  for (const [k, v] of emojiByHeroId) emojis[String(k)] = v;
  try {
    writeJsonAtomic(CACHE_FILE, { updatedAt: new Date().toISOString(), emojis });
  } catch (err) {
    console.warn('[hero-emojis] cache save failed:', err.message);
  }
}

function emojiNameForHero(heroId) {
  return `dl_${Number(heroId)}`;
}

function heroEmoji(heroId) {
  return emojiByHeroId.get(Number(heroId)) || '';
}

/**
 * Sync Deadlock hero icons as Discord application emojis (bot-only).
 * Loads disk cache first, reuses existing app emojis, creates a few missing
 * ones per boot (non-blocking caller should not await forever).
 *
 * @param {import('discord.js').Client} client
 */
async function ensureHeroEmojis(client) {
  loadDiskCache();
  if (emojiByHeroId.size) {
    console.log(`[hero-emojis] loaded ${emojiByHeroId.size} from disk cache`);
  }

  if (!client.application) {
    console.warn('[hero-emojis] client.application missing');
    return emojiByHeroId;
  }

  const heroMap = await ensureHeroes(config.deadlockApiKey);
  await client.application.emojis.fetch().catch((err) => {
    console.warn('[hero-emojis] fetch failed:', err.message);
  });

  const byName = new Map();
  for (const emoji of client.application.emojis.cache.values()) {
    byName.set(emoji.name, emoji);
  }

  let created = 0;
  let reused = 0;
  let skippedCreate = 0;

  for (const [id, hero] of heroMap) {
    const name = emojiNameForHero(id);
    const existing = byName.get(name);
    if (existing) {
      emojiByHeroId.set(id, existing.toString());
      reused += 1;
      continue;
    }

    // Already have a cached mention from a previous session  keep it
    if (emojiByHeroId.has(id)) continue;

    if (!hero.icon) continue;

    if (created >= MAX_CREATE_PER_BOOT) {
      skippedCreate += 1;
      continue;
    }

    try {
      const emoji = await client.application.emojis.create({
        attachment: hero.icon,
        name,
      });
      emojiByHeroId.set(id, emoji.toString());
      byName.set(name, emoji);
      created += 1;
      console.log(`[hero-emojis] created ${name} (${created}/${MAX_CREATE_PER_BOOT} this boot)`);
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      console.warn(`[hero-emojis] failed ${name}:`, err.message);
      // Stop creating more this boot if we're rate-limited
      if (/rate|429|limit/i.test(err.message)) break;
    }
  }

  saveDiskCache();
  console.log(
    `[hero-emojis] ready: ${emojiByHeroId.size} (created=${created}, reused=${reused}, deferred=${skippedCreate})`
  );
  return emojiByHeroId;
}

/**
 * Fire-and-forget sync so bot loops can start immediately.
 * @param {import('discord.js').Client} client
 */
function ensureHeroEmojisBackground(client) {
  if (syncPromise) return syncPromise;
  loadDiskCache();
  syncPromise = ensureHeroEmojis(client)
    .catch((err) => console.warn('[hero-emojis] sync failed:', err.message))
    .finally(() => {
      syncPromise = null;
    });
  return syncPromise;
}

loadDiskCache();

module.exports = {
  ensureHeroEmojis,
  ensureHeroEmojisBackground,
  heroEmoji,
  emojiNameForHero,
};
