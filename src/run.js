// Una temporada de Savia, vista en corte. Tres fases:
//  1. raíces: cada árbol echa raíces que bajan por el suelo; el puntero las guía hacia la comida.
//     Cada raíz avanza hasta su largo máximo (o hasta chocar) y se para; si a su árbol le quedan
//     brotes, de esa raíz vieja brota una nueva. Cuando no crece ninguna, se acaba esta fase.
//  2. crecer: cada árbol crece según el largo de sus raíces y la comida que recogieron.
//  3. frutos: los frutos caen; los que atrapas con el puntero valen más.
// El suelo no se acaba hacia abajo: se genera por trozos (run.ch[k]) y cuanto más hondo, más vale.
// Sin DOM: el dibujo está en render.js y el bot del simulador usa esto mismo.

import { POCKETS } from './data.js';

export function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const CELL = 6; // rejilla para saber dónde hay raíces
export const CH = 96; // alto de cada trozo de suelo
const REF_AREA = 43200; // área de suelo de referencia (una pantalla) para el equilibrio
export const DEPTH_K = Number(globalThis.process?.env?.DEPTH_K || 300); // cada DEPTH_K px de profundidad, ×1 más de valor
export const HARD_K = Number(globalThis.process?.env?.HARD_K || 400); // a HARD_K px de profundidad se crece a la mitad de velocidad
export const SOIL_TOP = 160; // px de cielo encima del suelo: sitio para que crezcan los árboles
export const TREE_MAX_H = 112; // alto máximo de un árbol (px)
export const GROW_T = 1.6; // s que tarda el árbol en crecer al final
const STALL_T = 300; // s: si algo se atasca, la fase de raíces acaba igual

const EMPTY = Object.freeze({ pockets: [], stones: [], puddles: [], spurs: [], dead: [] });
export const bucket = (run, k) => run.ch[k] || EMPTY;
const ensureBucket = (run, k) => (run.ch[k] ||= { pockets: [], stones: [], puddles: [], spurs: [], dead: [] });

/** Dureza del suelo: cuanto más hondo, más despacio crecen las raíces. */
export function hardness(run, y) {
  return 1 / (1 + Math.max(0, y - run.soilTop) / (HARD_K * run.st.hardK));
}

/** Multiplicador de valor según la profundidad. */
export function depthMult(run, y) {
  return 1 + Math.max(0, y - run.soilTop) / DEPTH_K;
}

export const depthOf = (run, y) => Math.max(0, y - run.soilTop);

/** Tamaño de un árbol según su crecimiento: alto, tronco, copa (centro y radio) y punta. */
export function treeShape(growth, soilTop, x) {
  const h = Math.min(TREE_MAX_H, Math.round(12 + 18 * Math.log10(1 + Math.max(0, growth))));
  const trunk = Math.round(h * 0.48);
  const cr = Math.max(3, Math.round(h * 0.3));
  const cy = soilTop - trunk - Math.round(cr * 0.5);
  return { h, trunk, cr, cx: x, cy, top: cy - cr };
}

/** Crecimiento que lleva ya cada árbol: raíces + comida, con las uniones y el bosque. */
export function liveGrowth(run, tree) {
  const { st } = run;
  const links = 1 + st.linkBonus * Math.min(tree.links, st.linkMax);
  const forest = 1 + st.forestBonus * (run.trees.length - 1);
  const wet = 1 + st.wetBonus * Math.min(tree.wet, st.wetMax);
  return (tree.len * st.lenGrowth * st.growth + tree.food) * links * forest * wet;
}

