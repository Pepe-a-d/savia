// Arranque y bucle: árbol ⇄ temporada ⇄ resumen.

import './style.css';
import { newState, computeStats, applySeason, buyNode, hydrate, depthRecord } from './game.js';
import { createRun, stepRun, depthMult } from './run.js';
import { RunRenderer } from './render.js';
import { TreeView } from './treeview.js';
import { knownCurrencies, renderRes, iconButton, toast, modal, settingsDialog, setText, el } from './ui.js';
import { sfx, setSound } from './audio.js';
import { fmt, fmtTime, fmtDepth } from './format.js';
import { resURL } from './pixel.js';
import { NODE_BY_ID, CURRENCIES, BRANCHES, BIOMES, LAYERS, layerIndex } from './data.js';
import { playDecomposition } from './minigames/descomposicion.js';
import { playEsporada } from './minigames/esporada.js';

const SAVE_KEY = 'micelio:save';
const $ = (s) => document.querySelector(s);

const G = {
  state: null,
  screen: 'tree',
  run: null,
  pointer: null,
  ptrClient: null, // último punto del ratón o dedo en pantalla (la cámara se mueve aunque no muevas el ratón)
  frozen: false,
  save,
  exportCode,
  importCode,
  hardReset,
  applySettings() { setSound(G.state.settings.sound); },
};
window.micelio = G;

// ── Guardado ───────────────────────────────────────────────────────────────

function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return hydrate(JSON.parse(raw));
  } catch (e) {
    console.warn('No se pudo cargar la partida:', e.message);
  }
  return null;
}

function save() {
  if (G.frozen || !G.state) return false;
  G.state.lastSave = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.state)); return true; } catch { return false; }
}

