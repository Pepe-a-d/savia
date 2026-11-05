// Minijuego de Esporada: mantén pulsado para cargar la seta y suelta cuando llegue la ráfaga.
// Cinco tiros; resultado: multiplicador de esporas de ×1 a ×2,5.

import { openMinigame, fmtMult } from './common.js';
import { sfx } from '../audio.js';

const SHOTS = 5;
const WINDOW = 3.2; // segundos de viento que se ven por delante
const CHARGE_SECS = 0.9;

function makeWind() {
  const gusts = [];
  let c = 1.6;
  while (c < 90) {
    gusts.push({ c, a: 0.45 + Math.random() * 0.55, s: 0.22 + Math.random() * 0.2 });
    c += 1.5 + Math.random() * 1.4;
  }
  return (t) => {
    let v = 0.1 + Math.sin(t * 1.7) * 0.03;
    for (const g of gusts) {
      const d = t - g.c;
      if (Math.abs(d) < 1.5) v += g.a * Math.exp(-(d * d) / (2 * g.s * g.s));
    }
    return Math.min(1, v);
  };
}

export function playEsporada({ setas = 1, ring = false } = {}) {
  const mg = openMinigame({
    title: 'Esporada',
    intro: 'El viento llega en ráfagas desde la derecha. Mantén pulsado (o la barra espaciadora) para cargar la seta y suelta justo cuando la ráfaga pase por la seta. Tienes cinco tiros.',
    controls: '<div class="mg-shots"></div>',
  });
  const shotsEl = mg.controls.querySelector('.mg-shots');

  return new Promise((resolve) => {
    const wind = makeWind();
    let t = 0;
    let raf = 0;
    let last = 0;
    let running = false;
    let charging = false;
    let charge = 0;
    let cooldown = 0;
    const shots = [];
    const spores = [];
    let dims = mg.size();

    const mult = () => (shots.length ? 1 + 1.5 * (shots.reduce((a, b) => a + b, 0) / shots.length) : 1);
    const renderShots = () => {
      shotsEl.innerHTML = Array.from({ length: SHOTS }, (_, k) => {
        const q = shots[k];
        if (q === undefined) return '<span class="mg-shot"></span>';
        const label = q > 0.8 ? 'perfecto' : q > 0.55 ? 'bien' : q > 0.3 ? 'regular' : 'flojo';
        return `<span class="mg-shot done" style="--q:${q.toFixed(2)}" title="${label}">${Math.round(q * 100)}</span>`;
      }).join('');
    };
    renderShots();

    const down = () => {
      if (!running || cooldown > 0 || shots.length >= SHOTS) return;
      charging = true;
      charge = 0;
    };
    const up = () => {
      if (!running || !charging) return;
      charging = false;
      const q = Math.min(1, charge) * wind(t);
      shots.push(q);
      renderShots();
      cooldown = 0.7;
      const { w, h } = dims;
      const n = 10 + Math.round(q * 40);
      for (let k = 0; k < n; k++) {
        spores.push({ x: w * 0.22, y: h * 0.62, vx: 40 + q * (220 + Math.random() * 160), vy: -20 - Math.random() * 60 * (0.4 + q), life: 1 + q });
      }
      if (q > 0.55) sfx.glow(); else sfx.click();
      charge = 0;
    };
    mg.canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); down(); });
    window.addEventListener('pointerup', up);
    const onKeyDown = (e) => { if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) down(); } };
    const onKeyUp = (e) => { if (e.code === 'Space') { e.preventDefault(); up(); } };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    const finish = (result) => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointerup', up);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      mg.close();
      resolve(result);
    };
    mg.skip.addEventListener('click', () => finish(null));

    const draw = () => {
      const g = mg.ctx;
      const { w, h } = dims;
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#1E1628');
      sky.addColorStop(1, '#140F1C');
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h);

      // cinta de viento (arriba): el instante actual está en la seta
      const top = 62;
      const band = h * 0.3;
      const nowX = w * 0.22;
      const pxPerSec = (w - nowX) / WINDOW;
      g.beginPath();
      g.moveTo(0, top + band);
      for (let x = 0; x <= w; x += 4) {
        const tt = t + (x - nowX) / pxPerSec;
        g.lineTo(x, top + band - wind(tt) * band);
      }
      g.lineTo(w, top + band);
      g.closePath();
      const wg = g.createLinearGradient(0, top, 0, top + band);
      wg.addColorStop(0, 'rgba(244,213,141,0.55)');
      wg.addColorStop(1, 'rgba(244,213,141,0.05)');
      g.fillStyle = wg;
      g.fill();
      g.strokeStyle = 'rgba(244,213,141,0.25)';
      g.strokeRect(0.5, top + 0.5, w - 1, band);
      g.strokeStyle = '#F4E9D8';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(nowX, top - 6); g.lineTo(nowX, top + band + 6); g.stroke();
      g.fillStyle = 'rgba(244,233,216,0.75)';
      g.font = '16px "Jersey 15", monospace';
      g.textAlign = 'center';
      g.fillText('ahora', nowX, top - 9);
      g.textAlign = 'right';
      g.fillText('viento que llega →', w - 8, top - 9);

      // suelo y seta
      const groundY = h * 0.78;
      g.fillStyle = '#2E2340';
      g.fillRect(0, groundY, w, h - groundY);
      const x = nowX;
      const sz = 46 + (charging ? Math.min(1, charge) * 8 : 0);
      g.fillStyle = '#F4E9D8';
      g.fillRect(x - sz * 0.1, groundY - sz * 0.8, sz * 0.2, sz * 0.8);
      g.fillStyle = ring ? '#F49AC2' : '#F49AC2';
      g.beginPath(); g.ellipse(x, groundY - sz * 0.78, sz * 0.55, sz * 0.4, 0, Math.PI, 0); g.closePath(); g.fill();
      // carga
      const c = Math.min(1, charge);
      g.strokeStyle = 'rgba(255,255,255,0.12)';
      g.lineWidth = 5;
      g.beginPath(); g.arc(x, groundY - sz * 0.95, sz * 0.75, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      g.strokeStyle = c >= 1 ? '#F4D58D' : '#F28C28';
      g.beginPath(); g.arc(x, groundY - sz * 0.95, sz * 0.75, Math.PI * 1.1, Math.PI * (1.1 + 0.8 * c)); g.stroke();

      // esporas volando
      for (const s of spores) {
        g.globalAlpha = Math.max(0, Math.min(1, s.life));
        g.fillStyle = '#F49AC2';
        g.beginPath(); g.arc(s.x, s.y, 1.6, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;

      g.fillStyle = 'rgba(244,233,216,0.9)';
      g.font = '19px "Jersey 15", monospace';
      g.textAlign = 'left';
      g.fillText(`Tiro ${Math.min(SHOTS, shots.length + 1)} de ${SHOTS}`, 12, 22);
      g.textAlign = 'right';
      g.fillText(`Esporas ${fmtMult(mult())}`, w - 12, 22);
      if (!charging && cooldown <= 0 && shots.length < SHOTS) {
        g.textAlign = 'center';
        g.fillStyle = 'rgba(244,233,216,0.55)';
        g.font = '17px "Jersey 15", monospace';
        g.fillText('Mantén pulsado para cargar', w * 0.6, groundY + 26);
      }
    };

    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      if (charging) charge += dt / CHARGE_SECS;
      if (cooldown > 0) cooldown -= dt;
      for (const s of spores) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 25 * dt;
        s.life -= dt * 0.6;
      }
      while (spores.length && spores[0].life <= 0) spores.shift();
      draw();
      if (shots.length >= SHOTS && cooldown <= 0 && !spores.some((s) => s.life > 0.4)) {
        running = false;
        const m = mult();
        sfx.achievement();
        mg.message(`<div class="mg-big">${fmtMult(m)}</div><p>Puntuación media ${Math.round((shots.reduce((a, b) => a + b, 0) / SHOTS) * 100)} de 100 con ${setas} ${setas === 1 ? 'seta' : 'setas'}.</p>`, 'Recoger esporas')
          .then(() => finish({ mult: m, shots }));
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    draw();
    mg.message('<p>Fíjate en la cinta de arriba: las crestas son ráfagas que vienen hacia la seta.</p>', 'Empezar').then(() => {
      dims = mg.size();
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    });
  });
}