export function createRun(st, seed, W = 288, VH = 180) {
  const soilTop = SOIL_TOP;
  const rng = mulberry32(seed ^ 0x2f6b);
  const run = {
    W, VH, soilTop, skyH: soilTop - 2, st, seed, rng,
    t: 0, phase: 'roots', phaseT: 0, rootsT: 0, ended: false, dur: 0, doneT: 0,
    trees: [], roots: [], tips: [], newSegs: [], length: 0, maxDepth: soilTop,
    ch: [], chunks: Math.floor(soilTop / CH),
    gw: Math.ceil(W / CELL), grid: new Map(), owner: new Map(), linked: new Set(), links: 0,
    fruits: [], gained: { f: 0 }, absorbed: 0, food: 0, caught: 0, landed: 0, fruitCount: 0,
    sproutsTotal: 0, bonusSprouts: 0,
    events: [],
    flow: (seed & 1) ? -1 : 1, // hacia dónde va la corriente (ribera)
    cracks: [], brambles: [], newBramSegs: [], stolen: 0, wetRoots: 0,
    stumps: [], stumpsDone: 0, deadUsed: 0,
    startCam: Math.max(0, soilTop - Math.round(VH * 0.32)),
    harvestCam: Math.max(0, soilTop - Math.round(VH * 0.6)),
  };

  // Árboles repartidos por la superficie; cada uno echa sus primeras raíces hacia abajo
  const n = Math.max(1, st.trees);
  for (let i = 0; i < n; i++) {
    const x = Math.round((W * (i + 1)) / (n + 1));
    run.trees.push({ i, x, sprouts: st.sprouts, bonus: 0, len: 0, food: 0, links: 0, wet: 0, growth: 0, shape: null, fruits: 0 });
    run.sproutsTotal += st.sprouts;
  }
  // Ladera: grietas que bajan serpenteando por la roca (la misma fórmula en todos los trozos)
  if (st.rockTop) {
    const n = Math.max(2, Math.round((st.cracks * W) / 288));
    for (let i = 0; i < n; i++) {
      run.cracks.push({
        x0: (W * (i + 0.5)) / n + (rng() - 0.5) * (W / n) * 0.5,
        a1: 4 + rng() * 6, f1: 0.025 + rng() * 0.03, p1: rng() * 6,
        a2: 1 + rng() * 1.5, f2: 0.13 + rng() * 0.1, p2: rng() * 6,
        w: st.crackW,
      });
    }
  }
  // Ladera: zarzas rivales que nacen en la superficie, lejos de tus árboles
  for (let k = 0; k < st.brambles; k++) {
    let x = 0;
    for (let t = 0; t < 20; t++) {
      x = Math.round(8 + rng() * (W - 16));
      if (run.trees.every((tr) => Math.abs(tr.x - x) > 22) && run.brambles.every((b) => Math.abs(b.x - x) > 20)) break;
    }
    run.brambles.push({ x, y: soilTop + 2, a: Math.PI / 2, segs: [] });
  }
  // Bosque viejo: tocones en la superficie, con sus raíces muertas bajando
  for (let k = 0; k < (st.stumps ? Math.max(1, Math.round((st.stumps * W) / 288)) : 0); k++) {
    let x = 0;
    for (let t = 0; t < 30; t++) {
      x = Math.round(10 + rng() * (W - 20));
      if (run.trees.every((tr) => Math.abs(tr.x - x) > 18) && run.stumps.every((o) => Math.abs(o.x + o.w / 2 - x) > 28)) break;
    }
    const w = 12 + Math.floor(rng() * 6);
    run.stumps.push({ x: x - Math.floor(w / 2), y: soilTop + 1, w, h: 9, prog: 0, done: false });
    for (let n = 2 + Math.floor(rng() * 2); n > 0; n--) deadPath(run, x + (rng() - 0.5) * w * 0.6, soilTop + 6, Math.PI / 2 + (rng() - 0.5) * 1.8, 120 + rng() * 220, rng, 2);
  }
  ensureChunks(run);
  for (const tree of run.trees) {
    const r0 = st.startRoots;
    for (let k = 0; k < r0; k++) {
      const f = r0 === 1 ? 0 : k / (r0 - 1) - 0.5;
      newRoot(run, tree, tree.x + Math.round(f * 4), soilTop + 3, Math.PI / 2 + f * Math.min(2.2, 0.8 * r0) + (rng() - 0.5) * 0.3, 0);
    }
  }
  return run;
}

// ── Generación del suelo ───────────────────────────────────────────────────

