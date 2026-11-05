// Arranque y bucle: mejoras ⇄ temporada ⇄ resumen.

import './style.css';
import { newState, computeStats, applySeason, buyNode, hydrate, depthRecord, affordableCount, pollenReady, setPollen, pollenTime, pollenPerFlower, pruneReady, pruneTime, prunePerBranch, applyPrune, zonesOpen, rebirth } from './game.js';
import { playEnding } from './ending.js';
import { playPolinizar } from './minigames/polinizar.js';
import { playPodar } from './minigames/podar.js';
import { createRun, stepRun, depthMult, liveGrowth, finishRoots } from './run.js';
import { RunRenderer } from './render.js';
import { TreeView } from './treeview.js';
import { knownCurrencies, renderRes, iconButton, toast, modal, settingsDialog, setText } from './ui.js';
import { sfx, setSound } from './audio.js';
import { fmt, fmtDepth, fmtLen } from './format.js';
import { resURL, cursorCSS } from './pixel.js';
import { NODE_BY_ID, BRANCHES, ZONES, LAYERS, layerIndex } from './data.js';

const SAVE_KEY = 'savia:save';
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
window.savia = G;

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

// ── Mejoras ────────────────────────────────────────────────────────────────

function refreshTree() {
  const s = G.state;
  G.tree.update(s);
  renderRes($('#tree-res'), knownCurrencies(s), s.res);
  const open = zonesOpen(s);
  if (!open.includes(s.zone)) s.zone = 'pradera';
  const pick = $('#zone-pick');
  pick.hidden = open.length < 2;
  const pkey = `${open.join('|')}|${s.zone}`;
  if (pick._k !== pkey) {
    pick._k = pkey;
    pick.innerHTML = open.map((z) => `<button type="button" data-z="${z}" class="${z === s.zone ? 'on' : ''}">${ZONES[z].name}</button>`).join('');
    for (const b of pick.querySelectorAll('button')) b.addEventListener('click', () => { s.zone = b.dataset.z; sfx.click(); refreshTree(); save(); });
  }
  setText($('#start'), `▶ Temporada ${s.seasons + 1}${open.length > 1 ? ` · ${ZONES[s.zone].name}` : ''}`);
  setText($('#gen'), s.legacy ? `gen. ${s.legacy + 1} · frutos ×${2 ** s.legacy}` : '');
  const lines = [];
  if (s.last) lines.push(`Última: +${fmt(s.last.f)} frutos`);
  if (s.pollen > 1) lines.push(`Polinizado: frutos ×${s.pollen.toFixed(2).replace('.', ',')} en la próxima`);
  setText($('#last'), lines.join('\n'));
}

const UNLOCK_NEWS = {
  doble: 'Tu árbol echa <b>una raíz más</b> a la vez.',
  olfato: 'Tus raíces ya buscan comida <b>solas</b>.',
  lluvia: 'Aparecen <b>charcos</b> bajo tierra: dentro, las raíces crecen el doble de rápido.',
  rompe: 'Tus raíces ya <b>atraviesan las piedras</b>.',
  dorado: 'A veces sale un <b>fruto dorado</b>: vale ×5.',
  abejas: 'Llegan las <b>abejas</b>: al acabar una temporada, podrás <b>polinizar</b> las flores.',
  entrelazadas: 'Guía raíces de árboles distintos para que se <b>toquen</b>: los dos crecen más.',
  ribera: 'Ya puedes ir a la <b>ribera</b>: elige la zona junto al botón de empezar.',
  tijeras: 'Ya puedes <b>podar</b>: al acabar una temporada, corta las ramas secas.',
  crecida: '¡<b>La crecida</b>! Frutos ×2 en todas las zonas. Ya puedes subir a la ladera.',
  ladera: 'Ya puedes subir a la <b>ladera</b>: busca las grietas en la roca.',
  cumbre: '¡<b>La cumbre</b>! Frutos ×2 en todas las zonas. Ya puedes ir al bosque viejo.',
  viejo: 'Ya puedes entrar en el <b>bosque viejo</b>: cubre los tocones y sigue las raíces muertas.',
  eterno: '<b>Savia eterna</b>: tus árboles dan el doble de frutos.',
};

