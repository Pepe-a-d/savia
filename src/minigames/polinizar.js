// Minijuego Polinizar: guía una abeja con el puntero por las flores que se abren en las copas.
// Cada flor tocada antes de que se cierre da más frutos en la próxima temporada.

import { openMinigame } from './common.js';
import { sfx } from '../audio.js';

const BASE_H = 90; // alto del mundo pixel del minijuego; el ancho se ajusta al escenario
const SPAWN = 0.55; // s entre flores
const BEE_SPEED = 85; // px/s

const SKY = ['#120D22', '#1A1430', '#251A3D', '#3A2350', '#5A2E5E'];
const LEAF = ['#1F4A2A', '#2E6A3A', '#3E8A4A', '#5FA155', '#8FD06A'];

function disc(g, cx, cy, r) {
  r = Math.round(r);
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(Math.max(0, r * r - y * y + r * 0.6)));
    g.fillRect(Math.round(cx) - w, Math.round(cy) + y, w * 2 + 1, 1);
  }
}

/** Fondo fijo: cielo, estrellas, copas de los árboles y la hierba. Devuelve también las copas. */
function paintScene(trees, W0, H0) {
  const c = document.createElement('canvas');
  c.width = W0;
  c.height = H0;
  const g = c.getContext('2d');
  for (let y = 0; y < H0; y++) {
    g.fillStyle = SKY[Math.min(SKY.length - 1, Math.floor((y / H0) * SKY.length))];
    g.fillRect(0, y, W0, 1);
  }
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let k = 0; k < W0 / 3; k++) {
    g.fillStyle = k % 3 ? '#7A6A9A' : '#F4E9D8';
    g.fillRect(Math.floor(rnd() * W0), Math.floor(rnd() * H0 * 0.5), 1, 1);
  }
  const crowns = [];
  const n = Math.max(1, Math.min(4, trees));
  for (let i = 0; i < n; i++) {
    const x = Math.round((W0 * (i + 1)) / (n + 1));
    const r = Math.max(10, Math.min(20, Math.round((W0 / (n + 1)) * 0.42)));
    const y = Math.round(H0 * 0.62) - (i % 2) * 4;
    g.fillStyle = '#6A4630';
    g.fillRect(x - 2, y, 4, H0 - y);
    g.fillStyle = '#8E6240';
    g.fillRect(x - 2, y, 1, H0 - y);
    g.fillStyle = LEAF[0];
    disc(g, x, y + 1, r);
    g.fillStyle = LEAF[2];
    disc(g, x, y, r - 1);
    g.fillStyle = LEAF[3];
    disc(g, x - 3, y - 4, Math.round(r * 0.55));
    g.fillStyle = LEAF[4];
    g.fillRect(x - 6, y - r + 4, 3, 1);
    crowns.push({ x, y, r });
  }
  g.fillStyle = '#3E7A3A';
  g.fillRect(0, H0 - 4, W0, 4);
  g.fillStyle = '#5FA14A';
  g.fillRect(0, H0 - 4, W0, 1);
  return { c, crowns };
}