/** Rellena el trozo k (filas k·CH a (k+1)·CH): comida, piedras y charcos. */
function genChunk(run, k) {
  const { st, W, soilTop } = run;
  const rng = mulberry32((run.seed ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0);
  const B = ensureBucket(run, k);
  const y0 = Math.max(k * CH, soilTop + 4);
  const y1 = (k + 1) * CH;
  if (y1 - y0 < 4) return;
  const count = (x) => Math.floor(x) + (rng() < x - Math.floor(x) ? 1 : 0);
  const perScreen = (n, ya = y0, yb = y1) => count((n * W * Math.max(0, yb - ya)) / REF_AREA);
  const inRect = (x, y, r, o) => x > o.x - r - 2 && x < o.x + o.w + r + 2 && y > o.y - r - 2 && y < o.y + o.h + r + 2;
  const free = (x, y, r) => {
    if (st.rockTop && inRock(run, x, y)) return false;
    for (const t of run.trees) if (Math.abs(x - t.x) < 8 + r && y < soilTop + 14) return false;
    for (let kk = k - 1; kk <= k; kk++) {
      const b = bucket(run, kk);
      for (const s of b.stones) if (inRect(x, y, r, s)) return false;
      for (const p of b.pockets) if (Math.hypot(p.x - x, p.y - y) < p.r + r + 3) return false;
    }
    return true;
  };
  const spot = (r, ya = y0, yb = y1) => {
    ya = Math.max(ya, y0);
    yb = Math.min(yb, y1);
    if (yb - ya < 2) return null;
    for (let t = 0; t < 40; t++) {
      const x = 4 + r + rng() * (W - 2 * (4 + r));
      const y = ya + (yb - ya) * rng();
      if (free(x, y, r)) return { x: Math.round(x), y: Math.round(y) };
    }
    return null;
  };
  const pocket = (p) => {
    if (!p) return;
    const type = rng() < st.big ? 'big' : 'n';
    B.pockets.push({ x: p.x, y: p.y, r: POCKETS[type].r, type, k });
  };

  // Ladera: ramales de las grietas (para cruzar de una a otra) y vetas minerales pegadas a ellas
  if (st.rockTop) {
    const rTop = soilTop + st.rockTop;
    for (let n = perScreen(7); n > 0; n--) {
      const c = run.cracks[Math.floor(rng() * run.cracks.length)];
      const y = Math.max(rTop + 4, y0) + rng() * (y1 - Math.max(rTop + 4, y0));
      if (y >= y1) continue;
      const x = crackX(c, y);
      const len = 14 + rng() * 26;
      const side = rng() < 0.5 ? -1 : 1;
      B.spurs.push({ x0: x, y0: y, x1: Math.max(2, Math.min(W - 2, x + side * len)), y1: y + (rng() - 0.3) * len * 0.8, w: Math.max(2, c.w - 1) });
    }
    for (let n = perScreen(st.veins); n > 0; n--) {
      const c = run.cracks[Math.floor(rng() * run.cracks.length)];
      const y = Math.round(Math.max(rTop + 6, y0) + rng() * (y1 - Math.max(rTop + 6, y0)));
      if (y >= y1) continue;
      const side = rng() < 0.5 ? -1 : 1;
      const x = Math.round(crackX(c, y) + side * (c.w / 2 + 3));
      if (x > 3 && x < W - 3) B.pockets.push({ x, y, r: POCKETS.vein.r, type: 'vein', k });
    }
  }
  // Piedras
  for (let n = perScreen(st.stones); n > 0; n--) {
    const w = 6 + Math.floor(rng() * 10);
    const h = 5 + Math.floor(rng() * 7);
    const p = spot(9, soilTop + 16);
    if (p) B.stones.push({ x: p.x - Math.floor(w / 2), y: p.y - Math.floor(h / 2), w, h, k });
  }
  // Charcos (Lluvia)
  for (let n = perScreen(st.puddles); n > 0; n--) {
    const r = 11 + Math.floor(rng() * 6);
    const p = spot(r, soilTop + 30);
    if (p) B.puddles.push({ x: p.x, y: p.y, r, k });
  }
  // Bosque viejo: raíces muertas sueltas de árboles antiguos
  for (let n = perScreen(st.deadRoots); n > 0; n--) {
    deadPath(run, 6 + rng() * (W - 12), Math.max(y0, soilTop + 20) + rng() * CH * 0.8, Math.PI / 2 + (rng() - 0.5) * 2, 60 + rng() * 140, rng, 1);
  }
  // Comida: por todo el suelo y más en la capa de arriba, la más fértil
  for (let n = perScreen(st.pockets); n > 0; n--) pocket(spot(POCKETS.n.r, soilTop + 4));
  for (let n = perScreen(st.pockets, y0, Math.min(y1, soilTop + 80)); n > 0; n--) pocket(spot(POCKETS.n.r, soilTop + 4, soilTop + 80));
}

/** Una raíz muerta: tramos de unos 4 px que bajan serpenteando y a veces se ramifican. */
function deadPath(run, x, y, a, len, rng, depth) {
  const { W, soilTop } = run;
  for (let d = 0; d < len; d += 4) {
    a += (rng() - 0.5) * 0.7 + Math.atan2(Math.sin(Math.PI / 2 - a), Math.cos(Math.PI / 2 - a)) * 0.08;
    const nx = Math.max(3, Math.min(W - 3, x + Math.cos(a) * 4));
    const ny = Math.max(soilTop + 4, y + Math.sin(a) * 4);
    ensureBucket(run, Math.floor(Math.min(y, ny) / CH)).dead.push({ x0: x, y0: y, x1: nx, y1: ny, used: false });
    x = nx;
    y = ny;
    if (depth > 0 && rng() < 0.06) deadPath(run, x, y, a + (rng() < 0.5 ? -0.8 : 0.8), (len - d) * 0.5, rng, depth - 1);
  }
}

function ensureChunks(run) {
  const need = Math.floor((run.maxDepth + run.VH * 1.2) / CH);
  while (run.chunks <= need) genChunk(run, run.chunks++);
}

// ── Raíces ─────────────────────────────────────────────────────────────────

const cellKey = (run, x, y) => Math.floor(y / CELL) * run.gw + Math.floor(x / CELL);

/** ¿Hay raíz en ese punto? (por casillas) */
export const hasRoot = (run, x, y) => run.grid.has(cellKey(run, x, y));

function newRoot(run, tree, x, y, a, gen) {
  const r = {
    id: run.roots.length, tree: tree.i, gen, x, y, a, x0: x, y0: y,
    segs: [], len: 0, max: run.st.rootLen * (0.9 + run.rng() * 0.2), alive: true, acid: run.st.acid || 0,
  };
  run.roots.push(r);
  run.tips.push(r);
  return r;
}

/** La raíz se para; si a su árbol le quedan brotes, de ella brota otra. */
function stopRoot(run, r, why) {
  r.alive = false;
  run.events.push({ type: 'stop', r, x: r.x, y: r.y, why });
  const tree = run.trees[r.tree];
  if (tree.sprouts > 0) sprout(run, tree, r);
}

/** Brota una raíz nueva en un punto de la mitad honda de la raíz vieja. */
function sprout(run, tree, parent) {
  const { rng } = run;
  tree.sprouts -= 1;
  let x = parent.x0;
  let y = parent.y0;
  let a = Math.PI / 2;
  const n = parent.segs.length;
  if (n >= 2) {
    const s = parent.segs[Math.min(n - 1, Math.floor(n * (0.45 + 0.5 * rng())))];
    x = s[2];
    y = s[3];
    a = Math.atan2(s[3] - s[1], s[2] - s[0]);
  }
  a += (rng() < 0.5 ? -1 : 1) * (0.6 + 0.5 * rng());
  a += wrap(Math.PI / 2 - a) * 0.3; // que tienda a bajar
  const r = newRoot(run, tree, x, y, a, parent.gen + 1);
  run.events.push({ type: 'sprout', x, y, r });
}

/** Ladera: posición de una grieta a una altura. */
export const crackX = (c, y) => c.x0 + c.a1 * Math.sin(y * c.f1 + c.p1) + c.a2 * Math.sin(y * c.f2 + c.p2);

/** Ladera: ¿ese punto es roca (y no grieta ni ramal)? */
export function inRock(run, x, y) {
  const { st } = run;
  if (!st.rockTop || y < run.soilTop + st.rockTop) return false;
  for (const c of run.cracks) if (Math.abs(x - crackX(c, y)) <= c.w / 2) return false;
  const kk = Math.floor(y / CH);
  for (let k = kk - 1; k <= kk + 1; k++) {
    for (const sp of bucket(run, k).spurs) {
      const dx = sp.x1 - sp.x0;
      const dy = sp.y1 - sp.y0;
      const t = Math.max(0, Math.min(1, ((x - sp.x0) * dx + (y - sp.y0) * dy) / (dx * dx + dy * dy || 1)));
      if ((x - sp.x0 - dx * t) ** 2 + (y - sp.y0 - dy * t) ** 2 <= (sp.w / 2) ** 2) return false;
    }
  }
  return true;
}

/** Ribera: ¿ese punto está en el agua subterránea? */
export const inWater = (run, y) => run.st.waterBottom > 0 && y >= run.soilTop + run.st.waterTop && y < run.soilTop + run.st.waterBottom;

/** ¿Hay una piedra que pare la raíz? */
function blocked(run, x, y) {
  if (run.st.stonePass) return false;
  const kk = Math.floor(y / CH);
  for (let k = kk - 1; k <= kk; k++) {
    for (const s of bucket(run, k).stones) {
      if (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) return true;
    }
  }
  return false;
}

function inPuddle(run, x, y) {
  const kk = Math.floor(y / CH);
  for (let k = kk - 1; k <= kk + 1; k++) {
    for (const p of bucket(run, k).puddles) if ((x - p.x) ** 2 + (y - p.y) ** 2 < p.r * p.r) return true;
  }
  return false;
}

/** Avanza una raíz `step` px. target: {x,y,turn} o null. */
function growRoot(run, r, step, target, dt) {
  const { rng, W, soilTop } = run;
  if (target) {
    const want = Math.atan2(target.y - r.y, target.x - r.x);
    const d = wrap(want - r.a);
    const m = target.turn * dt;
    r.a += Math.max(-m, Math.min(m, d));
  } else {
    r.a += wrap(Math.PI / 2 - r.a) * 0.5 * dt; // sin guía, tiende a bajar
  }
  // las raíces se apartan de las que ya hay: así se abren en abanico en vez de ir todas juntas
  const ahead = (a) => run.grid.get(cellKey(run, r.x + Math.cos(a) * 7, r.y + Math.sin(a) * 7)) || 0;
  if (ahead(r.a) > 0) {
    const l = ahead(r.a - 0.7);
    const rr = ahead(r.a + 0.7);
    if (l !== rr) r.a += (l < rr ? -1 : 1) * 3.2 * dt;
  }
  r.a += (rng() - 0.5) * 2.4 * dt;
  step = Math.min(step, r.max - r.len + 0.01);
  if (r.y + Math.sin(r.a) * step < soilTop + 1) {
    // no sale de la tierra: se da la vuelta hacia abajo
    r.a = Math.abs(r.a) || Math.PI / 2;
    return;
  }
  let nx = r.x + Math.cos(r.a) * step;
  let ny = r.y + Math.sin(r.a) * step;
  if (run.st.current && inWater(run, r.y)) nx += run.flow * run.st.current * dt; // la corriente arrastra
  if (run.st.rockTop && inRock(run, nx, ny)) {
    // roca: dentro de una grieta, la raíz la sigue; si choca de frente, se para (salvo lo que pueda disolver)
    let ok = false;
    for (const da of [0.45, -0.45, 0.9, -0.9]) {
      const a = r.a + da;
      const tx = r.x + Math.cos(a) * step;
      const ty = r.y + Math.sin(a) * step;
      if (ty >= soilTop + 1 && !inRock(run, tx, ty)) { r.a = a; nx = tx; ny = ty; ok = true; break; }
    }
    if (!ok) {
      if (r.acid > 0) r.acid -= step;
      else { stopRoot(run, r, 'rock'); return; }
    }
  }
  if (blocked(run, nx, ny)) {
    // piedra: la raíz la rodea si puede; si no, se para
    let ok = false;
    const side = rng() < 0.5 ? 1 : -1;
    for (const da of [0.6, -0.6, 1.2, -1.2, 1.6, -1.6]) {
      const a = r.a + da * side;
      const tx = r.x + Math.cos(a) * step;
      const ty = r.y + Math.sin(a) * step;
      if (ty >= soilTop + 1 && tx >= 1 && tx <= W - 2 && !blocked(run, tx, ty) && !(run.st.rockTop && inRock(run, tx, ty))) { r.a = a; nx = tx; ny = ty; ok = true; break; }
    }
    if (!ok) { stopRoot(run, r, 'stone'); return; }
  }
  if (nx < 1 || nx > W - 2) {
    stopRoot(run, r, 'stone');
    return;
  }
  const gi = cellKey(run, nx, ny);
  run.grid.set(gi, (run.grid.get(gi) || 0) + step);
  touchRoots(run, r, gi, nx, ny);
  // Ribera: la primera vez que una raíz llega al agua, su árbol crece más
  if (run.st.wetBonus && !r.wet && inWater(run, ny)) {
    r.wet = true;
    const tree = run.trees[r.tree];
    if (tree.wet < run.st.wetMax) {
      tree.wet += 1;
      run.wetRoots += 1;
      run.events.push({ type: 'water', x: nx, y: ny, amount: run.st.wetBonus });
    }
  }
  const seg = [r.x, r.y, nx, ny];
  r.segs.push(seg);
  run.newSegs.push({ s: seg, r });
  r.len += step;
  run.length += step;
  run.trees[r.tree].len += step;
  if (ny > run.maxDepth) run.maxDepth = ny;
  r.x = nx;
  r.y = ny;
  if (r.len >= r.max) stopRoot(run, r, 'max');
}

/**
 * Quién tiene raíces en cada casilla (la última raíz de cada árbol). Si una raíz entra donde hay
 * una de otro árbol, se unen: con «Raíces entrelazadas», los dos árboles crecen más.
 */
function touchRoots(run, r, gi, x, y) {
  let cell = run.owner.get(gi);
  if (!cell) { cell = {}; run.owner.set(gi, cell); }
  if (run.trees.length > 1 && run.st.linkBonus) {
    for (const t in cell) {
      if (+t === r.tree) continue;
      const q = cell[t];
      const key = r.id < q ? `${r.id}|${q}` : `${q}|${r.id}`;
      if (run.linked.has(key)) continue;
      run.linked.add(key);
      const a = run.trees[r.tree];
      const b = run.trees[+t];
      if (a.links >= run.st.linkMax && b.links >= run.st.linkMax) continue;
      a.links += 1;
      b.links += 1;
      run.links += 1;
      run.events.push({ type: 'link', x, y, amount: run.st.linkBonus });
    }
  }
  cell[r.tree] = r.id;
}

function absorb(run, list, i, tree) {
  const p = list[i];
  list.splice(i, 1);
  const { st } = run;
  const amount = POCKETS[p.type].value * (p.type === 'vein' ? st.veinValue : 1) * st.value * st.zoneValue * depthMult(run, p.y) * st.growth;
  tree.food += amount;
  run.food += amount;
  run.absorbed += 1;
  let sprouted = false;
  if (p.type === 'big' && st.bigSprout && tree.bonus < st.sprouts) {
    // cada árbol puede ganar como mucho tantos brotes extra como brotes tenía
    tree.bonus += st.bigSprout;
    tree.sprouts += st.bigSprout;
    run.sproutsTotal += st.bigSprout;
    run.bonusSprouts += st.bigSprout;
    sprouted = true;
  }
  run.events.push({ type: 'absorb', x: p.x, y: p.y, amount, kind: p.type, sprouted });
}

function nearestPocket(run, x, y, maxD) {
  let best = null;
  let bd = maxD * maxD;
  const kk = Math.floor(y / CH);
  for (let k = kk - 1; k <= kk + 1; k++) {
    for (const p of bucket(run, k).pockets) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
  }
  return best;
}

function stepRoots(run, dt, pointer) {
  const { st } = run;
  for (const r of run.tips.slice()) {
    if (!r.alive) continue;
    let target = null;
    const d2 = pointer ? (pointer.x - r.x) ** 2 + (pointer.y - r.y) ** 2 : Infinity;
    if (d2 < st.attract * st.attract) {
      // al llegar donde apuntas, la raíz sigue su camino hasta que muevas el puntero (no da vueltas)
      if (r.reach && (pointer.x - r.reach.x) ** 2 + (pointer.y - r.reach.y) ** 2 < 144) target = null;
      else if (d2 < 25) r.reach = { x: pointer.x, y: pointer.y };
      else target = { x: pointer.x, y: pointer.y, turn: 4.5 };
    }
    if (!target && st.sense) {
      const p = nearestPocket(run, r.x, r.y, st.sense);
      if (p) target = { x: p.x, y: p.y, turn: 3 };
    }
    let speed = st.speed * hardness(run, r.y);
    if (r.onDead) speed *= st.deadSpeed; // por una raíz muerta se avanza como por un camino
    if (st.puddles && inPuddle(run, r.x, r.y)) speed *= 2;
    if (st.waterBottom && inWater(run, r.y)) speed *= st.waterSpeed;
    const tree = run.trees[r.tree];
    growRoot(run, r, speed * dt, target, dt);
    // Absorber las bolsas que toca (también justo al pararse)
    const kk = Math.floor(r.y / CH);
    if (st.stumps) touchOldWood(run, r, tree, speed * dt, kk);
    for (let k = kk - 1; k <= kk + 1; k++) {
      const list = bucket(run, k).pockets;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        const reach = p.r + st.absorb;
        if ((p.x - r.x) ** 2 + (p.y - r.y) ** 2 <= reach * reach) absorb(run, list, i, tree);
      }
    }
  }
  run.tips = run.tips.filter((r) => r.alive);
  if (run.brambles.length) stepBrambles(run, dt);
  ensureChunks(run);
  if (!run.tips.length || run.t > STALL_T) startHarvest(run);
}

