// Dibuja una temporada en pixel art, vista en corte: cielo alto para los árboles, superficie
// y capas de suelo sin fondo. Todo va a un lienzo pequeño (1 px = 1 px del mundo) que se amplía
// a pantalla sin suavizado. La cámara sigue a las raíces que crecen y, al acabar, sube para ver
// crecer los árboles y caer sus frutos. Fondo y raíces se guardan por trozos de suelo (CH px de alto).

import { PAL, bitmap } from './pixel.js';
import { mulberry32, CH, bucket, treeShape, GROW_T, crackX } from './run.js';
import { LAYERS } from './data.js';

// Aspecto de cada zona. layers: una por capa del suelo, [base, clara, oscura]
const THEMES = {
  pradera: {
    sky: ['#120D22', '#1A1430', '#251A3D', '#3A2350', '#5A2E5E', '#7A3E5E'],
    hills: ['#2B1D42', '#1E1534'],
    layers: [['#3B2731', '#4A3340', '#2E1F28'], ['#46282A', '#573434', '#361E20'], ['#2C1F36', '#3A2A45', '#22182B'], ['#211830', '#2C2040', '#191226'], ['#160F22', '#1F1730', '#0F0A18']],
    speck: ['#5A4652', '#7A6472'],
    fossil: '#3E3050',
    moon: ['#3A2350', '#F4E2B0', '#CDB57E'],
    grass: ['#3E7A3A', '#5FA14A', '#8FD06A'],
    mote: '#4A3448',
  },
  ribera: {
    sky: ['#0C1A22', '#11242C', '#183238', '#21433F', '#2E5A4A', '#3E6A50'],
    hills: ['#1E4440', '#14302E'],
    layers: [['#2F2A24', '#3B3428', '#25211A'], ['#1D3A48', '#27505E', '#173040'], ['#34343C', '#44444E', '#28282E'], ['#24304A', '#2E3C5A', '#1C2638'], ['#141A26', '#1C2432', '#0E121A']],
    speck: ['#4A4438', '#5E5648'],
    fossil: '#2F4044',
    moon: ['#21433F', '#D8E8C8', '#A8C0A0'],
    grass: ['#3E7A3A', '#4E8A3E', '#7DB85A'],
    mote: '#3A4A44',
    reeds: true,
  },
  ladera: {
    sky: ['#1A1028', '#2A1530', '#4A2236', '#7A3A3A', '#A8583A', '#C87A4A'],
    hills: ['#5A3040', '#3A2034'],
    layers: [['#4A3640', '#5E4652', '#3A2A32'], ['#3E3A44', '#4E4A56', '#2E2A34'], ['#46404A', '#58505E', '#342E38'], ['#3A3448', '#4C4560', '#2C2638'], ['#2A2430', '#36303E', '#1E1A24']],
    speck: ['#5A5462', '#706A78'],
    fossil: '#4A4456',
    moon: ['#7A3A3A', '#FFE2B0', '#E0B880'],
    grass: ['#4E6A34', '#6E8A3A', '#9AB060'],
    mote: '#55505E',
    peaks: true,
    crack: ['#1A1218', '#2A2026', '#6E6878'],
  },
  viejo: {
    sky: ['#08100E', '#0C1814', '#10201A', '#162A20', '#1E3626', '#2A4430'],
    hills: ['#13261C', '#0E1C15'],
    layers: [['#1E1A16', '#2A2420', '#141210'], ['#241C16', '#30261E', '#1A1410'], ['#16120E', '#201A14', '#0E0C0A'], ['#22242A', '#2E3038', '#181A1E'], ['#0E0C10', '#16141A', '#08070A']],
    speck: ['#3A3228', '#4E4436'],
    fossil: '#3A3A30',
    moon: ['#162A20', '#E8F0D0', '#B8C8A0'],
    grass: ['#2E5A2A', '#3E7A3A', '#6EA85A'],
    mote: '#3A3428',
    giants: true,
    dead: ['#4E4A44', '#6A645C', '#2E2A26'],
  },
};
const ROOT = {
  live: '#F0CF92', liveLo: '#5A3B28', liveHi: '#FFF8E4',
  old: '#8A5A38', oldHi: '#B07A4E', oldLo: '#3A2216',
};
const LEAF = ['#1F4A2A', '#2E6A3A', '#3E8A4A', '#5FA155', '#8FD06A'];
const BARK = ['#4A2E20', '#6A4630', '#8E6240'];
const GROWTH_COL = '#9BE36B';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