function exportCode() {
  const bytes = new TextEncoder().encode(JSON.stringify(G.state));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function importCode(code) {
  const text = String(code || '').trim();
  if (!text) throw new Error('Pega primero un código.');
  let data;
  try {
    data = JSON.parse(text.startsWith('{') ? text : new TextDecoder().decode(Uint8Array.from(atob(text.replace(/\s+/g, '')), (c) => c.charCodeAt(0))));
  } catch {
    throw new Error('Ese código no se puede leer. ¿Lo has copiado entero?');
  }
  const s = hydrate(data);
  G.frozen = true;
  localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  location.reload();
}

function hardReset() {
  G.frozen = true;
  try { localStorage.removeItem(SAVE_KEY); } catch { /* nada */ }
  location.reload();
}

// ── Árbol ──────────────────────────────────────────────────────────────────

function refreshTree() {
  const s = G.state;
  G.tree.update(s);
  renderRes($('#tree-res'), knownCurrencies(s), s.res);
  const swampOpen = s.levels.pantano > 0;
  const caveOpen = s.levels.cueva > 0;
  if (!swampOpen || (s.biome === 'cueva' && !caveOpen)) s.biome = swampOpen ? 'pantano' : 'bosque';
  $('#biome-pick').hidden = !swampOpen;
  for (const b of document.querySelectorAll('#biome-pick button')) {
    b.classList.toggle('on', b.dataset.b === s.biome);
    if (b.dataset.b === 'cueva') b.hidden = !caveOpen;
  }
  setText($('#start'), `▶ Temporada ${s.seasons + 1}${swampOpen ? ` · ${BIOMES[s.biome].name}` : ''}`);
  const l = s.last;
  setText($('#last'), l ? `Última: +${fmt(l.n)} N${l.m ? ` · +${fmt(l.m)} M` : ''}${l.a ? ` · +${fmt(l.a)} A` : ''}${l.e ? ` · +${fmt(l.e)} E` : ''}${l.t ? ` · +${fmt(l.t)} T` : ''}${l.c ? ` · +${fmt(l.c)} C` : ''}` : '');
}

const UNLOCK_NEWS = {
  minerales: ['m', 'Nueva moneda: <b>minerales</b>. Busca las vetas cian.'],
  arboles: ['a', 'Nueva moneda: <b>azúcar</b>. Llega a las raíces de los árboles.'],
  setas: ['e', 'Nueva moneda: <b>esporas</b>. Salen de las setas al final de cada temporada.'],
  quimio: [null, 'Tus puntas ya buscan comida <b>solas</b>.'],
  troncos: [null, 'Aparecen <b>troncos</b> bajo la superficie: cúbrelos con tu red.'],
  juncos: ['t', 'Aparecen <b>juncos</b> en la orilla: llega a sus raíces.'],
  antibiotico: ['t', 'Tus puntas ya pueden <b>destruir colonias</b>.'],
  grillos: ['c', 'Aparecen <b>grillos</b>: si tocan tu red, se llevan tus esporas lejos.'],
  eco: ['c', 'Ya ves la silueta de los <b>cristales</b> y el <b>guano</b> a oscuras.'],
};

function onBuy(id) {
  const s = G.state;
  const node = NODE_BY_ID[id];
  if (buyNode(s, id)) {
    sfx.buy();
    G.tree.flash(id, true);
    refreshTree();
    save();
    const news = UNLOCK_NEWS[id];
    if (news && s.levels[id] === 1) toast(news[1], news[0] ? CURRENCIES[news[0]].color : BRANCHES[node.branch].color);
    if (node.final) ending(node.final);
  } else {
    sfx.deny();
    G.tree.flash(id, false);
  }
}

async function ending(which) {
  sfx.prestige();
  const s = G.state;
  if (which === 'bosque') {
    await modal({
      title: '¡El anillo de hadas!',
      body: `<p>Un círculo perfecto de setas brilla en el claro, y el viento se lleva sus esporas lejos.</p>
        <p>Has completado el bosque en <b>${s.seasons} temporadas</b>.</p>
        <p>Tus esporas han llegado a un <b>pantano</b>. Ya puedes elegir dónde pasar cada temporada, y en el árbol se abre una rama nueva.</p>`,
      actions: [{ id: 'ok', label: 'Al pantano', primary: true }],
    });
    s.biome = 'pantano';
    G.tree.center();
  } else if (which === 'pantano') {
    await modal({
      title: '¡Fuego fatuo!',
      body: `<p>Luces verdes flotan sobre el agua: es tu micelio, brillando en la oscuridad del pantano.</p>
        <p>Has completado el pantano en <b>${s.seasons} temporadas</b>.</p>
        <p>Una grieta del fondo lleva a una <b>cueva</b>. Ya puedes bajar, y en el árbol se abre otra rama.</p>`,
      actions: [{ id: 'ok', label: 'A la cueva', primary: true }],
    });
    s.biome = 'cueva';
  } else {
    await modal({
      title: '¡El corazón de la cueva!',
      body: `<p>En lo más hondo, una geoda enorme late con tu luz. Tu micelio ya llega del bosque a la cueva.</p>
        <p>Has completado la cueva. En total, <b>${s.seasons} temporadas</b> (${fmtTime(s.stats.time)} de juego).</p>
        <p>Las ruinas llegan en la siguiente fase. Mientras tanto puedes seguir jugando.</p>`,
      actions: [{ id: 'ok', label: 'Seguir', primary: true }],
    });
  }
  refreshTree();
  save();
}

// ── Temporada ──────────────────────────────────────────────────────────────

function show(screen) {
  G.screen = screen;
  $('#screen-tree').hidden = screen !== 'tree';
  $('#screen-run').hidden = screen !== 'run';
}

async function startRun() {
  if (G.screen !== 'tree' || document.querySelector('.modal-wrap')) return;
  const s = G.state;
  const biome = s.biome === 'cueva' && s.levels.cueva ? 'cueva' : s.biome === 'pantano' && s.levels.pantano ? 'pantano' : 'bosque';
  if (biome === 'cueva' && !s.flags.caveIntro) {
    s.flags.caveIntro = true;
    await modal({
      title: 'La cueva',
      body: `<p>Aquí no llega la luz: <b>solo ves lo que ilumina tu red</b>. Crece para descubrir la cueva.</p>
        <p><b>Cristales</b> (morados): están escondidos en la roca y a oscuras solo destellan de vez en cuando.</p>
        <p><b>Estalagmitas</b>: bloquean el paso hasta que aprendas a disolver la caliza.</p>
        <p>Los cristales pagan la rama de la cueva.</p>`,
      actions: [{ id: 'ok', label: 'Bajar', primary: true }],
    });
  }
  if (!s.flags.digIntro && s.seasons > 0) {
    s.flags.digIntro = true;
    await modal({
      title: 'El suelo no se acaba',
      body: `<p>Ahora tu red puede <b>excavar sin límite</b>: la cámara baja con ella.</p>
        <p>Cuanto más hondo, <b>más vale la comida</b>: Tierra, Arcilla, Roca… aunque la tierra es más dura y se crece más despacio.</p>
        <p>Una línea marca tu <b>récord de profundidad</b> en cada lugar. Al acabar la temporada vuelves a la superficie para ver tus setas.</p>`,
      actions: [{ id: 'ok', label: 'A cavar', primary: true }],
    });
  }
  if (biome === 'pantano' && !s.flags.swampIntro) {
    s.flags.swampIntro = true;
    await modal({
      title: 'El pantano',
      body: `<p>Aquí las cosas son distintas:</p>
        <p><b>Barro inundado</b> (azul): creces más rápido, pero la corriente arrastra tus hifas.</p>
        <p><b>Colonias rivales</b> (rojas): crecen y se comen tu red. Esquívalas hasta tener Antibióticos.</p>
        <p><b>Turba</b> (verde): cubre los depósitos con tu red. La turba paga la rama del pantano.</p>`,
      actions: [{ id: 'ok', label: 'Empezar', primary: true }],
    });
  }
  const st = computeStats(s, biome);
  const { W, H } = G.renderer.worldSize();
  const seed = (s.seed + s.seasons * 7919) >>> 0;
  G.run = createRun(st, seed, W, H);
  G.endT = 0;
  G.summaryShown = false;
  G.pointer = G.ptrClient = null;
  G.prevBest = s.stats.bestN;
  G.biome = biome;
  G.prevDeep = depthRecord(s, biome);
  G.layer = layerIndex(biome, G.prevDeep); // el cartel solo sale en capas que nunca habías alcanzado
  G.recShown = false;
  show('run');
  $('#summary').hidden = true;
  $('#run-depth').textContent = '';
  $('#run-depth')._k = null;
  G.renderer.setRun(G.run, seed, { record: G.prevDeep });
  setText($('#run-season'), `Temporada ${s.seasons + 1}${s.levels.pantano ? ` · ${BIOMES[biome].name}` : ''}`);
  const hint = $('#run-hint');
  hint.hidden = s.seasons >= 2;
  hint.textContent = window.matchMedia('(pointer: coarse)').matches
    ? 'Arrastra el dedo por la tierra: tus hifas irán hacia allí'
    : 'Mueve el ratón por la tierra: tus hifas irán hacia allí';
  sfx.click();
}

function onRunEnd() {
  const run = G.run;
  const g = { ...run.gained };
  applySeason(G.state, g, { time: run.dur, depth: run.maxDepth - run.soilTop, biome: G.biome });
  save();
  sfx.achievement();
  $('#run-hint').hidden = true;
}

function showSummary() {
  G.summaryShown = true;
  const run = G.run;
  const s = G.state;
  const g = run.gained;
  const st = run.st;
  const box = $('#summary');
  const known = knownCurrencies(s);
  const rows = known.filter((c) => c === 'n' || g[c] > 0).map((c) => `
    <div class="gain" data-c="${c}"><img alt="" src="${resURL(c)}">+${fmt(g[c])} <small>${CURRENCIES[c].name}</small><span class="bonus"></span></div>`).join('');
  const best = g.n > G.prevBest && s.seasons > 1;
  const depth = run.maxDepth - run.soilTop;
  const deepRec = depth > G.prevDeep && s.seasons > 1;
  const setas = run.setasTotal || run.setas.length;
  box.innerHTML = `
    <h2>Temporada ${s.seasons}</h2>
    <p class="sub">Bajaste <b>${fmtDepth(depth)}</b>, hasta ${LAYERS[G.biome][layerIndex(G.biome, depth)][1].toLowerCase()} · ${run.absorbed} bolsas${setas ? ` · ${fmt(setas)} setas` : ''}</p>
    ${best || deepRec ? `<div class="best">${[best && 'Mejor temporada', deepRec && 'Récord de profundidad'].filter(Boolean).join(' · ')}</div>` : ''}
    <div class="gains">${rows}</div>
    <div class="games"></div>
    <button type="button" class="px-btn big" id="to-tree">Al árbol ▶</button>`;
  const games = box.querySelector('.games');
  const addGame = (label, play) => {
    const b = el('button', 'px-btn ghost small');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', async () => {
      b.disabled = true;
      await play(b);
    });
    games.append(b);
  };
  if (st.esporada && g.e > 0) {
    addGame('Soltar esporas (minijuego, ×1 a ×2,5)', async (b) => {
      const r = await playEsporada({ setas: run.setas.length });
      const mult = r ? r.mult : 1;
      const bonus = Math.round(g.e * (mult - 1));
      s.res.e += bonus;
      s.stats.totalE += bonus;
      if (mult > s.stats.bestEsporada) s.stats.bestEsporada = mult;
      box.querySelector('[data-c="e"] .bonus').textContent = bonus ? ` +${fmt(bonus)}` : '';
      b.textContent = `Esporada ×${mult.toFixed(1).replace('.', ',')}`;
      save();
    });
  }
  if (st.descomp && run.logGain > 0) {
    addGame('Descomponer troncos (minijuego, ×1 a ×3)', async (b) => {
      const r = await playDecomposition();
      const mult = r ? r.mult : 1;
      const bonus = run.logGain * (mult - 1);
      s.res.n += bonus;
      s.stats.totalN += bonus;
      if (mult > s.stats.bestDecomp) s.stats.bestDecomp = mult;
      box.querySelector('[data-c="n"] .bonus').textContent = bonus ? ` +${fmt(bonus)}` : '';
      b.textContent = `Descomposición ×${mult.toFixed(1).replace('.', ',')}`;
      save();
    });
  }
  box.hidden = false;
  const btn = $('#to-tree');
  btn.addEventListener('click', toTree);
  btn.focus();
}