function onBuy(id) {
  const s = G.state;
  const node = NODE_BY_ID[id];
  if (buyNode(s, id)) {
    sfx.buy();
    G.tree.flash(id, true);
    refreshTree();
    save();
    const news = id === 'plantar' ? `Ya tienes <b>${1 + s.levels.plantar} árboles</b>: todos echan raíces a la vez.` : s.levels[id] === 1 && UNLOCK_NEWS[id];
    if (news) toast(news, BRANCHES[node.branch].color);
    if ((id === 'ribera' || id === 'ladera' || id === 'viejo') && s.levels[id] === 1) { s.zone = id; refreshTree(); save(); }
    if (node.final) ending();
  } else {
    sfx.deny();
    G.tree.flash(id, false);
  }
}

// ── Temporada ──────────────────────────────────────────────────────────────

function show(screen) {
  G.screen = screen;
  $('#screen-tree').hidden = screen !== 'tree';
  $('#screen-run').hidden = screen !== 'run';
}

const ZONE_INTRO = {
  ribera: {
    title: 'La ribera',
    body: `<p>Bajo la orilla del río hay una capa de <b>agua subterránea</b> (azul).</p>
      <p>Dentro, tus raíces crecen <b>el doble de rápido</b>, pero la <b>corriente</b> las arrastra de lado.</p>
      <p>Cada raíz que llega al agua da <b>+4 % de crecimiento</b> a su árbol. Aquí la comida vale ×3.</p>`,
  },
  viejo: {
    title: 'El bosque viejo',
    body: `<p>Aquí vivieron árboles gigantes. Quedan sus <b>tocones</b> en la superficie: cúbrelos por dentro con tus raíces para descomponerlos. Cada uno da mucha comida y <b>2 brotes</b>.</p>
      <p>Bajo tierra siguen sus <b>raíces muertas</b> (grises). Lleva tus raíces por encima: las absorben y avanzan más deprisa, como por un camino.</p>
      <p>Aquí la comida vale ×30. Al final de esta rama está <b>el árbol madre</b>.</p>`,
  },
  ladera: {
    title: 'La ladera',
    body: `<p>Bajo una capa fina de tierra está la <b>roca</b>: solo se cruza por las <b>grietas</b>. Una raíz que choca con la roca se para.</p>
      <p>Junto a las grietas brillan <b>vetas minerales</b> (cian): valen muchísimo.</p>
      <p>Cuidado con las <b>zarzas</b> (granates): crecen hacia la comida y se la comen antes que tú. Aquí la comida vale ×10.</p>`,
  },
};

async function startRun() {
  if (document.querySelector('.modal-wrap, .mg-wrap')) return;
  if (G.screen === 'run' && !G.summaryShown) return;
  const s = G.state;
  const zone = zonesOpen(s).includes(s.zone) ? s.zone : 'pradera';
  const intro = ZONE_INTRO[zone];
  if (intro && !s.flags[`intro_${zone}`]) {
    s.flags[`intro_${zone}`] = true;
    save();
    await modal({ title: intro.title, body: intro.body, actions: [{ id: 'ok', label: 'Empezar', primary: true }] });
  }
  const st = computeStats(s, zone);
  const { W, H } = G.renderer.worldSize();
  const seed = (s.seed + s.seasons * 7919) >>> 0;
  G.run = createRun(st, seed, W, H);
  G.endT = 0;
  G.summaryShown = false;
  G.pointer = G.ptrClient = null;
  G.prevBest = s.stats.bestF;
  G.zone = zone;
  G.prevDeep = depthRecord(s, zone);
  G.layer = layerIndex(zone, G.prevDeep); // el cartel solo sale en capas que nunca habías alcanzado
  G.recShown = false;
  G.phase = 'roots';
  show('run');
  $('#summary').hidden = true;
  $('#run-growth').textContent = '';
  $('#run-growth')._k = null;
  $('#catch')._k = null;
  $('#db-label')._k = null;
  G.dScale = 0;
  G.renderer.setRun(G.run, seed, { record: G.prevDeep });
  setText($('#run-season'), `Temporada ${s.seasons + 1}${zonesOpen(s).length > 1 ? ` · ${ZONES[zone].name}` : ''}`);
  const hint = $('#run-hint');
  hint.hidden = s.seasons >= 2;
  hint.textContent = window.matchMedia('(pointer: coarse)').matches
    ? 'Arrastra el dedo por la tierra: tus raíces irán hacia allí'
    : 'Mueve el ratón por la tierra: tus raíces irán hacia allí';
  sfx.click();
}

