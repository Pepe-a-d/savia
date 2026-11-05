// Una temporada: excavar. El suelo no se acaba hacia abajo; se genera por trozos según bajas,
// y cuanto más hondo, más vale todo. La red crece desde la espora, el puntero guía las puntas.
// Sin DOM: el dibujo está en render.js y el bot del simulador usa esto mismo.
// Todo lo que hay en el suelo va guardado por trozos (run.ch[k]) para mirar solo lo cercano.

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
const BRANCH_EVERY = 12; // px recorridos entre intentos de ramificar
const LOG_NEED = 40; // px de red dentro de un tronco para descomponerlo
const PEAT_NEED = 34; // px de red dentro de un depósito de turba
const MAX_TIPS_HARD = 24;
export const CELL = 6; // rejilla para saber dónde está ya la red
const CELL_CAP = 10; // px de red por celda antes de que esté llena
export const CH = 96; // alto de cada trozo de suelo
export const BAND = 150; // alto de cada capa (cada una vale más)
const REF_AREA = 43200; // área de suelo de referencia (una pantalla) para el equilibrio
export const DEPTH_K = Number(globalThis.process?.env?.DEPTH_K || 300); // cada DEPTH_K px de profundidad, ×1 más de valor
export const HARD_K = Number(globalThis.process?.env?.HARD_K || 150); // a HARD_K px de profundidad se crece a la mitad de velocidad

const EMPTY = Object.freeze({ pockets: [], stones: [], peats: [], colonies: [], puddles: [], crickets: [] });
export const bucket = (run, k) => run.ch[k] || EMPTY;
const ensureBucket = (run, k) => (run.ch[k] ||= { pockets: [], stones: [], peats: [], colonies: [], puddles: [], crickets: [] });

/** Tamaño del cielo para una vista de W×VH. */
export function layout(W, VH) {
  const skyH = Math.max(20, Math.min(40, Math.round(VH * 0.15)));
  return { skyH, soilTop: skyH + 2 };
}

/** Dureza del suelo: cuanto más hondo, más despacio creces. */
export function hardness(run, y) {
  return 1 / (1 + Math.max(0, y - run.soilTop) / HARD_K);
}

/** Multiplicador de valor según la profundidad. */
export function depthMult(run, y) {
  return 1 + Math.max(0, y - run.soilTop) / DEPTH_K;
}

export const depthOf = (run, y) => Math.max(0, y - run.soilTop);

export function createRun(st, seed, W = 288, VH = 180) {
  const { skyH, soilTop } = layout(W, VH);
  const cx = Math.round(W / 2);
  const cy = soilTop + 14;
  const run = {
    W, VH, skyH, soilTop, cx, cy, st, seed,
    swamp: st.biome === 'pantano', cave: st.biome === 'cueva', dark: !!st.dark,
    rng: mulberry32(seed ^ 0x2f6b),
    waterTop: st.biome === 'pantano' ? soilTop + 36 : Infinity,
    flow: (seed & 1) ? -1 : 1,
    t: 0, dur: st.duration, ended: false,
    tips: [], segs: [], newSegs: [], length: 0, maxDepth: cy,
    ch: [], plants: [], logs: [], bats: [],
    gained: { n: 0, m: 0, a: 0, e: 0, t: 0, c: 0 }, logGain: 0, absorbed: 0,
    events: [], refill: 0, respawnT: st.respawn || 0, setas: [], eatT: 0,
    gw: Math.ceil(W / CELL), grid: new Map(), lit: new Set(), litSrc: new Set(), litDirty: true,
    lightCells: Math.max(1, Math.round((st.light || 0) / CELL)),
    chunks: 0,
  };
  ensureChunks(run);

  // Puntas iniciales, hacia abajo y a los lados
  const n0 = Math.min(st.tips, 2 + st.startBranches);
  for (let k = 0; k < n0; k++) run.tips.push(newTip(cx, cy, Math.PI / 2 + (n0 === 1 ? 0 : (k / (n0 - 1) - 0.5) * 2.4) + run.rng() * 0.3));
  if (st.startBranches) {
    const tmp = run.tips.slice();
    for (const tip of tmp) for (let s = 0; s < 14; s++) growTip(run, tip, 1.5, null);
  }
  if (run.dark) markLit(run, cx, cy, run.lightCells + 2);
  return run;
}