function toTree() {
  if (G.screen !== 'run' || !G.summaryShown || document.querySelector('.mg-wrap, .modal-wrap')) return;
  G.run = null;
  $('#summary').hidden = true;
  show('tree');
  refreshTree();
}

function updateRunHUD() {
  const run = G.run;
  // Profundidad: capa, metros y cuánto vale la comida ahí
  const depth = run.maxDepth - run.soilTop;
  const li = layerIndex(G.biome, depth);
  if (!run.ended && li > G.layer) {
    G.layer = li;
    G.recShown = true;
    G.renderer.showBanner(LAYERS[G.biome][li][1], `la comida vale ×${depthMult(run, run.maxDepth).toFixed(1).replace('.', ',')}`);
    sfx.achievement();
  } else if (!run.ended && !G.recShown && G.prevDeep > 20 && depth > G.prevDeep) {
    G.recShown = true;
    G.renderer.showBanner('¡Nuevo récord!', `más hondo que nunca en ${BIOMES[G.biome].name.toLowerCase()}`);
    sfx.glow();
  }
  const key = `${Math.floor(depth / 10)}|${li}`;
  const box = $('#run-depth');
  if (box._k !== key) {
    box._k = key;
    const mult = depthMult(run, run.maxDepth).toFixed(1).replace('.', ',');
    box.innerHTML = `<b>${fmtDepth(depth)}</b> ${LAYERS[G.biome][li][1]} <span>×${mult}</span>${G.prevDeep > 20 ? `<small>récord ${fmtDepth(Math.max(G.prevDeep, depth))}</small>` : ''}`;
    box.classList.toggle('rec', G.prevDeep > 20 && depth > G.prevDeep);
  }
  const left = Math.max(0, run.dur - run.t);
  setText($('#run-time'), String(Math.ceil(left)));
  const fill = $('#timer-fill');
  const f = (1 - run.t / run.dur).toFixed(3);
  if (fill._f !== f) { fill._f = f; fill.style.transform = `scaleX(${f})`; }
  $('.timer').classList.toggle('low', left < 5);
  renderRes($('#run-res'), knownCurrencies(G.state), run.gained, true);
}