/** Cambio de fase: al acabar las raíces, al empezar a caer los frutos. */
function onPhase(phase) {
  const s = G.state;
  const hint = $('#run-hint');
  if (phase === 'grow') {
    hint.hidden = true;
    sfx.achievement();
  } else if (phase === 'fruit') {
    if (G.run.fruitCount && s.seasons < 3) {
      hint.hidden = false;
      hint.textContent = window.matchMedia('(pointer: coarse)').matches
        ? '¡Atrapa los frutos con el dedo: valen el doble!'
        : '¡Atrapa los frutos con el ratón: valen el doble!';
    }
  }
}

function onRunEnd() {
  const run = G.run;
  const growth = run.trees.reduce((a, t) => a + t.growth, 0);
  applySeason(G.state, run.gained, { time: run.dur, depth: run.maxDepth - run.soilTop, zone: G.zone, caught: run.caught, growth });
  save();
  $('#run-hint').hidden = true;
}

function showSummary() {
  G.summaryShown = true;
  const run = G.run;
  const s = G.state;
  const f = run.gained.f;
  const box = $('#summary');
  const best = f > G.prevBest && s.seasons > 1;
  const depth = run.maxDepth - run.soilTop;
  const deepRec = depth > G.prevDeep && s.seasons > 1;
  const growth = run.trees.reduce((a, t) => a + t.growth, 0);
  const canBuy = affordableCount(s) > 0;
  const nT = run.trees.length;
  const prune = s.levels.tijeras > 0
    ? pruneReady(s)
      ? '<button type="button" class="px-btn ghost small" id="prune">Podar las ramas secas (minijuego)</button>'
      : `<p class="sub">Podar: dentro de ${s.pruneAt - s.seasons} ${s.pruneAt - s.seasons === 1 ? 'temporada' : 'temporadas'}</p>`
    : '';
  const pollen = s.levels.abejas > 0
    ? pollenReady(s)
      ? '<button type="button" class="px-btn ghost small" id="pollinate">Polinizar las flores (minijuego)</button>'
      : s.pollen > 1
        ? `<p class="sub">Polinizado: frutos <b>×${s.pollen.toFixed(2).replace('.', ',')}</b> en la próxima temporada</p>`
        : `<p class="sub">Polinizar: dentro de ${s.pollenAt - s.seasons} ${s.pollenAt - s.seasons === 1 ? 'temporada' : 'temporadas'}</p>`
    : '';
  box.innerHTML = `
    <h2>Temporada ${s.seasons}</h2>
    <p class="sub">Raíces: <b>${fmtLen(run.length)}</b> en total, hasta <b>${fmtDepth(depth)}</b> de hondo · ${run.absorbed} bolsas</p>
    <p class="sub">${nT > 1 ? `Tus ${nT} árboles crecieron` : 'Tu árbol creció'} <b>${fmt(growth, { decimals: growth < 10 ? 1 : 0 })}</b>${run.links ? ` · ${run.links} ${run.links === 1 ? 'unión' : 'uniones'}` : ''}${run.fruitCount ? ` · atrapaste <b>${run.caught} de ${run.fruitCount}</b> frutos al vuelo` : ''}</p>
    ${best || deepRec ? `<div class="best">${[best && 'Mejor temporada', deepRec && 'Récord de profundidad'].filter(Boolean).join(' · ')}</div>` : ''}
    <div class="gains"><div class="gain"><img alt="" src="${resURL('f')}">+${fmt(f, { decimals: f < 10 ? 1 : 0 })} <small>frutos</small></div></div>
    <div class="sum-pollen">${pollen}</div>
    <div class="sum-pollen sum-prune">${prune}</div>
    <div class="sum-actions">
      <button type="button" class="px-btn ${canBuy ? 'ghost' : ''}" id="again">Otra temporada</button>
      <button type="button" class="px-btn ${canBuy ? '' : 'ghost'}" id="to-tree">Mejoras ▶</button>
    </div>`;
  box.hidden = false;
  $('#to-tree').addEventListener('click', toTree);
  $('#again').addEventListener('click', startRun);
  $('#pollinate')?.addEventListener('click', pollinate);
  $('#prune')?.addEventListener('click', prune);
  (canBuy ? $('#to-tree') : $('#again')).focus();
}

async function pollinate() {
  const s = G.state;
  if (!pollenReady(s)) return;
  const btn = $('#pollinate');
  if (btn) btn.disabled = true;
  const r = await playPolinizar({ time: pollenTime(s), per: pollenPerFlower(s), trees: 1 + (s.levels.plantar || 0) });
  setPollen(s, r ? r.flowers : 0);
  save();
  const box = $('.sum-pollen:not(.sum-prune)');
  if (box) box.innerHTML = `<p class="sub">Polinizado: frutos <b>×${s.pollen.toFixed(2).replace('.', ',')}</b> en la próxima temporada</p>`;
  $('#again')?.focus();
}

