// Contenido: monedas, ramas y nodos del árbol de habilidades.
// Cada nodo tiene niveles; su efecto se calcula en game.js (computeStats) a partir de los niveles.

export const CURRENCIES = {
  n: { name: 'nutrientes', short: 'N', color: '#F28C28' },
  m: { name: 'minerales', short: 'M', color: '#5FCDE4' },
  a: { name: 'azúcar', short: 'A', color: '#FFD23F' },
  e: { name: 'esporas', short: 'E', color: '#F49AC2' },
  t: { name: 'turba', short: 'T', color: '#B6E35A' },
  c: { name: 'cristales', short: 'C', color: '#C79BFF' },
};

export const BIOMES = {
  bosque: { name: 'Bosque' },
  pantano: { name: 'Pantano' },
  cueva: { name: 'Cueva' },
};

// Capas del suelo por lugar: [profundidad en px desde la superficie, nombre]. Lo hondo vale más (run.js, depthMult).
export const LAYERS = {
  bosque: [[0, 'Tierra'], [150, 'Arcilla'], [400, 'Roca'], [800, 'Roca madre'], [1500, 'Profundidades']],
  pantano: [[0, 'Barro'], [36, 'Barro inundado'], [300, 'Cieno'], [700, 'Turba antigua'], [1400, 'Abismo']],
  cueva: [[0, 'Caliza'], [150, 'Pizarra'], [400, 'Basalto'], [800, 'Geoda'], [1500, 'Abismo']],
};

export function layerIndex(biome, depth) {
  const L = LAYERS[biome] || LAYERS.bosque;
  let i = 0;
  while (i + 1 < L.length && depth >= L[i + 1][0]) i++;
  return i;
}

export const BRANCHES = {
  centro: { name: 'Origen', color: '#FFF3D6' },
  crecer: { name: 'Crecimiento', color: '#F4D58D' },
  absorber: { name: 'Absorción', color: '#F28C28' },
  suelo: { name: 'Suelo', color: '#7DD181' },
  temporada: { name: 'Temporada', color: '#B48EF0' },
  minerales: { name: 'Minerales', color: '#5FCDE4' },
  simbiosis: { name: 'Simbiosis', color: '#FFD23F' },
  troncos: { name: 'Troncos', color: '#C9824A' },
  setas: { name: 'Fructificación', color: '#F49AC2' },
  pantano: { name: 'Pantano', color: '#4FD1A5' },
  defensa: { name: 'Defensa', color: '#FF6B81' },
  luz: { name: 'Bioluminiscencia', color: '#B6E35A' },
  cueva: { name: 'Cueva', color: '#9F8CFF' },
  cristal: { name: 'Cristal', color: '#E59BFF' },
};

const pct = (x) => `${Math.round(x * 100)}%`;
const N = (id, branch, x, y, req, name, desc, max, cost, fx, extra = {}) => ({ id, branch, x, y, req, name, desc, max, cost, fx, ...extra });

