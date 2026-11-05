// Escena final: en el centro del bosque crece el árbol madre, con luces que suben al cielo.
// Al acabar enseña las estadísticas de la partida y el botón para empezar de nuevo.

import { fmt, fmtTime } from './format.js';
import { sfx } from './audio.js';

const SKY = ['#0A0816', '#100C22', '#18122E', '#22183A', '#2E1E44', '#3A2650'];
const LEAF = ['#173A22', '#2E6A3A', '#3E8A4A', '#5FA155', '#8FD06A'];

function disc(g, cx, cy, r) {
  r = Math.round(r);
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(Math.max(0, r * r - y * y + r * 0.6)));
    g.fillRect(Math.round(cx) - w, Math.round(cy) + y, w * 2 + 1, 1);
  }
}

function line(g, x0, y0, x1, y1, w = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    g.fillRect(Math.round(x0 + (x1 - x0) * t - w / 2), Math.round(y0 + (y1 - y0) * t), w, w);
  }
}

const ease = (p) => 1 - (1 - Math.max(0, Math.min(1, p))) ** 3;

/** stats: { time, seasons, fruits, trees, legacy }. Resuelve al pulsar «Empezar de nuevo». */
export function playEnding(stats) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'ending';
    wrap.innerHTML = `
      <canvas></canvas>
      <div class="ending-text">
        <h1>El árbol madre</h1>
        <p class="ending-sub">Tu bosque es ya un bosque antiguo.</p>
        <p class="ending-stats"></p>
      </div>
      <div class="ending-btn"><button type="button" class="px-btn big"></button></div>`;
    document.body.append(wrap);
    const canvas = wrap.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const text = wrap.querySelector('.ending-text');
    const btnBox = wrap.querySelector('.ending-btn');
    const next = 2 ** (stats.legacy + 1);
    wrap.querySelector('.ending-stats').innerHTML = `${fmtTime(stats.time)} de juego · ${stats.seasons} temporadas · ${fmt(stats.fruits)} frutos`;
    const btn = wrap.querySelector('button');
    btn.textContent = `Empezar de nuevo (frutos ×${next} para siempre)`;

    let W0 = 0;
    let H0 = 0;
    let S = 2;
    let buf = null;
    let b = null;
    let stars = [];
    let lights = [];
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(innerWidth * dpr);
      canvas.height = Math.round(innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      S = Math.max(2, Math.floor(Math.min(innerWidth, innerHeight) / 180));
      W0 = Math.ceil(innerWidth / S);
      H0 = Math.ceil(innerHeight / S);
      buf = document.createElement('canvas');
      buf.width = W0;
      buf.height = H0;
      b = buf.getContext('2d');
      stars = Array.from({ length: Math.round(W0 / 3) }, () => ({ x: Math.random() * W0, y: Math.random() * H0 * 0.55, p: Math.random() * 6 }));
    };
    size();
    window.addEventListener('resize', size);

    // árboles pequeños alrededor (tu bosque) y el árbol madre en el centro
    const around = Array.from({ length: 6 }, (_, i) => ({ f: [0.12, 0.24, 0.36, 0.64, 0.76, 0.88][i], h: 0.1 + Math.random() * 0.05 }));
    let t = 0;
    let last = performance.now();
    let raf = 0;
    let shown = false;

    const draw = () => {
      const ground = Math.round(H0 * 0.8);
      for (let y = 0; y < ground; y++) {
        b.fillStyle = SKY[Math.min(SKY.length - 1, Math.floor((y / ground) * SKY.length))];
        b.fillRect(0, y, W0, 1);
      }
      for (const s of stars) {
        b.fillStyle = Math.sin(t * 2 + s.p) > 0.6 ? '#F4E9D8' : '#7A6A9A';
        b.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
      }
      b.fillStyle = '#1E1A16';
      b.fillRect(0, ground, W0, H0 - ground);
      b.fillStyle = '#3E7A3A';
      b.fillRect(0, ground, W0, 2);

      for (const a of around) {
        const x = Math.round(W0 * a.f);
        const h = Math.round(H0 * a.h * ease(t / 2));
        const r = Math.round(h * 0.6) + 2;
        b.fillStyle = '#5A3C26';
        b.fillRect(x - 1, ground - h, 3, h);
        b.fillStyle = LEAF[0];
        disc(b, x, ground - h - r * 0.4, r);
        b.fillStyle = LEAF[2];
        disc(b, x, ground - h - r * 0.4 - 1, r - 1);
      }

      // el árbol madre crece entre el segundo 0,8 y el 5
      const p = ease((t - 0.8) / 4.2);
      const cx = Math.round(W0 / 2);
      const trunkH = Math.round(H0 * 0.24 * p);
      const tw = Math.max(2, Math.round(12 * p));
      const cr = Math.round(Math.min(W0 * 0.24, H0 * 0.2) * p);
      // raíces bajo tierra
      b.fillStyle = '#6A4630';
      for (let k = 0; k < 6; k++) {
        const a = Math.PI * (0.15 + 0.7 * (k / 5));
        line(b, cx, ground + 1, cx + Math.cos(a) * W0 * 0.3 * p, ground + 1 + Math.sin(a) * (H0 - ground) * 0.9 * p, Math.max(1, Math.round(3 * p)));
      }
      if (p > 0) {
        b.fillStyle = '#4A2E20';
        b.fillRect(cx - Math.floor(tw / 2), ground - trunkH, tw, trunkH + 1);
        b.fillRect(cx - tw, ground - 3, tw * 2, 4);
        b.fillStyle = '#6A4630';
        b.fillRect(cx - Math.floor(tw / 2), ground - trunkH, Math.max(1, Math.floor(tw / 3)), trunkH);
        const cy = ground - trunkH - Math.round(cr * 0.45);
        line(b, cx, ground - trunkH * 0.6, cx - cr * 0.7, cy, Math.max(1, Math.round(tw / 3)));
        line(b, cx, ground - trunkH * 0.7, cx + cr * 0.75, cy - cr * 0.1, Math.max(1, Math.round(tw / 3)));
        const blobs = [[0, 0, 1], [-0.6, 0.2, 0.7], [0.6, 0.2, 0.7], [-0.35, -0.45, 0.7], [0.35, -0.45, 0.65], [0, -0.6, 0.55]];
        for (let layer = 0; layer < 3; layer++) {
          b.fillStyle = [LEAF[0], LEAF[2], LEAF[3]][layer];
          for (const [bx, by, br] of blobs) disc(b, cx + bx * cr - layer, cy + by * cr - layer, Math.max(1, cr * br * [1, 0.88, 0.5][layer]));
        }
        // luces en la copa que se sueltan y suben
        if (Math.random() < 0.5 * p) lights.push({ x: cx + (Math.random() - 0.5) * cr * 1.6, y: cy + (Math.random() - 0.5) * cr, v: 6 + Math.random() * 10, ph: Math.random() * 6, life: 4 + Math.random() * 3 });
      }
      for (const l of lights) {
        b.fillStyle = Math.sin(t * 5 + l.ph) > 0 ? '#FFE27A' : '#B6E35A';
        b.fillRect(Math.round(l.x + Math.sin(t + l.ph) * 2), Math.round(l.y), 1, 1);
      }

      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#140F1C';
      ctx.fillRect(0, 0, innerWidth, innerHeight);
      ctx.drawImage(buf, 0, 0, W0 * S, H0 * S);
    };

    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      for (const l of lights) { l.y -= l.v * dt; l.life -= dt; }
      lights = lights.filter((l) => l.life > 0 && l.y > -2);
      draw();
      if (!shown && t > 3.2) { shown = true; text.classList.add('on'); btnBox.classList.add('on'); sfx.prestige(); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    btn.addEventListener('click', () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
      wrap.classList.add('out');
      setTimeout(() => wrap.remove(), 300);
      resolve();
    });
  });
}
