# Savia: diseño del juego

> Borrador 4 de Savia, del 5 de noviembre de 2026. Recoge el juego completo: las fases 1 (la pradera, con un árbol), 2 (el bosque: más árboles, uniones de raíces, Polinizar y cursor propio), 3 (la Ribera, la Ladera y Podar) y 4 (el Bosque viejo, el árbol madre y empezar de nuevo). Sustituye al diseño de Micelio, que sigue en la etiqueta de git `micelio`. El plan de las fases siguientes está en [plan-savia.md](plan-savia.md).

## En una frase

Cada temporada tu árbol echa raíces que guías con el puntero hacia la comida. Cada raíz llega hasta un largo máximo, se para y de ella brota otra. Cuando se acaban los brotes, el árbol crece según sus raíces y suelta frutos que atrapas al vuelo. Con los frutos compras mejoras.

## Lo decidido

| | |
| --- | --- |
| Estilo | Pixel cálido (paleta morada, crema y naranja) con la fuente Jersey 15, en una escena en corte a pantalla completa: cielo alto para el árbol y capas de suelo debajo |
| Control | El puntero (ratón o dedo) guía las puntas de las raíces |
| Temporada | Sin reloj: acaba cuando se gastan los brotes. Raíces y árbol empiezan de cero cada vez |
| Moneda | Solo una: frutos |
| Mejoras | Un árbol de mejoras con nodos y niveles |
| Árboles | Un bosque de hasta 4 árboles iguales que echan raíces a la vez |
| Cursor | Propio: flecha crema y mano en los menús; un brote al guiar las raíces y una cesta en la cosecha |
| Final | «El árbol madre», en el Bosque viejo. Pide todas las mejoras al menos a nivel 1. Tras la escena final se empieza de nuevo con frutos ×2 para siempre |

## La temporada

1. **Raíces.**
   - El árbol es un brote en la superficie y echa 2 raíces hacia abajo.
   - Las raíces que están cerca del puntero giran hacia él. Cuando una llega a donde apuntas, sigue su camino hasta que muevas el puntero, para que no dé vueltas.
   - Sin guía, las raíces tienden a bajar. Se apartan de las que ya hay, así que se abren en abanico.
2. **Largo máximo y brotes.**
   - Cada raíz avanza hasta su largo máximo (40 cm al principio), y se para. Las piedras las rodea si puede; si no, también se para, igual que en el borde.
   - Si a su árbol le quedan brotes, de un punto de la mitad honda de esa raíz brota otra.
   - Las raíces paradas se dibujan más oscuras y más gruesas cuanto más cerca del tronco están. Las vivas se ven claras, con la punta brillante.
3. **Comida.**
   - Las bolsas naranjas suman crecimiento y valen más cuanto más hondo están.
   - Las bolsas verdes («gordas») valen ×4 y dan un brote más. Cada árbol puede ganar como mucho tantos brotes extra como brotes tenía.
4. **Fin de las raíces.** Cuando no crece ninguna raíz, la cámara sube.
5. **Crecimiento.** El árbol crece en 1,6 s hasta un tamaño que sube con el logaritmo de su crecimiento: crecimiento = (largo de raíces × 0,05 + comida) × Savia.
6. **Frutos.**
   - Frutos = crecimiento × 0,3 × Más frutos.
   - Se dibujan como mucho 24 frutos por árbol (según lo que cabe en la copa), y cada uno vale su parte del total.
   - Los frutos saltan del árbol hacia un lado y caen. Atrapados con el puntero valen ×2 (×3 con «Al vuelo»); los que llegan al suelo valen ×1.
7. **Resumen.** Muestra las raíces, la profundidad, el crecimiento, los frutos atrapados y los récords. Desde aquí se puede ir a **Mejoras** o jugar **Otra temporada**.

