// Progreso permanente: monedas, niveles del árbol, estadísticas y guardado. Sin DOM.

import { NODES, NODE_BY_ID, BASE } from './data.js';

export const SAVE_VERSION = 3;

export function newState(now = Date.now()) {
  return {
    v: SAVE_VERSION,
    seed: Math.floor(Math.random() * 2 ** 31),
    res: { n: 0, m: 0, a: 0, e: 0, t: 0, c: 0 },
    levels: { espora: 1 },
    seasons: 0,
    biome: 'bosque',
    done: false, // bosque completado (anillo de hadas)
    done2: false, // pantano completado (fuego fatuo)
    done3: false, // cueva completada (corazón de la cueva)
    stats: { bestN: 0, totalN: 0, totalE: 0, time: 0, started: now, bestDecomp: 0, bestEsporada: 0, bought: 0, deepBosque: 0, deepPantano: 0, deepCueva: 0 },
    last: null, // resumen de la última temporada
    flags: {},
    settings: { sound: true, shake: true },
    lastSave: now,
  };
}

export const lvl = (s, id) => s.levels[id] || 0;

const DEEP = { bosque: 'deepBosque', pantano: 'deepPantano', cueva: 'deepCueva' };
/** Récord de profundidad (px) en ese lugar. */
export const depthRecord = (s, biome) => s.stats[DEEP[biome] || DEEP.bosque] || 0;

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

/** 'max' | 'buy' (se puede comprar) | 'poor' (visible, sin dinero) | 'locked' (le faltan ramas) | 'hidden' */
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
  if (node.final === 'bosque') { s.done = true; s.levels.pantano = 1; }
  if (node.final === 'pantano') { s.done2 = true; s.levels.cueva = 1; }
  if (node.final === 'cueva') s.done3 = true;
  return true;
}

export function affordableCount(s) {
  return NODES.filter((n) => nodeStatus(s, n) === 'buy').length;
}

/** Parámetros de la próxima temporada según el árbol y el lugar. */
export function computeStats(s, biome = 'bosque') {
  const L = (id) => lvl(s, id);
  const st = {
    biome,
    speed: BASE.speed * 1.15 ** L('vel') * 1.5 ** L('apical') * 1.25 ** L('corriente') * 1.25 ** L('profundo'),
    tips: BASE.tips + L('puntas'),
    branch: BASE.branch * (1 + 0.35 * L('ramas')),
    attract: BASE.attract * (1 + 0.25 * L('alcance')),
    sense: L('quimio') ? 30 + 18 * (L('quimio') - 1) : 0,
    duration: BASE.duration + 4 * L('dur') + 10 * L('otono'),
    absorb: BASE.absorb + L('radio'),
    value: 1.3 ** L('valor') * 2 ** L('mult1') * 2 ** L('mult2') * 3 ** L('mult3') * 2 ** L('anfibio') * (L('biolum') ? 1.5 : 1) * 3 ** L('resonancia'),
    passive: 0.0002 * L('pasiva'),
    pockets: BASE.pockets + 4 * L('densidad'),
    big: L('grandes') ? 0.1 + 0.05 * L('grandes') : 0,
    leaves: 2 * L('hojarasca'),
    respawn: L('reaparicion') ? 2.5 * 0.8 ** (L('reaparicion') - 1) : 0,
    stonePass: L('piedra') > 0,
    minerals: L('minerales') ? 1.2 + 0.6 * L('min2') : 0, // por pantalla de suelo
    mineralValue: 1 + L('min2'),
    trees: L('arboles') ? 2 + L('bosque') : 0,
    sugar: 0.5 * 1.5 ** L('pelos'),
    logs: L('troncos') ? 2 : 0,
    logValue: 30 * (1 + 0.6 * L('podre')),
    descomp: L('descomp') > 0,
    setas: L('setas') > 0,
    sporesPerSeta: 1 + L('laminas'),
    setaRate: (1 + 0.25 * L('sombrero')) * 1.25 ** L('maduro') * 1.5 ** L('viajeras') * 1.5 ** L('espejo'),
    esporada: L('viento') > 0,
    startBranches: 3 * L('inicio'),
    puddles: 2 * L('lluvia'),
    // pantano
    current: 0, colonies: 0, peat: 0, reeds: 0,
    dark: false, crystals: 0, guano: 0, crickets: 0, stalags: 0,
    biolum: L('biolum') > 0,
  };
  if (biome === 'pantano') {
    Object.assign(st, {
      pockets: Math.round(st.pockets * 0.7),
      big: st.big * 0.5,
      leaves: 0, minerals: 0, trees: 0, logs: 0, puddles: 0,
      current: 22 * (1 - 0.25 * L('nadar')), // px/s de deriva en el barro inundado
      waterSpeed: 1.6,
      colonies: 1.5 * (1 - 0.2 * L('cuarentena')), // por pantalla de suelo
      colonyGrowth: 0.45 * (1 - 0.25 * L('cuarentena')),
      antibiotic: L('antibiotico') > 0,
      dps: 8 * 1.6 ** L('penicilina'),
      colonyHp: 20,
      colonyReward: 3 * 1.5 ** L('penicilina'),
      peat: 0.6 + 0.15 * L('turbera'), // por pantalla de suelo
      peatValue: 4 * 1.5 ** L('turbera'),
      reeds: L('juncos') ? 3 : 0,
      reedRate: 0.25 * 1.5 ** L('rizosfera'),
    });
  }
  if (biome === 'cueva') {
    Object.assign(st, {
      pockets: Math.round(st.pockets * 0.6),
      big: st.big * 0.5,
      leaves: 0, minerals: 0, trees: 0, logs: 0, puddles: 0,
      dark: true,
      light: 10 * 1.3 ** L('luz') * (L('biolum') ? 1.4 : 1), // px que ilumina cada punta
      crystals: 1 + 0.3 * L('geoda'), // por pantalla de roca
      crystalValue: 1.4 * 1.5 ** L('geoda'),
      guano: 2 * L('guano'),
      crickets: L('grillos') ? 0.6 + 0.3 * L('polizones') : 0, // por pantalla de roca
      jumpTips: 2 + L('polizones'),
      stalags: 7,
      stalagPass: L('caliza') > 0,
      echo: L('eco') > 0,
    });
  }
  return st;
}