async function prune() {
  const s = G.state;
  if (!pruneReady(s)) return;
  const btn = $('#prune');
  if (btn) btn.disabled = true;
  const r = await playPodar({ time: pruneTime(s), per: prunePerBranch(s) });
  const f = applyPrune(s, r ? r.cut : 0);
  save();
  const box = $('.sum-prune');
  if (box) box.innerHTML = `<p class="sub">Podaste: <b>+${fmt(f)}</b> frutos</p>`;
  $('#again')?.focus();
}

/** El final: escena del árbol madre y, al pulsar, una partida nueva con frutos ×2 más para siempre. */
async function ending() {
  const s = G.state;
  if (G.inEnding) return;
  G.inEnding = true;
  save();
  await playEnding({ time: s.stats.time, seasons: s.seasons, fruits: s.stats.totalF, trees: 1 + (s.levels.plantar || 0), legacy: s.legacy || 0 });
  G.state = rebirth(s);
  G.inEnding = false;
  G.tree.fitKey = null;
  show('tree');
  refreshTree();
  save();
  toast(`Generación ${G.state.legacy + 1}: tus frutos valen <b>×${2 ** G.state.legacy}</b> para siempre.`, '#FFE27A');
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
  renderRes($('#run-res'), knownCurrencies(G.state), run.gained, true);

  // Crecimiento del árbol
  const growth = run.phase === 'roots' ? run.trees.reduce((a, t) => a + liveGrowth(run, t), 0) : run.trees.reduce((a, t) => a + t.growth, 0);
  const gtxt = fmt(growth, { decimals: growth < 10 ? 1 : 0 });
  const gEl = $('#run-growth');
  if (gEl._k !== gtxt) { gEl._k = gtxt; gEl.innerHTML = `<img alt="" src="${resURL('g')}">${gtxt}`; }

  // Brotes: una barra que se vacía. En la cosecha, los frutos atrapados
  const roots = run.phase === 'roots';
  const sp = $('#sprouts');
  const ca = $('#catch');
  sp.hidden = !roots;
  ca.hidden = roots || !run.fruitCount;
  if (roots) {
    const left = run.trees.reduce((a, t) => a + t.sprouts, 0);
    const f = (run.sproutsTotal ? left / run.sproutsTotal : 0).toFixed(3);
    const fill = $('#sprout-fill');
    if (fill._f !== f) { fill._f = f; fill.style.transform = `scaleX(${f})`; }
  } else {
    const key = `${run.caught}|${run.fruitCount}`;
    if (ca._k !== key) { ca._k = key; ca.innerHTML = `Atrapados al vuelo: <b>${run.caught}</b> de ${run.fruitCount}`; }
  }

  // Profundidad: una barra vertical a la derecha, con las capas, el récord y cuánto vale ahí la comida
  const bar = $('#depth-bar');
  bar.hidden = !roots;
  if (!roots) return;
  const depth = run.maxDepth - run.soilTop;
  const li = layerIndex(G.zone, depth);
  if (li > G.layer) {
    G.layer = li;
    G.recShown = true;
    G.renderer.showBanner(LAYERS[G.zone][li][1], `la comida vale ×${depthMult(run, run.maxDepth).toFixed(1).replace('.', ',')}`);
    sfx.achievement();
  } else if (!G.recShown && G.prevDeep > 20 && depth > G.prevDeep) {
    G.recShown = true;
    G.renderer.showBanner('¡Nuevo récord!', `más hondo que nunca en la ${ZONES[G.zone].name.toLowerCase()}`);
    sfx.glow();
  }
  const scale = Math.max(G.dScale || 0, 150, Math.ceil((Math.max(G.prevDeep, depth) * 1.25) / 50) * 50);
  if (scale !== G.dScale) {
    G.dScale = scale;
    const track = $('#db-track');
    track.querySelectorAll('.db-tick').forEach((e) => e.remove());
    for (const [d] of LAYERS[G.zone]) {
      if (d <= 0 || d >= scale) continue;
      const tick = document.createElement('i');
      tick.className = 'db-tick';
      tick.style.top = `${(d / scale) * 100}%`;
      track.append(tick);
    }
    const rec = $('#db-rec');
    rec.hidden = G.prevDeep <= 20;
    rec.style.top = `${(G.prevDeep / scale) * 100}%`;
  }
  const pct = `${((depth / scale) * 100).toFixed(1)}%`;
  const fillD = $('#db-fill');
  if (fillD._p !== pct) { fillD._p = pct; fillD.style.height = pct; }
  const label = $('#db-label');
  const key = `${Math.floor(depth / 10)}|${pct}`;
  if (label._k !== key) {
    label._k = key;
    label.style.top = pct;
    label.innerHTML = `${fmtDepth(depth)}<small>comida ×${depthMult(run, run.maxDepth).toFixed(1).replace('.', ',')}</small>`;
    label.classList.toggle('rec', G.prevDeep > 20 && depth > G.prevDeep);
  }
}

