// Dibuja una temporada en pixel art, vista en corte: cielo, superficie y capas de suelo sin fondo.
// Todo va a un lienzo pequeño (1 px = 1 px del mundo) que se amplía a pantalla sin suavizado.
// La cámara baja con la red y, al acabar la temporada, sube a la superficie para ver las setas.
// El fondo y la red se guardan por trozos de suelo (CH px de alto); la red se dibuja solo donde crece.

import { PAL, bitmap } from './pixel.js';
import { mulberry32, CELL, CH, bucket } from './run.js';
import { LAYERS } from './data.js';

const THEMES = {
  bosque: {
    sky: ['#120D22', '#1A1430', '#251A3D', '#3A2350', '#5A2E5E'],
    hills: ['#1E1534', '#17112A'],
    stars: true,
    surface: 'grass',
    // Tierra, Arcilla, Roca, Roca madre, Profundidades: [base, clara, oscura]
    layers: [['#3B2731', '#4A3340', '#2E1F28'], ['#46282A', '#573434', '#361E20'], ['#2C1F36', '#3A2A45', '#22182B'], ['#211830', '#2C2040', '#191226'], ['#160F22', '#1F1730', '#0F0A18']],
    speck: ['#5A4652', '#7A6472'],
    roots: '#4E3524',
    fossil: '#3E3050',
    hypha: ['#F4D58D', '#6E5536', '#FFF8E4'],
  },
  pantano: {
    sky: ['#0A1418', '#0F1D21', '#16292B', '#1F3836', '#2C4A42'],
    hills: ['#12252A', '#0E1C20'],
    stars: false,
    surface: 'water',
    // Barro, Barro inundado, Cieno, Turba antigua, Abismo
    layers: [['#2F2A21', '#3B3428', '#25211A'], ['#1D2C30', '#26393C', '#17242A'], ['#182628', '#203234', '#121D1F'], ['#221C16', '#2E261D', '#18130F'], ['#0D1416', '#141D20', '#090E10']],
    speck: ['#3E4A44', '#5A6A60'],
    roots: '#3A3428',
    fossil: '#2F4044',
    hypha: ['#E9DCA0', '#4E5A3C', '#FFF8E4'],
  },
  cueva: {
    sky: ['#06050B', '#0B0A13', '#110F1B', '#181624', '#211E2E'],
    hills: [],
    stars: false,
    surface: 'ceiling',
    // Caliza, Pizarra, Basalto, Geoda, Abismo
    layers: [['#25223A', '#302C48', '#1C1A2C'], ['#1D1B2D', '#27243A', '#161424'], ['#17151F', '#1F1C2B', '#110F18'], ['#1E1530', '#2A1D42', '#150F22'], ['#0B0A10', '#121019', '#07060B']],
    speck: ['#34304A', '#4A4560'],
    roots: '#2A2638',
    fossil: '#2C2840',
    hypha: ['#ECE0C4', '#4A4258', '#FFF8E4'],
  },
};
const BIOLUM = ['#C6F26B', '#3E6A2A', '#F0FFC0'];

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

const SPR = {
  n: ['.###.', '#o##o', '##o##', '#####', '.###.'],
  big: ['..###..', '.#####.', '##o####', '#o##o##', '#######', '.#####.', '..###..'],
  leaf: ['....###', '..####o', '.###o##', '.##o###', '.#o###.', '#o###..', '.##....'],
  m: ['..#..', '.#o#.', '#o###', '.###.', '..#..'],
  core: ['..###..', '.#ooo#.', '#ooooo#', '#oo#oo#', '#ooooo#', '.#ooo#.', '..###..'],
  seta: ['.###.', '#o#o#', '#####', '..s..', '..s..'],
  fossil: ['.###.', '#...#', '#.#.#', '#..#.', '.##..'],
  bone: ['#....#', '.####.', '#....#'],
  guano: ['..###..', '.#o###.', '#######', '#o##o##'],
  c: ['...#...', '..#o#..', '#.#o#.#', '#o#o#o#', '#o###o#', '.#####.', '..###..'],
  bat: ['#.....#', '##.#.##', '.#####.', '..#.#..'],
};
const POCKET_COL = {
  n: [PAL.n, '#FFC27A'],
  big: [PAL.big, '#FFE7B8'],
  leaf: [PAL.leaf, '#D2F7C8'],
  m: [PAL.m, '#E2FBFF'],
  guano: ['#D9C9A0', '#FFF3D6'],
  c: ['#C79BFF', '#F4E6FF'],
};

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

function line(g, x0, y0, x1, y1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function disc(g, cx, cy, r) {
  r = Math.round(r);
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(Math.max(0, r * r - y * y + r * 0.6)));
    g.fillRect(Math.round(cx) - w, Math.round(cy) + y, w * 2 + 1, 1);
  }
}

const rgbCache = new Map();
function rgb(hex) {
  let v = rgbCache.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, v);
  }
  return v;
}