// ── Bosque viejo ───────────────────────────────────────────────────────────

/** Raíces muertas que absorbe la punta y tocones que va descomponiendo. */
function touchOldWood(run, r, tree, step, kk) {
  const { st } = run;
  const mult = st.value * st.zoneValue * st.growth;
  r.onDead = false;
  for (let k = kk - 1; k <= kk + 1; k++) {
    for (const d of bucket(run, k).dead) {
      const dx = d.x1 - d.x0;
      const dy = d.y1 - d.y0;
      const t = Math.max(0, Math.min(1, ((r.x - d.x0) * dx + (r.y - d.y0) * dy) / (dx * dx + dy * dy || 1)));
      if ((r.x - d.x0 - dx * t) ** 2 + (r.y - d.y0 - dy * t) ** 2 > 9) continue;
      r.onDead = true;
      if (d.used) continue;
      d.used = true;
      const amount = Math.hypot(dx, dy) * st.deadValue * mult * depthMult(run, d.y1);
      tree.food += amount;
      run.food += amount;
      run.deadUsed += 1;
      run.events.push({ type: 'dead', d, x: d.x1, y: d.y1, amount });
    }
  }
  for (const s of run.stumps) {
    if (s.done || r.x < s.x || r.x >= s.x + s.w || r.y < s.y || r.y >= s.y + s.h) continue;
    s.prog += step;
    if (s.prog < st.stumpNeed) continue;
    s.done = true;
    run.stumpsDone += 1;
    const amount = st.stumpValue * mult;
    tree.food += amount;
    run.food += amount;
    tree.sprouts += st.stumpSprouts;
    run.sproutsTotal += st.stumpSprouts;
    run.events.push({ type: 'stump', x: s.x + s.w / 2, y: s.y, amount, ref: s });
  }
}

