// Progreso permanente: frutos, niveles del árbol de mejoras, estadísticas y guardado. Sin DOM.

import { NODES, NODE_BY_ID, BASE, ZONES } from './data.js';

export const SAVE_VERSION = 1;

export function newState(now = Date.now()) {
  return {
    game: 'savia',
    v: SAVE_VERSION,
    seed: Math.floor(Math.random() * 2 ** 31),
    res: { f: 0 },
    levels: { semilla: 1 },
    seasons: 0,
    zone: 'pradera',
    pollen: 1, // multiplicador de frutos de la próxima temporada (Polinizar)
    pollenAt: 0, // temporada desde la que se puede volver a polinizar
    pruneAt: 0, // temporada desde la que se puede volver a podar
    legacy: 0, // veces que has llegado al árbol madre: frutos ×2 por cada una, para siempre
    done: false, // árbol madre comprado en esta partida
    stats: { bestF: 0, totalF: 0, time: 0, started: now, bought: 0, caught: 0, deepPradera: 0, deepRibera: 0, deepLadera: 0, deepViejo: 0, bestGrowth: 0, bestPollen: 0, bestPrune: 0 },
    history: [], // partidas acabadas: { time, seasons, fruits }
    last: null, // resumen de la última temporada
    flags: {},
    settings: { sound: true, shake: true },
    lastSave: now,
  };
}

export const lvl = (s, id) => s.levels[id] || 0;

const DEEP = { pradera: 'deepPradera', ribera: 'deepRibera', ladera: 'deepLadera', viejo: 'deepViejo' };
/** Récord de profundidad (px) en esa zona. */
export const depthRecord = (s, zone) => s.stats[DEEP[zone] || DEEP.pradera] || 0;

export function nodeCost(s, node) {
  return Math.ceil(node.cost.b * node.cost.k ** lvl(s, node.id));
}

/** Visible si ya lo tienes o si tienes alguno de los que lleva a él. */
export function isVisible(s, node) {
  return lvl(s, node.id) > 0 || node.req.some((r) => lvl(s, r) > 0);
}

/** Requisitos que faltan para un nodo final (reqAll). */
export function missingReqs(s, node) {
  return (node.reqAll || []).filter((r) => lvl(s, r) < 1);
}

/** 'max' | 'buy' (se puede comprar) | 'poor' (visible, sin frutos) | 'locked' (le faltan ramas) | 'hidden' */
export function nodeStatus(s, node) {
  if (!isVisible(s, node)) return 'hidden';
  if (lvl(s, node.id) >= node.max) return 'max';
  if (missingReqs(s, node).length) return 'locked';
  return s.res[node.cost.c] >= nodeCost(s, node) ? 'buy' : 'poor';
}

export function buyNode(s, id) {
  const node = NODE_BY_ID[id];
  if (!node || nodeStatus(s, node) !== 'buy') return false;
  s.res[node.cost.c] -= nodeCost(s, node);
  s.levels[id] = lvl(s, id) + 1;
  s.stats.bought += 1;
  if (node.final) s.done = true;
  return true;
}

/** Polinizar: lo da «Abejas» y se puede jugar cada pocas temporadas. */
export const POLLEN_EVERY = 3;
export const pollenReady = (s) => lvl(s, 'abejas') > 0 && s.seasons >= s.pollenAt && s.pollen <= 1;
export const pollenPerFlower = (s) => 0.05 + 0.01 * lvl(s, 'colmena');
export const pollenTime = (s) => 10 + 3 * lvl(s, 'colmena');

/** Guarda el resultado de Polinizar: vale para la próxima temporada. */
export function setPollen(s, flowers) {
  s.pollen = 1 + flowers * pollenPerFlower(s);
  s.pollenAt = s.seasons + POLLEN_EVERY;
  s.stats.bestPollen = Math.max(s.stats.bestPollen || 0, flowers);
}