/** Suma lo ganado en una temporada (ya con los minijuegos aplicados). */
export function applySeason(s, gained, extra = {}) {
  for (const k of ['n', 'm', 'a', 'e', 't', 'c']) s.res[k] += gained[k] || 0;
  s.seasons += 1;
  s.stats.totalN += gained.n || 0;
  s.stats.totalE += gained.e || 0;
  s.stats.time += extra.time || 0;
  if ((gained.n || 0) > s.stats.bestN) s.stats.bestN = gained.n;
  if (extra.decomp > s.stats.bestDecomp) s.stats.bestDecomp = extra.decomp;
  if (extra.esporada > s.stats.bestEsporada) s.stats.bestEsporada = extra.esporada;
  const dk = DEEP[extra.biome] || DEEP.bosque;
  if (extra.depth > s.stats[dk]) s.stats[dk] = Math.round(extra.depth);
  s.last = { ...gained, season: s.seasons };
}

// ── Guardado ───────────────────────────────────────────────────────────────

const num = (x, d = 0) => (Number.isFinite(Number(x)) && Number(x) >= 0 ? Number(x) : d);
const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});

export function hydrate(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object') throw new Error('Esto no parece una partida de Micelio.');
  if (raw.v !== SAVE_VERSION) throw new Error('Esta partida es de una versión anterior del juego y ya no se puede cargar.');
  const s = newState(now);
  s.seed = Number.isInteger(raw.seed) ? raw.seed : s.seed;
  for (const k of ['n', 'm', 'a', 'e', 't', 'c']) s.res[k] = num(obj(raw.res)[k]);
  s.biome = ['pantano', 'cueva'].includes(raw.biome) ? raw.biome : 'bosque';
  s.done2 = !!raw.done2;
  s.done3 = !!raw.done3;
  s.levels = { espora: 1 };
  for (const [id, l] of Object.entries(obj(raw.levels))) {
    if (NODE_BY_ID[id]) s.levels[id] = Math.min(NODE_BY_ID[id].max, Math.floor(num(l)));
  }
  s.seasons = Math.floor(num(raw.seasons));
  s.done = !!raw.done;
  for (const k of Object.keys(s.stats)) if (k in obj(raw.stats)) s.stats[k] = num(raw.stats[k]);
  s.last = raw.last && typeof raw.last === 'object' ? { n: num(raw.last.n), m: num(raw.last.m), a: num(raw.last.a), e: num(raw.last.e), t: num(raw.last.t), c: num(raw.last.c), season: num(raw.last.season) } : null;
  s.flags = { ...obj(raw.flags) };
  s.settings = { ...s.settings, ...obj(raw.settings) };
  s.lastSave = num(raw.lastSave) || now;
  return s;
}