// ── Zarzas (ladera) ────────────────────────────────────────────────────────

/** Las zarzas crecen hacia la comida más cercana y se la comen antes que tú. La roca las desvía. */
function stepBrambles(run, dt) {
  const { st, rng, W, soilTop } = run;
  for (const b of run.brambles) {
    const p = nearestPocket(run, b.x, b.y, 70);
    if (p) {
      const d = wrap(Math.atan2(p.y - b.y, p.x - b.x) - b.a);
      b.a += Math.max(-2.5 * dt, Math.min(2.5 * dt, d));
    } else {
      b.a += wrap(Math.PI / 2 - b.a) * 0.4 * dt;
    }
    b.a += (rng() - 0.5) * 2 * dt;
    const step = st.brambleSpeed * hardness(run, b.y) * dt;
    const nx = b.x + Math.cos(b.a) * step;
    const ny = b.y + Math.sin(b.a) * step;
    if (ny < soilTop + 1) { b.a = Math.abs(b.a) || Math.PI / 2; continue; }
    if (nx < 2 || nx > W - 3) { b.a = Math.PI - b.a; continue; }
    if (inRock(run, nx, ny)) { b.a += (rng() < 0.5 ? -1 : 1) * 1.3; continue; }
    const gi = cellKey(run, nx, ny);
    run.grid.set(gi, (run.grid.get(gi) || 0) + step);
    const seg = [b.x, b.y, nx, ny];
    b.segs.push(seg);
    run.newBramSegs.push(seg);
    b.x = nx;
    b.y = ny;
    const kk = Math.floor(b.y / CH);
    for (let k = kk - 1; k <= kk + 1; k++) {
      const list = bucket(run, k).pockets;
      for (let i = list.length - 1; i >= 0; i--) {
        const q = list[i];
        if ((q.x - b.x) ** 2 + (q.y - b.y) ** 2 > (q.r + 1.5) ** 2) continue;
        list.splice(i, 1);
        run.stolen += 1;
        run.events.push({ type: 'steal', x: q.x, y: q.y, kind: q.type });
      }
    }
  }
}

