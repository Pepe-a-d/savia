# Micelio: diseño del juego

> Borrador 5, del 4 de noviembre de 2026. Las temporadas pasan a ser de excavar: el suelo no se acaba y la cámara baja con la red. Antes, con las mejoras, la red llenaba la pantalla a los 5 s y el resto de la temporada era ver subir los números.
>
> Borrador 4, del 4 de noviembre de 2026. Ya están construidas las fases 1 (bosque), 2 (pantano) y 3 (cueva).
>
> Borrador 2, del 4 de noviembre de 2026. Sustituye al bosque de casillas (borrador 1): al jugarlo había demasiadas cosas en pantalla, el estilo no funcionaba y no enganchaba. Esta versión sigue el esquema de los incrementales cortos de éxito recientes (partidas breves y un árbol de habilidades grande entre una y otra), con estilo pixel cálido.

## En una frase

Cada temporada tu micelio crece desde la espora durante unos segundos, excavando hacia abajo, y tú lo guías con el puntero hacia la comida. Cuanto más hondo, más vale todo. Con lo que absorbes compras mejoras en un árbol de habilidades, y la siguiente temporada llegas más hondo y más rápido, hasta hacer fructificar el anillo de hadas.

## Lo decidido

| | |
| --- | --- |
| Estructura | Temporadas cortas (30 s al principio, unos 90 s al final) y árbol de habilidades entre una y otra |
| Estilo | Pixel cálido: paleta morada, crema y naranja, con la fuente Jersey 15 (Pixelify Sans se leía mal; también se probó VT323). La partida es una escena en corte que ocupa toda la pantalla: cielo y superficie arriba, capas de suelo debajo |
| Ingredientes | Árbol de habilidades, minijuegos opcionales y mecánicas nuevas que aparecen al avanzar |
| Ritmo | Lento al principio y cada vez más rápido. Simple de entrada, con más capas cuanto más avanzas |
| Excavar | El suelo no se acaba hacia abajo. La cámara baja con la red, cada capa vale más y, al acabar, sube a la superficie para enseñar las setas. Hay un récord de profundidad por lugar |
| Final | Cerrado por fases. El bosque termina con el anillo de hadas (unos 34 min con el bot), el pantano con el fuego fatuo (unos 43 min más) y la cueva con su corazón (unos 35 min más) |

## La temporada

- La espora está justo bajo la superficie y la red crece sola hacia abajo y a los lados, con 2 puntas al principio. Si una punta llega a la superficie, muere.
- **El suelo no se acaba.** Se genera por trozos según bajas, así que siempre hay tierra nueva y la red nunca se satura. La cámara sigue a lo más hondo de la red (nunca vuelve a subir durante la temporada) y, al acabar, sube a la superficie para ver brotar las setas.
- **Capas:** cada lugar tiene 5 capas con nombre y color propios. Al llegar por primera vez a una capa sale un cartel con su nombre. A la derecha hay una regla en metros (1 px = 1 cm).

| Lugar | Capas (desde la superficie) |
| --- | --- |
| Bosque | Tierra, Arcilla (1,5 m), Roca (4 m), Roca madre (8 m), Profundidades (15 m) |
| Pantano | Barro, Barro inundado (0,36 m), Cieno (3 m), Turba antigua (7 m), Abismo (14 m) |
| Cueva | Caliza, Pizarra (1,5 m), Basalto (4 m), Geoda (8 m), Abismo (15 m); la roca sin explorar es más negra cuanto más hondo |

