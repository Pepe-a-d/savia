// Contenido: la moneda, las zonas, las capas del suelo y los nodos del árbol de mejoras.
// Cada nodo tiene niveles; su efecto se calcula en game.js (computeStats) a partir de los niveles.

import { fmtLen } from './format.js';

export const CURRENCIES = {
  f: { name: 'frutos', short: 'F', color: '#E4405F' },
};

// value: cuánto vale la comida en esa zona
export const ZONES = {
  pradera: { name: 'Pradera', value: 1, unlock: null },
  ribera: { name: 'Ribera', value: 3, unlock: 'ribera' },
  ladera: { name: 'Ladera', value: 10, unlock: 'ladera' },
  viejo: { name: 'Bosque viejo', value: 30, unlock: 'viejo' },
};

// Capas del suelo por zona: [profundidad en px desde la superficie, nombre]. Lo hondo vale más (run.js, depthMult).
export const LAYERS = {
  pradera: [[0, 'Tierra'], [150, 'Arcilla'], [400, 'Roca'], [800, 'Roca madre'], [1500, 'Profundidades']],
  ribera: [[0, 'Tierra húmeda'], [36, 'Agua subterránea'], [260, 'Grava'], [600, 'Arcilla azul'], [1300, 'Lecho antiguo']],
  ladera: [[0, 'Tierra pedregosa'], [12, 'Roca'], [250, 'Granito'], [600, 'Cuarzo'], [1300, 'Corazón del monte']],
  viejo: [[0, 'Mantillo'], [120, 'Raíces antiguas'], [400, 'Humus negro'], [800, 'Piedra vieja'], [1500, 'Raíz del mundo']],
};

export function layerIndex(zone, depth) {
  const L = LAYERS[zone] || LAYERS.pradera;
  let i = 0;
  while (i + 1 < L.length && depth >= L[i + 1][0]) i++;
  return i;
}

export const BRANCHES = {
  centro: { name: 'Origen', color: '#FFF3D6' },
  raices: { name: 'Raíces', color: '#E8C48A' },
  suelo: { name: 'Suelo', color: '#F28C28' },
  arbol: { name: 'Árbol', color: '#7DD181' },
  cosecha: { name: 'Cosecha', color: '#FF6B81' },
  bosque: { name: 'Bosque', color: '#B48EF0' },
  ribera: { name: 'Ribera', color: '#5FC9E0' },
  ladera: { name: 'Ladera', color: '#E0A060' },
  viejo: { name: 'Bosque viejo', color: '#9BE36B' },
  madre: { name: 'Final', color: '#FFE27A' },
};

// Base de una temporada
export const BASE = {
  rootTime: 4.5, // s que tarda una raíz en llegar a su largo máximo (en la tierra blanda)
  startRoots: 2, // raíces que echa cada árbol al empezar
  sprouts: 4, // raíces nuevas que pueden brotar de las viejas
  rootLen: 40, // largo máximo de cada raíz (px; 1 px = 1 cm)
  attract: 50, // px: alcance del puntero
  absorb: 2, // px de margen para tocar una bolsa
  pockets: 18, // bolsas por pantalla de suelo
  big: 0.08, // parte de bolsas gordas (dan un brote)
  lenGrowth: 0.05, // crecimiento por px de raíz
  fruitRate: 0.3, // frutos por punto de crecimiento
  catchR: 8, // px: radio para atrapar frutos
  gravity: 90, // px/s² de los frutos al caer
};

const pct = (x) => `${Math.round(x * 100)}%`;
const x2 = (x) => x.toFixed(2).replace('.', ',');
const N = (id, branch, x, y, req, name, desc, max, cost, fx, extra = {}) => ({ id, branch, x, y, req, name, desc, max, cost, fx, ...extra });