// ── Cosecha ────────────────────────────────────────────────────────────────

function startHarvest(run) {
  const { st, rng, soilTop } = run;
  for (const r of run.tips) { r.alive = false; run.events.push({ type: 'stop', r, x: r.x, y: r.y, why: 'end' }); }
  run.tips = [];
  run.phase = 'grow';
  run.phaseT = 0;
  run.rootsT = run.t;
  let tallest = 0;
  for (const tree of run.trees) {
    tree.growth = liveGrowth(run, tree);
    tree.shape = treeShape(tree.growth, soilTop, tree.x);
    tallest = Math.max(tallest, soilTop - tree.shape.top);
    const F = tree.growth * st.fruitRate;
    tree.fruits = F;
    const { cx, cy, cr } = tree.shape;
    // cuántos frutos se ven: según lo que vale el árbol y lo que cabe en su copa (cada uno vale su parte)
    const n = F < 0.5 ? 0 : Math.max(1, Math.min(st.maxFruits, Math.round(F), Math.max(3, Math.round(cr * cr * 0.12))));
    const placed = [];
    for (let k = 0; k < n; k++) {
      let x = cx;
      let y = cy;
      for (let t = 0; t < 12; t++) {
        const a = rng() * TAU;
        const d = Math.sqrt(rng()) * cr * 0.85;
        x = cx + Math.cos(a) * d;
        y = cy + Math.sin(a) * d * 0.8;
        if (placed.every((p) => (p.x - x) ** 2 + (p.y - y) ** 2 > 20)) break;
      }
      placed.push({ x, y });
      const gold = rng() < st.gold;
      run.fruits.push({
        id: run.fruits.length, tree: tree.i, gold, x, y, vx: 0, vy: 0,
        drop: 0.3 + rng() * st.dropSpread, state: 'hang',
        value: (F / n) * (gold ? 5 : 1),
      });
    }
  }
  run.fruitCount = run.fruits.length;
  // la cámara sube: la superficie a dos tercios de la pantalla y el árbol más alto entero, bajo el HUD
  run.harvestCam = Math.max(0, Math.min(soilTop - Math.round(run.VH * 0.68), soilTop - tallest - 34));
  run.events.push({ type: 'grow' });
}

