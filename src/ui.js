// Pantallas y piezas de interfaz: barras de monedas, HUD de la temporada, resumen, avisos y ventanas.

import { CURRENCIES } from './data.js';
import { lvl } from './game.js';
import { PAL, iconURL, resURL } from './pixel.js';
import { fmt } from './format.js';

const $ = (sel, root = document) => root.querySelector(sel);

export function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

export function setText(e, t) {
  if (e._t !== t) { e._t = t; e.textContent = t; }
}

/** Monedas que ya conoces (las demás no se enseñan hasta que existen). */
export function knownCurrencies(s) {
  const out = ['n'];
  if (lvl(s, 'minerales') || s.res.m > 0) out.push('m');
  if (lvl(s, 'arboles') || s.res.a > 0) out.push('a');
  if (lvl(s, 'setas') || s.res.e > 0) out.push('e');
  if (lvl(s, 'pantano') || s.res.t > 0) out.push('t');
  if (lvl(s, 'cueva') || s.res.c > 0) out.push('c');
  return out;
}

/** Pinta (o actualiza) una barra de monedas. values: { n: 12, ... } */
export function renderRes(bar, list, values, rates = null) {
  const key = list.join('');
  if (bar._key !== key) {
    bar._key = key;
    bar.innerHTML = '';
    bar._chips = {};
    for (const c of list) {
      const chip = el('div', 'res', `<img alt="" src="${resURL(c)}"><span></span>`);
      chip.title = CURRENCIES[c].name;
      bar.append(chip);
      bar._chips[c] = { chip, val: $('span', chip) };
    }
  }
  for (const c of list) {
    const ch = bar._chips[c];
    const v = fmt(values[c] || 0);
    if (ch.val._t !== v) {
      if (rates && ch.val._t !== undefined) { ch.chip.classList.remove('pop'); void ch.chip.offsetWidth; ch.chip.classList.add('pop'); }
      setText(ch.val, v);
    }
  }
}

export function iconButton(btn, name) {
  btn.innerHTML = `<img alt="" src="${iconURL(name, PAL.cream, PAL.hyphaHi)}">`;
}

// ── Avisos y ventanas ──────────────────────────────────────────────────────

export function toast(html, color = '') {
  const root = $('#toasts');
  const t = el('div', 'toast', html);
  if (color) t.style.setProperty('--c', color);
  root.append(t);
  while (root.children.length > 3) root.firstElementChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 3200);
}

export function modal({ title, body, actions = [{ id: 'ok', label: 'Vale', primary: true }], onOpen }) {
  return new Promise((resolve) => {
    const wrap = el('div', 'modal-wrap');
    const card = el('div', 'modal px-panel');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    const h = el('h2');
    h.textContent = title;
    const bodyEl = el('div', 'modal-body', body);
    const acts = el('div', 'modal-actions');
    card.append(h, bodyEl, acts);
    let closed = false;
    const close = (id) => {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey);
      wrap.classList.add('out');
      setTimeout(() => wrap.remove(), 160);
      resolve(id);
    };
    const onKey = (e) => { if (e.key === 'Escape') close('cancel'); };
    let primary = null;
    for (const a of actions) {
      const b = el('button', `px-btn ${a.primary ? '' : 'ghost'} small`);
      b.type = 'button';
      b.textContent = a.label;
      b.addEventListener('click', () => {
        if (a.onClick && a.onClick(card) === false) return;
        close(a.id);
      });
      acts.append(b);
      if (a.primary) primary = b;
    }
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) close('cancel'); });
    wrap.append(card);
    $('#modal-root').append(wrap);
    if (onOpen) onOpen(card);
    else primary?.focus();
  });
}

// ── Ajustes y guardado ─────────────────────────────────────────────────────

export async function settingsDialog(G) {
  const s = G.state;
  await modal({
    title: 'Ajustes',
    body: `<label class="setting"><span>Sonido</span><input type="checkbox" data-k="sound"></label>
      <label class="setting"><span>Temblor de pantalla</span><input type="checkbox" data-k="shake"></label>
      <p style="margin-top:14px">La partida se guarda sola en este navegador.</p>`,
    onOpen: (card) => {
      card.querySelectorAll('input[data-k]').forEach((inp) => {
        inp.checked = !!s.settings[inp.dataset.k];
        inp.addEventListener('change', () => { s.settings[inp.dataset.k] = inp.checked; G.applySettings(); G.save(); });
      });
      card.querySelector('.px-btn:not(.ghost)')?.focus();
    },
    actions: [
      { id: 'export', label: 'Exportar', onClick: () => { exportDialog(G); return true; } },
      { id: 'import', label: 'Importar', onClick: () => { importDialog(G); return true; } },
      { id: 'reset', label: 'Borrar partida', onClick: () => { resetDialog(G); return true; } },
      { id: 'ok', label: 'Cerrar', primary: true },
    ],
  });
}

async function exportDialog(G) {
  G.save();
  const code = G.exportCode();
  await modal({
    title: 'Exportar partida',
    body: '<p>Copia este código. Con «Importar» lo recuperas en cualquier navegador.</p><textarea readonly></textarea>',
    onOpen: (card) => { const ta = $('textarea', card); ta.value = code; ta.focus(); ta.select(); },
    actions: [
      { id: 'copy', label: 'Copiar', onClick: () => { navigator.clipboard?.writeText(code).then(() => toast('Código copiado')); return false; } },
      { id: 'ok', label: 'Cerrar', primary: true },
    ],
  });
}

async function importDialog(G) {
  await modal({
    title: 'Importar partida',
    body: '<p>Pega un código exportado. <b>Sustituirá a tu partida actual.</b></p><textarea placeholder="Pega el código…"></textarea><div class="error" hidden></div>',
    onOpen: (card) => $('textarea', card).focus(),
    actions: [
      { id: 'cancel', label: 'Cancelar' },
      { id: 'ok', label: 'Importar', primary: true, onClick: (card) => {
        const err = $('.error', card);
        try { G.importCode($('textarea', card).value); return true; } catch (e) { err.hidden = false; err.textContent = e.message; return false; }
      } },
    ],
  });
}

async function resetDialog(G) {
  const r = await modal({
    title: '¿Borrar la partida?',
    body: '<p>Se pierde todo y empiezas desde la espora. No se puede deshacer.</p>',
    actions: [{ id: 'cancel', label: 'Cancelar', primary: true }, { id: 'reset', label: 'Borrar todo' }],
  });
  if (r === 'reset') G.hardReset();
}