- **Lo hondo vale más, pero cuesta más:** la comida vale ×(1 + profundidad / 300 px) y la tierra es más dura, así que se crece a 1 / (1 + profundidad / 150 px) de la velocidad. Lo especial (minerales, turba, colonias, cristales, grillos) aparece en cada pantalla de suelo con una densidad fija, pero su valor no sube con la profundidad.
- **Récord:** una línea discontinua marca tu récord de profundidad en ese lugar. Al superarlo sale «¡Nuevo récord!». El resumen dice hasta dónde bajaste.
- El mundo se adapta a la pantalla con un zoom entero (1 px del juego son 4 o 5 px de pantalla). Las cantidades de cosas se ajustan al área para que el equilibrio sea el mismo en cualquier formato.
- La capa de arriba es la más fértil (algo más de comida en los primeros 70 px), la hojarasca está justo debajo y los minerales desde 1,1 m. Los árboles se ven en la superficie y sus raíces bajan al suelo. Los troncos están medio enterrados.
- Las puntas que están cerca del puntero (ratón o dedo) giran hacia él. Las demás vagan y se abren hacia fuera.
- Si una punta toca una bolsa de comida, la absorbe y salta un «+número». Las piedras bloquean el paso.
- Las celdas donde la red ya es densa se llenan, así que las puntas no se amontonan. Las bolsas nuevas que caen sobre tu red se absorben solas.
- Al acabarse el tiempo, si tienes «Fructificación», brotan setas en la superficie, encima de la red, y sueltan esporas: una seta por cada 100 px de red hasta 100 setas y, a partir de ahí, crecen con la raíz cuadrada (en pantalla se dibujan 150 como mucho). Después viene un resumen con lo ganado y los minijuegos, si los tienes desbloqueados.
- En pantalla solo hay el temporizador, las monedas que conoces, el número de la temporada y una línea con la profundidad, la capa, cuánto vale ahí la comida y tu récord.

## El árbol de habilidades

Hay 36 nodos con niveles. Un nodo se ve cuando ya tienes alguno de los que llevan a él, y los de la siguiente fila aparecen como siluetas «?».

| Rama | Dirección | Qué mejora o desbloquea |
| --- | --- | --- |
| Crecimiento | Arriba | Velocidad, puntas, ramificación, alcance del puntero y quimiotaxis (las puntas buscan comida solas) |
| Absorción | Derecha | Valor de las bolsas (×1,3 por nivel), radio, absorción pasiva por píxel de red y multiplicadores ×2, ×2 y ×3 |
| Suelo | Abajo | Más bolsas, bolsas gordas (×5), hojarasca (×4), bolsas nuevas durante la temporada y atravesar piedras |
| Temporada | Izquierda | Duración, empezar con la red crecida, charcos (crecer el doble de rápido) y otoño largo |
| Minerales | Bajo Suelo | Vetas cian. Los minerales pagan nodos más profundos |
| Simbiosis | Bajo Minerales | Árboles. Si tu red toca sus raíces, dan azúcar durante la temporada |
| Troncos | Bajo Absorción | Troncos que hay que cubrir de red. Minijuego de Descomposición (×1 a ×3 sobre lo que dieron) |
| Fructificación | Sobre Crecimiento | Setas y esporas, minijuego de la Esporada (×1 a ×2,5) y, al final, el anillo de hadas |

El **anillo de hadas** cuesta 15.000 esporas y exige haber llegado al final de las otras ramas: Sombrero ancho, Digestión total, Bosque conectado, Otoño largo y Enzimas de la madera.

## Monedas

Las monedas aparecen poco a poco. Al principio solo hay nutrientes; después llegan los minerales, el azúcar y las esporas, cada una con un color y un icono propios.

## Ritmo (bot del simulador, `npm run sim`)

Con el suelo sin fin (borrador 5). El bot apunta el 85% del tiempo y supone minijuegos medianos.

| Momento | Por temporada | Hasta dónde baja | Nodos comprados |
| --- | --- | --- | --- |
| Temporada 1 | ~14 N | ~1,5 m | 2-3 |
| 10 min | ~630 N | ~4 m | ~39 |
| 20 min | ~115.000 N (quimiotaxis) | ~8 m | ~108 |
| 30 min | ~1,4 M N, esporas y azúcar | ~14 m | ~141 |
| 33-35 min | Anillo de hadas: se abre el pantano | ~19 m | ~150 |
| +10 min | Pantano: ~70 T | ~25 m | ~162 |
| +20 min | Pantano: ~230 T | ~31 m | ~176 |
| +42-45 min | Fuego fatuo: se abre la cueva | ~29 m | ~186 |
| +10 min | Cueva: ~150 C | ~40 m | ~201 |
| +20 min | Cueva: ~500 C | ~41 m | ~213 |
| ~1 h 49 min - 1 h 53 min | Corazón de la cueva (unos 35 min de cueva) | | ~215 |

## Fase 2: el pantano

