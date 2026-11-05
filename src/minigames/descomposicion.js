// Minijuego de Descomposición: caen moléculas de madera y hay que darle a cada una su enzima.
// Resultado: multiplicador del botín del tronco, de ×1 a ×3.

import { openMinigame, fmtMult } from './common.js';
import { sfx } from '../audio.js';

const TYPES = [
  { id: 'celulosa', name: 'Celulosa', enzyme: 'Celulasa', color: '#9fd88a', keys: ['1', 'a', 'arrowleft'] },
  { id: 'lignina', name: 'Lignina', enzyme: 'Ligninasa', color: '#e0a65c', keys: ['2', 's', 'arrowdown'] },
  { id: 'quitina', name: 'Quitina', enzyme: 'Quitinasa', color: '#9cc8f0', keys: ['3', 'd', 'arrowright'] },
];
const DURATION = 25;

function hexagon(g, x, y, r) {
  g.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 3) * k + Math.PI / 6;
    if (k === 0) g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  g.closePath();
}

/** Dibuja la molécula de cada tipo con una forma distinta (no solo color). */
function drawMolecule(g, type, x, y, s = 1) {
  const T = TYPES[type];
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.lineWidth = 2.2;
  g.strokeStyle = T.color;
  g.fillStyle = `${T.color}33`;
  if (type === 0) {
    // celulosa: cadena de anillos
    for (const dx of [-16, 0, 16]) { hexagon(g, dx, 0, 8); g.fill(); g.stroke(); }
  } else if (type === 1) {
    // lignina: racimo irregular
    for (const [dx, dy] of [[-9, 4], [6, 6], [0, -8], [12, -6]]) { g.beginPath(); g.arc(dx, dy, 7, 0, Math.PI * 2); g.fill(); g.stroke(); }
  } else {
    // quitina: dos anillos y un grupo amino
    hexagon(g, -7, 0, 8); g.fill(); g.stroke();
    hexagon(g, 8, 0, 8); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(8, 8); g.lineTo(8, 16); g.stroke();
    g.fillStyle = T.color;
    g.beginPath(); g.arc(8, 18, 3, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

export function iconFor(type) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  drawMolecule(g, type, 32, 30, 1.1);
  return c.toDataURL();
}

export function playDecomposition() {
  const controls = TYPES.map((t, k) => `
    <button type="button" class="enzyme" data-k="${k}" style="--c:${t.color}">
      <img alt="" src="${iconFor(k)}" />
      <span>${t.enzyme}</span><small>${t.name} · tecla ${k + 1}</small>
    </button>`).join('');
  const mg = openMinigame({
    title: 'Descomposición',
    intro: 'Caen moléculas de madera. Pulsa la enzima de la que esté más abajo antes de que toque el suelo. Cuantos más aciertos, más rinde el tronco.',
    controls,
  });

  return new Promise((resolve) => {
    let mols = [];
    let t = 0;
    let spawnT = 0;
    let spawned = 0;
    let hits = 0;
    let wrong = 0;
    let missed = 0;
    let combo = 0;
    let bestCombo = 0;
    let running = false;
    let raf = 0;
    let last = 0;
    let flash = null;
    const bursts = [];
    let dims = mg.size();

    const accuracy = () => (spawned ? hits / (spawned + wrong * 0.5) : 0);
    const mult = () => 1 + 2 * Math.min(1, Math.max(0, accuracy())) ** 1.3;

    const press = (k) => {
      if (!running) return;
      let target = null;
      for (const m of mols) if (!target || m.y > target.y) target = m;
      if (!target) return;
      if (target.type === k) {
        hits += 1;
        combo += 1;
        bestCombo = Math.max(bestCombo, combo);
        bursts.push({ x: target.x, y: target.y * dims.h, life: 1, color: TYPES[k].color });
        mols = mols.filter((m) => m !== target);
        sfx.click();
      } else {
        wrong += 1;
        combo = 0;
        flash = { life: 1, color: '#e57a5f' };
        sfx.deny();
      }
    };

    const buttons = [...mg.controls.querySelectorAll('.enzyme')];
    buttons.forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); press(Number(b.dataset.k)); }));
    const onKey = (e) => {
      const key = e.key.toLowerCase();
      const k = TYPES.findIndex((tp) => tp.keys.includes(key));
      if (k >= 0) { e.preventDefault(); press(k); }
    };
    document.addEventListener('keydown', onKey);

    const finish = (result) => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      mg.close();
      resolve(result);
    };
    mg.skip.addEventListener('click', () => finish(null));

    const draw = () => {
      const g = mg.ctx;
      const { w, h } = dims;
      g.clearRect(0, 0, w, h);
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#1E1628');
      grad.addColorStop(1, '#140F1C');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      // suelo
      g.fillStyle = 'rgba(229,122,95,0.12)';
      g.fillRect(0, h - 10, w, 10);
      for (const m of mols) drawMolecule(g, m.type, m.x, m.y * h, 1);
      for (const b of bursts) {
        g.globalAlpha = b.life;
        g.strokeStyle = b.color;
        g.lineWidth = 2;
        g.beginPath(); g.arc(b.x, b.y, 10 + (1 - b.life) * 26, 0, Math.PI * 2); g.stroke();
      }
      g.globalAlpha = 1;
      if (flash) {
        g.fillStyle = flash.color;
        g.globalAlpha = flash.life * 0.18;
        g.fillRect(0, 0, w, h);
        g.globalAlpha = 1;
      }
      // marcador
      g.fillStyle = 'rgba(244,233,216,0.9)';
      g.font = '19px "Jersey 15", monospace';
      g.textAlign = 'left';
      g.fillText(`${Math.max(0, Math.ceil(DURATION - t))} s`, 12, 22);
      g.textAlign = 'right';
      g.fillText(`Botín ${fmtMult(mult())}`, w - 12, 22);
      if (combo >= 3) {
        g.textAlign = 'center';
        g.fillStyle = '#F28C28';
        g.fillText(`${combo} seguidas`, w / 2, 22);
      }
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(0, 32, w, 3);
      g.fillStyle = '#F4D58D';
      g.fillRect(0, 32, w * Math.max(0, 1 - t / DURATION), 3);
    };

    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const p = Math.min(1, t / DURATION);
      const interval = 1.05 - 0.5 * p;
      const fall = 3.3 - 1.3 * p;
      spawnT -= dt;
      if (spawnT <= 0 && t < DURATION - 1) {
        spawnT = interval * (0.8 + Math.random() * 0.4);
        spawned += 1;
        mols.push({ type: Math.floor(Math.random() * 3), x: dims.w * (0.25 + Math.random() * 0.5), y: 0.08 });
      }
      for (const m of mols) m.y += dt / fall;
      const fallen = mols.filter((m) => m.y >= 0.96);
      if (fallen.length) {
        missed += fallen.length;
        combo = 0;
        flash = { life: 1, color: '#e57a5f' };
        mols = mols.filter((m) => m.y < 0.96);
      }
      for (const b of bursts) b.life -= dt * 2.5;
      while (bursts.length && bursts[0].life <= 0) bursts.shift();
      if (flash) { flash.life -= dt * 4; if (flash.life <= 0) flash = null; }
      draw();
      if (t >= DURATION && !mols.length) {
        running = false;
        const m = mult();
        sfx.achievement();
        mg.message(
          `<div class="mg-big">${fmtMult(m)}</div><p>${hits} aciertos de ${spawned} · ${missed} se te escaparon · mejor racha ${bestCombo}</p>`,
          'Descomponer',
        ).then(() => finish({ mult: m, hits, total: spawned }));
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    draw();
    window.addEventListener('resize', () => { dims = mg.size(); }, { once: true });
    mg.message('<p>Enzimas: <b>celulasa</b> (cadena verde), <b>ligninasa</b> (racimo naranja) y <b>quitinasa</b> (anillos azules).</p>', 'Empezar').then(() => {
      dims = mg.size();
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    });
  });
}