// cost: { c: moneda, b: precio base, k: multiplicador por nivel }
export const NODES = [
  N('espora', 'centro', 0, 0, [], 'Espora', 'Aquí empieza todo.', 1, { c: 'n', b: 0, k: 1 }, () => 'Tu red nace aquí'),

  // ── Crecimiento (arriba) ───────────────────────────────────────────────
  N('vel', 'crecer', 0, -1, ['espora'], 'Hifas rápidas', 'Tus hifas crecen más deprisa.', 10, { c: 'n', b: 6, k: 1.55 },
    (l) => `Velocidad ×${(1.15 ** l).toFixed(2).replace('.', ',')}`),
  N('puntas', 'crecer', -1, -2, ['vel'], 'Más puntas', 'Más hifas creciendo a la vez.', 6, { c: 'n', b: 30, k: 2.3 },
    (l) => `${2 + l} puntas a la vez`),
  N('ramas', 'crecer', 1, -2, ['vel'], 'Ramificación', 'Tus puntas se dividen más a menudo.', 5, { c: 'n', b: 45, k: 2 },
    (l) => `Ramifica +${pct(0.35 * l)}`),
  N('alcance', 'crecer', 0, -3, ['puntas', 'ramas'], 'Olfato', 'El puntero atrae hifas desde más lejos.', 5, { c: 'n', b: 90, k: 1.9 },
    (l) => `Alcance del puntero +${pct(0.25 * l)}`),
  N('quimio', 'crecer', 0, -4, ['alcance'], 'Quimiotaxis', 'Las puntas que no guías buscan solas la comida cercana.', 4, { c: 'n', b: 400, k: 2.4 },
    (l) => (l ? `Detectan comida a ${30 + 18 * (l - 1)} px` : 'Las puntas buscan comida solas')),
  N('apical', 'crecer', -1, -5, ['quimio'], 'Crecimiento apical', 'Velocidad ×1,5 por nivel.', 3, { c: 'n', b: 6000, k: 5 },
    (l) => `Velocidad ×${(1.5 ** l).toFixed(2).replace('.', ',')}`),
  N('setas', 'setas', 1, -5, ['quimio'], 'Fructificación', 'Al acabar la temporada, tu red da setas que sueltan esporas.', 1, { c: 'n', b: 8000, k: 1 },
    () => '1 seta por cada 100 px de red'),
  N('laminas', 'setas', 2, -6, ['setas'], 'Láminas', 'Cada seta suelta más esporas.', 5, { c: 'e', b: 6, k: 2 },
    (l) => `${1 + l} esporas por seta`),
  N('viento', 'setas', 1, -7, ['setas'], 'Viento', 'Desbloquea la esporada: suelta las esporas en la ráfaga buena y multiplícalas.', 1, { c: 'e', b: 10, k: 1 },
    () => 'Minijuego de la esporada (×1 a ×2,5)'),
  N('sombrero', 'setas', 2, -8, ['laminas', 'viento'], 'Sombrero ancho', 'Más setas por temporada.', 4, { c: 'e', b: 40, k: 2.2 },
    (l) => `+${pct(0.25 * l)} setas`),
  N('maduro', 'setas', 0, -6, ['setas'], 'Micelio maduro', 'Una red bien alimentada da más setas.', 8, { c: 'n', b: 60000, k: 2.4 },
    (l) => `Setas ×${(1.25 ** l).toFixed(2).replace('.', ',')}`),
  N('anillo', 'setas', 0, -9, ['sombrero', 'viento'], 'Anillo de hadas', 'Un círculo perfecto de setas. Completa el bosque y abre el pantano. Antes tienes que haber llegado al final de las otras ramas.', 1, { c: 'e', b: 15000, k: 1 },
    () => 'Completa el bosque', { final: 'bosque', reqAll: ['sombrero', 'mult3', 'bosque', 'otono', 'descomp'] }),

  // ── Pantano (arriba a la izquierda; se abre con el anillo) ─────────────
  N('pantano', 'pantano', -2, -9, ['anillo'], 'Viaje al pantano', 'Tus esporas llegaron a un pantano. Ya puedes elegir dónde pasar cada temporada.', 1, { c: 't', b: 0, k: 1 },
    () => 'Pantano abierto'),
  N('nadar', 'pantano', -3, -10, ['pantano'], 'Hifas nadadoras', 'La corriente del barro inundado te arrastra menos.', 3, { c: 't', b: 8, k: 2 },
    (l) => `Corriente −${pct(0.25 * l)}`),
  N('turbera', 'pantano', -3, -8, ['pantano'], 'Turbera', 'Más depósitos de turba, y cada uno da más.', 5, { c: 't', b: 12, k: 2 },
    (l) => `${3 + l} depósitos · turba ×${(1.5 ** l).toFixed(1).replace('.', ',')}`),
  N('juncos', 'pantano', -4, -11, ['nadar'], 'Juncos', 'Aparecen juncos en la orilla. Si tu red llega a sus raíces, te dan turba toda la temporada.', 1, { c: 't', b: 35, k: 1 },
    () => '3 juncos por temporada'),
  N('rizosfera', 'pantano', -5, -11, ['juncos'], 'Rizosfera', 'Los juncos dan más turba.', 4, { c: 't', b: 60, k: 2.2 },
    (l) => `Turba de juncos ×${(1.5 ** l).toFixed(1).replace('.', ',')}`),
  N('corriente', 'pantano', -4, -9, ['nadar', 'turbera'], 'Corriente a favor', 'Creces más rápido, en el bosque y en el pantano.', 4, { c: 'n', b: 2e6, k: 4 },
    (l) => `Velocidad ×${(1.25 ** l).toFixed(2).replace('.', ',')}`),
  N('anfibio', 'pantano', -5, -10, ['corriente'], 'Micelio anfibio', 'Todos los nutrientes ×2, en los dos lugares.', 3, { c: 'n', b: 5e6, k: 5 },
    (l) => `Nutrientes ×${2 ** l}`),
  N('antibiotico', 'defensa', -4, -7, ['turbera'], 'Antibióticos', 'Tus puntas atacan a las colonias rivales en vez de morir. Destruirlas da turba.', 1, { c: 't', b: 25, k: 1 },
    () => 'Puedes destruir colonias'),
  N('penicilina', 'defensa', -5, -6, ['antibiotico'], 'Penicilina', 'Destruyes las colonias más deprisa y te dan más turba.', 4, { c: 't', b: 50, k: 2.2 },
    (l) => `Daño ×${(1.6 ** l).toFixed(1).replace('.', ',')} · turba ×${(1.5 ** l).toFixed(1).replace('.', ',')}`),
  N('cuarentena', 'defensa', -5, -8, ['antibiotico'], 'Cuarentena', 'Hay menos colonias y crecen más despacio.', 3, { c: 't', b: 80, k: 2.4 },
    (l) => `${5 - l} colonias, crecen −${pct(0.25 * l)}`),
  N('viajeras', 'setas', -6, -9, ['anfibio', 'cuarentena'], 'Esporas viajeras', 'Más setas al final de cada temporada, en los dos lugares.', 3, { c: 'e', b: 30000, k: 3 },
    (l) => `Setas ×${(1.5 ** l).toFixed(1).replace('.', ',')}`),
  N('biolum', 'luz', -6, -11, ['rizosfera', 'anfibio'], 'Bioluminiscencia', 'Tus hifas brillan en la oscuridad y absorben un 50% más.', 1, { c: 't', b: 400, k: 1 },
    () => 'Hifas luminosas · absorción ×1,5'),
  N('fatuo', 'luz', -7, -10, ['biolum', 'viajeras'], 'Fuego fatuo', 'Luces verdes flotan sobre el pantano. Completa el pantano.', 1, { c: 't', b: 2500, k: 1 },
    () => 'Completa el pantano y abre la cueva', { final: 'pantano', reqAll: ['biolum', 'penicilina', 'rizosfera', 'viajeras', 'cuarentena'] }),

  // ── Cueva (más a la izquierda; se abre con el fuego fatuo) ─────────────
  N('cueva', 'cueva', -8, -10, ['fatuo'], 'Descenso a la cueva', 'Tus esporas cayeron por una grieta. Ya puedes pasar temporadas en la cueva.', 1, { c: 'c', b: 0, k: 1 },
    () => 'Cueva abierta'),
  N('luz', 'cueva', -9, -11, ['cueva'], 'Luz propia', 'Tu red ilumina más lejos en la oscuridad.', 5, { c: 'c', b: 6, k: 2 },
    (l) => `Luz ×${(1.3 ** l).toFixed(2).replace('.', ',')}`),
  N('geoda', 'cristal', -9, -9, ['cueva'], 'Geoda', 'Más cristales en la roca, y cada uno vale más.', 5, { c: 'c', b: 10, k: 2 },
    (l) => `${6 + 2 * l} cristales · valen ×${(1.5 ** l).toFixed(1).replace('.', ',')}`),
  N('grillos', 'cueva', -10, -12, ['luz'], 'Grillos de cueva', 'Si un grillo toca tu red, se lleva tus esporas y, donde las suelta, nace una red nueva.', 1, { c: 'c', b: 30, k: 1 },
    () => '2 grillos por temporada'),
  N('polizones', 'cueva', -11, -12, ['grillos'], 'Polizones', 'Más grillos, y las redes que nacen de sus saltos son más grandes.', 3, { c: 'c', b: 60, k: 2.4 },
    (l) => `${2 + l} grillos · ${2 + l} puntas por salto`),
  N('guano', 'cueva', -10, -10, ['luz', 'geoda'], 'Guano', 'Bajo los murciélagos se acumula guano: comida que vale ×12.', 4, { c: 'c', b: 20, k: 2.2 },
    (l) => `${2 * l} montones de guano`),
  N('eco', 'cristal', -10, -8, ['geoda'], 'Ecolocalización', 'Ves la silueta de los cristales y del guano aunque estén a oscuras.', 1, { c: 'c', b: 40, k: 1 },
    () => 'Los tesoros se ven en la oscuridad'),
  N('caliza', 'cueva', -11, -9, ['eco', 'guano'], 'Disolver caliza', 'Tus hifas atraviesan las estalagmitas.', 1, { c: 'c', b: 80, k: 1 },
    () => 'Las estalagmitas ya no te paran'),
  N('profundo', 'cueva', -11, -11, ['guano', 'grillos'], 'Raíces profundas', 'Creces más rápido en todos los lugares.', 4, { c: 'n', b: 2e7, k: 4 },
    (l) => `Velocidad ×${(1.25 ** l).toFixed(2).replace('.', ',')}`),
  N('resonancia', 'cristal', -12, -10, ['profundo', 'caliza'], 'Resonancia cristalina', 'Todos los nutrientes ×3, en todos los lugares.', 2, { c: 'c', b: 250, k: 6 },
    (l) => `Nutrientes ×${3 ** l}`),
  N('espejo', 'cristal', -12, -8, ['caliza'], 'Esporas de cristal', 'Más setas al final de cada temporada, en todos los lugares.', 3, { c: 'e', b: 250000, k: 3 },
    (l) => `Setas ×${(1.5 ** l).toFixed(1).replace('.', ',')}`),
  N('corazon', 'cristal', -13, -10, ['resonancia', 'espejo'], 'El corazón de la cueva', 'Una geoda enorme late en lo más hondo. Completa la cueva.', 1, { c: 'c', b: 3600, k: 1 },
    () => 'Completa la cueva', { final: 'cueva', reqAll: ['polizones', 'eco', 'caliza', 'resonancia', 'espejo'] }),

  // ── Absorción (derecha) ────────────────────────────────────────────────
  N('valor', 'absorber', 1, 0, ['espora'], 'Digestión', 'Cada bolsa de comida vale más.', 15, { c: 'n', b: 8, k: 1.65 },
    (l) => `Bolsas ×${(1.3 ** l).toFixed(2).replace('.', ',')}`),
  N('radio', 'absorber', 2, -1, ['valor'], 'Exoenzimas', 'Absorbes las bolsas desde más lejos.', 4, { c: 'n', b: 60, k: 2.1 },
    (l) => `Radio de absorción ${2 + l} px`),
  N('pasiva', 'absorber', 2, 1, ['valor'], 'Absorción pasiva', 'Toda tu red absorbe nutrientes poco a poco, no solo las puntas.', 10, { c: 'n', b: 150, k: 1.75 },
    (l) => `${(0.2 * l).toFixed(1).replace('.', ',')} por cada 1.000 px de red y segundo`),
  N('mult1', 'absorber', 3, 0, ['radio', 'pasiva'], 'Enzimas potentes', 'Todo lo que absorbes ×2.', 1, { c: 'n', b: 1500, k: 1 },
    () => 'Nutrientes ×2'),
  N('mult2', 'absorber', 4, 0, ['mult1'], 'Metabolismo', 'Todo lo que absorbes ×2 otra vez.', 1, { c: 'n', b: 120000, k: 1 },
    () => 'Nutrientes ×2'),
  N('mult3', 'absorber', 5, 0, ['mult2'], 'Digestión total', 'Todo lo que absorbes ×3.', 1, { c: 'a', b: 800, k: 1 },
    () => 'Nutrientes ×3'),
  N('troncos', 'troncos', 3, 1, ['pasiva'], 'Descomponedor', 'Aparecen troncos caídos. Cúbrelos con tu red para descomponerlos: valen mucho.', 1, { c: 'n', b: 2500, k: 1 },
    () => 'Troncos en la tierra'),
  N('podre', 'troncos', 4, 2, ['troncos'], 'Podredumbre blanca', 'Los troncos valen más.', 5, { c: 'n', b: 6000, k: 2.2 },
    (l) => `Troncos +${pct(0.6 * l)}`),
  N('descomp', 'troncos', 3, 3, ['troncos'], 'Enzimas de la madera', 'Desbloquea la descomposición: al acabar la temporada, multiplica lo que dieron los troncos.', 1, { c: 'n', b: 12000, k: 1 },
    () => 'Minijuego de descomposición (×1 a ×3)'),

  // ── Suelo (abajo) ──────────────────────────────────────────────────────
  N('densidad', 'suelo', 0, 1, ['espora'], 'Suelo rico', 'Más bolsas de comida en cada temporada.', 10, { c: 'n', b: 8, k: 1.5 },
    (l) => `+${4 * l} bolsas`),
  N('grandes', 'suelo', -1, 2, ['densidad'], 'Bolsas gordas', 'Algunas bolsas valen ×5.', 5, { c: 'n', b: 70, k: 2 },
    (l) => `${l ? Math.round((0.1 + 0.05 * l) * 100) : 0}% de bolsas gordas`),
  N('hojarasca', 'suelo', 1, 2, ['densidad'], 'Hojarasca', 'Aparecen manchas de hojas que valen ×4.', 5, { c: 'n', b: 200, k: 2.1 },
    (l) => `${2 * l} manchas de hojarasca`),
  N('reaparicion', 'suelo', 0, 3, ['grandes', 'hojarasca'], 'Suelo vivo', 'Durante la temporada aparecen bolsas nuevas.', 5, { c: 'n', b: 500, k: 2.2 },
    (l) => (l ? `Una bolsa nueva cada ${(2.5 * 0.8 ** (l - 1)).toFixed(1).replace('.', ',')} s; las que caen sobre tu red se absorben solas` : 'Bolsas nuevas durante la temporada')),
  N('piedra', 'suelo', -2, 3, ['grandes'], 'Ácidos fuertes', 'Tus hifas atraviesan las piedras.', 1, { c: 'n', b: 900, k: 1 },
    () => 'Las piedras ya no te paran'),
  N('minerales', 'minerales', 0, 4, ['reaparicion'], 'Meteorización', 'Aparecen vetas de minerales (cian). Los minerales abren nuevas ramas.', 1, { c: 'n', b: 3500, k: 1 },
    () => 'Vetas de minerales'),
  N('min2', 'minerales', -1, 5, ['minerales'], 'Ácidos orgánicos', 'Cada veta da más minerales y hay más vetas.', 5, { c: 'm', b: 12, k: 1.9 },
    (l) => `${1 + l} minerales por veta`),
  N('arboles', 'simbiosis', 1, 5, ['minerales'], 'Micorriza', 'Aparecen árboles. Si tu red toca sus raíces, te dan azúcar mientras dure la temporada.', 1, { c: 'm', b: 25, k: 1 },
    () => '2 árboles por temporada'),
  N('pelos', 'simbiosis', 2, 6, ['arboles'], 'Pelos radicales', 'Los árboles dan más azúcar.', 5, { c: 'a', b: 15, k: 2 },
    (l) => `Azúcar ×${(1.5 ** l).toFixed(1).replace('.', ',')}`),
  N('bosque', 'simbiosis', 1, 7, ['arboles'], 'Bosque conectado', 'Más árboles en cada temporada.', 3, { c: 'a', b: 40, k: 2.5 },
    (l) => `${2 + l} árboles`),

  // ── Temporada (izquierda) ──────────────────────────────────────────────
  N('dur', 'temporada', -1, 0, ['espora'], 'Temporada larga', 'Cada temporada dura más.', 8, { c: 'n', b: 14, k: 1.7 },
    (l) => `${30 + 4 * l} s por temporada`),
  N('inicio', 'temporada', -2, -1, ['dur'], 'Brote fuerte', 'Empiezas cada temporada con la red ya algo crecida.', 3, { c: 'n', b: 160, k: 3 },
    (l) => `Empiezas con ${l * 3} ramas`),
  N('lluvia', 'temporada', -2, 1, ['dur'], 'Lluvia', 'Aparecen charcos: dentro, creces el doble de rápido.', 3, { c: 'n', b: 260, k: 2.2 },
    (l) => `${l * 2} charcos`),
  N('otono', 'temporada', -3, 0, ['inicio', 'lluvia'], 'Otoño largo', 'Temporadas todavía más largas.', 3, { c: 'm', b: 20, k: 2.5 },
    (l) => `+${10 * l} s por temporada`),
];

export const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]));

// Base de una temporada
export const BASE = {
  speed: 18, // px por segundo
  tips: 2,
  branch: 0.1, // probabilidad de ramificar cada 12 px
  attract: 55, // px
  duration: 30, // s
  absorb: 2, // px de margen para tocar una bolsa
  pockets: 16,
};

export const POCKETS = {
  n: { r: 2, value: 1, color: '#F28C28', dark: '#B8581A' },
  big: { r: 3, value: 5, color: '#FFB347', dark: '#C46A12' },
  leaf: { r: 4, value: 4, color: '#7DD181', dark: '#3E8A4A' },
  m: { r: 2, value: 1, color: '#5FCDE4', dark: '#2B7C93' },
  guano: { r: 4, value: 12, color: '#D9C9A0', dark: '#8A7A58' },
  c: { r: 3, value: 1, color: '#C79BFF', dark: '#6A4AA8' },
};