// ── Entrada ────────────────────────────────────────────────────────────────

function bindInput() {
  const c = $('#run');
  const at = (e) => { G.ptrClient = { x: e.clientX, y: e.clientY }; return G.renderer.toWorld(e.clientX, e.clientY); };
  c.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' || e.buttons) {
      G.pointer = at(e);
      if (G.state.seasons >= 0 && !$('#run-hint').hidden && G.run && G.run.t > 2) $('#run-hint').hidden = true;
    }
  });
  c.addEventListener('pointerdown', (e) => { G.pointer = at(e); c.setPointerCapture?.(e.pointerId); });
  c.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') G.pointer = G.ptrClient = null; });
  c.addEventListener('pointercancel', () => { G.pointer = G.ptrClient = null; });
  c.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') G.pointer = G.ptrClient = null; });

  window.addEventListener('keydown', (e) => {
    if (document.querySelector('.modal-wrap, .mg-wrap')) return;
    if ((e.key === 'Enter' || e.key === ' ') && G.screen === 'tree' && !(e.target instanceof HTMLButtonElement && e.target.classList.contains('node'))) {
      e.preventDefault();
      startRun();
    } else if (e.key === 'Enter' && G.screen === 'run' && G.summaryShown && document.activeElement?.id !== 'to-tree') {
      e.preventDefault();
      toTree();
    }
  });
}