/** Podar: lo dan las «Tijeras de podar»; da frutos al momento según la última temporada. */
export const PRUNE_EVERY = 3;
export const pruneReady = (s) => lvl(s, 'tijeras') > 0 && s.seasons >= s.pruneAt;
export const pruneTime = (s) => 8 + 2 * lvl(s, 'afilar');
/** Frutos por rama cortada. */
export const prunePerBranch = (s) => Math.max(1, (s.last?.f || 0) * 0.06 * (1 + 0.5 * lvl(s, 'afilar')));

export function applyPrune(s, cut) {
  const f = cut * prunePerBranch(s);
  s.res.f += f;
  s.stats.totalF += f;
  s.pruneAt = s.seasons + PRUNE_EVERY;
  s.stats.bestPrune = Math.max(s.stats.bestPrune || 0, cut);
  return f;
}

/**
 * Empezar de nuevo tras el árbol madre: vuelves a la semilla con frutos ×2 más para siempre.
 * Se guardan los ajustes, las ventanas ya vistas, el historial y el tiempo total de juego.
 */
export function rebirth(s, now = Date.now()) {
  const n = newState(now);
  n.legacy = (s.legacy || 0) + 1;
  n.settings = { ...s.settings };
  n.flags = { ...s.flags };
  n.history = [...(s.history || []), { time: s.stats.time, seasons: s.seasons, fruits: s.stats.totalF }];
  return n;
}

/** Zonas que ya puedes elegir. */
export const zonesOpen = (s) => Object.keys(ZONES).filter((z) => !ZONES[z].unlock || lvl(s, ZONES[z].unlock) > 0);

export function affordableCount(s) {
  return NODES.filter((n) => nodeStatus(s, n) === 'buy').length;
}

/** Parámetros de la próxima temporada según las mejoras y la zona. */
export function computeStats(s, zone = 'pradera') {
  const L = (id) => lvl(s, id);
  const ribera = zone === 'ribera';
  const ladera = zone === 'ladera';
  const viejo = zone === 'viejo';
  return {
    zone,
    zoneValue: (ZONES[zone] || ZONES.pradera).value * (1 + 0.25 * L('riego')),
    trees: 1 + L('plantar'),
    // raíces
    speed: (BASE.rootLen * 1.2 ** L('largo')) / (BASE.rootTime * 0.9 ** L('rapidas')),
    startRoots: BASE.startRoots + L('doble'),
    sprouts: BASE.sprouts + 2 * L('brotes'),
    rootLen: BASE.rootLen * 1.2 ** L('largo'),
    attract: BASE.attract * (1 + 0.25 * L('atraccion')),
    sense: L('olfato') ? 25 + 15 * (L('olfato') - 1) : 0,
    hardK: 1.5 ** L('pivotante'),
    // suelo
    absorb: BASE.absorb + L('pelos'),
    value: 1 + 0.3 * L('digestion'),
    pockets: BASE.pockets * (1 + 0.25 * L('rico')),
    big: BASE.big + 0.04 * L('gordas'),
    bigSprout: 1,
    stones: ladera ? 0 : 8,
    stonePass: L('rompe') > 0,
    puddles: ladera ? 0 : 2 * L('lluvia'),
    // árbol y cosecha
    lenGrowth: BASE.lenGrowth,
    growth: 1 + 0.25 * L('savia'),
    fruitRate: BASE.fruitRate * (1 + 0.2 * L('frutos')) * (s.pollen || 1) * 2 ** L('crecida') * 2 ** L('cumbre') * 2 ** L('eterno') * 2 ** (s.legacy || 0),
    maxFruits: 24,
    gold: 0.03 * L('dorado'),
    catchR: BASE.catchR + 3 * L('cesta'),
    gravity: BASE.gravity * 0.8 ** L('lenta'),
    fallMax: 80 * 0.85 ** L('lenta'),
    dropSpread: 2.2 + 0.4 * L('lenta'),
    catchMult: 2 + 0.5 * L('vuelo'),
    landMult: 1 + 0.25 * L('mantillo'),
    // bosque
    linkBonus: 0.03 * L('entrelazadas'),
    linkMax: 8,
    forestBonus: 0.05 * L('vivero'),
    // ribera: una capa de agua subterránea (profundidades en px) con corriente
    waterTop: ribera ? 36 : 0,
    waterBottom: ribera ? 260 : 0,
    waterSpeed: 2 + 0.5 * L('capilar'),
    current: ribera ? 16 * (1 - 0.25 * L('anclas')) : 0,
    wetBonus: ribera ? 0.04 + 0.02 * L('sed') : 0,
    wetMax: 10,
    // ladera: roca con grietas, vetas y zarzas
    rockTop: ladera ? 12 : 0,
    cracks: 3 + L('grietas'),
    crackW: 3 + L('grietas'),
    acid: 8 * L('acido'),
    veins: ladera ? 2 + L('vetas') : 0,
    veinValue: 1.5 ** L('vetas'),
    brambles: ladera ? 3 : 0,
    brambleSpeed: 9 * (1 - 0.25 * L('alelopatia')),
    // bosque viejo: tocones que descomponer y raíces muertas que seguir
    stumps: viejo ? 3 + L('memoria') : 0,
    stumpNeed: 70 * 0.7 ** L('carcoma'), // px de raíz dentro del tocón
    stumpValue: 60 * 1.5 ** L('carcoma'), // en bolsas normales
    stumpSprouts: 2,
    deadRoots: viejo ? 2.5 * (1 + 0.3 * L('memoria')) : 0, // raíces muertas sueltas por pantalla de suelo
    deadValue: 0.25 * 1.5 ** L('sendas'), // por px de raíz muerta, en bolsas normales
    deadSpeed: 1.6 + 0.3 * L('sendas'),
  };
}