export class RunRenderer {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.fx = [];
    this.floaters = [];
    this.recent = [];
    this.ambient = [];
    this.shake = 0;
    this.time = 0;
    this.cam = 0;
    this.hudTarget = null; // (cur) => {x, y} en píxeles de pantalla
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
  }

  /** Tamaño de la vista para la pantalla actual: llena la pantalla con un zoom entero. */
  worldSize() {
    const r = this.c.parentElement.getBoundingClientRect();
    const w = r.width || window.innerWidth;
    const h = r.height || window.innerHeight;
    const portrait = h > w;
    const S = Math.max(2, Math.floor((portrait ? w : h) / 180));
    return { W: Math.ceil(w / S), H: Math.ceil(h / S) };
  }

  /** opts.record: récord de profundidad (px) en este lugar, para marcarlo en el suelo. */
  setRun(run, seed, opts = {}) {
    this.run = run;
    this.seed = seed;
    this.biome = run.cave ? 'cueva' : run.swamp ? 'pantano' : 'bosque';
    this.theme = THEMES[this.biome];
    this.bounds = LAYERS[this.biome].map(([d]) => run.soilTop + d);
    this.record = opts.record || 0;
    this.dripSrc = [];
    this.darkC = null;
    this.hyphaCol = run.st.biolum ? BIOLUM : this.theme.hypha;
    this.buf = makeCanvas(run.W, run.VH);
    this.g = this.buf.getContext('2d');
    this.bgC = []; // fondo por trozo
    this.netC = []; // red por trozo: {c, g}
    this.sprites = new WeakMap();
    this.fx = [];
    this.floaters = [];
    this.recent = [];
    this.banner = null;
    this.endT = 0;
    this.cam = 0;
    this.camY = 0;
    this.camTarget = 0;
    this.chunkBg(0);
    this.plantSprites = run.plants.map((p) => this.makePlant(p));
    this.logSprites = run.logs.map((l) => this.makeLog(l));
    this.makeAmbient();
    this.resize();
  }

  /** Cartel grande al entrar en una capa nueva. */
  showBanner(title, sub) {
    this.banner = { title, sub, life: 2.4 };
  }

  // ── fondo, por trozos ────────────────────────────────────────────────────

  chunkBg(k) {
    if (!this.bgC[k]) this.bgC[k] = this.paintChunk(k);
    return this.bgC[k];
  }

  paintChunk(k) {
    const run = this.run;
    const T = this.theme;
    const { W, skyH, soilTop } = run;
    const y0 = k * CH;
    const c = makeCanvas(W, CH);
    const g = c.getContext('2d');
    const rng = mulberry32((this.seed ^ Math.imul(k + 7, 0x51ed27)) >>> 0);
    const img = g.createImageData(W, CH);
    const d = img.data;
    const put = (x, y, hex) => {
      y -= y0;
      if (x < 0 || y < 0 || x >= W || y >= CH) return;
      const [r, gg, b] = rgb(hex);
      const i = (y * W + x) * 4;
      d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
    };

    // Cielo con bandas difuminadas (solo el primer trozo)
    const sky = T.sky;
    for (let y = y0; y < Math.min(skyH, y0 + CH); y++) {
      const t = (y / Math.max(1, skyH - 1)) * (sky.length - 1);
      const i = Math.min(sky.length - 2, Math.floor(t));
      const fr = t - i;
      for (let x = 0; x < W; x++) put(x, y, fr > bayer(x, y) ? sky[i + 1] : sky[i]);
    }

    // Capas del suelo, con bordes ondulados y difuminados; cuanto más hondo, más oscuro
    const B = this.bounds;
    const n = B.length;
    const wave = (x, i) => Math.sin(x * 0.05 + i * 1.7) * 2 + Math.sin(x * 0.115 + i * 2.9);
    const by = new Array(n);
    for (let x = 0; x < W; x++) {
      for (let i = 1; i < n; i++) by[i] = B[i] + wave(x, i);
      let li = 0;
      for (let y = Math.max(soilTop, y0); y < y0 + CH; y++) {
        while (li + 1 < n && y >= by[li + 1]) li++;
        let L = li;
        if (L > 0 && y - by[L] < 2 && bayer(x, y) > 0.5) L--;
        else if (L + 1 < n && by[L + 1] - y < 2 && bayer(x, y) > 0.5) L++;
        const P = T.layers[L];
        const r = rng();
        put(x, y, r < 0.06 ? P[1] : r < 0.13 ? P[2] : P[0]);
      }
    }
    g.putImageData(img, 0, 0);
    g.translate(0, -y0);

    if (k === 0) this.paintSurface(g, rng);

    // Piedrecitas (más en las capas de roca) y algún fósil
    const ya = Math.max(soilTop + 4, y0);
    const rows = y0 + CH - ya;
    if (rows > 0) {
      const deep = Math.min(1, (y0 - soilTop) / 800);
      for (let q = 0; q < (W * rows * (1 + deep)) / 600; q++) {
        const x = Math.floor(rng() * W);
        const y = ya + Math.floor(rng() * rows);
        g.fillStyle = T.speck[0];
        g.fillRect(x, y, 2, 1 + (rng() < 0.3 ? 1 : 0));
        g.fillStyle = T.speck[1];
        g.fillRect(x, y, 1, 1);
      }
      if (k > 0 && rng() < 0.45) {
        const spr = bitmap(rng() < 0.5 ? SPR.fossil : SPR.bone, T.fossil, '#000');
        g.drawImage(spr, Math.floor(rng() * (W - 8)), Math.floor(y0 + rng() * (CH - 6)));
      }
    }

    // Piedras, picos de roca y bolsas de agua (también las de los trozos vecinos que asoman)
    for (let kk = k - 1; kk <= k + 1; kk++) {
      const b = bucket(run, kk);
      for (const s of b.stones) this.paintStone(g, s);
      for (const p of b.puddles) {
        g.fillStyle = '#1E2850';
        disc(g, p.x, p.y, p.r);
        g.fillStyle = PAL.water;
        disc(g, p.x, p.y, p.r - 1);
        g.fillStyle = PAL.waterHi;
        g.fillRect(p.x - p.r + 3, p.y - Math.floor(p.r / 2), Math.floor(p.r * 0.8), 1);
      }
    }
    return c;
  }

  /** Estrellas, luna, colinas y la superficie (hierba, agua o techo de la cueva). */
  paintSurface(g, rng) {
    const run = this.run;
    const T = this.theme;
    const { W, skyH, soilTop } = run;
    if (T.stars) {
      for (let k = 0; k < W / 5; k++) {
        const x = Math.floor(rng() * W);
        const y = Math.floor(rng() * skyH * 0.7);
        g.fillStyle = rng() < 0.3 ? '#F4E9D8' : '#7A6A9A';
        g.fillRect(x, y, 1, 1);
      }
    }
    if (!run.cave) {
      const mr = Math.max(3, Math.round(skyH * 0.15));
      const mx = Math.round(W * 0.8);
      const my = Math.round(skyH * 0.38);
      g.fillStyle = run.swamp ? '#2C4A42' : '#3A2350';
      disc(g, mx, my, mr + 2);
      g.fillStyle = run.swamp ? '#D8E8C8' : '#F4E2B0';
      disc(g, mx, my, mr);
      g.fillStyle = run.swamp ? '#A8C0A0' : '#CDB57E';
      g.fillRect(mx - 1, my - 1, 2, 1);
      g.fillRect(mx + 1, my + 1, 1, 1);
    }
    for (let layer = 0; layer < T.hills.length; layer++) {
      g.fillStyle = T.hills[layer];
      const amp = skyH * (layer ? 0.18 : 0.32);
      const ph = rng() * 10;
      for (let x = 0; x < W; x++) {
        const h = Math.round(amp * (0.55 + 0.45 * Math.sin(x * (layer ? 0.06 : 0.03) + ph)) + Math.sin(x * 0.17 + ph) * 1.2);
        g.fillRect(x, skyH - h, 1, h);
      }
    }
    if (run.swamp) {
      // árboles muertos en el horizonte
      g.fillStyle = '#0B171A';
      for (let k = 0; k < Math.round(W / 40); k++) {
        const x = Math.round(rng() * W);
        const h = Math.round(skyH * (0.35 + rng() * 0.3));
        g.fillRect(x, skyH - h, 1, h);
        g.fillRect(x - 2, skyH - h + 3, 2, 1);
        g.fillRect(x + 1, skyH - h + 5, 2, 1);
      }
    }

    if (T.surface === 'grass') {
      g.fillStyle = '#3E7A3A';
      g.fillRect(0, skyH, W, 2);
      g.fillStyle = '#5FA14A';
      g.fillRect(0, skyH, W, 1);
      for (let x = 0; x < W; x++) {
        const h = rng() < 0.5 ? Math.floor(rng() * 3) : 0;
        if (!h) continue;
        g.fillStyle = rng() < 0.5 ? '#5FA14A' : '#8FD06A';
        g.fillRect(x, skyH - h, 1, h);
        if (h === 2 && rng() < 0.12) { g.fillStyle = rng() < 0.5 ? '#F49AC2' : '#FFD23F'; g.fillRect(x, skyH - h - 1, 1, 1); }
      }
    } else if (T.surface === 'ceiling') {
      // Cueva: estalactitas colgando del techo y el suelo de roca de la cueva
      for (let k = 0; k < W / 8; k++) {
        const x = Math.floor(rng() * W);
        const len = 3 + Math.floor(rng() * skyH * 0.55);
        const w0 = 1 + Math.floor(rng() * 2);
        for (let y = 0; y < len; y++) {
          const w = Math.max(1, Math.round(w0 * 2 * (1 - y / len)));
          g.fillStyle = y === len - 1 ? '#4A4566' : y % 4 === 0 ? '#2E2A40' : '#262234';
          g.fillRect(x - Math.floor(w / 2), y, w, 1);
        }
        if (rng() < 0.5) this.dripSrc.push({ x, y: len });
      }
      g.fillStyle = '#2E2A3C';
      g.fillRect(0, skyH, W, 2);
      g.fillStyle = '#45405A';
      for (let x = 0; x < W; x++) {
        if (rng() < 0.5) g.fillRect(x, skyH, 1, 1);
        if (rng() < 0.08) { g.fillStyle = '#3A3550'; g.fillRect(x, skyH - 1, 2 + Math.floor(rng() * 2), 1); g.fillStyle = '#45405A'; }
      }
    } else {
      g.fillStyle = '#1C3B44';
      g.fillRect(0, skyH - 1, W, 3);
      g.fillStyle = '#3E7A84';
      for (let x = 0; x < W; x++) if (rng() < 0.12) g.fillRect(x, skyH - 1, rng() < 0.5 ? 2 : 1, 1);
      g.fillStyle = '#4E8A3E';
      for (let k = 0; k < W / 18; k++) {
        const x = Math.round(rng() * (W - 5));
        g.fillRect(x, skyH - 1, 4, 1);
        g.fillStyle = '#6FB05A';
        g.fillRect(x + 1, skyH - 1, 1, 1);
        g.fillStyle = '#4E8A3E';
      }
    }

    // Raicillas bajo la superficie
    g.fillStyle = T.roots;
    for (let x = 0; x < W; x += run.cave ? 9 + Math.floor(rng() * 9) : 2 + Math.floor(rng() * 5)) {
      const len = 2 + Math.floor(rng() * 6);
      let px = x;
      for (let y = soilTop; y < soilTop + len; y++) { g.fillRect(px, y, 1, 1); if (rng() < 0.3) px += rng() < 0.5 ? -1 : 1; }
    }
  }

  paintStone(g, s) {
    if (s.kind === 'stalag') {
      // estalagmita (sube) o estalactita (baja)
      for (let y = s.y; y < s.y + s.h; y++) {
        const t = s.up ? (y - s.y) / s.h : 1 - (y - s.y) / s.h;
        const half = Math.max(0, Math.round((s.w / 2) * t));
        const cx = s.x + Math.floor(s.w / 2);
        g.fillStyle = '#3A3550';
        g.fillRect(cx - half, y, half * 2 + 1, 1);
        g.fillStyle = '#55507A';
        g.fillRect(cx - half, y, 1, 1);
        g.fillStyle = '#24203A';
        g.fillRect(cx + half, y, 1, 1);
        if (half === 0) { g.fillStyle = '#6A6490'; g.fillRect(cx, y, 1, 1); }
      }
      return;
    }
    g.fillStyle = PAL.stone;
    g.fillRect(s.x + 1, s.y, s.w - 2, s.h);
    g.fillRect(s.x, s.y + 1, s.w, s.h - 2);
    g.fillStyle = PAL.stoneHi;
    g.fillRect(s.x + 1, s.y, s.w - 2, 1);
    g.fillRect(s.x, s.y + 1, 1, s.h - 3);
    g.fillRect(s.x + 2, s.y + 1, 2, 1);
    g.fillStyle = PAL.stoneLo;
    g.fillRect(s.x + 1, s.y + s.h - 1, s.w - 2, 1);
    g.fillRect(s.x + s.w - 1, s.y + 2, 1, s.h - 3);
    g.fillRect(s.x + Math.floor(s.w / 2), s.y + 2, 1, Math.max(1, s.h - 4));
  }

  makePlant(p) {
    const run = this.run;
    const { skyH, soilTop } = run;
    const R = p.roots;
    const w = R * 2 + 9;
    const top = 0;
    const h = p.y + R + 2;
    const ox = Math.round(p.x - w / 2);
    const rng = mulberry32(Math.round(p.x * 131 + 7));
    const make = (on) => {
      const c = makeCanvas(w, h);
      const g = c.getContext('2d');
      const cx = Math.floor(w / 2);
      // Raíces
      g.fillStyle = on ? (p.kind === 'tree' ? PAL.a : '#B6E35A') : (p.kind === 'tree' ? '#4E3524' : '#3E3A22');
      const rr = mulberry32(Math.round(p.x * 17 + 3));
      const n = p.kind === 'tree' ? 9 : 6;
      for (let k = 0; k < n; k++) {
        let a = Math.PI * (0.12 + 0.76 * (k / (n - 1))) + (rr() - 0.5) * 0.3;
        let x = cx;
        let y = soilTop;
        const len = R * (0.7 + rr() * 0.35);
        for (let s = 0; s < len; s += 2) {
          a += (rr() - 0.5) * 0.5;
          const nx = x + Math.cos(a) * 2;
          const ny = y + Math.sin(a) * 2;
          line(g, x, y, nx, ny);
          x = nx; y = ny;
        }
      }
      if (p.kind === 'tree') {
        const trunkH = Math.max(6, Math.round(skyH * 0.5));
        const tw = 3;
        g.fillStyle = '#5A3C26';
        g.fillRect(cx - 1, skyH - trunkH, tw, trunkH + 1);
        g.fillStyle = '#7A5534';
        g.fillRect(cx - 1, skyH - trunkH, 1, trunkH);
        const cr = Math.max(4, Math.round(skyH * 0.28));
        const cy = skyH - trunkH - Math.round(cr * 0.4);
        g.fillStyle = '#24502E';
        disc(g, cx, cy + 1, cr);
        g.fillStyle = '#3E7A44';
        disc(g, cx, cy, cr);
        g.fillStyle = '#5FA155';
        disc(g, cx - 1, cy - 1, Math.max(2, cr - 2));
        g.fillStyle = '#8FD06A';
        g.fillRect(cx - 2, cy - cr + 1, 2, 1);
        if (on) {
          g.fillStyle = PAL.a;
          for (let k = 0; k < 5; k++) g.fillRect(cx - cr + 1 + Math.floor(rng() * (cr * 2 - 2)), cy - cr + 2 + Math.floor(rng() * (cr * 2 - 3)), 1, 1);
        }
      } else {
        // juncos
        for (let k = 0; k < 4; k++) {
          const x = cx - 3 + k * 2;
          const hh = Math.max(6, Math.round(skyH * (0.4 + rng() * 0.25)));
          g.fillStyle = '#5E7A3A';
          g.fillRect(x, skyH - hh, 1, hh + 1);
          g.fillStyle = '#8FAF5A';
          g.fillRect(x, skyH - hh + 3, 1, hh - 4);
          if (k % 2 === 0) {
            g.fillStyle = on ? '#B6E35A' : '#6B4A2F';
            g.fillRect(x, skyH - hh - 1, 2, 4);
          }
        }
      }
      return c;
    };
    return { off: make(false), on: make(true), x: ox, y: top, h };
  }

  makeLog(l) {
    const mk = (done) => {
      const c = makeCanvas(l.w, l.h + 3);
      const g = c.getContext('2d');
      if (done) {
        g.fillStyle = '#2E1F18';
        g.fillRect(1, 3, l.w - 2, l.h - 1);
        g.fillStyle = '#4E3122';
        for (let k = 0; k < l.w; k += 3) g.fillRect(k, 3 + ((k * 7) % (l.h - 1)), 2, 1);
        g.fillStyle = '#F49AC2';
        g.fillRect(4, 1, 3, 1); g.fillRect(5, 2, 1, 2);
        g.fillRect(l.w - 8, 0, 3, 1); g.fillRect(l.w - 7, 1, 1, 3);
        return c;
      }
      g.fillStyle = PAL.logLo;
      g.fillRect(0, 1, l.w, l.h + 1);
      g.fillStyle = PAL.log;
      g.fillRect(0, 0, l.w - 3, l.h);
      g.fillStyle = PAL.logHi;
      g.fillRect(0, 0, l.w - 3, 1);
      for (let k = 2; k < l.w - 5; k += 5) g.fillRect(k, 3, 3, 1);
      g.fillStyle = '#C9A27A';
      g.fillRect(l.w - 4, 0, 3, l.h);
      g.fillStyle = '#8A6A48';
      g.fillRect(l.w - 3, 2, 1, l.h - 4);
      return c;
    };
    return { off: mk(false), on: mk(true) };
  }

  peatSprite(p) {
    let spr = this.sprites.get(p);
    if (spr) return spr;
    const mk = (done) => {
      const c = makeCanvas(p.w, p.h);
      const g = c.getContext('2d');
      const rng = mulberry32(p.x * 13 + p.y);
      // contorno oscuro, cuerpo de turba, fibras y musgo brillante
      g.fillStyle = done ? '#1A2622' : '#140E08';
      g.fillRect(1, 0, p.w - 2, p.h);
      g.fillRect(0, 1, p.w, p.h - 2);
      g.fillStyle = done ? '#24302A' : '#4A3A24';
      g.fillRect(1, 1, p.w - 2, p.h - 2);
      g.fillStyle = done ? '#2E3E36' : '#7A6040';
      for (let k = 0; k < (p.w * p.h) / 5; k++) g.fillRect(1 + Math.floor(rng() * (p.w - 3)), 1 + Math.floor(rng() * (p.h - 2)), 2, 1);
      if (!done) {
        g.fillStyle = '#5E7A2A';
        g.fillRect(1, 1, p.w - 2, 1);
        g.fillStyle = '#B6E35A';
        for (let k = 0; k < 5; k++) g.fillRect(1 + Math.floor(rng() * (p.w - 2)), 1 + Math.floor(rng() * (p.h - 2)), 1, 1);
      }
      return c;
    };
    spr = { off: mk(false), on: mk(true) };
    this.sprites.set(p, spr);
    return spr;
  }

  makeAmbient() {
    const run = this.run;
    const { W, VH, skyH, soilTop } = run;
    this.ambient = [];
    const flies = run.cave ? 8 : run.swamp ? 10 : 6;
    for (let k = 0; k < flies; k++) this.ambient.push({ kind: 'fly', x: Math.random() * W, y: Math.random() * (skyH - 4) + 2, ph: Math.random() * 10 });
    for (let k = 0; k < Math.round(W / 10); k++) this.ambient.push({ kind: 'mote', x: Math.random() * W, y: soilTop + Math.random() * (VH - soilTop), v: 1 + Math.random() * 2 });
    for (const d of this.dripSrc) this.ambient.push({ kind: 'drip', x: d.x, y0: d.y, y: d.y + Math.random() * (skyH - d.y), v: 0, wait: Math.random() * 3 });
    if (run.swamp) {
      for (let k = 0; k < 14; k++) this.ambient.push({ kind: 'bubble', x: Math.random() * W, y: run.waterTop + Math.random() * (VH - run.waterTop), v: 4 + Math.random() * 5 });
      for (let k = 0; k < 18; k++) this.ambient.push({ kind: 'flow', x: Math.random() * W, y: run.waterTop + 3 + Math.random() * (VH - run.waterTop - 6), len: 2 + Math.floor(Math.random() * 3) });
    }
  }

  // ── red, por trozos ──────────────────────────────────────────────────────

  net(k) {
    let n = this.netC[k];
    if (!n) {
      const c = makeCanvas(this.run.W, CH);
      n = { c, g: c.getContext('2d') };
      this.netC[k] = n;
    }
    return n;
  }

  /** Línea de hifa con su sombra debajo (la sombra va siempre detrás de toda la red). */
  drawSeg(s) {
    const ka = Math.floor(Math.min(s[1], s[3]) / CH);
    const kb = Math.floor((Math.max(s[1], s[3]) + 2) / CH);
    for (let k = ka; k <= kb; k++) {
      const { g } = this.net(k);
      const oy = k * CH;
      g.globalCompositeOperation = 'destination-over';
      g.fillStyle = this.hyphaCol[1];
      line(g, s[0] + 1, s[1] + 1 - oy, s[2] + 1, s[3] + 1 - oy);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = this.hyphaCol[0];
      line(g, s[0], s[1] - oy, s[2], s[3] - oy);
    }
  }

  /** Las colonias borran la red que se comen. */
  eraseDisc(x, y, r) {
    const ka = Math.floor((y - r - 1) / CH);
    const kb = Math.floor((y + r + 1) / CH);
    for (let k = Math.max(0, ka); k <= kb; k++) {
      const n = this.netC[k];
      if (!n) continue;
      n.g.globalCompositeOperation = 'destination-out';
      disc(n.g, x, y - k * CH, r);
      n.g.globalCompositeOperation = 'source-over';
    }
  }

  /**
   * Capa de oscuridad de lo que se ve (una casilla = un píxel): lo no explorado, negro;
   * lo explorado, en penumbra; y luz plena solo alrededor de las puntas que crecen y de la espora.
   */
  updateDark(cam) {
    const run = this.run;
    const { gw } = run;
    const j0 = Math.floor(cam / CELL);
    const rows = Math.ceil(run.VH / CELL) + 2;
    if (!this.darkC || this.darkRows !== rows) {
      this.darkRows = rows;
      this.darkC = makeCanvas(gw, rows);
      this.darkImg = this.darkC.getContext('2d').createImageData(gw, rows);
      this.alpha = new Uint8Array(gw * rows);
    }
    const A = this.alpha;
    const top = Math.floor(run.soilTop / CELL);
    for (let j = 0; j < rows; j++) {
      const J = j0 + j;
      // cuanto más hondo, más negra la roca sin explorar
      const black = Math.min(250, 236 + Math.floor((J * CELL - run.soilTop) / 150) * 3);
      for (let i = 0; i < gw; i++) A[j * gw + i] = J < top ? 0 : run.lit.has(J * gw + i) ? 130 : black;
    }
    const R = run.lightCells + 1;
    const light = (x, y, r) => {
      const ci = Math.floor(x / CELL);
      const cj = Math.floor(y / CELL) - j0;
      for (let j = Math.max(top - j0, 0, cj - r); j <= Math.min(rows - 1, cj + r); j++) {
        for (let i = Math.max(0, ci - r); i <= Math.min(gw - 1, ci + r); i++) {
          const d2 = (i - ci) ** 2 + (j - cj) ** 2;
          if (d2 > r * r + r) continue;
          const a = d2 >= (r - 1) * (r - 1) ? 70 : 0;
          const g = j * gw + i;
          if (a < A[g]) A[g] = a;
        }
      }
    };
    light(run.cx, run.cy, R + 1);
    for (const tip of run.tips) light(tip.x, tip.y, R);
    const d = this.darkImg.data;
    for (let g = 0; g < A.length; g++) {
      const k = g * 4;
      d[k] = 5; d[k + 1] = 4; d[k + 2] = 10; d[k + 3] = A[g];
    }
    this.darkC.getContext('2d').putImageData(this.darkImg, 0, 0);
    this.darkY = j0 * CELL - cam;
  }

  // ── pantalla ─────────────────────────────────────────────────────────────

  resize() {
    const r = this.c.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.cw = r.width;
    this.ch = r.height;
    this.c.width = Math.round(r.width * dpr);
    this.c.height = Math.round(r.height * dpr);
    if (!this.run) return;
    const { W, VH } = this.run;
    let s = Math.max(r.width / W, r.height / VH);
    if (s >= 2 && Math.abs(s - Math.round(s)) < 0.15) s = Math.round(s);
    this.scale = s;
    this.ox = Math.round((r.width - W * s) / 2);
    this.oy = Math.round((r.height - VH * s) / 2);
  }

  /** Punto de la pantalla → píxeles del mundo (con la cámara). */
  toWorld(clientX, clientY) {
    const r = this.c.getBoundingClientRect();
    return { x: (clientX - r.left - this.ox) / this.scale, y: (clientY - r.top - this.oy) / this.scale + this.cam };
  }

  /** Efectos de los sucesos de la temporada (en coordenadas del mundo). */
  onEvent(e) {
    const run = this.run;
    const colorOf = (cur, kind) => (cur === 'm' ? PAL.m : cur === 't' ? '#B6E35A' : cur === 'c' ? '#C79BFF' : cur === 'a' ? PAL.a : kind === 'leaf' ? PAL.leaf : kind === 'guano' ? '#D9C9A0' : PAL.n);
    if (e.type === 'absorb') {
      const color = colorOf(e.cur, e.kind);
      for (let k = 0; k < 5; k++) {
        const a = Math.random() * Math.PI * 2;
        this.fx.push({ x: e.x, y: e.y, vx: Math.cos(a) * 28, vy: Math.sin(a) * 28, life: 0.4, color });
      }
      this.collect(e.x, e.y, e.cur, color, 3);
      this.floaters.push({ x: e.x, y: e.y - 4, text: `+${e.text}`, color, life: 1 });
    } else if (e.type === 'log' || e.type === 'peat' || e.type === 'colony') {
      const color = colorOf(e.cur);
      for (let k = 0; k < 26; k++) {
        const a = Math.random() * Math.PI * 2;
        const v = 20 + Math.random() * 45;
        this.fx.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.7, color: e.type === 'colony' ? (k % 2 ? '#FF6B81' : color) : k % 2 ? PAL.logHi : color });
      }
      this.collect(e.x, e.y, e.cur, color, 8);
      this.floaters.push({ x: e.x, y: e.y - 6, text: `+${e.text}`, color, life: 1.3, big: true });
      this.shake = 0.22;
    } else if (e.type === 'plant') {
      this.floaters.push({ x: e.x, y: e.y, text: e.kind === 'tree' ? 'Pacto · azúcar' : 'Juncos · turba', color: e.kind === 'tree' ? PAL.a : '#B6E35A', life: 1.4, big: true });
      for (let k = 0; k < 14; k++) this.fx.push({ x: e.x, y: run.soilTop, vx: (Math.random() - 0.5) * 40, vy: -Math.random() * 40, life: 0.8, color: e.kind === 'tree' ? PAL.a : '#B6E35A' });
    } else if (e.type === 'pickup') {
      for (let k = 0; k < 8; k++) this.fx.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 24, vy: -Math.random() * 24, life: 0.6, color: '#FFF8E4' });
    } else if (e.type === 'jump') {
      for (let k = 0; k < 24; k++) {
        const a = Math.random() * Math.PI * 2;
        this.fx.push({ x: e.x, y: e.y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, life: 0.7, color: k % 2 ? '#FFF8E4' : this.hyphaCol[0] });
      }
      this.floaters.push({ x: e.x, y: e.y - 6, text: '¡Salto!', color: '#FFF8E4', life: 1.3, big: true });
    } else if (e.type === 'bite') {
      for (let k = 0; k < 4; k++) this.fx.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, life: 0.3, color: '#FF6B81' });
    }
    if (this.floaters.length > 40) this.floaters.splice(0, this.floaters.length - 40);
    if (this.fx.length > 500) this.fx.splice(0, this.fx.length - 500);
  }

  /** Partículas que vuelan hasta el contador de esa moneda. */
  collect(x, y, cur, color, n) {
    const hud = this.hudTarget?.(cur);
    if (!hud) return;
    for (let k = 0; k < n; k++) {
      this.fx.push({ x: x + (Math.random() - 0.5) * 4, y: y + (Math.random() - 0.5) * 4, vx: (Math.random() - 0.5) * 50, vy: -20 - Math.random() * 30, life: 1.2, color, hud, delay: k * 0.03 });
    }
  }

  /** Mueve la cámara: baja con lo más hondo de la red y, al acabar, sube a la superficie. */
  moveCamera(dt) {
    const run = this.run;
    if (!run.ended) {
      this.camTarget = Math.max(this.camTarget, run.maxDepth - run.VH * 0.62);
      this.camY += (this.camTarget - this.camY) * Math.min(1, dt * 3);
    } else {
      this.camY += (0 - this.camY) * Math.min(1, dt * 4.5);
      if (this.camY < 0.5) this.camY = 0;
    }
    this.camY = Math.max(0, this.camY);
    this.cam = Math.round(this.camY);
  }

  draw(dt, pointer, settings) {
    const run = this.run;
    if (!run) return;
    this.time += dt;
    this.moveCamera(dt);
    const { g, buf, cam } = this;
    const { W, VH, skyH, soilTop } = run;
    const t = this.time;
    const k0 = Math.floor(cam / CH);
    const k1 = Math.floor((cam + VH - 1) / CH);
    const vis = (y, m = 8) => y > cam - m && y < cam + VH + m;

    // Red nueva
    if (run.newSegs.length) {
      for (const s of run.newSegs) {
        this.drawSeg(s);
        this.recent.push({ s, t });
      }
      run.newSegs.length = 0;
      if (this.recent.length > 700) this.recent.splice(0, this.recent.length - 700);
    }
    // Las colonias de la zona activa se comen la red
    if (!run.ended) {
      const ka = Math.max(0, Math.floor((run.maxDepth - VH * 1.5) / CH));
      for (let k = ka; k <= k1 + 1; k++) for (const c of bucket(run, k).colonies) if (!c.dead) this.eraseDisc(c.x, c.y, c.r);
    }

    // Fondo
    g.fillStyle = this.theme.layers[4][2];
    g.fillRect(0, 0, W, VH);
    for (let k = k0; k <= k1; k++) g.drawImage(this.chunkBg(k), 0, k * CH - cam);

    // Ambiente: corriente, burbujas, motas, gotas
    const floorY = Math.max(soilTop, cam);
    for (const a of this.ambient) {
      if (a.kind === 'mote') {
        a.y -= a.v * dt;
        if (a.y < floorY || a.y > cam + VH) { a.y = a.y < floorY && a.y > cam - 4 ? cam + VH - 1 : floorY + Math.random() * (cam + VH - floorY); a.x = Math.random() * W; }
        g.fillStyle = run.cave ? '#2C2840' : run.swamp ? '#2E4044' : '#3E2E4C';
        g.fillRect(Math.round(a.x), Math.round(a.y - cam), 1, 1);
      } else if (a.kind === 'bubble') {
        const top = Math.max(run.waterTop, cam);
        a.y -= a.v * dt;
        if (a.y < top || a.y > cam + VH) { a.y = a.y < top && a.y > cam - 4 ? cam + VH - 1 : top + Math.random() * (cam + VH - top); a.x = Math.random() * W; }
        g.fillStyle = '#3E6A70';
        g.fillRect(Math.round(a.x), Math.round(a.y - cam), 1, 1);
      } else if (a.kind === 'drip') {
        // gota que cae de una estalactita al suelo de la cueva
        if (a.wait > 0) { a.wait -= dt; continue; }
        a.v += 60 * dt;
        a.y += a.v * dt;
        if (a.y >= skyH) { a.y = a.y0; a.v = 0; a.wait = 1 + Math.random() * 3; continue; }
        if (vis(a.y)) { g.fillStyle = '#5A7AB0'; g.fillRect(a.x, Math.round(a.y - cam), 1, 1); }
      } else if (a.kind === 'flow') {
        const top = Math.max(run.waterTop + 3, cam);
        if (a.y < top || a.y > cam + VH) a.y = top + Math.random() * Math.max(1, cam + VH - top);
        a.x += run.flow * run.st.current * 0.8 * dt;
        if (a.x < -4) a.x = W + 2;
        if (a.x > W + 4) a.x = -2;
        g.fillStyle = '#2C474C';
        g.fillRect(Math.round(a.x), Math.round(a.y - cam), a.len, 1);
      }
    }
    // Agua: brillos que parpadean
    g.fillStyle = PAL.waterHi;
    for (let k = k0 - 1; k <= k1 + 1; k++) {
      for (const p of bucket(run, k).puddles) {
        if (!vis(p.y, 20)) continue;
        if (Math.floor(t * 2 + p.x) % 2) g.fillRect(p.x - 2, p.y + 2 - cam, 3, 1);
        else g.fillRect(p.x + 1, p.y - 1 - cam, 2, 1);
      }
    }
    if (run.swamp && vis(skyH)) {
      g.fillStyle = '#3E7A84';
      for (let x = (Math.floor(t * 3) % 7); x < W; x += 13) g.fillRect(x, skyH - cam, 2, 1);
    }

    // Plantas y troncos (superficie), turba
    run.plants.forEach((p, k) => {
      const spr = this.plantSprites[k];
      if (spr.y + spr.h > cam) g.drawImage(p.connected ? spr.on : spr.off, spr.x, spr.y - cam);
    });
    run.logs.forEach((l, k) => { if (vis(l.y, 12)) { const spr = this.logSprites[k]; g.drawImage(l.done ? spr.on : spr.off, l.x, l.y - 2 - cam); } });
    for (let k = k0 - 1; k <= k1 + 1; k++) {
      for (const p of bucket(run, k).peats) {
        if (!vis(p.y, 16)) continue;
        const spr = this.peatSprite(p);
        g.drawImage(p.done ? spr.on : spr.off, p.x, p.y - cam);
      }
    }

    // Red: trozos ya dibujados y la estela reciente más clara
    for (let k = k0; k <= k1; k++) if (this.netC[k]) g.drawImage(this.netC[k].c, 0, k * CH - cam);
    g.fillStyle = this.hyphaCol[2];
    const keep = [];
    for (const r of this.recent) {
      if (t - r.t > 0.6) continue;
      if (vis(r.s[3], 2)) line(g, r.s[0], r.s[1] - cam, r.s[2], r.s[3] - cam);
      keep.push(r);
    }
    this.recent = keep;

    // Colonias rivales: masa de bacterias con borde que se mueve y puntos dentro
    for (let k = k0 - 1; k <= k1 + 1; k++) {
      bucket(run, k).colonies.forEach((c, ci) => {
        if (c.dead || !vis(c.y, 20)) return;
        const cy = c.y - cam;
        const r = c.r + (Math.floor(t * 3 + ci) % 2) * 0.5;
        g.fillStyle = '#3A0E20';
        disc(g, c.x, cy + 1, r + 1);
        g.fillStyle = '#9E2A4E';
        disc(g, c.x, cy, r);
        g.fillStyle = '#C93A64';
        disc(g, c.x - 1, cy - 1, Math.max(1, r - 2));
        const cr = mulberry32(Math.round(c.x * 977 + c.y * 13));
        for (let q = 0; q < r * 2; q++) {
          const a = cr() * Math.PI * 2;
          const d = Math.sqrt(cr()) * (r - 1);
          const wob = Math.sin(t * 2 + q) * 0.6;
          g.fillStyle = q % 3 ? '#7A1E3E' : '#FF9AB4';
          g.fillRect(Math.round(c.x + Math.cos(a) * d + wob), Math.round(cy + Math.sin(a) * d), 1, 1);
        }
        g.fillStyle = '#FFC2D2';
        g.fillRect(Math.round(c.x - r * 0.45), Math.round(cy - r * 0.55), 2, 1);
        g.fillStyle = Math.floor(t * 4) % 2 ? '#FF6B81' : '#5A1730';
        for (let q = 0; q < 10; q++) {
          const a = (q / 10) * Math.PI * 2 + t * 0.7;
          g.fillRect(Math.round(c.x + Math.cos(a) * (r + 1)), Math.round(cy + Math.sin(a) * (r + 1)), 1, 1);
        }
        if (c.hp < run.st.colonyHp) {
          g.fillStyle = '#FFF3D6';
          g.fillRect(Math.round(c.x - 3), Math.round(cy - c.r - 3), Math.round(6 * Math.max(0, c.hp / run.st.colonyHp)), 1);
        }
      });
    }

    // Bolsas de comida (con un brillo que recorre)
    for (let k = k0 - 1; k <= k1 + 1; k++) {
      for (const p of bucket(run, k).pockets) {
        if (!vis(p.y)) continue;
        const [c1, c2] = POCKET_COL[p.type];
        const spr = bitmap(SPR[p.type], c1, c2);
        const x = Math.round(p.x - spr.width / 2);
        const y = Math.round(p.y - cam - spr.height / 2);
        g.drawImage(spr, x, y);
        if (Math.floor(t * 1.5 + p.x * 0.37) % 6 === 0) { g.fillStyle = '#FFFFFF'; g.fillRect(x + 1, y + 1, 1, 1); }
      }
    }

    // Grillos (y la espora que llevan encima) y murciélagos del techo
    for (let k = k0 - 1; k <= k1 + 1; k++) {
      for (const c of bucket(run, k).crickets) {
        if (!vis(c.y)) continue;
        const x = Math.round(c.x);
        const y = Math.round(c.y - cam) - (c.air > 0 ? 1 : 0);
        g.fillStyle = '#7A5A30';
        g.fillRect(x - 1, y, 3, 1);
        g.fillRect(x - 2, y + 1, 1, 1);
        g.fillRect(x + 2, y + 1, 1, 1);
        g.fillStyle = '#B8935A';
        g.fillRect(x, y - 1, 2, 1);
        g.fillRect(x + 2, y - 2, 1, 1);
        if (c.carry > 0) {
          g.fillStyle = Math.floor(t * 8) % 2 ? '#FFF8E4' : this.hyphaCol[0];
          g.fillRect(x, y - 3, 1, 1);
        }
      }
    }
    if (cam < 12) {
      for (const b of run.bats) {
        const spr = bitmap(SPR.bat, '#2E2840', '#000');
        g.drawImage(spr, Math.round(b.x - 3), 1 - cam);
        if (Math.floor(t * 1.3 + b.x) % 5) {
          g.fillStyle = '#FFD23F';
          g.fillRect(Math.round(b.x - 1), 3 - cam, 1, 1);
          g.fillRect(Math.round(b.x + 1), 3 - cam, 1, 1);
        }
      }
    }

    // Puntas: brillo que parpadea
    for (const tip of run.tips) {
      if (!vis(tip.y)) continue;
      const x = Math.round(tip.x);
      const y = Math.round(tip.y - cam);
      g.fillStyle = this.hyphaCol[0];
      g.fillRect(x - 1, y, 3, 1);
      g.fillRect(x, y - 1, 1, 3);
      g.fillStyle = '#FFFFFF';
      g.fillRect(x, y, 1, 1);
      if (Math.floor(t * 8 + x) % 2) {
        g.fillStyle = this.hyphaCol[2];
        g.fillRect(x - 2, y, 1, 1);
        g.fillRect(x + 2, y, 1, 1);
      }
    }

    // Espora
    if (vis(run.cy)) {
      const core = bitmap(SPR.core, this.hyphaCol[0], '#FFF8E4');
      g.drawImage(core, run.cx - 3, run.cy - 3 - cam);
      const ring = 5 + (Math.floor(t * 3) % 3);
      g.fillStyle = this.hyphaCol[0];
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        if (k % 2) g.fillRect(Math.round(run.cx + Math.cos(a) * ring), Math.round(run.cy - cam + Math.sin(a) * ring), 1, 1);
      }
    }

    // Oscuridad de la cueva: solo se ve lo que tu red ha iluminado
    if (run.dark) {
      this.updateDark(cam);
      g.imageSmoothingEnabled = true;
      g.drawImage(this.darkC, 0, this.darkY, run.gw * CELL, this.darkRows * CELL);
      g.imageSmoothingEnabled = false;
      // pistas: los cristales destellan a oscuras; con Ecolocalización se ve su silueta
      for (let k = k0 - 1; k <= k1 + 1; k++) {
        for (const p of bucket(run, k).pockets) {
          if ((p.type !== 'c' && p.type !== 'guano') || !vis(p.y)) continue;
          if (run.lit.has(Math.floor(p.y / CELL) * run.gw + Math.floor(p.x / CELL))) continue;
          const py = p.y - cam;
          if (run.st.echo) {
            g.fillStyle = p.type === 'c' ? '#5E4A8A' : '#5A5040';
            for (let q = 0; q < 8; q++) {
              const a = (q / 8) * Math.PI * 2 + t;
              g.fillRect(Math.round(p.x + Math.cos(a) * 4), Math.round(py + Math.sin(a) * 4), 1, 1);
            }
          }
          if (p.type === 'c' && Math.floor(t * 2 + p.x * 0.7) % 9 === 0) {
            g.fillStyle = '#E5C8FF';
            g.fillRect(p.x, py - 1, 1, 3);
            g.fillRect(p.x - 1, py, 3, 1);
          }
        }
      }
    }

    // Récord de profundidad: una línea discontinua (encima de la oscuridad)
    const recY = soilTop + this.record - cam;
    const showRec = this.record > 20 && recY > 2 && recY < VH - 2;
    if (showRec) {
      g.fillStyle = 'rgba(255,243,214,0.55)';
      for (let x = (Math.floor(t * 6) % 6); x < W; x += 6) g.fillRect(x, recY, 3, 1);
    }

    // Luciérnagas en el cielo
    for (const a of this.ambient) {
      if (a.kind !== 'fly') continue;
      a.x += Math.sin(t * 0.7 + a.ph) * 6 * dt;
      a.y += Math.cos(t * 0.9 + a.ph) * 3 * dt;
      const y = Math.round(Math.max(1, Math.min(skyH - 3, a.y))) - cam;
      if (y >= 0 && Math.sin(t * 2 + a.ph * 3) > 0.2) {
        g.fillStyle = run.cave ? '#9F8CFF' : run.swamp ? '#C6F26B' : '#FFE27A';
        g.fillRect(Math.round(a.x), y, 1, 1);
      }
    }

    // Reglilla de profundidad en el borde derecho: una marca cada 50 cm
    g.fillStyle = 'rgba(255,243,214,0.35)';
    for (let dd = Math.max(50, Math.ceil((cam - soilTop) / 50) * 50); soilTop + dd < cam + VH; dd += 50) {
      g.fillRect(W - (dd % 100 ? 2 : 4), soilTop + dd - cam, dd % 100 ? 2 : 4, 1);
    }

    // Setas en la superficie al final (la cámara ya ha subido)
    if (run.ended) this.endT += dt;
    if (run.ended && run.setas.length && cam < skyH + 10) {
      const capCol = run.cave ? '#C79BFF' : run.swamp ? '#C6F26B' : PAL.e;
      const spotCol = run.cave ? '#F4E6FF' : run.swamp ? '#F0FFC0' : '#FFE0F0';
      for (const s of run.setas) {
        const p = Math.min(1, Math.max(0, (this.endT - s.d) / 0.25));
        if (p <= 0) continue;
        const h = Math.round(1 + 3 * p);
        const sy = s.y - cam;
        g.fillStyle = '#F4E9D8';
        g.fillRect(s.x, sy - h + 1, 1, h);
        g.fillStyle = capCol;
        g.fillRect(s.x - 1, sy - h - 1, 3, 1);
        g.fillRect(s.x - 2, sy - h, 5, 1);
        g.fillStyle = spotCol;
        g.fillRect(s.x - 1, sy - h, 1, 1);
        if (p >= 1 && Math.random() < 0.01) this.fx.push({ x: s.x, y: s.y - h - 1, vx: (Math.random() - 0.5) * 6, vy: -8 - Math.random() * 8, life: 1.2, color: capCol });
      }
    }

    // Puntero: anillo de alcance y cruz
    if (pointer && !run.ended) {
      const px = Math.round(pointer.x);
      const py = Math.round(pointer.y - cam);
      if (px >= 0 && pointer.y >= soilTop - 4 && px < W && py < VH) {
        const R = run.st.attract;
        const n = Math.max(32, Math.round(R * 1.1));
        g.fillStyle = 'rgba(255,243,214,0.5)';
        for (let k = 0; k < n; k += 2) {
          const a = t * 0.6 + (k / n) * Math.PI * 2;
          g.fillRect(Math.round(px + Math.cos(a) * R), Math.round(py + Math.sin(a) * R), 1, 1);
        }
        g.fillStyle = '#FFF8E4';
        g.fillRect(px - 3, py, 2, 1);
        g.fillRect(px + 2, py, 2, 1);
        g.fillRect(px, py - 3, 1, 2);
        g.fillRect(px, py + 2, 1, 2);
      }
    }

    // Partículas (las que van al contador aceleran hacia él)
    const s = this.scale;
    for (const f of this.fx) {
      if (f.delay > 0) { f.delay -= dt; continue; }
      if (f.hud) {
        const dx = (f.hud.x - this.ox) / s - f.x;
        const dy = (f.hud.y - this.oy) / s + cam - f.y;
        const d = Math.hypot(dx, dy) || 1;
        f.vx += (dx / d) * 600 * dt;
        f.vy += (dy / d) * 600 * dt;
        f.vx *= 0.92;
        f.vy *= 0.92;
        if (d < 4) f.life = 0;
      } else {
        f.vx *= 0.9;
        f.vy *= 0.9;
      }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.life -= dt;
      g.fillStyle = f.color;
      g.fillRect(Math.round(f.x), Math.round(f.y - cam), 1, 1);
    }
    this.fx = this.fx.filter((f) => f.life > 0);

    // A pantalla
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    let sx = 0;
    let sy = 0;
    if (this.shake > 0 && settings.shake) {
      sx = Math.round((Math.random() - 0.5) * 6);
      sy = Math.round((Math.random() - 0.5) * 6);
    }
    this.shake = Math.max(0, this.shake - dt);
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(0, 0, this.cw, this.ch);
    ctx.drawImage(buf, this.ox + sx, this.oy + sy, W * s, VH * s);

    const text = (str, x, y, size, color, align = 'center', alpha = 1) => {
      ctx.font = `${size}px "Jersey 15", monospace`;
      ctx.textAlign = align;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = PAL.ink;
      ctx.fillText(str, x + 2, y + 2);
      ctx.fillStyle = color;
      ctx.fillText(str, x, y);
      ctx.globalAlpha = 1;
    };

    // Metros en la reglilla y etiqueta del récord
    for (let dd = Math.max(100, Math.ceil((cam - soilTop) / 100) * 100); soilTop + dd < cam + VH; dd += 100) {
      const y = Math.round(this.oy + (soilTop + dd - cam) * s);
      if (y > 70) text(`${dd / 100} m`, Math.round(this.ox + (W - 6) * s), y + 7, 20, 'rgba(255,243,214,0.6)', 'right');
    }
    if (showRec) text('récord', Math.round(this.ox + 6 * s), Math.round(this.oy + recY * s) - 6, 20, 'rgba(255,243,214,0.75)', 'left');

    // Textos flotantes con la fuente pixel
    for (const f of this.floaters) {
      f.life -= dt;
      const rise = (1 - Math.max(0, f.life)) * 12;
      text(f.text, Math.round(this.ox + f.x * s), Math.round(this.oy + (f.y - cam - rise) * s), f.big ? 30 : 22, f.color, 'center', Math.max(0, Math.min(1, f.life * 2)));
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);

    // Cartel de capa nueva
    if (this.banner) {
      const b = this.banner;
      b.life -= dt;
      const a = Math.max(0, Math.min(1, b.life * 1.5, (2.4 - b.life) * 4));
      const y = Math.round(this.ch * 0.3);
      const k = Math.min(1, this.cw / 560); // en pantallas estrechas, más pequeño
      text(b.title, Math.round(this.cw / 2), y, Math.round(46 * Math.max(0.7, k)), '#FFF3D6', 'center', a);
      if (b.sub) text(b.sub, Math.round(this.cw / 2), y + Math.round(32 * Math.max(0.7, k)), Math.round(26 * Math.max(0.8, k)), '#F4D58D', 'center', a);
      if (b.life <= 0) this.banner = null;
    }
  }
}