// ── Bucle ──────────────────────────────────────────────────────────────────

function frame(t) {
  const dt = Math.min(0.05, Math.max(0, (t - G.last) / 1000));
  G.last = t;
  if (G.screen === 'run' && G.run) {
    const run = G.run;
    if (G.ptrClient) G.pointer = G.renderer.toWorld(G.ptrClient.x, G.ptrClient.y);
    if (!run.ended) {
      let left = dt;
      while (left > 0 && !run.ended) {
        const h = Math.min(1 / 60, left);
        stepRun(run, h, G.pointer);
        left -= h;
      }
      for (const e of run.events) {
        if (e.amount !== undefined) e.text = fmt(e.amount, { decimals: e.amount < 10 ? 1 : 0 });
        G.renderer.onEvent(e);
        if (e.type === 'absorb') sfx.click();
        else if (e.type === 'log') sfx.glow();
        else if (e.type === 'tree') sfx.achievement();
      }
      run.events.length = 0;
      if (run.ended) onRunEnd();
    } else {
      G.endT += dt;
      if (G.endT > 1.8 && !G.summaryShown) showSummary();
    }
    G.renderer.draw(dt, G.pointer, G.state.settings);
    updateRunHUD();
  }
  requestAnimationFrame(frame);
}

// ── Arranque ───────────────────────────────────────────────────────────────

function boot() {
  const loaded = readSave();
  G.state = loaded || newState();
  G.applySettings();
  G.renderer = new RunRenderer($('#run'));
  G.tree = new TreeView($('#tree'), { onBuy });
  iconButton($('#gear'), 'gear');
  iconButton($('#center'), 'center');
  $('#gear').addEventListener('click', () => settingsDialog(G));
  $('#center').addEventListener('click', () => G.tree.center());
  $('#start').addEventListener('click', startRun);
  for (const b of document.querySelectorAll('#biome-pick button')) {
    b.addEventListener('click', () => { G.state.biome = b.dataset.b; refreshTree(); save(); });
  }
  G.renderer.hudTarget = (cur) => {
    const chip = $('#run-res')._chips?.[cur]?.chip;
    if (!chip) return null;
    const r = chip.getBoundingClientRect();
    return { x: r.left + 14, y: r.top + r.height / 2 };
  };
  bindInput();
  show('tree');
  refreshTree();
  save();
  setInterval(save, 15000);
  window.addEventListener('pagehide', save);

  if (!loaded) {
    modal({
      title: 'Micelio',
      body: `<p>Eres una espora bajo el bosque.</p>
        <p>Cada <b>temporada</b> tu red crece sola durante unos segundos. Mueve el ratón (o el dedo) para guiarla hacia las bolsas de comida.</p>
        <p>El suelo no se acaba: cuanto más <b>hondo</b> llegues, más vale la comida.</p>
        <p>Con lo que absorbas, mejora tu micelio en el <b>árbol</b>: la siguiente temporada llegarás más lejos.</p>`,
      actions: [{ id: 'ok', label: 'Empezar', primary: true }],
    });
    G.state.flags.digIntro = true;
  }

  if (import.meta.env.DEV) {
    G.debug = {
      give(n = 1e6, cur = 'n') { G.state.res[cur] += n; refreshTree(); },
      endRun() { if (G.run) G.run.t = G.run.dur; },
    };
  }

  G.last = performance.now();
  requestAnimationFrame(frame);
}

boot();