// ── Entrada ────────────────────────────────────────────────────────────────

function bindInput() {
  const c = $('#run');
  const at = (e) => { G.ptrClient = { x: e.clientX, y: e.clientY }; return G.renderer.toWorld(e.clientX, e.clientY); };
  c.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' || e.buttons) {
      G.pointer = at(e);
      if (!$('#run-hint').hidden && G.run && G.run.phase === 'roots' && G.run.t > 2) $('#run-hint').hidden = true;
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
    } else if ((e.key === 'Enter' || e.key === ' ') && G.screen === 'run' && G.summaryShown && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      (affordableCount(G.state) > 0 ? toTree : startRun)();
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
    if (G.paused) {
      // pausa de pruebas: solo se dibuja
    } else if (!run.ended) {
      let left = dt;
      while (left > 0 && !run.ended) {
        const h = Math.min(1 / 60, left);
        stepRun(run, h, G.pointer);
        left -= h;
      }
      for (const e of run.events) {
        if (e.amount !== undefined) e.text = fmt(e.amount, { decimals: e.amount < 10 ? 1 : 0 });
        G.renderer.onEvent(e);
        if (e.type === 'absorb') (e.sprouted ? sfx.glow : sfx.click)();
        else if (e.type === 'catch') sfx.buy();
        else if (e.type === 'land') sfx.click();
      }
      run.events.length = 0;
      if (run.phase !== G.phase) { G.phase = run.phase; onPhase(run.phase); }
      if (run.ended) onRunEnd();
    } else {
      G.endT += dt;
      if (G.endT > 0.3 && !G.summaryShown) showSummary();
    }
    G.renderer.draw(G.paused ? 0 : dt, G.pointer, G.state.settings);
    updateRunHUD();
  }
  requestAnimationFrame(frame);
}

// ── Arranque ───────────────────────────────────────────────────────────────

function boot() {
  const loaded = readSave();
  G.state = loaded || newState();
  G.applySettings();
  // cursor propio: flecha crema y mano en lo que se puede pulsar
  document.documentElement.style.setProperty('--cur-arrow', cursorCSS('arrow'));
  document.documentElement.style.setProperty('--cur-hand', cursorCSS('hand'));
  G.renderer = new RunRenderer($('#run'));
  G.tree = new TreeView($('#tree'), { onBuy });
  iconButton($('#gear'), 'gear');
  iconButton($('#center'), 'center');
  $('#gear').addEventListener('click', () => settingsDialog(G));
  $('#center').addEventListener('click', () => G.tree.center());
  $('#start').addEventListener('click', startRun);
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
      title: 'Savia',
      body: `<p>Eres una semilla en la pradera.</p>
        <p>Cada <b>temporada</b> tu árbol echa raíces. Mueve el ratón (o el dedo) por la tierra para guiarlas hacia las <b>bolsas de comida</b>.</p>
        <p>Cada raíz llega hasta un <b>largo máximo</b>: entonces se para y de ella <b>brota</b> otra. Las bolsas <b>verdes</b> te dan un brote más. Cuando se acaban los brotes, el árbol <b>crece</b> según sus raíces y suelta <b>frutos</b>: atrápalos al vuelo y valen el doble.</p>
        <p>Con los frutos <b>mejoras</b> tu árbol para la siguiente temporada.</p>`,
      actions: [{ id: 'ok', label: 'Plantar', primary: true }],
    });
  }

  if (import.meta.env.DEV) {
    G.debug = {
      give(n = 1e6) { G.state.res.f += n; refreshTree(); },
      endRun() { if (G.run) finishRoots(G.run); },
    };
  }

  if (G.state.done) ending(); // si cerraste en la escena final, vuelve a salir

  G.last = performance.now();
  requestAnimationFrame(frame);
}

boot();