// ── Generación ─────────────────────────────────────────────────────────────

/** Rellena el trozo k (filas k·CH a (k+1)·CH) con lo que no se acaba: comida, piedras y agua. */
function genChunk(run, k) {
  const { st, W, soilTop, cx, cy } = run;
  const rng = mulberry32((run.seed ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0);
  const B = ensureBucket(run, k);
  const y0 = Math.max(k * CH, soilTop + 3);
  const y1 = (k + 1) * CH;
  const fa = (W * (y1 - y0)) / REF_AREA;
  const count = (n) => { const x = n * fa; return Math.floor(x) + (rng() < x - Math.floor(x) ? 1 : 0); };
  const inRect = (x, y, r, o) => x > o.x - r - 2 && x < o.x + o.w + r + 2 && y > o.y - r - 2 && y < o.y + o.h + r + 2;
  const free = (x, y, r) => {
    if (Math.hypot(x - cx, y - cy) < 16 + r) return false;
    for (const l of run.logs) if (inRect(x, y, r, l)) return false;
    for (let kk = k - 1; kk <= k; kk++) {
      const b = bucket(run, kk);
      for (const s of b.stones) if (inRect(x, y, r, s)) return false;
      for (const p of b.peats) if (inRect(x, y, r, p)) return false;
      for (const p of b.pockets) if (Math.hypot(p.x - x, p.y - y) < p.r + r + 3) return false;
      for (const c of b.colonies) if (Math.hypot(c.x - x, c.y - y) < c.maxR + r + 3) return false;
    }
    return true;
  };
  const spot = (r, ya = y0, yb = y1, bias = 1) => {
    ya = Math.max(ya, y0);
    yb = Math.min(yb, y1);
    if (yb - ya < 2) return null;
    for (let t = 0; t < 40; t++) {
      const x = 4 + r + rng() * (W - 2 * (4 + r));
      const y = ya + (yb - ya) * rng() ** bias;
      if (free(x, y, r)) return { x: Math.round(x), y: Math.round(y) };
    }
    return null;
  };
  const pocket = (type, p) => { if (p) B.pockets.push({ x: p.x, y: p.y, r: POCKETS[type].r, type, k }); };

  if (k === 0) {
    // Superficie: árboles o juncos, troncos medio enterrados, murciélagos con su guano, hojarasca
    const nPlants = run.swamp ? st.reeds : st.trees;
    const xs = [];
    for (let t = 0; t < nPlants * 4 && xs.length < nPlants; t++) {
      const x = Math.round(14 + rng() * (W - 28));
      if (Math.abs(x - cx) > 28 && xs.every((o) => Math.abs(o - x) > 34)) xs.push(x);
    }
    for (const x of xs) {
      run.plants.push(run.swamp
        ? { kind: 'reed', x, y: soilTop + 7, roots: 15, connected: false, rate: st.reedRate, cur: 't' }
        : { kind: 'tree', x, y: soilTop + 10, roots: 22, connected: false, rate: st.sugar, cur: 'a' });
    }
    for (let n = 0; n < Math.round(st.logs * (W / 288)); n++) {
      for (let t = 0; t < 30; t++) {
        const w = 26;
        const x = Math.round(6 + rng() * (W - w - 12));
        if (Math.abs(x + w / 2 - cx) > 24 && !run.logs.some((o) => Math.abs(o.x - x) < w + 6)) {
          run.logs.push({ x, y: soilTop + 1, w, h: 7, prog: 0, done: false });
          break;
        }
      }
    }
    for (let n = 0; n < Math.round(st.guano * (W / 288)); n++) {
      const p = spot(4, soilTop + 2, soilTop + 16);
      if (p) { pocket('guano', p); run.bats.push({ x: p.x }); }
    }
    for (let n = 0; n < Math.round(st.leaves * (W / 288)); n++) pocket('leaf', spot(4, soilTop + 2, soilTop + 40));
    // La capa de arriba es la más fértil: un poco más de comida justo bajo la superficie
    for (let n = Math.round(st.pockets * 0.45 * (W / 288)); n > 0; n--) pocket(rng() < st.big ? 'big' : 'n', spot(POCKETS.n.r, soilTop + 3, soilTop + 70));
  }

  // Cueva: picos de roca que suben o bajan
  for (let n = count(st.stalags); n > 0; n--) {
    const up = rng() < 0.5;
    const w = 5 + Math.floor(rng() * 5);
    const h = 12 + Math.floor(rng() * 14);
    const p = spot(8, y0 + 4, y1 - 4);
    if (p && Math.abs(p.x - cx) > 16) B.stones.push({ x: p.x - Math.floor(w / 2), y: p.y - Math.floor(h / 2), w, h, kind: 'stalag', up, k });
  }
  // Piedras
  for (let n = count(run.cave ? 4 : 8); n > 0; n--) {
    const w = 6 + Math.floor(rng() * 10);
    const h = 5 + Math.floor(rng() * 7);
    const p = spot(9, soilTop + 8);
    if (p) B.stones.push({ x: p.x - Math.floor(w / 2), y: p.y - Math.floor(h / 2), w, h, k });
  }
  // Bolsas de agua subterránea (Lluvia)
  for (let n = count(st.puddles); n > 0; n--) {
    const r = 11 + Math.floor(rng() * 6);
    const p = spot(r, soilTop + 40);
    if (p) B.puddles.push({ x: p.x, y: p.y, r, k });
  }
  // Pantano: turba y colonias rivales en el barro inundado
  for (let n = count(st.peat); n > 0; n--) {
    const w = 14 + Math.floor(rng() * 7);
    const h = 8 + Math.floor(rng() * 4);
    const p = spot(10, run.waterTop + 4);
    if (p) B.peats.push({ x: p.x - Math.floor(w / 2), y: p.y - Math.floor(h / 2), w, h, prog: 0, done: false, k });
  }
  for (let n = count(st.colonies); n > 0; n--) {
    const p = spot(8, soilTop + 10);
    if (p && Math.hypot(p.x - cx, p.y - cy) > 45) B.colonies.push({ x: p.x, y: p.y, r: 4, maxR: 10 + rng() * 5, hp: st.colonyHp, dead: false, k });
  }
  // Cueva: grillos
  for (let n = count(st.crickets); n > 0; n--) {
    const p = spot(3, soilTop + 10);
    if (p) B.crickets.push({ x: p.x, y: p.y, vx: 0, vy: 0, hop: rng() * 1.5, carry: 0, used: false, air: 0, k });
  }
  // Comida (no se acaba nunca), minerales y cristales
  for (let n = count(st.pockets); n > 0; n--) pocket(rng() < st.big ? 'big' : 'n', spot(POCKETS.n.r, soilTop + 3));
  for (let n = count(st.minerals); n > 0; n--) pocket('m', spot(POCKETS.m.r, soilTop + 110));
  for (let n = count(st.crystals); n > 0; n--) pocket('c', spot(POCKETS.c.r, soilTop + 40));
}

function ensureChunks(run) {
  const need = Math.floor((run.maxDepth + run.VH * 1.2) / CH);
  while (run.chunks <= need) genChunk(run, run.chunks++);
}

// ── Luz (cueva) ────────────────────────────────────────────────────────────

const cellKey = (run, x, y) => Math.floor(y / CELL) * run.gw + Math.floor(x / CELL);

function markLit(run, x, y, r) {
  const ci = Math.floor(x / CELL);
  const cj = Math.floor(y / CELL);
  for (let j = Math.max(0, cj - r); j <= cj + r; j++) {
    for (let i = ci - r; i <= ci + r; i++) {
      if (i < 0 || i >= run.gw) continue;
      if ((i - ci) ** 2 + (j - cj) ** 2 > r * r + r) continue;
      const g = j * run.gw + i;
      if (!run.lit.has(g)) { run.lit.add(g); run.litDirty = true; }
    }
  }
}

export function isLit(run, x, y) {
  return !run.dark || run.lit.has(cellKey(run, x, y));
}

// ── Crecimiento ────────────────────────────────────────────────────────────

function newTip(x, y, a) {
  return { x, y, a, acc: 0, alive: true };
}

/** ¿Hay una piedra o un pico de roca que bloquee (según lo que ya atraviesas)? */
function blocked(run, x, y) {
  const { st } = run;
  const kk = Math.floor(y / CH);
  for (let k = kk - 1; k <= kk; k++) {
    for (const s of bucket(run, k).stones) {
      if (x < s.x || x >= s.x + s.w || y < s.y || y >= s.y + s.h) continue;
      if (s.kind === 'stalag') {
        if (st.stalagPass) continue;
        const t = s.up ? (y - s.y) / s.h : 1 - (y - s.y) / s.h;
        if (Math.abs(x - (s.x + s.w / 2)) <= (s.w / 2) * t + 0.5) return true;
        continue;
      }
      if (!st.stonePass) return true;
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

/** Avanza una punta `step` px. target: {x,y,turn} o null. */
function growTip(run, tip, step, target, dt = 0.1) {
  const { st, rng, W } = run;
  if (target) {
    const want = Math.atan2(target.y - tip.y, target.x - tip.x);
    const d = wrap(want - tip.a);
    const m = target.turn * dt;
    tip.a += Math.max(-m, Math.min(m, d));
  } else {
    // sin guía: tiende a bajar, abriéndose a los lados
    tip.a += wrap(Math.PI / 2 - tip.a) * 0.25 * dt;
  }
  tip.a += (rng() - 0.5) * 3 * dt;
  let nx = tip.x + Math.cos(tip.a) * step;
  const ny = tip.y + Math.sin(tip.a) * step;
  if (tip.y >= run.waterTop) nx += run.flow * st.current * dt; // la corriente del barro inundado
  if (ny < run.soilTop || nx < 1 || nx > W - 2 || blocked(run, nx, ny)) {
    tip.alive = false;
    return;
  }
  const gi = cellKey(run, nx, ny);
  const same = cellKey(run, tip.x, tip.y) === gi;
  const filled = run.grid.get(gi) || 0;
  if (!same && filled >= CELL_CAP) {
    tip.alive = false;
    return;
  }
  run.grid.set(gi, filled + step);
  if (run.dark && !run.litSrc.has(gi)) { run.litSrc.add(gi); markLit(run, nx, ny, run.lightCells); }
  const seg = [tip.x, tip.y, nx, ny];
  run.segs.push(seg);
  run.newSegs.push(seg);
  run.length += step;
  if (ny > run.maxDepth) run.maxDepth = ny;
  tip.x = nx;
  tip.y = ny;
  tip.acc += step;
  if (tip.acc >= BRANCH_EVERY) {
    tip.acc = 0;
    if (run.tips.length < Math.min(st.tips, MAX_TIPS_HARD) && rng() < st.branch) {
      const side = rng() < 0.5 ? -1 : 1;
      run.tips.push(newTip(nx, ny, tip.a + side * (0.5 + rng() * 0.6)));
    }
  }
}

function absorb(run, list, i) {
  const p = list[i];
  list.splice(i, 1);
  let cur = 'n';
  let amount;
  if (p.type === 'm') { cur = 'm'; amount = run.st.mineralValue; } else if (p.type === 'c') { cur = 'c'; amount = run.st.crystalValue; } else amount = POCKETS[p.type].value * run.st.value * depthMult(run, p.y);
  run.gained[cur] += amount;
  run.absorbed += 1;
  run.events.push({ type: 'absorb', x: p.x, y: p.y, cur, amount, kind: p.type });
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

const inside = (o, x, y) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h;

/** Trozos alrededor del frente (lo más hondo), donde pasa casi todo. */
function frontChunks(run, above = 1.5, below = 1.2) {
  return [Math.max(0, Math.floor((run.maxDepth - run.VH * above) / CH)), Math.floor((run.maxDepth + run.VH * below) / CH)];
}

/**
 * Avanza la temporada dt segundos. pointer: {x,y} en píxeles del mundo, o null.
 * Los sucesos se acumulan en run.events.
 */
export function stepRun(run, dt, pointer) {
  if (run.ended) return;
  const { st } = run;
  run.t += dt;
  let kmin = Infinity;
  let kmax = -Infinity;

  for (const tip of run.tips) {
    const kk = Math.floor(tip.y / CH);
    // ¿Dentro de una colonia rival?
    let fighting = false;
    for (let k = kk - 1; k <= kk + 1 && tip.alive; k++) {
      for (const c of bucket(run, k).colonies) {
        if (c.dead || (c.x - tip.x) ** 2 + (c.y - tip.y) ** 2 > c.r * c.r) continue;
        if (!st.antibiotic) { tip.alive = false; run.events.push({ type: 'bite', x: tip.x, y: tip.y }); break; }
        fighting = true;
        c.hp -= st.dps * dt;
        if (c.hp <= 0 && !c.dead) {
          c.dead = true;
          run.gained.t += st.colonyReward;
          run.gained.n += 10 * st.value * depthMult(run, c.y);
          run.events.push({ type: 'colony', x: c.x, y: c.y, cur: 't', amount: st.colonyReward });
        }
      }
    }
    if (!tip.alive || fighting) continue;

    let target = null;
    if (pointer && (pointer.x - tip.x) ** 2 + (pointer.y - tip.y) ** 2 < st.attract * st.attract) {
      target = { x: pointer.x, y: pointer.y, turn: 4.5 };
    } else if (st.sense) {
      const p = nearestPocket(run, tip.x, tip.y, st.sense);
      if (p) target = { x: p.x, y: p.y, turn: 3 };
    }
    let speed = st.speed * hardness(run, tip.y);
    if (st.puddles && inPuddle(run, tip.x, tip.y)) speed *= 2;
    if (tip.y >= run.waterTop) speed *= st.waterSpeed;
    growTip(run, tip, speed * dt, target, dt);
    if (!tip.alive) continue;
    const k2 = Math.floor(tip.y / CH);
    if (k2 < kmin) kmin = k2;
    if (k2 > kmax) kmax = k2;

    // Absorber bolsas
    for (let k = k2 - 1; k <= k2 + 1; k++) {
      const list = bucket(run, k).pockets;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        const reach = p.r + st.absorb;
        if ((p.x - tip.x) ** 2 + (p.y - tip.y) ** 2 <= reach * reach) absorb(run, list, i);
      }
      for (const p of bucket(run, k).peats) {
        if (p.done || !inside(p, tip.x, tip.y)) continue;
        p.prog += speed * dt;
        if (p.prog >= PEAT_NEED) {
          p.done = true;
          const amount = st.peatValue;
          run.gained.t += amount;
          run.gained.n += 8 * st.value;
          run.events.push({ type: 'peat', x: p.x + p.w / 2, y: p.y + p.h / 2, cur: 't', amount, ref: p });
        }
      }
    }
    // Junto a la superficie: troncos y raíces de las plantas
    if (k2 === 0) {
      for (const l of run.logs) {
        if (l.done || !inside(l, tip.x, tip.y)) continue;
        l.prog += speed * dt;
        if (l.prog >= LOG_NEED) {
          l.done = true;
          const amount = st.logValue * st.value;
          run.gained.n += amount;
          run.logGain += amount;
          run.events.push({ type: 'log', x: l.x + l.w / 2, y: l.y + l.h / 2, cur: 'n', amount, ref: l });
        }
      }
      for (const pl of run.plants) {
        if (!pl.connected && (pl.x - tip.x) ** 2 + (pl.y - tip.y) ** 2 < pl.roots * pl.roots) {
          pl.connected = true;
          run.events.push({ type: 'plant', x: pl.x, y: run.soilTop - 6, kind: pl.kind });
        }
      }
    }
  }
  run.tips = run.tips.filter((t) => t.alive);

  // Reponer puntas muertas desde la zona más reciente (y honda) de la red
  if (run.tips.length < st.tips) {
    run.refill -= dt;
    if (run.refill <= 0) {
      run.refill = 0.35;
      const n = run.segs.length;
      const seg = n ? run.segs[Math.min(n - 1, Math.floor(n * (0.7 + 0.3 * run.rng())))] : [run.cx, run.cy, run.cx, run.cy];
      run.tips.push(newTip(seg[2], seg[3], Math.PI / 2 + (run.rng() - 0.5) * 2.4));
    }
  }

  const [f0, f1] = frontChunks(run);

  // Grillos: saltan; si tocan la red se llevan esporas y, donde las sueltan, nace una red nueva
  for (let k = f0; k <= f1; k++) {
    for (const c of bucket(run, k).crickets) {
      c.hop -= dt;
      if (c.hop <= 0) {
        const a = run.rng() * TAU;
        const v = 30 + run.rng() * 30;
        c.vx = Math.cos(a) * v;
        c.vy = Math.sin(a) * v * 0.6;
        c.hop = c.carry > 0 ? 0.35 + run.rng() * 0.3 : 0.8 + run.rng() * 1.2;
        c.air = 0.3;
      }
      if (c.air > 0) {
        c.air -= dt;
        c.x = Math.max(3, Math.min(run.W - 3, c.x + c.vx * dt));
        c.y = Math.max(run.soilTop + 3, Math.min((k + 1) * CH - 2, Math.max(k * CH + 1, c.y + c.vy * dt)));
      }
      if (!c.used && c.carry <= 0 && run.grid.has(cellKey(run, c.x, c.y))) {
        c.carry = 1.8 + run.rng() * 1.5;
        run.events.push({ type: 'pickup', x: c.x, y: c.y });
      } else if (c.carry > 0) {
        c.carry -= dt;
        if (c.carry <= 0) {
          c.used = true;
          for (let n = 0; n < st.jumpTips && run.tips.length < MAX_TIPS_HARD; n++) run.tips.push(newTip(c.x, c.y, run.rng() * TAU));
          if (run.dark) markLit(run, c.x, c.y, run.lightCells + 1);
          run.events.push({ type: 'jump', x: c.x, y: c.y });
        }
      }
    }
  }

  // Las colonias crecen y se comen la red y la comida que tocan
  if (st.colonies) {
    run.eatT -= dt;
    const eat = run.eatT <= 0;
    if (eat) run.eatT = 0.25;
    for (let k = f0; k <= f1; k++) {
      for (const c of bucket(run, k).colonies) {
        if (c.dead) continue;
        c.r = Math.min(c.maxR, c.r + st.colonyGrowth * dt);
        if (!eat) continue;
        const r = Math.ceil(c.r / CELL);
        const ci = Math.floor(c.x / CELL);
        const cj = Math.floor(c.y / CELL);
        for (let j = cj - r; j <= cj + r; j++) {
          for (let i = ci - r; i <= ci + r; i++) {
            if (i < 0 || j < 0 || i >= run.gw) continue;
            if (((i + 0.5) * CELL - c.x) ** 2 + ((j + 0.5) * CELL - c.y) ** 2 > c.r * c.r) continue;
            const g = j * run.gw + i;
            const v = run.grid.get(g);
            if (v) { run.length = Math.max(0, run.length - v); run.grid.delete(g); }
          }
        }
        for (let kk = k - 1; kk <= k + 1; kk++) {
          const list = bucket(run, kk).pockets;
          for (let i = list.length - 1; i >= 0; i--) {
            if ((list[i].x - c.x) ** 2 + (list[i].y - c.y) ** 2 < c.r * c.r) list.splice(i, 1);
          }
        }
      }
    }
  }

  // Bolsas en una zona donde ya hay red: se absorben solas (solo donde crece la red)
  if (kmin <= kmax) {
    for (let k = kmin - 1; k <= kmax + 1; k++) {
      const list = bucket(run, k).pockets;
      for (let i = list.length - 1; i >= 0; i--) if (run.grid.has(cellKey(run, list[i].x, list[i].y))) absorb(run, list, i);
    }
  }

  // Absorción pasiva y plantas conectadas
  if (st.passive) run.gained.n += st.passive * run.length * st.value * dt;
  for (const pl of run.plants) if (pl.connected) run.gained[pl.cur] += pl.rate * dt;

  // Bolsas nuevas, siempre cerca del frente
  if (st.respawn) {
    run.respawnT -= dt;
    if (run.respawnT <= 0) {
      run.respawnT = st.respawn;
      const y = Math.round(Math.max(run.soilTop + 4, run.maxDepth - run.VH * 0.4 + run.rng() * run.VH * 0.7));
      const x = Math.round(6 + run.rng() * (run.W - 12));
      const type = run.rng() < st.big ? 'big' : 'n';
      const k = Math.floor(y / CH);
      if (run.ch[k] && !run.grid.has(cellKey(run, x, y))) run.ch[k].pockets.push({ x, y, r: POCKETS[type].r, type, k });
    }
  }

  ensureChunks(run);
  if (run.t >= run.dur) endRun(run);
}

function endRun(run) {
  run.ended = true;
  const { st } = run;
  if (st.setas && run.segs.length) {
    // Una seta por cada 100 px de red hasta 100; a partir de ahí rinde menos (raíz cuadrada)
    const base = run.length <= 10000 ? run.length / 100 : 100 * Math.sqrt(run.length / 10000);
    const total = Math.floor(base * st.setaRate);
    const count = Math.min(150, total);
    // Las setas brotan en la superficie, encima de la red
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of run.segs) { if (s[2] < lo) lo = s[2]; if (s[2] > hi) hi = s[2]; }
    for (let k = 0; k < count; k++) {
      run.setas.push({ x: Math.round(lo + (hi - lo) * run.rng()), y: run.soilTop - 1, d: 0.5 + run.rng() * 0.8 });
    }
    run.setasTotal = total;
    run.gained.e = total * st.sporesPerSeta;
  }
}

/** Puntero del bot: lo más valioso y cercano que esté a la vista; si no hay nada, hacia abajo. */
export function botPointer(run) {
  let deep = null;
  for (const t of run.tips) if (!deep || t.y > deep.y) deep = t;
  if (!deep) return null;
  let best = null;
  let bd = Infinity;
  const [f0, f1] = frontChunks(run, 1, 1);
  const danger = (x, y) => {
    if (run.st.antibiotic) return false;
    const kk = Math.floor(y / CH);
    for (let k = kk - 1; k <= kk + 1; k++) for (const c of bucket(run, k).colonies) if (!c.dead && (c.x - x) ** 2 + (c.y - y) ** 2 < (c.r + 8) ** 2) return true;
    return false;
  };
  const consider = (x, y, w) => {
    const d = (((x - deep.x) ** 2 + (y - deep.y) ** 2) * w) / depthMult(run, y);
    if (d < bd && !danger(x, y) && isLit(run, x, y)) { bd = d; best = { x, y }; }
  };
  for (let k = f0; k <= f1; k++) {
    const b = bucket(run, k);
    for (const p of b.pockets) consider(p.x, p.y, 1);
    for (const p of b.peats) if (!p.done) consider(p.x + p.w / 2, p.y + p.h / 2, 0.4);
    if (run.st.antibiotic) for (const c of b.colonies) if (!c.dead) consider(c.x, c.y, 0.6);
  }
  // Al empezar, lo primero es conectar las plantas y los troncos de la superficie
  if (run.t < 6) {
    const pl = run.plants.find((p) => !p.connected) || run.logs.find((l) => !l.done);
    if (pl) return pl.w ? { x: pl.x + pl.w / 2, y: pl.y + 3 } : { x: pl.x, y: pl.y };
  }
  if (best && best.y > deep.y - 30) return best;
  return { x: deep.x + Math.sin(run.t * 0.7) * 30, y: deep.y + 40 };
}
