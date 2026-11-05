// Bot que juega temporadas y compra en el árbol, para medir el ritmo.
// Uso: npm run sim  (o node sim/balance.mjs 120 3 → hasta 120 min, 3 semillas)
// Apunta siempre a la bolsa libre más cercana (mejor que una persona) y supone minijuegos medianos.

import { newState, computeStats, applySeason, nodeStatus, nodeCost, buyNode, lvl } from '../src/game.js';
import { createRun, stepRun, botPointer } from '../src/run.js';
import { NODES } from '../src/data.js';
import { fmt, fmtTime } from '../src/format.js';

const MAX_MIN = Number(process.argv[2] || 200);
const SEEDS = Number(process.argv[3] || 2);
const OVERHEAD = 8; // s entre temporadas (resumen + árbol)
const AIM = 0.85; // fracción del tiempo que el bot apunta (una persona no es perfecta)

function play(seed0) {
  const s = newState(0);
  let time = 0;
  let seed = seed0;
  const log = [];
  const seen = new Set();
  let snap = 0;
  let forestEnd = 0;
  let swampEnd = 0;
  while (time < MAX_MIN * 60 && !s.done3) {
    const biome = s.done2 ? 'cueva' : s.done ? 'pantano' : 'bosque';
    const st = computeStats(s, biome);
    const run = createRun(st, seed++, 288, 180);
    const dt = 1 / 30;
    let aimT = 0;
    while (!run.ended) {
      aimT += dt;
      const aiming = (aimT % 1) < AIM;
      stepRun(run, dt, aiming ? botPointer(run) : null);
      run.newSegs.length = 0;
      run.events.length = 0;
    }
    const g = { ...run.gained };
    if (st.esporada) g.e = Math.round(g.e * 1.2);
    if (st.descomp) g.n += run.logGain * 0.6;
    applySeason(s, g, { time: run.dur });
    time += run.dur + OVERHEAD;

    // Compras: lo más barato primero, mientras se pueda
    for (;;) {
      const options = NODES.filter((n) => nodeStatus(s, n) === 'buy').sort((a, b) => nodeCost(s, a) - nodeCost(s, b));
      if (!options.length) break;
      const n = options[0];
      buyNode(s, n.id);
      if (!seen.has(n.id)) {
        seen.add(n.id);
        if (['quimio', 'setas', 'troncos', 'minerales', 'arboles', 'mult3', 'viento', 'anillo', 'antibiotico', 'juncos', 'biolum', 'fatuo', 'grillos', 'guano', 'eco', 'caliza', 'profundo', 'resonancia', 'espejo', 'corazon'].includes(n.id)) {
          log.push([time, `compra ${n.name}`]);
        }
      }
    }
    if (s.done && !forestEnd) { forestEnd = time; log.push([time, `BOSQUE COMPLETO en la temporada ${s.seasons}`]); snap = time; }
    if (s.done2 && !swampEnd) { swampEnd = time; log.push([time, `PANTANO COMPLETO en la temporada ${s.seasons} (${fmtTime(time - forestEnd)})`]); snap = time; }
    if (time >= snap) {
      snap += Number(process.env.SNAP || 600);
      log.push([time, `  ${biome} t${s.seasons} (${st.duration} s): +${fmt(g.n)} N, +${fmt(g.m)} M, +${fmt(g.a, { decimals: 1 })} A, +${fmt(g.e)} E, +${fmt(g.t, { decimals: 1 })} T, +${fmt(g.c, { decimals: 1 })} C · red ${Math.round(run.length)} px · hondo ${Math.round(run.maxDepth - run.soilTop)} px · ${run.absorbed} bolsas · nodos ${Object.values(s.levels).reduce((a, b) => a + b, 0)}`]);
    }
  }
  log.push([time, s.done3 ? `FIN: corazón de la cueva en la temporada ${s.seasons} (cueva: ${fmtTime(time - swampEnd)})` : `SIN TERMINAR tras ${s.seasons} temporadas`]);
  return log;
}

for (let k = 0; k < SEEDS; k++) {
  console.log(`\n── semilla ${k + 1}`);
  for (const [t, msg] of play(1000 * (k + 1))) console.log(`${fmtTime(t).padStart(12)}  ${msg}`);
}