// cost: { c: moneda, b: precio base, k: multiplicador por nivel }
export const NODES = [
  N('semilla', 'centro', 0, 0, [], 'Semilla', 'Aquí empieza tu árbol.', 1, { c: 'f', b: 0, k: 1 }, () => 'Tu árbol nace aquí'),

  // ── Raíces (arriba) ────────────────────────────────────────────────────
  N('largo', 'raices', 0, -1, ['semilla'], 'Raíces largas', 'Cada raíz llega más lejos antes de pararse.', 10, { c: 'f', b: 5, k: 1.9 },
    (l) => `Cada raíz llega a ${fmtLen(BASE.rootLen * 1.2 ** l)}`),
  N('brotes', 'raices', -1, -2, ['largo'], 'Más brotes', 'Brotan más raíces nuevas de las viejas en cada temporada.', 8, { c: 'f', b: 14, k: 2.1 },
    (l) => `${BASE.sprouts + 2 * l} brotes por árbol`),
  N('rapidas', 'raices', 1, -2, ['largo'], 'Puntas rápidas', 'Tus raíces crecen más deprisa: la temporada dura menos y das más frutos por minuto.', 4, { c: 'f', b: 20, k: 2.2 },
    (l) => `Velocidad ×${x2(1 / 0.9 ** l)}`),
  N('doble', 'raices', 0, -3, ['brotes', 'rapidas'], 'Raíz doble', 'Tu árbol echa más raíces a la vez desde el principio.', 3, { c: 'f', b: 120, k: 4 },
    (l) => `${BASE.startRoots + l} raíces a la vez`),
  N('olfato', 'raices', -1, -4, ['doble'], 'Olfato', 'Las raíces que no guías buscan solas la comida cercana.', 4, { c: 'f', b: 400, k: 3 },
    (l) => `Notan la comida a ${fmtLen(25 + 15 * (l - 1))}`),
  N('atraccion', 'raices', 1, -4, ['doble'], 'Atracción', 'El puntero atrae las raíces desde más lejos.', 4, { c: 'f', b: 250, k: 2.5 },
    (l) => `Alcance del puntero +${pct(0.25 * l)}`),
  N('pivotante', 'raices', 0, -5, ['olfato', 'atraccion'], 'Raíz pivotante', 'La tierra dura del fondo te frena menos.', 3, { c: 'f', b: 4000, k: 4 },
    (l) => `Lo hondo frena ${pct(1 - 1 / 1.5 ** l)} menos`),

  // ── Suelo (abajo) ──────────────────────────────────────────────────────
  N('digestion', 'suelo', 0, 1, ['semilla'], 'Digestión', 'Cada bolsa de comida hace crecer más a tu árbol.', 12, { c: 'f', b: 6, k: 2 },
    (l) => `Bolsas +${pct(0.3 * l)}`),
  N('rico', 'suelo', -1, 2, ['digestion'], 'Suelo rico', 'Más bolsas de comida en la tierra.', 8, { c: 'f', b: 30, k: 2.2 },
    (l) => `+${pct(0.25 * l)} bolsas`),
  N('gordas', 'suelo', 1, 2, ['digestion'], 'Bolsas gordas', 'Más bolsas gordas (las verdes): valen ×4 y dan un brote extra.', 5, { c: 'f', b: 60, k: 2.5 },
    (l) => `${pct(BASE.big + 0.04 * l)} de bolsas gordas`),
  N('pelos', 'suelo', 0, 3, ['rico', 'gordas'], 'Pelos radicales', 'Tus raíces absorben las bolsas desde más lejos.', 4, { c: 'f', b: 200, k: 2.6 },
    (l) => `Radio de absorción ${fmtLen(BASE.absorb + l)}`),
  N('lluvia', 'suelo', -1, 4, ['pelos'], 'Lluvia', 'Aparecen charcos bajo tierra: dentro, las raíces crecen el doble de rápido.', 3, { c: 'f', b: 1500, k: 3 },
    (l) => `${2 * l} charcos por pantalla`),
  N('rompe', 'suelo', 1, 4, ['pelos'], 'Raíces que rompen', 'Tus raíces atraviesan las piedras en vez de rodearlas.', 1, { c: 'f', b: 3000, k: 1 },
    () => 'Atraviesas las piedras'),

  // ── Árbol y cosecha (derecha) ──────────────────────────────────────────
  N('savia', 'arbol', 1, 0, ['semilla'], 'Savia', 'Tu árbol crece más con las mismas raíces.', 12, { c: 'f', b: 10, k: 2.1 },
    (l) => `Crecimiento +${pct(0.25 * l)}`),
  N('frutos', 'arbol', 2, -1, ['savia'], 'Más frutos', 'Tu árbol da más frutos por cada punto de crecimiento.', 10, { c: 'f', b: 40, k: 2.3 },
    (l) => `Frutos +${pct(0.2 * l)}`),
  N('cesta', 'cosecha', 2, 1, ['savia'], 'Cesta grande', 'Atrapas los frutos desde más lejos.', 4, { c: 'f', b: 30, k: 2.4 },
    (l) => `Radio para atrapar ${fmtLen(BASE.catchR + 3 * l)}`),
  N('dorado', 'arbol', 3, -1, ['frutos'], 'Fruto dorado', 'A veces sale un fruto dorado: vale ×5.', 5, { c: 'f', b: 600, k: 2.8 },
    (l) => `${pct(0.03 * l)} de frutos dorados`),
  N('lenta', 'cosecha', 3, 1, ['cesta'], 'Caída lenta', 'Los frutos caen más despacio: es más fácil atraparlos.', 3, { c: 'f', b: 200, k: 2.8 },
    (l) => `Caen −${pct(1 - 0.8 ** l)} de rápido`),
  N('vuelo', 'cosecha', 4, 0, ['dorado', 'lenta'], 'Al vuelo', 'Los frutos que atrapas valen todavía más.', 2, { c: 'f', b: 20000, k: 5 },
    (l) => `Atrapados ×${(2 + 0.5 * l).toFixed(1).replace('.', ',')}`),

  // ── Bosque (izquierda) ─────────────────────────────────────────────────
  N('plantar', 'bosque', -1, 0, ['semilla'], 'Plantar otro árbol', 'Un árbol más en la pradera. Todos echan raíces a la vez y comparten la tierra.', 3, { c: 'f', b: 200, k: 18 },
    (l) => `${1 + l} árboles`),
  N('abejas', 'bosque', -2, -1, ['plantar'], 'Abejas', 'Desbloquea Polinizar: cada 3 temporadas guías una abeja por las flores y la siguiente temporada das más frutos.', 1, { c: 'f', b: 400, k: 1 },
    () => 'Minijuego Polinizar'),
  N('colmena', 'bosque', -3, -1, ['abejas'], 'Colmena', 'Polinizar dura más y cada flor vale más.', 3, { c: 'f', b: 1500, k: 3 },
    (l) => `${10 + 3 * l} s de vuelo · +${5 + l}% por flor`),
  N('entrelazadas', 'bosque', -2, 1, ['plantar'], 'Raíces entrelazadas', 'Cuando se tocan raíces de dos árboles distintos, los dos crecen más (hasta 8 uniones por árbol).', 3, { c: 'f', b: 600, k: 3.5 },
    (l) => `+${3 * l}% de crecimiento por unión`),
  N('mantillo', 'bosque', -3, 1, ['entrelazadas'], 'Mantillo', 'Los frutos que caen al suelo valen más.', 4, { c: 'f', b: 300, k: 2.5 },
    (l) => `Caídos ×${(1 + 0.25 * l).toFixed(2).replace('.', ',')}`),
  N('vivero', 'bosque', -4, 0, ['colmena', 'mantillo'], 'Bosque espeso', 'Cada árbol crece más cuantos más árboles tenga cerca.', 3, { c: 'f', b: 8000, k: 4 },
    (l) => `+${5 * l}% de crecimiento por cada otro árbol`),

  // ── Ribera (abajo a la izquierda) ──────────────────────────────────────
  N('ribera', 'ribera', -2, 3, ['entrelazadas'], 'Viaje a la ribera', 'Tus semillas llegan a la orilla de un río. Ya puedes elegir dónde pasar cada temporada: allí la comida vale ×3 y hay agua bajo tierra.', 1, { c: 'f', b: 1e5, k: 1 },
    () => 'Ribera abierta'),
  N('capilar', 'ribera', -3, 4, ['ribera'], 'Raíces capilares', 'En el agua subterránea, tus raíces crecen todavía más rápido.', 3, { c: 'f', b: 2e6, k: 2 },
    (l) => `En el agua, velocidad ×${(2 + 0.5 * l).toFixed(1).replace('.', ',')}`),
  N('anclas', 'ribera', -2, 5, ['ribera'], 'Raíces ancladas', 'La corriente del agua subterránea te arrastra menos.', 3, { c: 'f', b: 1.5e6, k: 2 },
    (l) => `Corriente −${pct(0.25 * l)}`),
  N('sed', 'ribera', -4, 3, ['capilar'], 'Sed', 'Cada raíz que llega al agua da más crecimiento a su árbol.', 3, { c: 'f', b: 3e6, k: 2.2 },
    (l) => `+${4 + 2 * l}% por raíz que llega al agua`),
  N('tijeras', 'ribera', -3, 6, ['anclas'], 'Tijeras de podar', 'Desbloquea Podar: cada 3 temporadas cortas las ramas secas de tu árbol y te dan frutos al momento.', 1, { c: 'f', b: 4e6, k: 1 },
    () => 'Minijuego Podar'),
  N('afilar', 'ribera', -4, 6, ['tijeras'], 'Tijeras afiladas', 'Podar dura más y cada rama cortada da más frutos.', 3, { c: 'f', b: 4e6, k: 2 },
    (l) => `${8 + 2 * l} s · ramas +${pct(0.5 * l)}`),
  N('riego', 'ribera', -4, 5, ['capilar', 'anclas'], 'Riego', 'Toda la comida vale más, en todas las zonas.', 4, { c: 'f', b: 2e6, k: 2 },
    (l) => `Comida +${pct(0.25 * l)}`),
  N('crecida', 'ribera', -5, 4, ['sed', 'riego'], 'La crecida', 'El río se desborda y abona todas las tierras. Antes tienes que haber llegado al final de las otras ramas de la ribera.', 1, { c: 'f', b: 4e7, k: 1 },
    () => 'Frutos ×2 en todas las zonas', { reqAll: ['sed', 'afilar', 'riego'] }),

  // ── Ladera (abajo a la derecha; se abre tras la crecida) ───────────────
  N('ladera', 'ladera', 2, 5, ['rompe'], 'Subir a la ladera', 'Tus semillas suben a la montaña. Allí la comida vale ×10, pero bajo la tierra hay roca que solo se cruza por las grietas. Antes tienes que haber hecho la crecida.', 1, { c: 'f', b: 5e7, k: 1 },
    () => 'Ladera abierta', { reqAll: ['crecida'] }),
  N('grietas', 'ladera', 3, 6, ['ladera'], 'Grietas anchas', 'En la ladera hay más grietas y son más anchas.', 3, { c: 'f', b: 1.2e7, k: 2 },
    (l) => `${3 + l} grietas por pantalla, ${3 + l} cm de ancho`),
  N('acido', 'ladera', 2, 7, ['ladera'], 'Raíces ácidas', 'Cada raíz puede abrirse paso un poco por la roca antes de pararse.', 4, { c: 'f', b: 2e7, k: 2 },
    (l) => `Atraviesan ${fmtLen(8 * l)} de roca`),
  N('vetas', 'ladera', 4, 5, ['grietas'], 'Vetas ricas', 'Más vetas minerales en la roca, y cada una vale más.', 4, { c: 'f', b: 3e7, k: 2.2 },
    (l) => `${2 + l} vetas por pantalla · valen ×${x2(8 * 1.5 ** l)}`),
  N('alelopatia', 'ladera', 3, 8, ['acido'], 'Alelopatía', 'Tus raíces sueltan sustancias que frenan a las zarzas.', 3, { c: 'f', b: 2.5e7, k: 2 },
    (l) => `Zarzas −${pct(0.25 * l)} de rápidas`),
  N('cumbre', 'ladera', 4, 7, ['vetas', 'alelopatia'], 'La cumbre', 'Tus raíces llegan a lo alto del monte. Antes tienes que haber llegado al final de las otras ramas de la ladera.', 1, { c: 'f', b: 2.5e8, k: 1 },
    () => 'Frutos ×2 en todas las zonas', { reqAll: ['grietas', 'acido', 'vetas', 'alelopatia'] }),

  // ── Bosque viejo (arriba a la derecha; se abre tras la cumbre) ─────────
  N('viejo', 'viejo', 3, -3, ['dorado'], 'El bosque viejo', 'Tus semillas llegan a un bosque de árboles gigantes. Allí la comida vale ×30, hay tocones que descomponer y raíces muertas que seguir. Antes tienes que haber llegado a la cumbre.', 1, { c: 'f', b: 3e8, k: 1 },
    () => 'Bosque viejo abierto', { reqAll: ['cumbre'] }),
  N('carcoma', 'viejo', 2, -4, ['viejo'], 'Carcoma', 'Los tocones se descomponen con menos raíces y dan más comida.', 3, { c: 'f', b: 5e8, k: 2 },
    (l) => `Tocones: piden −${pct(1 - 0.7 ** l)} de raíz y dan ×${x2(1.5 ** l)}`),
  N('sendas', 'viejo', 4, -4, ['viejo'], 'Sendas antiguas', 'Las raíces muertas dan más y por ellas creces más deprisa.', 3, { c: 'f', b: 8e8, k: 2 },
    (l) => `Raíces muertas ×${x2(1.5 ** l)} · velocidad ×${(1.6 + 0.3 * l).toFixed(1).replace('.', ',')}`),
  N('memoria', 'viejo', 3, -5, ['carcoma', 'sendas'], 'Memoria del bosque', 'Hay más tocones y más raíces muertas en el bosque viejo.', 3, { c: 'f', b: 1.5e9, k: 2 },
    (l) => `${3 + l} tocones · +${pct(0.3 * l)} raíces muertas`),
  N('eterno', 'viejo', 2, -6, ['memoria'], 'Savia eterna', 'Todos tus árboles dan más frutos, en todas las zonas.', 2, { c: 'f', b: 2.5e9, k: 3 },
    (l) => `Frutos ×${2 ** l}`),
  N('madre', 'madre', 3, -7, ['memoria', 'eterno'], 'El árbol madre', 'Un árbol enorme nace en el centro de tu bosque: es el final de Savia. Antes tienes que tener todas las mejoras, al menos a nivel 1.', 1, { c: 'f', b: 1.2e10, k: 1 },
    () => 'El final', { final: true }),
];

// El árbol madre pide tener todas las demás mejoras
NODES.find((n) => n.id === 'madre').reqAll = NODES.filter((n) => n.id !== 'madre' && n.id !== 'semilla').map((n) => n.id);

export const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]));

export const POCKETS = {
  n: { r: 2, value: 1 },
  big: { r: 3, value: 4 },
  vein: { r: 2, value: 8 },
};