const SPR = {
  n: ['.###.', '#o##o', '##o##', '#####', '.###.'],
  big: ['..###..', '.#####.', '##o####', '#o##o##', '#######', '.#####.', '..###..'],
  fossil: ['.###.', '#...#', '#.#.#', '#..#.', '.##..'],
  bone: ['#....#', '.####.', '#....#'],
  fruit: ['.##.', '#o##', '####', '.##.'],
  vein: ['..#..', '.#o#.', '#o#o#', '.###.', '..#..'],
};

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** Línea de píxeles; con w > 1, de w×w píxeles de grueso. */
function line(g, x0, y0, x1, y1, w = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const o = w > 1 ? Math.floor(w / 2) : 0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    g.fillRect(x0 - o, y0 - o, w, w);
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

const ease = (p) => 1 - (1 - p) ** 3;

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

  /** opts.record: récord de profundidad (px) en esta zona, para marcarlo en el suelo. */
  setRun(run, seed, opts = {}) {
    this.run = run;
    this.seed = seed;
    this.zone = run.st.zone || 'pradera';
    this.theme = THEMES[this.zone] || THEMES.pradera;
    this.bounds = LAYERS[this.zone].map(([d]) => run.soilTop + d);
    this.record = opts.record || 0;
    this.buf = makeCanvas(run.W, run.VH);
    this.g = this.buf.getContext('2d');
    this.bgC = []; // fondo por trozo
    this.netC = []; // raíces por trozo: {c, g}
    this.fx = [];
    this.floaters = [];
    this.recent = [];
    this.banner = null;
    this.camY = run.startCam;
    this.camTarget = run.startCam;
    this.cam = Math.round(this.camY);
    // forma de la copa de cada árbol: manchas de hojas al azar, siempre las mismas
    this.crowns = run.trees.map((t) => {
      const rng = mulberry32((seed ^ Math.imul(t.i + 3, 0x45d9f3b)) >>> 0);
      const blobs = [[0, 0, 1]];
      const n = 5 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + rng() * 0.6;
        blobs.push([Math.cos(a) * (0.5 + rng() * 0.15), Math.sin(a) * (0.4 + rng() * 0.15) - 0.05, 0.55 + rng() * 0.2]);
      }
      return blobs;
    });
    this.makeAmbient();
    this.resize();
  }

  /** Cartel grande (capa nueva, récord). */
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

    // Cielo con bandas difuminadas: noche arriba, el último resplandor del día abajo
    const T = this.theme;
    const sky = T.sky;
    for (let y = y0; y < Math.min(soilTop, y0 + CH); y++) {
      const t = (y / Math.max(1, skyH - 1)) * (sky.length - 1);
      const i = Math.min(sky.length - 2, Math.floor(t));
      const fr = Math.min(1, t - i);
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

    // Lo de la superficie se pinta en cada trozo que la toca, siempre con el mismo azar
    if (y0 < soilTop + 8) this.paintSurface(g, mulberry32((this.seed ^ 0x5eed) >>> 0));

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
      if (y0 > soilTop + 60 && rng() < 0.45) {
        const spr = bitmap(rng() < 0.5 ? SPR.fossil : SPR.bone, T.fossil, '#000');
        g.drawImage(spr, Math.floor(rng() * (W - 8)), Math.floor(ya + rng() * Math.max(1, rows - 6)));
      }
    }

    // Ribera: la superficie del agua subterránea
    const st = run.st;
    if (st.waterBottom) {
      const wy = soilTop + st.waterTop;
      if (wy >= y0 && wy < y0 + CH) {
        for (let x = 0; x < W; x++) {
          g.fillStyle = (x + Math.floor(x / 7)) % 5 ? '#3E7A90' : '#5FA8C0';
          g.fillRect(x, wy + (Math.sin(x * 0.2) > 0.6 ? 1 : 0), 1, 1);
        }
      }
    }
    // Ladera: grietas en la roca (oscuras, con el borde iluminado) y sus ramales
    if (st.rockTop) {
      const T2 = this.theme.crack;
      const ry = Math.max(soilTop + st.rockTop, y0);
      for (let y = ry; y < y0 + CH; y++) {
        for (const c of run.cracks) {
          const cx = crackX(c, y);
          const a = Math.round(cx - c.w / 2);
          const b = Math.round(cx + c.w / 2);
          g.fillStyle = T2[0];
          g.fillRect(a, y, b - a + 1, 1);
          g.fillStyle = T2[1];
          if ((y * 7 + a) % 5 === 0) g.fillRect(a + 1, y, 1, 1);
          g.fillStyle = T2[2];
          g.fillRect(a - 1, y, 1, 1);
        }
      }
      for (let kk = k - 1; kk <= k + 1; kk++) {
        for (const sp of bucket(run, kk).spurs) {
          g.fillStyle = T2[2];
          line(g, sp.x0 - 1, sp.y0 - 1, sp.x1 - 1, sp.y1 - 1, sp.w);
          g.fillStyle = T2[0];
          line(g, sp.x0, sp.y0, sp.x1, sp.y1, sp.w);
        }
      }
      // la capa fina de tierra encima de la roca
      const ty = soilTop + st.rockTop;
      if (ty >= y0 && ty < y0 + CH) {
        g.fillStyle = T2[2];
        for (let x = 0; x < W; x++) if (x % 3) g.fillRect(x, ty, 1, 1);
      }
    }

    // Bosque viejo: raíces muertas (grises); al absorberlas se pintan encima, en la capa de raíces
    if (this.theme.dead) {
      const D = this.theme.dead;
      for (let kk = k - 1; kk <= k + 1; kk++) {
        for (const d of bucket(run, kk).dead) {
          g.fillStyle = D[2];
          line(g, d.x0 + 1, d.y0 + 1, d.x1 + 1, d.y1 + 1, 2);
          g.fillStyle = D[0];
          line(g, d.x0, d.y0, d.x1, d.y1, 2);
          g.fillStyle = D[1];
          line(g, d.x0, d.y0, d.x1, d.y1);
        }
      }
    }

    // Piedras y charcos (también los de los trozos vecinos que asoman)
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

  /** Estrellas, luna, colinas (o montañas) con árboles lejanos y la hierba de la superficie. */
  paintSurface(g, rng) {
    const run = this.run;
    const T = this.theme;
    const { W, skyH } = run;
    for (let k = 0; k < W / 4; k++) {
      const x = Math.floor(rng() * W);
      const y = Math.floor(rng() * skyH * 0.6);
      g.fillStyle = rng() < 0.3 ? '#F4E9D8' : '#7A6A9A';
      g.fillRect(x, y, 1, 1);
    }
    const mr = 5;
    const mx = Math.round(W * 0.84);
    const my = Math.round(skyH * 0.45);
    g.fillStyle = T.moon[0];
    disc(g, mx, my, mr + 2);
    g.fillStyle = T.moon[1];
    disc(g, mx, my, mr);
    g.fillStyle = T.moon[2];
    g.fillRect(mx - 1, my - 1, 2, 1);
    g.fillRect(mx + 2, my + 1, 1, 1);
    if (T.giants) {
      // troncos de árboles gigantes que se pierden hacia arriba
      for (let x = Math.floor(rng() * 30); x < W; x += 34 + Math.floor(rng() * 40)) {
        const w = 8 + Math.floor(rng() * 8);
        g.fillStyle = '#0B1611';
        g.fillRect(x, 0, w, skyH);
        g.fillStyle = '#122219';
        g.fillRect(x, 0, 2, skyH);
        g.fillRect(x - 3, skyH - 4, w + 6, 4);
        g.fillStyle = '#0B1611';
        const by = Math.floor(rng() * skyH * 0.5);
        line(g, x + w / 2, by, x + w / 2 + (rng() < 0.5 ? -1 : 1) * 18, by - 14, 3);
      }
    }
    for (let layer = 0; layer < T.hills.length; layer++) {
      g.fillStyle = T.hills[layer];
      const ph = rng() * 10;
      const tops = [];
      for (let x = 0; x < W; x++) {
        let h;
        if (T.peaks) {
          // montañas con picos: dientes de sierra suavizados
          const f = layer ? 0.045 : 0.022;
          const tri = Math.abs(((x * f + ph) % 2) - 1);
          h = Math.round((layer ? 16 : 40) * (0.35 + 0.65 * tri) + Math.sin(x * 0.3 + ph) * 1.5);
        } else {
          const amp = layer ? 10 : 22;
          h = Math.round(amp * (0.55 + 0.45 * Math.sin(x * (layer ? 0.06 : 0.025) + ph)) + Math.sin(x * 0.17 + ph) * 1.2);
        }
        g.fillRect(x, skyH - h, 1, h);
        tops.push(skyH - h);
      }
      if (T.peaks && !layer) {
        // nieve en lo más alto
        g.fillStyle = '#E8D8E0';
        for (let x = 0; x < W; x++) if (skyH - tops[x] > 36) g.fillRect(x, tops[x], 1, 2);
        continue;
      }
      // árboles lejanos (o pinos en la montaña)
      g.fillStyle = T.hills[layer];
      for (let x = 3 + Math.floor(rng() * 8); x < W - 3; x += 6 + Math.floor(rng() * (layer ? 10 : 18))) {
        const r = layer ? 2 + Math.floor(rng() * 2) : 1 + Math.floor(rng() * 2);
        const ty = tops[x] - r - (layer ? 2 : 1);
        if (T.peaks) {
          for (let q = 0; q < r * 2 + 2; q++) g.fillRect(x - Math.floor(q / 2), ty - r + q, Math.floor(q / 2) * 2 + 1, 1);
        } else disc(g, x, ty, r);
        g.fillRect(x, ty, 1, tops[x] - ty + 1);
      }
    }
    const [g0, g1, g2] = T.grass;
    g.fillStyle = g0;
    g.fillRect(0, skyH, W, 2);
    g.fillStyle = g1;
    g.fillRect(0, skyH, W, 1);
    for (let x = 0; x < W; x++) {
      const h = rng() < (T.peaks ? 0.25 : 0.5) ? Math.floor(rng() * 3) : 0;
      if (!h) continue;
      g.fillStyle = rng() < 0.5 ? g1 : g2;
      g.fillRect(x, skyH - h, 1, h);
      if (h === 2 && rng() < 0.12) { g.fillStyle = rng() < 0.5 ? '#F49AC2' : '#FFD23F'; g.fillRect(x, skyH - h - 1, 1, 1); }
    }
    if (T.reeds) {
      // juncos en la orilla, lejos de los árboles
      for (let x = 4; x < W - 4; x += 5 + Math.floor(rng() * 9)) {
        if (run.trees.some((t) => Math.abs(t.x - x) < 10)) continue;
        const h = 5 + Math.floor(rng() * 6);
        g.fillStyle = '#5E7A3A';
        g.fillRect(x, skyH - h, 1, h);
        g.fillStyle = '#8FAF5A';
        g.fillRect(x + 1, skyH - h + 2, 1, h - 2);
        g.fillStyle = '#6B4A2F';
        g.fillRect(x, skyH - h - 2, 1, 3);
      }
    }
    if (T.peaks) {
      // piedras sueltas en la superficie
      for (let x = 6; x < W - 6; x += 14 + Math.floor(rng() * 20)) {
        if (run.trees.some((t) => Math.abs(t.x - x) < 9)) continue;
        const w = 3 + Math.floor(rng() * 4);
        g.fillStyle = PAL.stone;
        g.fillRect(x, skyH - 2, w, 3);
        g.fillStyle = PAL.stoneHi;
        g.fillRect(x, skyH - 2, w - 1, 1);
      }
    }
  }

  paintStone(g, s) {
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

  makeAmbient() {
    const run = this.run;
    const { W, VH, skyH, soilTop } = run;
    this.ambient = [];
    for (let k = 0; k < 7; k++) this.ambient.push({ kind: 'fly', x: Math.random() * W, y: skyH - 6 - Math.random() * 60, ph: Math.random() * 10 });
    for (let k = 0; k < Math.round(W / 10); k++) this.ambient.push({ kind: 'mote', x: Math.random() * W, y: soilTop + Math.random() * VH, v: 1 + Math.random() * 2 });
    if (run.st.waterBottom) {
      const top = soilTop + run.st.waterTop;
      for (let k = 0; k < Math.round(W / 8); k++) this.ambient.push({ kind: 'flow', x: Math.random() * W, y: top + 3 + Math.random() * (run.st.waterBottom - run.st.waterTop - 6), len: 2 + Math.floor(Math.random() * 3) });
    }
  }

  // ── raíces, por trozos ───────────────────────────────────────────────────

  net(k) {
    let n = this.netC[k];
    if (!n) {
      const c = makeCanvas(this.run.W, CH);
      n = { c, g: c.getContext('2d') };
      this.netC[k] = n;
    }
    return n;
  }

  /** Llama a fn(g, oy) en cada trozo que toca el tramo (con margen para el grosor). */
  eachChunk(s, m, fn) {
    const ka = Math.floor((Math.min(s[1], s[3]) - m) / CH);
    const kb = Math.floor((Math.max(s[1], s[3]) + m) / CH);
    for (let k = Math.max(0, ka); k <= kb; k++) fn(this.net(k).g, k * CH);
  }

  /** Tramo de una raíz que crece: fina y clara, con su sombra detrás. */
  drawLiveSeg(s) {
    this.eachChunk(s, 2, (g, oy) => {
      g.globalCompositeOperation = 'destination-over';
      g.fillStyle = ROOT.liveLo;
      line(g, s[0] + 1, s[1] + 1 - oy, s[2] + 1, s[3] + 1 - oy);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = ROOT.live;
      line(g, s[0], s[1] - oy, s[2], s[3] - oy);
    });
  }

  /** Una raíz que se ha parado: más oscura y gruesa, más cuanto más cerca del tronco. */
  drawOldRoot(r) {
    const n = r.segs.length;
    if (!n) return;
    const w0 = r.gen === 0 ? 3 : r.gen === 1 ? 2 : 1;
    r.segs.forEach((s, i) => {
      const w = Math.max(1, Math.round(w0 - (w0 - 1) * (i / n) * 1.3));
      this.eachChunk(s, w + 1, (g, oy) => {
        g.fillStyle = ROOT.oldLo;
        line(g, s[0] + 1, s[1] + 1 - oy, s[2] + 1, s[3] + 1 - oy, w);
        g.fillStyle = ROOT.old;
        line(g, s[0], s[1] - oy, s[2], s[3] - oy, w);
        if (w >= 2) {
          g.fillStyle = ROOT.oldHi;
          line(g, s[0] - Math.floor(w / 2), s[1] - oy, s[2] - Math.floor(w / 2), s[3] - oy);
        }
      });
    });
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
    const burst = (x, y, n, v, life, color) => {
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        const s = v * (0.5 + Math.random() * 0.7);
        this.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, color: typeof color === 'function' ? color(k) : color });
      }
    };
    if (e.type === 'absorb') {
      const color = e.kind === 'big' ? '#B6E35A' : PAL.n;
      burst(e.x, e.y, e.kind === 'big' ? 12 : 5, 28, 0.45, color);
      this.floaters.push({ x: e.x, y: e.y - 4, text: `+${e.text}`, color: GROWTH_COL, life: 1 });
      if (e.sprouted) {
        this.floaters.push({ x: e.x, y: e.y - 12, text: '+1 brote', color: '#D2F7A0', life: 1.4, big: true });
        burst(e.x, e.y, 14, 40, 0.7, (k) => (k % 2 ? '#B6E35A' : '#FFF8E4'));
        this.shake = 0.12;
      }
    } else if (e.type === 'sprout') {
      burst(e.x, e.y, 7, 22, 0.5, (k) => (k % 2 ? '#B6E35A' : ROOT.liveHi));
    } else if (e.type === 'stop') {
      this.drawOldRoot(e.r);
      if (e.why !== 'end') burst(e.x, e.y, 4, 14, 0.4, e.why === 'rock' ? '#8A8494' : ROOT.old);
    } else if (e.type === 'catch') {
      const color = e.gold ? PAL.a : '#FF6B81';
      burst(e.x, e.y, e.gold ? 16 : 8, 36, 0.5, (k) => (k % 2 ? color : '#FFF8E4'));
      this.collect(e.x, e.y, 'f', color, e.gold ? 8 : 4);
      this.floaters.push({ x: e.x, y: e.y - 6, text: `+${e.text}`, color, life: 1.1, big: true });
    } else if (e.type === 'land') {
      burst(e.x, e.y, 3, 16, 0.35, '#8FD06A');
      this.collect(e.x, e.y, 'f', e.gold ? PAL.a : PAL.red, 2);
      this.floaters.push({ x: e.x, y: e.y - 4, text: `+${e.text}`, color: 'rgba(244,233,216,0.75)', life: 0.8 });
    } else if (e.type === 'link') {
      // dos árboles se unen por las raíces
      burst(e.x, e.y, 14, 30, 0.7, (k) => (k % 2 ? '#B48EF0' : '#FFF8E4'));
      this.floaters.push({ x: e.x, y: e.y - 6, text: `unión +${Math.round(e.amount * 100)}%`, color: '#D9C2FF', life: 1.3 });
    } else if (e.type === 'dead') {
      // raíz muerta absorbida: se ilumina en ámbar
      const d = e.d;
      this.eachChunk([d.x0, d.y0, d.x1, d.y1], 3, (gg, oy) => {
        gg.fillStyle = '#7A5A30';
        line(gg, d.x0, d.y0 - oy, d.x1, d.y1 - oy, 2);
        gg.fillStyle = '#E0B060';
        line(gg, d.x0, d.y0 - oy, d.x1, d.y1 - oy);
      });
      if (Math.random() < 0.5) this.fx.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 20, vy: -10 - Math.random() * 14, life: 0.5, color: '#FFE27A' });
    } else if (e.type === 'stump') {
      burst(e.x, e.y, 34, 50, 0.9, (k) => (k % 3 === 0 ? '#B6E35A' : k % 2 ? '#E0B060' : '#8A6A48'));
      this.floaters.push({ x: e.x, y: e.y - 10, text: `+${e.text}`, color: GROWTH_COL, life: 1.4, big: true });
      this.floaters.push({ x: e.x, y: e.y - 22, text: '+2 brotes', color: '#D2F7A0', life: 1.6, big: true });
      this.shake = 0.25;
    } else if (e.type === 'water') {
      burst(e.x, e.y, 10, 26, 0.6, (k) => (k % 2 ? '#7FD1E8' : '#E2FBFF'));
      this.floaters.push({ x: e.x, y: e.y - 6, text: `+${Math.round(e.amount * 100)}%`, color: '#9FE2F2', life: 1.2 });
    } else if (e.type === 'steal') {
      burst(e.x, e.y, 6, 20, 0.5, '#C93A64');
      this.floaters.push({ x: e.x, y: e.y - 4, text: 'zarza', color: '#FF8FA8', life: 0.9 });
    } else if (e.type === 'grow') {
      this.growFx = 0;
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

  /**
   * Cámara. Con raíces: sigue a la más honda que crece, y si caben todas, que se vean todas.
   * Al acabar: sube hasta ver entero el árbol más alto.
   */
  moveCamera(dt) {
    const run = this.run;
    let target = run.harvestCam;
    let speed = 4;
    if (run.phase === 'roots') {
      speed = 2.5;
      target = this.camTarget;
      if (run.tips.length) {
        let deep = -Infinity;
        let shallow = Infinity;
        for (const r of run.tips) { if (r.y > deep) deep = r.y; if (r.y < shallow) shallow = r.y; }
        target = deep - run.VH * 0.62;
        if (shallow - 16 < target && deep - shallow < run.VH - 40) target = shallow - 16;
      }
      target = Math.max(run.startCam, target);
      this.camTarget = target;
    }
    this.camY += (target - this.camY) * Math.min(1, dt * speed);
    this.camY = Math.max(0, this.camY);
    this.cam = Math.round(this.camY);
  }

  /** Árbol: brote mientras crecen las raíces; al acabar, crece hasta su tamaño. p: 0 → 1. */
  drawTree(g, tree, p, cam) {
    const run = this.run;
    const { soilTop } = run;
    const x = tree.x;
    // cuello de la raíz, bajo tierra
    g.fillStyle = BARK[0];
    g.fillRect(x - 2, soilTop - 1, 5, 3);
    g.fillStyle = BARK[1];
    g.fillRect(x - 1, soilTop - 1, 3, 4);
    if (p <= 0) {
      // brote
      const y = soilTop - 1 - cam;
      g.fillStyle = '#5FA14A';
      g.fillRect(x, y - 6, 1, 6);
      g.fillStyle = LEAF[3];
      g.fillRect(x - 3, y - 7, 3, 2);
      g.fillRect(x + 1, y - 9, 3, 2);
      g.fillStyle = LEAF[4];
      g.fillRect(x - 3, y - 7, 1, 1);
      g.fillRect(x + 3, y - 9, 1, 1);
      return;
    }
    const S = treeShape(tree.growth * ease(p), soilTop, x);
    const cy = S.cy - cam;
    const base = soilTop - cam;
    const tw = Math.max(2, Math.round(S.h / 12));
    const tx = x - Math.floor(tw / 2);
    // tronco con su luz a la izquierda y su sombra a la derecha, más ancho en la base
    g.fillStyle = BARK[1];
    g.fillRect(tx, cy, tw, base - cy);
    g.fillRect(tx - 1, base - 2, tw + 2, 2);
    g.fillStyle = BARK[2];
    g.fillRect(tx, cy, 1, base - cy);
    g.fillStyle = BARK[0];
    g.fillRect(tx + tw - 1, cy, 1, base - cy);
    // ramas hacia la copa
    g.fillStyle = BARK[1];
    const by = Math.round(cy + (base - cy) * 0.35);
    line(g, x, by, x - S.cr * 0.55, cy - S.cr * 0.2, Math.max(1, tw - 1));
    line(g, x, by + 2, x + S.cr * 0.6, cy - S.cr * 0.1, Math.max(1, tw - 1));
    // copa: manchas de hojas en tres tonos
    const blobs = this.crowns[tree.i];
    const R = S.cr;
    g.fillStyle = LEAF[0];
    for (const [bx, b2, br] of blobs) disc(g, x + bx * R, cy + b2 * R + 1, R * br);
    g.fillStyle = LEAF[2];
    for (const [bx, b2, br] of blobs) disc(g, x + bx * R, cy + b2 * R, R * br - 1);
    g.fillStyle = LEAF[3];
    for (const [bx, b2, br] of blobs) disc(g, x + bx * R - 1, cy + b2 * R - 1, Math.max(1, R * br * 0.55));
    // textura: matas de hojas en el borde (oscuras abajo, claras arriba) y brillos sueltos
    const rng = mulberry32((tree.i * 7919 + 13) >>> 0);
    for (const [bx, b2, br] of blobs) {
      const bxx = x + bx * R;
      const byy = cy + b2 * R;
      const rr = R * br;
      for (let q = 0; q < rr * 1.6; q++) {
        const a = rng() * Math.PI * 2;
        const d = rr * (0.75 + rng() * 0.3);
        const px = Math.round(bxx + Math.cos(a) * d);
        const py = Math.round(byy + Math.sin(a) * d);
        g.fillStyle = Math.sin(a) > 0.2 ? LEAF[1] : Math.sin(a) < -0.3 ? LEAF[3] : LEAF[2];
        g.fillRect(px, py, 2, 2);
      }
    }
    g.fillStyle = LEAF[4];
    for (const [bx, b2, br] of blobs) {
      g.fillRect(Math.round(x + bx * R - R * br * 0.4), Math.round(cy + b2 * R - R * br * 0.45), 2, 1);
      if (rng() < 0.7) g.fillRect(Math.round(x + bx * R + R * br * 0.1), Math.round(cy + b2 * R - R * br * 0.6), 1, 1);
    }
    g.fillStyle = LEAF[1];
    for (let q = 0; q < R * 0.8; q++) g.fillRect(Math.round(x + (rng() - 0.5) * R * 1.4), Math.round(cy + rng() * R * 0.6), 1, 1);
  }

  drawFruit(g, f, cam, t) {
    const run = this.run;
    let x = Math.round(f.x) - 2;
    const y = Math.round(f.y - cam) - 2;
    if (f.state === 'hang' && run.phaseT > f.drop - 0.45) x += Math.floor(t * 18) % 2 ? 1 : 0; // tiembla antes de caer
    const spr = f.gold ? bitmap(SPR.fruit, PAL.a, '#FFF8C0') : bitmap(SPR.fruit, PAL.red, '#FFB3C0');
    g.drawImage(spr, x, y);
    g.fillStyle = f.gold ? '#B8901A' : '#9E2A3E';
    g.fillRect(x + 1, y + 3, 2, 1);
    if (f.state !== 'land') {
      g.fillStyle = LEAF[3];
      g.fillRect(x + 2, y - 1, 1, 1);
    }
    if (f.gold && Math.floor(t * 4 + f.id) % 3 === 0) {
      g.fillStyle = '#FFF8E4';
      g.fillRect(x + 4, y - 1, 1, 1);
    }
  }

  draw(dt, pointer, settings) {
    const run = this.run;
    if (!run) return;
    this.time += dt;
    this.moveCamera(dt);
    const { g, buf, cam } = this;
    const { W, VH, soilTop } = run;
    const t = this.time;
    const k0 = Math.floor(cam / CH);
    const k1 = Math.floor((cam + VH - 1) / CH);
    const vis = (y, m = 8) => y > cam - m && y < cam + VH + m;
    const roots = run.phase === 'roots';

    // Raíces nuevas
    if (run.newSegs.length) {
      for (const n of run.newSegs) {
        if (!n.r.alive) continue; // ya se pintó entera como raíz vieja
        this.drawLiveSeg(n.s);
        this.recent.push({ s: n.s, t });
      }
      run.newSegs.length = 0;
      if (this.recent.length > 700) this.recent.splice(0, this.recent.length - 700);
    }

    // Zarzas nuevas: tallo granate con espinas
    if (run.newBramSegs.length) {
      for (const sg of run.newBramSegs) {
        this.eachChunk(sg, 2, (gg, oy) => {
          gg.fillStyle = '#2A0E1C';
          line(gg, sg[0] + 1, sg[1] + 1 - oy, sg[2] + 1, sg[3] + 1 - oy);
          gg.fillStyle = '#6A2440';
          line(gg, sg[0], sg[1] - oy, sg[2], sg[3] - oy, 2);
          if (Math.random() < 0.35) {
            gg.fillStyle = '#C93A64';
            const a = Math.atan2(sg[3] - sg[1], sg[2] - sg[0]) + (Math.random() < 0.5 ? 1.6 : -1.6);
            gg.fillRect(Math.round(sg[2] + Math.cos(a) * 2), Math.round(sg[3] - oy + Math.sin(a) * 2), 1, 1);
          }
        });
      }
      run.newBramSegs.length = 0;
    }

    // Fondo
    g.fillStyle = this.theme.layers[4][2];
    g.fillRect(0, 0, W, VH);
    for (let k = k0; k <= k1; k++) g.drawImage(this.chunkBg(k), 0, k * CH - cam);

    // Motas en la tierra
    const floorY = Math.max(soilTop + 2, cam);
    g.fillStyle = this.theme.mote;
    for (const a of this.ambient) {
      if (a.kind !== 'mote') continue;
      a.y -= a.v * dt;
      if (a.y < floorY || a.y > cam + VH) { a.y = a.y < floorY && a.y > cam - 4 ? cam + VH - 1 : floorY + Math.random() * Math.max(1, cam + VH - floorY); a.x = Math.random() * W; }
      g.fillRect(Math.round(a.x), Math.round(a.y - cam), 1, 1);
    }
    // Ribera: la corriente del agua subterránea
    g.fillStyle = '#3E7088';
    for (const a of this.ambient) {
      if (a.kind !== 'flow') continue;
      a.x += run.flow * run.st.current * 0.9 * dt;
      if (a.x < -4) a.x = W + 2;
      if (a.x > W + 4) a.x = -2;
      if (vis(a.y, 2)) g.fillRect(Math.round(a.x), Math.round(a.y - cam), a.len, 1);
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

    // Bosque viejo: la madera de los tocones bajo tierra (debajo de las raíces, para verlas entrar)
    if (cam < soilTop + 16) {
      for (const sp of run.stumps) {
        const y = soilTop - cam;
        g.fillStyle = sp.done ? '#1A1410' : '#5A4028';
        g.fillRect(sp.x, y + 1, sp.w, sp.h);
        g.fillStyle = sp.done ? '#3A2C20' : '#7A5A38';
        for (let q = 0; q < sp.h; q += 3) g.fillRect(sp.x + 1, y + 2 + q, sp.w - 2, 1);
      }
    }

    // Raíces: trozos ya dibujados y la estela reciente más clara
    for (let k = k0; k <= k1; k++) if (this.netC[k]) g.drawImage(this.netC[k].c, 0, k * CH - cam);
    g.fillStyle = ROOT.liveHi;
    const keep = [];
    for (const r of this.recent) {
      if (t - r.t > 0.5) continue;
      if (vis(r.s[3], 2)) line(g, r.s[0], r.s[1] - cam, r.s[2], r.s[3] - cam);
      keep.push(r);
    }
    this.recent = keep;

    // Bolsas de comida (las gordas, con un brote encima)
    for (let k = k0 - 1; k <= k1 + 1; k++) {
      for (const p of bucket(run, k).pockets) {
        if (!vis(p.y)) continue;
        const big = p.type === 'big';
        const spr = p.type === 'vein' ? bitmap(SPR.vein, '#5FCDE4', '#E2FBFF') : big ? bitmap(SPR.big, '#8FCB45', '#E2FBB0') : bitmap(SPR.n, PAL.n, '#FFC27A');
        const x = Math.round(p.x - spr.width / 2);
        const y = Math.round(p.y - cam - spr.height / 2);
        if (big) {
          // bolsa gorda: verde como los brotes, con un anillo que late
          g.fillStyle = Math.floor(t * 3 + p.x) % 2 ? 'rgba(182,227,90,0.55)' : 'rgba(182,227,90,0.25)';
          for (let q = 0; q < 12; q++) {
            const a = (q / 12) * Math.PI * 2;
            g.fillRect(Math.round(p.x + Math.cos(a) * 6), Math.round(p.y - cam + Math.sin(a) * 6), 1, 1);
          }
        }
        g.drawImage(spr, x, y);
        if (p.type === 'vein' && Math.floor(t * 2 + p.x * 0.7) % 5 === 0) {
          g.fillStyle = '#FFFFFF';
          g.fillRect(x + 2, y - 2, 1, 2);
          g.fillRect(x + 4, y + 1, 2, 1);
        }
        if (Math.floor(t * 1.5 + p.x * 0.37) % 6 === 0) { g.fillStyle = '#FFFFFF'; g.fillRect(x + 1, y + 1, 1, 1); }
      }
    }

    // Bosque viejo: tocones (encima de la tierra) y su madera bajo la superficie
    if (cam < soilTop + 16) {
      for (const sp of run.stumps) {
        const x = sp.x;
        const y = soilTop - cam;
        if (sp.done) {
          g.fillStyle = '#2A2018';
          g.fillRect(x + 1, y - 2, sp.w - 2, 2);
          g.fillStyle = '#4E8A3E';
          for (let q = 1; q < sp.w - 1; q += 3) g.fillRect(x + q, y - 3, 2, 1);
          continue;
        }
        // tronco cortado con sus anillos
        g.fillStyle = '#3A2818';
        g.fillRect(x - 2, y - 2, sp.w + 4, 3);
        g.fillStyle = '#4A3424';
        g.fillRect(x, y - 8, sp.w, 8);
        g.fillStyle = '#6A4A30';
        g.fillRect(x + 1, y - 8, 2, 8);
        g.fillStyle = '#8A6A48';
        g.fillRect(x, y - 8, sp.w, 1);
        g.fillStyle = '#A88A62';
        g.fillRect(x + 2, y - 8, sp.w - 4, 1);
        g.fillStyle = '#5E8A3A';
        g.fillRect(x + 1, y - 9, 3, 1);
        g.fillRect(x + sp.w - 5, y - 9, 2, 1);
        // cuánto falta para descomponerlo
        if (sp.prog > 0) {
          const f = Math.min(1, sp.prog / run.st.stumpNeed);
          g.fillStyle = PAL.ink;
          g.fillRect(x - 1, y - 13, sp.w + 2, 3);
          g.fillStyle = '#B6E35A';
          g.fillRect(x, y - 12, Math.max(1, Math.round(sp.w * f)), 1);
        }
      }
    }

    // Árboles: brote mientras crecen las raíces; al acabar, crecen
    const growP = run.phase === 'grow' ? Math.max(0, Math.min(1, (run.phaseT - 0.45) / (GROW_T - 0.55))) : roots ? 0 : 1;
    if (cam < soilTop + 6) {
      for (const tree of run.trees) this.drawTree(g, tree, growP, cam);
    }
    if (run.phase === 'grow' && growP > 0 && growP < 1 && Math.random() < 0.5) {
      for (const tree of run.trees) {
        const S = treeShape(tree.growth * ease(growP), soilTop, tree.x);
        const a = Math.random() * Math.PI * 2;
        this.fx.push({ x: tree.x + Math.cos(a) * S.cr, y: S.cy + Math.sin(a) * S.cr * 0.8, vx: Math.cos(a) * 20, vy: Math.sin(a) * 20 - 6, life: 0.6, color: Math.random() < 0.5 ? LEAF[4] : '#D2F7A0' });
      }
    }

    // Frutos
    if (run.phase === 'fruit' || run.ended) for (const f of run.fruits) if (f.state !== 'caught' && vis(f.y)) this.drawFruit(g, f, cam, t);

    // Zarzas: mata espinosa en la superficie y la cabeza que avanza
    for (const b of run.brambles) {
      if (vis(soilTop, 12)) {
        const bx = Math.round(b.segs.length ? b.segs[0][0] : b.x);
        const by = soilTop - cam;
        g.fillStyle = '#3A1A2A';
        disc(g, bx, by - 3, 3);
        g.fillStyle = '#6A2440';
        g.fillRect(bx - 2, by - 5, 1, 1);
        g.fillRect(bx + 2, by - 4, 1, 1);
        g.fillStyle = '#C93A64';
        g.fillRect(bx - 1, by - 6, 1, 1);
        g.fillRect(bx + 3, by - 3, 1, 1);
      }
      if (roots && vis(b.y)) {
        const x = Math.round(b.x);
        const y = Math.round(b.y - cam);
        g.fillStyle = '#9E2A4E';
        g.fillRect(x - 1, y - 1, 3, 3);
        g.fillStyle = Math.floor(t * 6) % 2 ? '#FF6B81' : '#C93A64';
        g.fillRect(x, y, 1, 1);
      }
    }

    // Puntas de las raíces que crecen: brillo que parpadea
    for (const r of run.tips) {
      if (!vis(r.y)) continue;
      const x = Math.round(r.x);
      const y = Math.round(r.y - cam);
      g.fillStyle = ROOT.live;
      g.fillRect(x - 1, y, 3, 1);
      g.fillRect(x, y - 1, 1, 3);
      g.fillStyle = '#FFFFFF';
      g.fillRect(x, y, 1, 1);
      if (Math.floor(t * 8 + x) % 2) {
        g.fillStyle = ROOT.liveHi;
        g.fillRect(x - 2, y, 1, 1);
        g.fillRect(x + 2, y, 1, 1);
      }
    }

    // Récord de profundidad: una línea discontinua
    const recY = soilTop + this.record - cam;
    const showRec = roots && this.record > 20 && recY > 2 && recY < VH - 2;
    if (showRec) {
      g.fillStyle = 'rgba(255,243,214,0.55)';
      for (let x = (Math.floor(t * 6) % 6); x < W; x += 6) g.fillRect(x, recY, 3, 1);
    }

    // Luciérnagas en el cielo
    for (const a of this.ambient) {
      if (a.kind !== 'fly') continue;
      a.x += Math.sin(t * 0.7 + a.ph) * 6 * dt;
      a.y += Math.cos(t * 0.9 + a.ph) * 3 * dt;
      const y = Math.round(Math.min(soilTop - 4, a.y)) - cam;
      if (y >= 0 && y < VH && Math.sin(t * 2 + a.ph * 3) > 0.2) {
        g.fillStyle = '#FFE27A';
        g.fillRect(Math.round(a.x), y, 1, 1);
      }
    }

    // Puntero: con raíces, un brote y su alcance bajo tierra; en la cosecha, la cesta y su radio
    if (pointer && !run.ended) {
      const px = Math.round(pointer.x);
      const py = Math.round(pointer.y - cam);
      if (px >= -4 && px < W + 4 && py >= -4 && py < VH + 4) {
        const ring = (R, col, speed) => {
          const n = Math.max(14, Math.round(R * 1.1));
          g.fillStyle = col;
          for (let k = 0; k < n; k += 2) {
            const a = t * speed + (k / n) * Math.PI * 2;
            g.fillRect(Math.round(px + Math.cos(a) * R), Math.round(py + Math.sin(a) * R), 1, 1);
          }
        };
        if (roots) {
          if (pointer.y >= soilTop - 4) ring(run.st.attract, 'rgba(255,243,214,0.45)', 0.6);
          // brote: tallo, dos hojas y una luz en el punto exacto
          g.fillStyle = PAL.ink;
          g.fillRect(px - 3, py - 5, 7, 2);
          g.fillRect(px - 1, py - 3, 3, 5);
          g.fillStyle = '#5FA155';
          g.fillRect(px, py - 3, 1, 3);
          g.fillStyle = '#B6E35A';
          g.fillRect(px - 2, py - 4, 2, 1);
          g.fillRect(px + 1, py - 5, 2, 1);
          g.fillStyle = '#FFF8E4';
          g.fillRect(px, py, 1, 1);
          g.fillStyle = ROOT.live;
          g.fillRect(px - 1, py + 1, 3, 1);
        } else {
          ring(run.st.catchR, 'rgba(255,243,214,0.85)', 2);
          // cesta de mimbre
          const bx = px - 4;
          const by = py - 1;
          g.fillStyle = PAL.ink;
          g.fillRect(bx - 1, by - 1, 11, 7);
          g.fillStyle = BARK[2];
          g.fillRect(bx, by, 9, 1);
          g.fillRect(bx, by + 1, 1, 1);
          g.fillRect(bx + 8, by + 1, 1, 1);
          g.fillRect(bx, by + 2, 9, 1);
          g.fillStyle = '#C98A52';
          for (let q = 0; q < 9; q += 2) g.fillRect(bx + q, by + 3, 1, 1);
          g.fillRect(bx + 1, by + 4, 7, 1);
          g.fillStyle = BARK[1];
          for (let q = 1; q < 9; q += 2) g.fillRect(bx + q, by + 3, 1, 1);
          g.fillRect(bx + 1, by + 5, 7, 0);
        }
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

    // Textos flotantes con la fuente pixel
    for (const f of this.floaters) {
      f.life -= dt;
      const rise = (1 - Math.max(0, f.life)) * 12;
      text(f.text, Math.round(this.ox + f.x * s), Math.round(this.oy + (f.y - cam - rise) * s), f.big ? 30 : 22, f.color, 'center', Math.max(0, Math.min(1, f.life * 2)));
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);

    // Cartel
    if (this.banner) {
      const b = this.banner;
      b.life -= dt;
      const a = Math.max(0, Math.min(1, b.life * 1.5, (2.4 - b.life) * 4));
      const y = Math.round(this.ch * 0.32);
      const k = Math.min(1, this.cw / 560); // en pantallas estrechas, más pequeño
      text(b.title, Math.round(this.cw / 2), y, Math.round(46 * Math.max(0.7, k)), '#FFF3D6', 'center', a);
      if (b.sub) text(b.sub, Math.round(this.cw / 2), y + Math.round(32 * Math.max(0.7, k)), Math.round(26 * Math.max(0.8, k)), '#F4D58D', 'center', a);
      if (b.life <= 0) this.banner = null;
    }
  }
}