**Lo que se ve durante la temporada:**
- Arriba: la temporada (y la zona), los frutos y el crecimiento (hoja verde).
- Debajo, la barra de **brotes**, que se vacía a medida que se gastan.
- A la derecha, una barra vertical de **profundidad**: se llena según bajas, con marcas en los cambios de capa y una línea discontinua en tu récord. En su punta dice los metros y cuánto vale ahí la comida.
- Al entrar en una capa nueva o batir el récord sale un cartel grande.

En la cosecha, en lugar de las barras sale cuántos frutos llevas atrapados.

**El suelo:**
- No se acaba, como en Micelio. Hay 5 capas: Tierra, Arcilla (1,5 m), Roca (4 m), Roca madre (8 m) y Profundidades (15 m).
- La comida vale ×(1 + profundidad / 300 px).
- Lo hondo frena: las raíces crecen a 1 / (1 + profundidad / 400 px) de la velocidad.
- Una línea marca el récord de profundidad.

**La velocidad:** va unida al largo. Cada raíz tarda unos 4,5 s en llegar a su largo máximo en tierra blanda, así que alargar las raíces no alarga la temporada; «Puntas rápidas» la acorta.

## El bosque

- **Árboles:** «Plantar otro árbol» (hasta 4) reparte los árboles a lo ancho de la pradera. Todos echan raíces a la vez y comparten la tierra: compiten por la comida, y cada bolsa es del árbol cuya raíz llega antes.
- **Uniones:**
  - Con «Raíces entrelazadas», cuando una raíz entra en una casilla donde hay una raíz de otro árbol, se unen (una vez por pareja de raíces).
  - Cada unión da +3 % de crecimiento por nivel a los dos árboles, hasta 8 uniones por árbol.
  - Sale un destello morado con «unión +3%».
- **Bosque espeso:** +5 % de crecimiento por nivel por cada otro árbol.
- **Mantillo:** los frutos que caen al suelo valen +25 % por nivel.
- **Polinizar** (lo da «Abejas»):
  - Se juega desde el resumen, una vez cada 3 temporadas.
  - Guías una abeja con el puntero, con velocidad máxima, durante 10 s (+3 s por nivel de Colmena).
  - Las flores se abren en las copas cada 0,55 s y se cierran a los 2–3 s.
  - Cada flor tocada da +5 % de frutos en la próxima temporada (+1 % por nivel de Colmena).
  - El resultado se guarda en la partida y vale para una sola temporada.

## Zonas

Se elige la zona con un selector junto al botón de empezar. Los árboles plantados y todas las mejoras valen en todas las zonas.

| Zona | Comida | Qué tiene |
| --- | --- | --- |
| Pradera | ×1 | Piedras, charcos (con Lluvia) y bolsas |
| Ribera | ×3 | Agua subterránea de 0,36 a 2,6 m |
| Ladera | ×10 | Roca desde 16 cm, con grietas, vetas y zarzas |
| Bosque viejo | ×30 | Tocones y raíces muertas |

**Ribera:**
- Dentro del agua subterránea, las raíces crecen ×2 (más con Raíces capilares).
- Una corriente de 16 px/s las arrastra hacia un lado (menos con Raíces ancladas).
- Cada raíz que llega al agua da +4 % de crecimiento a su árbol, hasta 10 raíces por árbol (más con Sed).

**Ladera:**
- La roca solo se cruza por las grietas, que bajan serpenteando con ramales laterales.
- Si una raíz choca de frente con la roca, se para; dentro de una grieta, la sigue sola. Con Raíces ácidas puede atravesar unos centímetros.
- Las vetas (cian) están pegadas a las grietas y valen ×8 la comida normal.
- Tres zarzas nacen en la superficie, crecen hacia la comida cercana y se la comen. La roca las desvía, y Alelopatía las frena.

**Bosque viejo:**
- **Tocones:** en la superficie hay 3 (más con Memoria del bosque). Cubriendo su madera con unos 70 cm de raíz (menos con Carcoma), se descomponen y dan 60 veces una bolsa normal y 2 brotes.
- **Raíces muertas:** salen de los tocones y hay más sueltas por el suelo. Cada tramo que toca una punta se absorbe: da 0,25 bolsas por cm y se ilumina en ámbar. Mientras va por una, la raíz crece ×1,6 de rápido (más con Sendas antiguas).