/** Suma lo ganado en una temporada. */
export function applySeason(s, gained, extra = {}) {
  const f = gained.f || 0;
  s.res.f += f;
  s.seasons += 1;
  s.stats.totalF += f;
  s.stats.time += extra.time || 0;
  s.stats.caught += extra.caught || 0;
  if (f > s.stats.bestF) s.stats.bestF = f;
  if ((extra.growth || 0) > s.stats.bestGrowth) s.stats.bestGrowth = extra.growth;
  const dk = DEEP[extra.zone] || DEEP.pradera;
  if (extra.depth > s.stats[dk]) s.stats[dk] = Math.round(extra.depth);
  s.pollen = 1; // la polinización vale para una sola temporada
  s.last = { f, season: s.seasons };
}

// ── Guardado ───────────────────────────────────────────────────────────────

const num = (x, d = 0) => (Number.isFinite(Number(x)) && Number(x) >= 0 ? Number(x) : d);
const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});

export function hydrate(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || raw.game !== 'savia') throw new Error('Esto no parece una partida de Savia.');
  if (raw.v !== SAVE_VERSION) throw new Error('Esta partida es de otra versión del juego y no se puede cargar.');
  const s = newState(now);
  s.seed = Number.isInteger(raw.seed) ? raw.seed : s.seed;
  s.res.f = num(obj(raw.res).f);
  s.levels = { semilla: 1 };
  for (const [id, l] of Object.entries(obj(raw.levels))) {
    if (NODE_BY_ID[id]) s.levels[id] = Math.min(NODE_BY_ID[id].max, Math.floor(num(l)));
  }
  s.seasons = Math.floor(num(raw.seasons));
  s.pollen = Math.max(1, Math.min(5, num(raw.pollen, 1)));
  s.pollenAt = Math.floor(num(raw.pollenAt));
  s.pruneAt = Math.floor(num(raw.pruneAt));
  s.zone = ZONES[raw.zone] ? raw.zone : 'pradera';
  s.legacy = Math.floor(num(raw.legacy));
  s.done = !!raw.done;
  s.history = Array.isArray(raw.history) ? raw.history.slice(-20).map((h) => ({ time: num(h?.time), seasons: num(h?.seasons), fruits: num(h?.fruits) })) : [];
  for (const k of Object.keys(s.stats)) if (k in obj(raw.stats)) s.stats[k] = num(raw.stats[k]);
  s.last = raw.last && typeof raw.last === 'object' ? { f: num(raw.last.f), season: num(raw.last.season) } : null;
  s.flags = { ...obj(raw.flags) };
  s.settings = { ...s.settings, ...obj(raw.settings) };
  s.lastSave = num(raw.lastSave) || now;
  return s;
}
