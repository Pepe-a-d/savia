// Árbol de habilidades: nodos (botones) sobre un plano que se arrastra, con líneas SVG y una ficha.

import { NODES, NODE_BY_ID, BRANCHES, CURRENCIES } from './data.js';
import { lvl, nodeCost, nodeStatus, isVisible, missingReqs } from './game.js';
import { PAL, iconURL, resURL, NODE_ICON } from './pixel.js';
import { fmt } from './format.js';

const UNIT = 76; // px entre nodos
const SVGNS = 'http://www.w3.org/2000/svg';

export class TreeView {
  constructor(root, { onBuy }) {
    this.root = root;
    this.onBuy = onBuy;
    this.pan = { x: 0, y: 0 };
    this.zoom = 1;
    this.selected = null;
    this.hover = null;
    this.items = new Map();
    this.coarse = window.matchMedia('(pointer: coarse)').matches;

    this.plane = document.createElement('div');
    this.plane.className = 'tree-plane';
    this.svg = document.createElementNS(SVGNS, 'svg');
    this.svg.setAttribute('class', 'tree-lines');
    this.svg.setAttribute('shape-rendering', 'crispEdges');
    this.plane.append(this.svg);
    root.append(this.plane);

    this.card = document.createElement('div');
    this.card.className = 'node-card px-panel';
    this.card.hidden = true;
    root.append(this.card);

    for (const n of NODES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'node';
      b.style.left = `${n.x * UNIT}px`;
      b.style.top = `${n.y * UNIT}px`;
      b.style.setProperty('--c', BRANCHES[n.branch].color);
      b.innerHTML = '<img alt="" draggable="false"><span class="lv"></span>';
      b.setAttribute('aria-label', n.name);
      b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { this.hover = n.id; this.renderCard(); } });
      b.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { this.hover = null; this.renderCard(); } });
      b.addEventListener('focus', () => { this.selected = n.id; this.renderCard(); });
      b.addEventListener('click', () => {
        if (this.dragged) return;
        if (this.coarse && this.selected !== n.id) {
          this.selected = n.id;
          this.renderCard();
          return;
        }
        this.selected = n.id;
        this.onBuy(n.id, b);
      });
      this.plane.append(b);
      const lines = n.req.map((r) => {
        const ln = document.createElementNS(SVGNS, 'line');
        const a = NODE_BY_ID[r];
        ln.setAttribute('x1', a.x * UNIT);
        ln.setAttribute('y1', a.y * UNIT);
        ln.setAttribute('x2', n.x * UNIT);
        ln.setAttribute('y2', n.y * UNIT);
        this.svg.append(ln);
        return { ln, from: r };
      });
      this.items.set(n.id, { n, b, img: b.querySelector('img'), lv: b.querySelector('.lv'), lines, key: '' });
    }
    this.bindPan();
    this.layout();
    new ResizeObserver(() => this.layout()).observe(root);
  }

  bindPan() {
    let start = null;
    this.root.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.node-card')) return;
      start = { x: e.clientX, y: e.clientY, px: this.pan.x, py: this.pan.y };
      this.dragged = false;
    });
    window.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!this.dragged && Math.hypot(dx, dy) > 6) this.dragged = true;
      if (this.dragged) {
        this.pan.x = start.px + dx;
        this.pan.y = start.py + dy;
        this.layout();
      }
    });
    window.addEventListener('pointerup', () => {
      start = null;
      setTimeout(() => { this.dragged = false; }, 0);
    });
    this.root.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom = Math.max(0.5, Math.min(1.6, this.zoom * Math.exp(-e.deltaY * 0.0015)));
      this.layout();
    }, { passive: false });
  }

  center() {
    this.fitKey = null;
    if (this.state) this.fit(this.state);
    else { this.pan = { x: 0, y: 0 }; this.layout(); }
  }

  /** Encaja lo que se ve del árbol en la pantalla (al abrirse ramas nuevas, se recoloca). */
  fit(s) {
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
    for (const { n, b } of this.items.values()) {
      if (b.hidden) continue;
      x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y);
    }
    if (x0 === Infinity) return;
    const key = `${x0}|${x1}|${y0}|${y1}`;
    if (key === this.fitKey) return;
    this.fitKey = key;
    const r = this.root.getBoundingClientRect();
    this.mid = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
    const fw = (r.width - 40) / ((x1 - x0 + 1.2) * UNIT);
    const fh = (r.height - 190) / ((y1 - y0 + 1.2) * UNIT);
    this.zoom = Math.max(0.5, Math.min(1, fw, fh));
    this.pan = { x: 0, y: 0 };
    this.layout();
  }

  layout() {
    const r = this.root.getBoundingClientRect();
    const m = this.mid || { x: 0, y: 0 };
    const cx = r.width / 2 + this.pan.x - m.x * UNIT * this.zoom;
    const cy = r.height * 0.46 + this.pan.y - m.y * UNIT * this.zoom;
    this.plane.style.transform = `translate(${Math.round(cx)}px, ${Math.round(cy)}px) scale(${this.zoom})`;
  }

  /** Repinta los nodos; barato si nada cambió. */
  update(s) {
    for (const it of this.items.values()) {
      const { n, b } = it;
      const st = nodeStatus(s, n);
      const l = lvl(s, n.id);
      const teaser = st === 'hidden' && n.req.some((r) => isVisible(s, NODE_BY_ID[r]));
      const key = `${st}|${l}|${teaser}`;
      if (key !== it.key) {
        it.key = key;
        b.className = `node s-${st}${l ? ' own' : ''}${teaser ? ' teaser' : ''}`;
        b.hidden = st === 'hidden' && !teaser;
        const color = BRANCHES[n.branch].color;
        if (teaser) it.img.src = iconURL('semilla', PAL.line, PAL.line);
        else if (st === 'max') it.img.src = iconURL(NODE_ICON[n.id], PAL.ink, PAL.panel2);
        else it.img.src = iconURL(NODE_ICON[n.id], color, PAL.creamHi);
        it.lv.textContent = teaser || n.max === 1 ? '' : `${l}/${n.max}`;
        b.tabIndex = b.hidden || teaser ? -1 : 0;
      }
      for (const { ln, from } of it.lines) {
        const fromOwned = lvl(s, from) > 0;
        const vis = !b.hidden && isVisible(s, NODE_BY_ID[from]);
        ln.style.display = vis ? '' : 'none';
        ln.setAttribute('stroke', l > 0 && fromOwned ? BRANCHES[n.branch].color : fromOwned ? PAL.line : '#2F2440');
      }
    }
    this.state = s;
    this.fit(s);
    this.renderCard();
  }

  /** Pequeño salto al comprar, o temblor si no se puede. */
  flash(id, ok) {
    const it = this.items.get(id);
    if (!it) return;
    it.b.classList.remove('bought', 'nope');
    void it.b.offsetWidth;
    it.b.classList.add(ok ? 'bought' : 'nope');
  }

  renderCard() {
    const s = this.state;
    const id = this.hover || this.selected;
    if (!s || !id) { this.card.hidden = true; return; }
    const n = NODE_BY_ID[id];
    const st = nodeStatus(s, n);
    if (st === 'hidden') { this.card.hidden = true; return; }
    const l = lvl(s, n.id);
    const cost = nodeCost(s, n);
    const cur = CURRENCIES[n.cost.c];
    const missing = missingReqs(s, n).map((r) => NODE_BY_ID[r].name);
    const br = BRANCHES[n.branch];
    const now = l > 0 ? n.fx(l) : '—';
    const next = l < n.max ? n.fx(l + 1) : null;
    const key = `${id}|${st}|${l}|${Math.floor(s.res[n.cost.c])}`;
    if (this.card._key === key && !this.card.hidden) return;
    this.card._key = key;
    this.card.hidden = false;
    this.card.style.setProperty('--c', br.color);
    this.card.innerHTML = `
      <div class="nc-head"><img alt="" src="${iconURL(NODE_ICON[n.id], br.color, PAL.creamHi)}"><div><div class="nc-branch"></div><h3></h3></div></div>
      <p class="nc-desc"></p>
      <div class="nc-rows">
        ${n.max > 1 ? `<div><span>Nivel</span><b>${l} / ${n.max}</b></div>` : ''}
        ${l > 0 && n.max > 1 ? '<div><span>Ahora</span><b class="nc-now"></b></div>' : ''}
        ${next ? '<div><span>Con este nivel</span><b class="nc-next"></b></div>' : ''}
      </div>
      ${missing.length ? '<p class="nc-missing"></p>' : ''}
      <div class="nc-foot">
        ${st === 'max' ? '<span class="nc-done">Completo</span>' : `<span class="nc-cost ${s.res[n.cost.c] >= cost ? '' : 'poor'}"><img alt="" src="${resURL(n.cost.c)}">${fmt(cost)} <small>${cur.name}</small></span>`}
        ${st !== 'max' && this.coarse ? `<button type="button" class="px-btn small nc-buy" ${st === 'buy' ? '' : 'disabled'}>Comprar</button>` : ''}
      </div>`;
    this.card.querySelector('.nc-branch').textContent = br.name;
    this.card.querySelector('h3').textContent = n.name;
    this.card.querySelector('.nc-desc').textContent = n.desc;
    if (this.card.querySelector('.nc-now')) this.card.querySelector('.nc-now').textContent = now;
    if (this.card.querySelector('.nc-next')) this.card.querySelector('.nc-next').textContent = next;
    if (missing.length) this.card.querySelector('.nc-missing').textContent = `Antes completa: ${missing.join(', ')}.`;
    const buy = this.card.querySelector('.nc-buy');
    if (buy) buy.addEventListener('click', () => this.onBuy(n.id, this.items.get(n.id).b));
  }
}