**Podar** (lo dan las «Tijeras de podar»):
- Se juega desde el resumen, una vez cada 3 temporadas.
- En la copa sale una rama seca cada 0,6 s; tiembla y cae a los 2 s. Hay que hacer clic en ella antes.
- Cada rama cortada da al momento el 6 % de los frutos de la última temporada (+50 % por nivel de Tijeras afiladas).

## El final

- **Árbol madre:** «El árbol madre» cuesta 12.000 M de frutos y pide tener todas las demás mejoras al menos a nivel 1. Al comprarlo, sale la escena final: en el centro del bosque crece un árbol enorme, con luces que suben al cielo y las estadísticas de la partida.
- **Empezar de nuevo:** el botón «Empezar de nuevo» vuelve a la semilla. Por cada vez que hayas acabado, frutos ×2 para siempre (generación 2: ×2, generación 3: ×4…). Se conservan los ajustes, las ventanas ya vistas y el historial de partidas.
- **Si cierras en la escena final,** vuelve a salir al abrir el juego.

## Mejoras (46 nodos)

| Rama | Nodos |
| --- | --- |
| Raíces (arriba) | Raíces largas (×1,2 de largo por nivel), Más brotes (+2), Puntas rápidas, Raíz doble (+1 raíz a la vez), Olfato (buscan comida solas), Atracción (alcance del puntero), Raíz pivotante (lo hondo frena menos) |
| Suelo (abajo) | Digestión (+30 % por bolsa), Suelo rico (+25 % de bolsas), Bolsas gordas, Pelos radicales (radio de absorción), Lluvia (charcos donde se crece el doble), Raíces que rompen (atraviesan piedras) |
| Árbol y cosecha (derecha) | Savia (+25 % de crecimiento), Más frutos (+20 %), Cesta grande (radio para atrapar), Fruto dorado (vale ×5), Caída lenta, Al vuelo (atrapados ×2,5 y ×3) |
| Bosque (izquierda) | Plantar otro árbol (hasta 4), Abejas (Polinizar), Colmena, Raíces entrelazadas, Mantillo, Bosque espeso |
| Ribera (abajo a la izquierda) | Viaje a la ribera, Raíces capilares, Raíces ancladas, Sed, Tijeras de podar, Tijeras afiladas, Riego (comida +25 % en todas las zonas) y La crecida (frutos ×2 en todas las zonas; pide las otras) |
| Ladera (abajo a la derecha) | Subir a la ladera (pide La crecida), Grietas anchas, Raíces ácidas, Vetas ricas, Alelopatía y La cumbre (frutos ×2 en todas las zonas; pide las otras) |
| Bosque viejo (arriba a la derecha) | El bosque viejo (pide La cumbre), Carcoma, Sendas antiguas, Memoria del bosque, Savia eterna (frutos ×2 por nivel) y El árbol madre (el final) |

Los multiplicadores grandes suman por nivel en vez de multiplicarse, y los precios suben entre ×1,9 y ×5 por nivel. Así el ritmo se va frenando poco a poco, en vez de dispararse al final.

## Ritmo (bot del simulador: atrapa la mitad de los frutos, poliniza y poda 6 de cada 10)

| Momento | Qué pasa |
| --- | --- |
| Temporada 1 | 15–20 s de raíces + 5 s de cosecha, unos 10–15 frutos |
| Minuto 12–13 | segundo árbol |
| Minuto 20–25 | tercer y cuarto árbol |
| Minuto 24–25 | se abre la Ribera |
| Minuto 46–51 | La crecida; se abre la Ladera |
| 1 h 13–1 h 22 | La cumbre; se abre el Bosque viejo |
| 1 h 34–1 h 57 | El árbol madre |

Con tres semillas distintas, cada zona dura unos 25 minutos.