function stepFruits(run, dt, pointer) {
  const { st, soilTop } = run;
  let pending = 0;
  for (const f of run.fruits) {
    if (f.state === 'hang') {
      pending++;
      if (run.phaseT >= f.drop) {
        // el fruto salta del árbol hacia un lado y luego cae
        f.state = 'fall';
        f.vy = -(30 + run.rng() * 35);
        f.vx = (run.rng() < 0.5 ? -1 : 1) * (12 + run.rng() * 30);
        run.events.push({ type: 'drop', x: f.x, y: f.y });
      }
      continue;
    }
    if (f.state !== 'fall') continue;
    pending++;
    f.vy = Math.min(st.fallMax, f.vy + st.gravity * dt);
    f.y += f.vy * dt;
    f.x += f.vx * dt;
    if (f.x < 3 || f.x > run.W - 3) { f.vx = -f.vx; f.x = Math.max(3, Math.min(run.W - 3, f.x)); }
    if (pointer && (pointer.x - f.x) ** 2 + (pointer.y - f.y) ** 2 <= st.catchR * st.catchR) {
      f.state = 'caught';
      const amount = f.value * st.catchMult;
      run.gained.f += amount;
      run.caught += 1;
      run.events.push({ type: 'catch', x: f.x, y: f.y, amount, gold: f.gold });
    } else if (f.y >= soilTop - 2) {
      f.y = soilTop - 2;
      f.state = 'land';
      const amount = f.value * st.landMult;
      run.gained.f += amount;
      run.landed += 1;
      run.events.push({ type: 'land', x: f.x, y: f.y, amount, gold: f.gold });
    }
  }
  if (!pending) {
    run.doneT += dt;
    if (run.doneT > 0.6) {
      run.ended = true;
      run.dur = run.t;
    }
  }
}

