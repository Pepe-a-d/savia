// Formato de números y tiempos. Coma decimal, punto de miles y sufijos cortos de juego
// (K = mil, M = millón, B = mil millones, T = billón...).

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc',
  'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];

let notation = 'short';
export const setNotation = (n) => { notation = n === 'sci' ? 'sci' : 'short'; };

const group = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const stripZeros = (s) => (s.includes('.') ? s.replace(/\.?0+$/, '') : s);

function sci(n, clean) {
  let e = Math.floor(Math.log10(n));
  let m = Math.floor((n / 10 ** e) * 100 + 1e-9) / 100;
  if (m >= 10) { m /= 10; e += 1; }
  let s = m.toFixed(2);
  if (clean) s = stripZeros(s);
  return `${s.replace('.', ',')}e${e}`;
}

/**
 * fmt(1234567) → "1,23 M"   fmt(0.25, { decimals: 1 }) → "0,2"
 * clean: quita ceros sobrantes ("10 M" en vez de "10,0 M"); úsalo en textos fijos, no en contadores.
 */
export function fmt(n, { decimals = 0, clean = false } = {}) {
  if (!Number.isFinite(n)) return '∞';
  if (n < 0) return `−${fmt(-n, { decimals, clean })}`;
  if (n < 1e6) {
    if (decimals && n < 100) {
      const f = 10 ** decimals;
      return stripZeros((Math.floor(n * f + 1e-9) / f).toFixed(decimals)).replace('.', ',');
    }
    return group(String(Math.floor(n + 1e-9)));
  }
  if (notation === 'sci') return sci(n, clean);
  const tier = Math.floor(Math.log10(n) / 3);
  if (tier >= SUFFIXES.length) return sci(n, clean);
  const m = n / 10 ** (tier * 3);
  const d = m < 10 ? 2 : m < 100 ? 1 : 0;
  const f = 10 ** d;
  let s = (Math.floor(m * f + 1e-9) / f).toFixed(d);
  if (clean) s = stripZeros(s);
  return `${s.replace('.', ',')} ${SUFFIXES[tier]}`;
}

export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d) return `${d} d ${h} h`;
  if (h) return `${h} h ${m} min`;
  if (m) return `${m} min ${s} s`;
  return `${s} s`;
}

/** Profundidad en px del mundo → metros (1 px = 1 cm): "0,8 m", "12,4 m", "130 m". */
export function fmtDepth(px) {
  const m = Math.max(0, px) / 100;
  return `${m < 100 ? (Math.floor(m * 10) / 10).toFixed(1).replace('.', ',') : Math.floor(m)} m`;
}

/** Largo en px del mundo → "40 cm" o "1,2 m". */
export function fmtLen(px) {
  const cm = Math.round(Math.max(0, px));
  return cm < 100 ? `${cm} cm` : fmtDepth(cm);
}
