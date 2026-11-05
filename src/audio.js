// Efectos de sonido sintetizados con WebAudio: no hay archivos que cargar.

let ctx = null;
let enabled = true;

export const setSound = (on) => { enabled = !!on; };

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'sine', vol = 0.04, slide = 0, delay = 0 } = {}) {
  if (!enabled) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.03);
}

let lastClick = 0;
export const sfx = {
  click() {
    const now = performance.now();
    if (now - lastClick < 35) return; // con autoclic rápido no saturamos
    lastClick = now;
    tone(300 + Math.random() * 70, 0.09, { slide: 1.9, vol: 0.035 });
  },
  buy() {
    tone(540, 0.07, { type: 'triangle', vol: 0.03 });
    tone(810, 0.1, { type: 'triangle', vol: 0.025, delay: 0.05 });
  },
  deny() { tone(150, 0.08, { type: 'square', vol: 0.012 }); },
  glow() { [660, 880, 1320].forEach((f, i) => tone(f, 0.28, { vol: 0.03, delay: i * 0.07 })); },
  achievement() {
    tone(523, 0.2, { type: 'triangle', vol: 0.035 });
    tone(784, 0.35, { type: 'triangle', vol: 0.035, delay: 0.12 });
  },
  prestige() { [262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, 0.6, { vol: 0.03, delay: i * 0.09 })); },
};
