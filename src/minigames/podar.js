// Minijuego Podar: en la copa salen ramas secas que tiemblan y caen. Haz clic (o toca) en ellas
// antes de que caigan: cada rama cortada da frutos al momento.

import { openMinigame } from './common.js';
import { sfx } from '../audio.js';
import { fmt } from '../format.js';

const BASE_H = 90; // alto del mundo pixel; el ancho se ajusta al escenario
const SPAWN = 0.6; // s entre ramas
const LIFE = 2.1; // s que aguanta una rama antes de caer (tiembla en el último tramo)

const SKY = ['#120D22', '#1A1430', '#251A3D', '#3A2350', '#5A2E5E'];
const LEAF = ['#1F4A2A', '#2E6A3A', '#3E8A4A', '#5FA155', '#8FD06A'];

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
    g.fillRect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), w, w);
  }
}

/** Fondo fijo: cielo, un árbol grande con su copa y la hierba. */
function paintScene(W0, H0) {
  const c = document.createElement('canvas');
  c.width = W0;
  c.height = H0;
  const g = c.getContext('2d');
  for (let y = 0; y < H0; y++) {
    g.fillStyle = SKY[Math.min(SKY.length - 1, Math.floor((y / H0) * SKY.length))];
    g.fillRect(0, y, W0, 1);
  }
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let k = 0; k < W0 / 3; k++) {
    g.fillStyle = k % 3 ? '#7A6A9A' : '#F4E9D8';
    g.fillRect(Math.floor(rnd() * W0), Math.floor(rnd() * H0 * 0.45), 1, 1);
  }
  const crown = { x: Math.round(W0 / 2), y: Math.round(H0 * 0.48), r: Math.round(Math.min(W0 * 0.22, H0 * 0.34)) };
  g.fillStyle = '#6A4630';
  g.fillRect(crown.x - 3, crown.y, 6, H0 - crown.y);
  g.fillStyle = '#8E6240';
  g.fillRect(crown.x - 3, crown.y, 2, H0 - crown.y);
  g.fillStyle = LEAF[0];
  disc(g, crown.x, crown.y + 1, crown.r);
  g.fillStyle = LEAF[2];
  disc(g, crown.x, crown.y, crown.r - 1);
  g.fillStyle = LEAF[3];
  disc(g, crown.x - 4, crown.y - 5, Math.round(crown.r * 0.55));
  g.fillStyle = LEAF[4];
  for (let k = 0; k < crown.r; k++) g.fillRect(Math.round(crown.x + (rnd() - 0.6) * crown.r * 1.2), Math.round(crown.y + (rnd() - 0.7) * crown.r), 2, 1);
  g.fillStyle = '#3E7A3A';
  g.fillRect(0, H0 - 4, W0, 4);
  g.fillStyle = '#5FA14A';
  g.fillRect(0, H0 - 4, W0, 1);
  return { c, crown };
}