/**
 * Avanza la temporada dt segundos. pointer: {x,y} en píxeles del mundo, o null.
 * Los sucesos se acumulan en run.events.
 */
export function stepRun(run, dt, pointer) {
  if (run.ended) return;
  run.t += dt;
  if (run.phase === 'roots') {
    stepRoots(run, dt, pointer);
  } else if (run.phase === 'grow') {
    run.phaseT += dt;
    if (run.phaseT >= GROW_T) { run.phase = 'fruit'; run.phaseT = 0; }
  } else {
    run.phaseT += dt;
    stepFruits(run, dt, pointer);
  }
}

/** Para todas las raíces y gasta los brotes (pruebas). */
export function finishRoots(run) {
  if (run.phase !== 'roots') return;
  for (const t of run.trees) t.sprouts = 0;
  startHarvest(run);
}

// ── Bot del simulador ──────────────────────────────────────────────────────

/**
 * Puntero del bot. Raíces: la bolsa más valiosa y cercana a alguna raíz viva; si no hay, debajo de la más honda.
 * Frutos: el fruto que va a tocar el suelo antes, pero solo `skill` de cada 10 (una persona no los atrapa todos).
 */
export function botPointer(run, skill = 6) {
  if (run.phase === 'fruit') {
    let best = null;
    for (const f of run.fruits) if (f.state === 'fall' && f.id % 10 < skill && (!best || f.y > best.y)) best = f;
    return best ? { x: best.x, y: best.y } : null;
  }
  if (run.phase !== 'roots' || !run.tips.length) return null;
  let deep = null;
  let best = null;
  let bd = Infinity;
  for (const r of run.tips) {
    if (!deep || r.y > deep.y) deep = r;
    const kk = Math.floor(r.y / CH);
    for (let k = kk - 1; k <= kk + 1; k++) {
      for (const p of bucket(run, k).pockets) {
        const d2 = (p.x - r.x) ** 2 + (p.y - r.y) ** 2;
        if (d2 > 60 * 60) continue;
        const d = d2 / depthMult(run, p.y) / (p.type === 'big' ? 3 : 1);
        if (d < bd) { bd = d; best = { x: p.x, y: p.y }; }
      }
      for (const dd of bucket(run, k).dead) {
        if (dd.used) continue;
        const d2 = (dd.x1 - r.x) ** 2 + (dd.y1 - r.y) ** 2;
        if (d2 < 50 * 50 && d2 * 0.5 < bd) { bd = d2 * 0.5; best = { x: dd.x1, y: dd.y1 }; }
      }
    }
    for (const sp of run.stumps) {
      if (sp.done) continue;
      const cx = sp.x + sp.w / 2;
      const cy = sp.y + sp.h / 2;
      const d2 = (cx - r.x) ** 2 + (cy - r.y) ** 2;
      if (d2 < 90 * 90 && d2 * 0.2 < bd) { bd = d2 * 0.2; best = { x: cx, y: cy }; }
    }
  }
  return best || { x: deep.x + Math.sin(run.t * 0.7) * 20, y: deep.y + 40 };
}
