const { getHeroes } = require('./client');

/** @type {Map<number, { id: number, name: string, icon: string }>} */
let heroById = new Map();
let loadedAt = 0;
const TTL_MS = 6 * 60 * 60 * 1000;

function fixAssetUrl(url) {
  if (!url || typeof url !== 'string') return '';
  return url
    .replace('assets-bucket.deadlock-api.com/assets-api-res/', 'assets.deadlock-api.com/')
    .replace('assets-bucket.deadlock-api.com/', 'assets.deadlock-api.com/');
}

function pickIcon(images) {
  if (!images || typeof images !== 'object') return '';
  return fixAssetUrl(
    images.icon_image_small ||
      images.icon_image_small_webp ||
      images.minimap_image ||
      images.icon_hero_card ||
      ''
  );
}

async function ensureHeroes(apiKey) {
  if (heroById.size && Date.now() - loadedAt < TTL_MS) return heroById;
  const list = await getHeroes(apiKey);
  const next = new Map();
  for (const h of list || []) {
    const id = h.id ?? h.hero_id;
    if (id == null) continue;
    const name = h.name || h.class_name || `Hero ${id}`;
    next.set(Number(id), {
      id: Number(id),
      name,
      icon: pickIcon(h.images),
    });
  }
  heroById = next;
  loadedAt = Date.now();
  return heroById;
}

function getHero(heroId) {
  return heroById.get(Number(heroId)) || null;
}

function heroName(heroId) {
  const h = getHero(heroId);
  return h ? h.name : `Hero ${heroId}`;
}

/** Markdown: linked hero name opens the portrait (Discord cannot inline arbitrary images in embeds). */
function heroLabel(heroId) {
  const h = getHero(heroId);
  if (!h) return `Hero ${heroId}`;
  if (h.icon) return `[${h.name}](${h.icon})`;
  return h.name;
}

module.exports = { ensureHeroes, getHero, heroName, heroLabel, fixAssetUrl };