/** per: frutos por rama cortada. Resuelve con { cut, fruits }. */
export function playPodar({ time = 8, per = 1 } = {}) {
  const mg = openMinigame({
    title: 'Podar',
    intro: `En la copa salen ramas secas que tiemblan y caen. Haz clic (o toca) en ellas antes de que caigan: cada una da ${fmt(per, { decimals: per < 10 ? 1 : 0 })} frutos al momento.`,
  });
  mg.canvas.style.cursor = 'none';

  return new Promise((resolve) => {
    let dims = mg.size();
    const S = Math.max(1, Math.floor(dims.h / BASE_H));
    const W0 = Math.ceil(dims.w / S);
    const H0 = Math.ceil(dims.h / S);
    const scene = paintScene(W0, H0);
    const { crown } = scene;
    const buf = document.createElement('canvas');
    buf.width = W0;
    buf.height = H0;
    const b = buf.getContext('2d');
    const branches = [];
    const sparks = [];
    const floats = [];
    let pointer = null;
    let t = 0;
    let spawnT = 0;
    let cut = 0;
    let raf = 0;
    let last = 0;
    let running = false;
    let done = false;
    let view = { s: S, ox: 0, oy: 0 };
    const layout = () => { view = { s: S, ox: Math.round((dims.w - W0 * S) / 2), oy: Math.round((dims.h - H0 * S) / 2) }; };
    layout();

    // Una rama seca nace en el borde de la copa y apunta hacia fuera
    const spawn = () => {
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI * (0.05 + 0.9 * Math.random()) + (Math.random() < 0.3 ? Math.PI * 0.75 * (Math.random() < 0.5 ? -1 : 1) : 0);
        const x0 = crown.x + Math.cos(a) * crown.r * 0.75;
        const y0 = crown.y + Math.sin(a) * crown.r * 0.7;
        if (branches.some((br) => br.state === 'on' && (br.x0 - x0) ** 2 + (br.y0 - y0) ** 2 < 100)) continue;
        const len = 7 + Math.random() * 5;
        branches.push({ x0, y0, a, len, age: 0, state: 'on', vy: 0, dy: 0 });
        return;
      }
    };
    const tipOf = (br) => ({ x: br.x0 + Math.cos(br.a) * br.len, y: br.y0 + Math.sin(br.a) * br.len });

    const toWorld = (e) => {
      const r = mg.canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left - view.ox) / view.s, y: (e.clientY - r.top - view.oy) / view.s };
    };
    const onMove = (e) => { pointer = toWorld(e); };
    const onDown = (e) => {
      e.preventDefault();
      pointer = toWorld(e);
      if (!running) return;
      // corta la rama más cercana al clic (a lo largo de toda la rama)
      let best = null;
      let bd = 7 * 7;
      for (const br of branches) {
        if (br.state !== 'on') continue;
        for (let q = 0.2; q <= 1.001; q += 0.2) {
          const x = br.x0 + Math.cos(br.a) * br.len * q;
          const y = br.y0 + Math.sin(br.a) * br.len * q;
          const d = (x - pointer.x) ** 2 + (y - pointer.y) ** 2;
          if (d < bd) { bd = d; best = br; }
        }
      }
      if (!best) { sfx.deny(); return; }
      best.state = 'cut';
      cut += 1;
      sfx.buy();
      const tip = tipOf(best);
      for (let k = 0; k < 10; k++) {
        const a = Math.random() * Math.PI * 2;
        sparks.push({ x: tip.x, y: tip.y, vx: Math.cos(a) * 24, vy: Math.sin(a) * 24, life: 0.5, c: k % 2 ? '#E4405F' : '#FFF3D6' });
      }
      floats.push({ x: tip.x, y: tip.y - 3, text: `+${fmt(per, { decimals: per < 10 ? 1 : 0 })}`, life: 0.9 });
    };
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
    mg.skip.addEventListener('click', () => finish({ cut, fruits: cut * per }));

    const draw = () => {
      b.drawImage(scene.c, 0, 0);
      for (const br of branches) {
        if (br.state === 'gone' || br.state === 'cut') continue;
        let sx = 0;
        if (br.state === 'on' && br.age > LIFE * 0.55) sx = Math.floor(t * 20) % 2 ? 1 : -1; // tiembla antes de caer
        const tip = tipOf(br);
        b.fillStyle = '#4A3A2E';
        line(b, br.x0 + sx + 1, br.y0 + br.dy + 1, tip.x + sx + 1, tip.y + br.dy + 1, 2);
        b.fillStyle = br.state === 'fall' ? '#5A4A3A' : '#8A7A62';
        line(b, br.x0 + sx, br.y0 + br.dy, tip.x + sx, tip.y + br.dy, 2);
        b.fillStyle = '#B0A088';
        line(b, tip.x + sx, tip.y + br.dy, tip.x + sx + Math.cos(br.a - 0.8) * 3, tip.y + br.dy + Math.sin(br.a - 0.8) * 3);
      }
      for (const s of sparks) {
        b.fillStyle = s.c;
        b.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
      }
      // tijeras en el puntero
      if (pointer) {
        const x = Math.round(pointer.x);
        const y = Math.round(pointer.y);
        b.fillStyle = '#140F1C';
        b.fillRect(x - 3, y - 3, 7, 7);
        b.fillStyle = '#D6D6E2';
        b.fillRect(x - 2, y - 2, 1, 1); b.fillRect(x + 2, y - 2, 1, 1);
        b.fillRect(x - 1, y - 1, 1, 1); b.fillRect(x + 1, y - 1, 1, 1);
        b.fillRect(x, y, 1, 1);
        b.fillStyle = '#E4405F';
        b.fillRect(x - 2, y + 2, 2, 1); b.fillRect(x + 1, y + 2, 2, 1);
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
      for (const f of floats) txt(f.text, view.ox + f.x * view.s, view.oy + f.y * view.s - (0.9 - f.life) * 20, 'center', '#FF6B81');
      txt(`${Math.max(0, Math.ceil(time - t))} s`, 12, 24, 'left', '#F4D58D');
      txt(`Cortadas ${cut} · +${fmt(cut * per)} frutos`, dims.w - 12, 24, 'right', '#FF6B81');
    };

    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      spawnT -= dt;
      if (spawnT <= 0 && t < time - 0.8) { spawnT = SPAWN; spawn(); }
      for (const br of branches) {
        if (br.state === 'on') {
          br.age += dt;
          if (br.age > LIFE) br.state = 'fall';
        } else if (br.state === 'fall') {
          br.vy += 120 * dt;
          br.dy += br.vy * dt;
          if (br.y0 + br.dy > H0) br.state = 'gone';
        }
      }
      for (const s of sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.9; s.vy *= 0.9; s.life -= dt; }
      for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life <= 0) sparks.splice(i, 1);
      for (const f of floats) f.life -= dt;
      for (let i = floats.length - 1; i >= 0; i--) if (floats[i].life <= 0) floats.splice(i, 1);
      draw();
      if (t >= time) {
        running = false;
        sfx.achievement();
        const fruits = cut * per;
        mg.message(cut
          ? `<div class="mg-big">+${fmt(fruits)}</div><p>Has cortado <b>${cut} ${cut === 1 ? 'rama' : 'ramas'}</b>: tus árboles te dan esos frutos ahora mismo.</p>`
          : '<p>No has cortado ninguna rama. Podrás volver a podar dentro de unas temporadas.</p>', 'Recoger')
          .then(() => finish({ cut, fruits }));
        return;
      }
      if (running) raf = requestAnimationFrame(loop);
    };

    draw();
    mg.message('<p>Las ramas secas tiemblan justo antes de caer. ¡Córtalas antes!</p>', 'Empezar').then(() => {
      dims = mg.size();
      layout();
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    });
  });
}
