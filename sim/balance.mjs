// Bot que juega temporadas y compra en el árbol de mejoras, para medir el ritmo.
// Uso: npm run sim  (o node sim/balance.mjs 60 3 → hasta 60 min, 3 semillas)
// Guía las raíces hacia la bolsa más cercana y atrapa 6 de cada 10 frutos (una persona no es perfecta).

import { newState, computeStats, applySeason, nodeStatus, nodeCost, buyNode, pollenReady, pollenTime, setPollen, pruneReady, pruneTime, applyPrune, zonesOpen, lvl } from '../src/game.js';
import { createRun, stepRun, botPointer } from '../src/run.js';
import { NODES } from '../src/data.js';
import { fmt, fmtTime } from '../src/format.js';

const MAX_MIN = Number(process.argv[2] || 60);
const SEEDS = Number(process.argv[3] || 2);
const OVERHEAD = 6; // s entre temporadas (resumen + mejoras)
const AIM = 0.85; // fracción del tiempo que el bot guía las raíces
const SKILL = Number(process.env.SKILL || 6); // frutos atrapados de cada 10

function play(seed0) {
  const s = newState(0);
  let time = 0;
  let seed = seed0;
  const log = [];
  let snap = 0;
  let allT = 0;
  const seen = new Set();
  while (time < MAX_MIN * 60) {
    const zone = zonesOpen(s).pop();
    const st = computeStats(s, zone);
    const run = createRun(st, seed++, 288, 180);
    const dt = 1 / 30;
    let aimT = 0;
    while (!run.ended) {
      aimT += dt;
      const aiming = run.phase !== 'roots' || (aimT % 1) < AIM;
      stepRun(run, dt, aiming ? botPointer(run, SKILL) : null);
      run.newSegs.length = 0;
      run.events.length = 0;
    }
    const growth = run.trees.reduce((a, t) => a + t.growth, 0);
    applySeason(s, run.gained, { time: run.dur, depth: run.maxDepth - run.soilTop, zone, caught: run.caught, growth });
    time += run.dur + OVERHEAD;
    // Polinizar cuando se puede: el bot toca 6 de cada 10 flores (sale una cada 0,55 s)
    if (pollenReady(s)) {
      setPollen(s, Math.round((pollenTime(s) / 0.55) * 0.6));
      time += pollenTime(s) + 4;
    }
    // Podar cuando se puede: sale una rama cada 0,6 s y el bot corta 6 de cada 10
    if (pruneReady(s)) {
      applyPrune(s, Math.round((pruneTime(s) / 0.6) * 0.6));
      time += pruneTime(s) + 4;
    }
    const first = s.seasons <= 3;

    // Compras: lo más barato primero, mientras se pueda
    const bought = [];
    for (;;) {
      const options = NODES.filter((n) => nodeStatus(s, n) === 'buy').sort((a, b) => nodeCost(s, a) - nodeCost(s, b));
      if (!options.length) break;
      buyNode(s, options[0].id);
      bought.push(options[0].id);
    }
    const levels = Object.values(s.levels).reduce((a, b) => a + b, 0) - 1;
    const maxLevels = NODES.reduce((a, n) => a + n.max, 0) - 1;
    if (first || time >= snap) {
      if (!first) snap += Number(process.env.SNAP || 180);
      log.push([time, `${zone} t${s.seasons}: raíces ${run.rootsT.toFixed(1)} s + cosecha ${(run.dur - run.rootsT).toFixed(1)} s · +${fmt(run.gained.f, { decimals: 1 })} frutos (${run.caught}/${run.fruitCount} al vuelo) · creció ${fmt(growth, { decimals: 1 })} · ${run.trees.length} árb. · ${run.links} uniones · raíz ${Math.round(run.length)} px, hondo ${Math.round(run.maxDepth - run.soilTop)} px · ${run.absorbed} bolsas (+${run.bonusSprouts} brotes) · mejoras ${levels}/${maxLevels}${bought.length ? ` · compra ${bought.join(', ')}` : ''}`]);
    }
    for (const id of ['plantar', 'ribera', 'crecida', 'ladera', 'cumbre', 'viejo', 'eterno', 'madre']) {
      if (lvl(s, id) && !seen.has(id + lvl(s, id))) { seen.add(id + lvl(s, id)); log.push([time, `  → ${id} ${lvl(s, id)} (temporada ${s.seasons}, ${zone})`]); }
    }
    if (s.done) { allT = time; log.push([time, `FIN: el árbol madre en la temporada ${s.seasons} (${levels}/${maxLevels} niveles)`]); break; }
  }
  if (!allT) log.push([time, `Sin terminar: ${s.seasons} temporadas`]);
  return log;
}

for (let k = 0; k < SEEDS; k++) {
  console.log(`\n── semilla ${k + 1}`);
  for (const [t, msg] of play(1000 * (k + 1))) console.log(`${fmtTime(t).padStart(12)}  ${msg}`);
}
