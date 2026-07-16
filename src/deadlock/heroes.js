const { getHeroes } = require('./client');

/** @type {Map<number, { id: number, name: string }>} */
let heroById = new Map();
let loadedAt = 0;
const TTL_MS = 6 * 60 * 60 * 1000;

async function ensureHeroes(apiKey) {
  if (heroById.size && Date.now() - loadedAt < TTL_MS) return heroById;
  const list = await getHeroes(apiKey);
  const next = new Map();
  for (const h of list || []) {
    const id = h.id ?? h.hero_id;
    const name = h.name || h.class_name || `Hero ${id}`;
    if (id != null) next.set(Number(id), { id: Number(id), name });
  }
  heroById = next;
  loadedAt = Date.now();
  return heroById;
}

function heroName(heroId) {
  const h = heroById.get(Number(heroId));
  return h ? h.name : `Hero ${heroId}`;
}

module.exports = { ensureHeroes, heroName };