export function playPolinizar({ time = 10, per = 0.05, trees = 1 } = {}) {
  const mg = openMinigame({
    title: 'Polinizar',
    intro: `Guía la abeja con el ratón (o el dedo) por las flores rosas antes de que se cierren. Cada flor: +${Math.round(per * 100)}% de frutos en la próxima temporada.`,
  });
  mg.canvas.style.cursor = 'none';

  return new Promise((resolve) => {
    let dims = mg.size();
    // mundo pixel con zoom entero que llena el escenario
    const S = Math.max(1, Math.floor(dims.h / BASE_H));
    const W0 = Math.ceil(dims.w / S);
    const H0 = Math.ceil(dims.h / S);
    const scene = paintScene(trees, W0, H0);
    const buf = document.createElement('canvas');
    buf.width = W0;
    buf.height = H0;
    const b = buf.getContext('2d');
    const flowers = [];
    const sparks = [];
    const bee = { x: W0 / 2, y: H0 * 0.3 };
    let target = null;
    let t = 0;
    let spawnT = 0;
    let count = 0;
    let raf = 0;
    let last = 0;
    let running = false;
    let done = false;
    let view = { s: S, ox: 0, oy: 0 };

    const layout = () => {
      const s = S;
      view = { s, ox: Math.round((dims.w - W0 * s) / 2), oy: Math.round((dims.h - H0 * s) / 2) };
    };
    layout();
    const mult = () => 1 + count * per;

    const spawn = () => {
      const cr = scene.crowns[Math.floor(Math.random() * scene.crowns.length)];
      for (let k = 0; k < 10; k++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * (cr.r - 3);
        const x = Math.round(cr.x + Math.cos(a) * d);
        const y = Math.round(cr.y + Math.sin(a) * d * 0.85);
        if (flowers.every((f) => f.state === 'gone' || (f.x - x) ** 2 + (f.y - y) ** 2 > 36)) {
          flowers.push({ x, y, age: 0, life: 2.2 + Math.random() * 0.9, state: 'bud' });
          return;
        }
      }
    };

    const toWorld = (e) => {
      const r = mg.canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left - view.ox) / view.s, y: (e.clientY - r.top - view.oy) / view.s };
    };
    const onMove = (e) => { if (e.pointerType === 'mouse' || e.buttons) target = toWorld(e); };
    const onDown = (e) => { e.preventDefault(); target = toWorld(e); mg.canvas.setPointerCapture?.(e.pointerId); };
    mg.canvas.addEventListener('pointermove', onMove);
    mg.canvas.addEventListener('pointerdown', onDown);
    const onResize = () => { dims = mg.size(); layout(); };
    window.addEventListener('resize', onResize);

    const finish = (result) => {
      if (done) return;
      done = true;
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      mg.close();
      resolve(result);
    };
    mg.skip.addEventListener('click', () => finish({ flowers: count }));

    const draw = () => {
      b.drawImage(scene.c, 0, 0);
      // flores: capullo, abierta (rosa con centro amarillo), polinizada (destello) y cerrándose
      for (const f of flowers) {
        if (f.state === 'gone') continue;
        if (f.state === 'bud') {
          b.fillStyle = '#C06A90';
          b.fillRect(f.x, f.y, 1, 1);
        } else if (f.state === 'open') {
          const closing = f.life - f.age < 0.6 && Math.floor(t * 10) % 2;
          b.fillStyle = closing ? '#C06A90' : '#F49AC2';
          b.fillRect(f.x - 1, f.y, 3, 1);
          b.fillRect(f.x, f.y - 1, 1, 3);
          b.fillStyle = '#FFD23F';
          b.fillRect(f.x, f.y, 1, 1);
        } else if (f.state === 'done') {
          b.fillStyle = '#FFF3D6';
          b.fillRect(f.x, f.y, 1, 1);
        }
      }
      for (const s of sparks) {
        b.fillStyle = s.c;
        b.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
      }
      // abeja: cuerpo a rayas, alas que aletean y aguijón
      const x = Math.round(bee.x) - 3;
      const y = Math.round(bee.y) - 2;
      const flap = Math.floor(t * 20) % 2;
      b.fillStyle = '#E6F1FB';
      b.fillRect(x + 1, y - 1 - flap, 2, 1 + flap);
      b.fillRect(x + 3, y - 1 - flap, 2, 1 + flap);
      b.fillStyle = '#140F1C';
      b.fillRect(x, y, 6, 3);
      b.fillStyle = '#FFD23F';
      b.fillRect(x + 1, y, 1, 3);
      b.fillRect(x + 3, y, 1, 3);
      b.fillStyle = '#FFF3D6';
      b.fillRect(x + 5, y + 1, 1, 1);
      // a dónde va (el puntero)
      if (target) {
        b.fillStyle = 'rgba(255,243,214,0.6)';
        b.fillRect(Math.round(target.x), Math.round(target.y), 1, 1);
      }

      const g = mg.ctx;
      g.fillStyle = '#140F1C';
      g.fillRect(0, 0, dims.w, dims.h);
      g.imageSmoothingEnabled = false;
      g.drawImage(buf, view.ox, view.oy, W0 * view.s, H0 * view.s);
      g.font = '20px "Jersey 15", monospace';
      const txt = (str, tx, ty, align, color) => {
        g.textAlign = align;
        g.fillStyle = '#140F1C';
        g.fillText(str, tx + 2, ty + 2);
        g.fillStyle = color;
        g.fillText(str, tx, ty);
      };
      txt(`${Math.max(0, Math.ceil(time - t))} s`, 12, 24, 'left', '#F4D58D');
      txt(`Flores ${count} · frutos ×${mult().toFixed(2).replace('.', ',')}`, dims.w - 12, 24, 'right', '#F49AC2');
    };

    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      // flores nuevas mientras quede tiempo
      spawnT -= dt;
      if (spawnT <= 0 && t < time - 0.6) { spawnT = SPAWN; spawn(); }
      for (const f of flowers) {
        if (f.state === 'gone' || f.state === 'done') continue;
        f.age += dt;
        if (f.state === 'bud' && f.age > 0.35) f.state = 'open';
        if (f.age > f.life) f.state = 'gone';
      }
      // la abeja vuela hacia el puntero, con velocidad máxima
      if (target) {
        const dx = target.x - bee.x;
        const dy = target.y - bee.y;
        const d = Math.hypot(dx, dy);
        const step = Math.min(d, BEE_SPEED * dt);
        if (d > 0.01) { bee.x += (dx / d) * step; bee.y += (dy / d) * step; }
      } else {
        bee.x += Math.sin(t * 2) * 6 * dt;
        bee.y += Math.cos(t * 3) * 4 * dt;
      }
      for (const f of flowers) {
        if (f.state !== 'open' || (f.x - bee.x) ** 2 + (f.y - bee.y) ** 2 > 25) continue;
        f.state = 'done';
        count += 1;
        sfx.click();
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          sparks.push({ x: f.x, y: f.y, vx: Math.cos(a) * 18, vy: Math.sin(a) * 18, life: 0.5, c: k % 2 ? '#FFD23F' : '#F49AC2' });
        }
      }
      for (const s of sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.9; s.vy *= 0.9; s.life -= dt; }
      for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life <= 0) sparks.splice(i, 1);
      draw();
      if (t >= time) {
        running = false;
        sfx.achievement();
        const m = mult();
        mg.message(`<div class="mg-big">frutos ×${m.toFixed(2).replace('.', ',')}</div>${count ? `<p>Has polinizado <b>${count} ${count === 1 ? 'flor' : 'flores'}</b>. En la próxima temporada tus árboles darán más frutos.</p>` : '<p>No has llegado a ninguna flor. Podrás volver a intentarlo dentro de unas temporadas.</p>'}`, 'Volver')
          .then(() => finish({ flowers: count }));
        return;
      }
      if (running) raf = requestAnimationFrame(loop);
    };

    draw();
    mg.message('<p>Las flores se abren en las copas y se cierran al poco. Llévales la abeja.</p>', 'Empezar').then(() => {
      dims = mg.size();
      layout();
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    });
  });
}