- **Cómo se abre:** al comprar el anillo de hadas se abre el pantano, y en el árbol aparecen el nodo «Viaje al pantano» y su rama (arriba a la izquierda). Desde entonces, al pie del árbol eliges dónde pasar cada temporada: en el bosque o en el pantano. El árbol del bosque no se reinicia.
- **Lo nuevo en la temporada:**
  - **Barro inundado** (desde el 30% de profundidad): creces ×1,6, pero una corriente lateral arrastra las puntas.
  - **Colonias rivales** (1,5 por pantalla de suelo): bacterias rojas que crecen, se comen la red y la comida que tocan, y matan a las puntas que entran. Con Antibióticos, las puntas las atacan y, al destruirlas, dan turba.
  - **Depósitos de turba** (0,6 por pantalla, más con Turbera; 4 T cada uno, ×1,5 por nivel de Turbera): hay que cubrirlos de red. Los juncos de la orilla dan turba mientras estén conectados.
- **La turba** es la moneda nueva. Hay nodos de la rama que cuestan nutrientes o esporas, para que el bosque siga sirviendo.

| Nodo | Efecto |
| --- | --- |
| Hifas nadadoras | La corriente arrastra menos |
| Turbera | Más depósitos y más turba |
| Juncos, Rizosfera | Juncos que dan turba |
| Corriente a favor | Velocidad ×1,25 en los dos lugares |
| Micelio anfibio | Nutrientes ×2 en los dos lugares |
| Antibióticos, Penicilina | Destruir colonias |
| Cuarentena | Menos colonias, que crecen más despacio |
| Esporas viajeras | Más setas en los dos lugares |
| Bioluminiscencia | Las hifas brillan en verde y absorben ×1,5 |
| **Fuego fatuo** | Final de la fase 2. Pide 2.500 de turba y tener Bioluminiscencia, Penicilina, Rizosfera, Esporas viajeras y Cuarentena |

## Fase 3: la cueva

- **Cómo se abre:** al comprar el fuego fatuo se abren el nodo «Descenso a la cueva» y su rama, más a la izquierda del pantano. El selector pasa a tener tres lugares.
- **La escena:** arriba está el aire de la cueva, con estalactitas, gotas que caen y murciélagos colgados del techo. Debajo, la roca por capas, con estalagmitas y picos que bajan.
- **Oscuridad:** lo no explorado está negro y lo explorado queda en penumbra. Solo hay luz plena alrededor de la espora y de las puntas que crecen. La luz es de 10 px por punta: Luz propia la multiplica por 1,3 por nivel y la Bioluminiscencia del pantano por 1,4.
- **Cristales** (moneda nueva, morada): 1 por pantalla de roca desde 0,4 m, más con Geoda. A oscuras solo destellan de vez en cuando, y con Ecolocalización se ve su silueta.
- **Guano:** está bajo los murciélagos, junto al techo de roca, y vale ×12.
- **Grillos:** saltan por la roca. Si tocan tu red se llevan esporas y, al soltarlas, nace allí una red nueva de 2 o más puntas.
- **Estalagmitas:** bloquean con forma de pico hasta tener Disolver caliza.

| Nodo | Efecto |
| --- | --- |
| Luz propia | Luz ×1,3 por nivel |
| Geoda | +2 cristales por nivel y valen ×1,5 |
| Grillos de cueva, Polizones | Saltos |
| Guano | Montones de guano |
| Ecolocalización | Ver los tesoros a oscuras |
| Disolver caliza | Atravesar estalagmitas |
| Raíces profundas | Velocidad ×1,25 en todos los lugares; cuesta nutrientes |
| Resonancia cristalina | Nutrientes ×3 en todos los lugares |
| Esporas de cristal | Setas ×1,5 en todos los lugares; cuesta esporas |
| **El corazón de la cueva** | Final de la fase 3. Pide 3.600 cristales y tener Polizones, Ecolocalización, Disolver caliza, Resonancia y Esporas de cristal |

## Más adelante

- **Ruinas:** materiales humanos y automatizaciones.
- **Final:** el hongo antiguo.

## Pendiente

- Probar con personas el ritmo de los primeros 10 minutos y lo claro que resulta guiar la red con el puntero.
- Probar con una persona si la cámara que baja sola se entiende y si en las últimas fases (40 m de hondo en 90 s) baja demasiado deprisa.
- Sonido con más variedad: hoy son tonos sintetizados sencillos.
