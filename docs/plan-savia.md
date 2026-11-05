# Plan de desarrollo: Savia

Savia sustituye a Micelio. El protagonista pasa a ser el árbol: en cada temporada sus raíces bajan por el suelo recogiendo nutrientes y, al acabar, el árbol crece según lo largas que fueron y suelta frutos. Con los frutos compras mejoras, plantas más árboles y abres zonas nuevas, hasta un final cerrado.

El Micelio tal como estaba queda guardado en git: commit `102c463`, etiqueta `micelio`. Para volver a verlo: `git checkout micelio`.

## Lo que decidiste

| Tema | Decisión |
| --- | --- |
| Durante la temporada | Guías las puntas de las raíces con el ratón, como ahora |
| Raíces | Cada raíz avanza hasta un largo máximo, se para y de ella brota una nueva. Cada temporada empieza de cero |
| Fin de temporada | Sin reloj: acaba cuando se gastan los brotes |
| El árbol de arriba | También empieza de cero cada temporada: es un brote que crece según sus raíces de ese año |
| Frutos | Caen al final; los que atrapas con el ratón valen doble y los que caen al suelo cuentan igual |
| Árboles | Un bosque que crece: varios árboles iguales echan raíces a la vez |
| Monedas | Solo una: frutos |
| Mejoras | Un árbol de habilidades como el de ahora, con contenido nuevo |
| Micelio | Fuera del todo: ni setas, ni esporas, ni el nombre |
| Nombre | Savia |
| Minijuegos | Nuevos, de árboles |
| Final | Cerrado |

## Cómo se juega

### Una temporada

1. **Plantar.** Empieza con tus árboles como brotes en la superficie. Al principio tienes uno.
2. **Raíces.**
   - Cada árbol echa 2 raíces. Avanzan hacia abajo y tú las guías con el ratón hacia la comida.
   - Cada raíz tiene un largo máximo (al principio unos 40 cm). Cuando lo alcanza, o choca con una piedra, se para. Si a su árbol le quedan brotes, de esa raíz vieja brota una nueva.
   - Las raíces viejas se ven más gruesas y oscuras, y las vivas claras, con la punta brillante.
3. **Nutrientes.**
   - Las bolsas del suelo valen más cuanto más hondo están, como ahora.
   - Al tocarlas suman crecimiento al árbol dueño de esa raíz.
   - Las bolsas grandes dan además un brote extra, así que jugar bien alarga la temporada.
4. **Fin.** Cuando ninguna raíz sigue viva y no quedan brotes, la temporada acaba. En el HUD ves los brotes que quedan y la profundidad.
5. **Cosecha** (unos 5 s).
   - La cámara sube y cada árbol crece de golpe hasta un tamaño que depende de su crecimiento.
   - Los frutos maduran y caen. Los que atrapas pasando el ratón valen ×2; los que llegan al suelo valen ×1.
6. **Resumen.** Muestra los frutos y el récord de profundidad, y te deja ir al árbol de mejoras o empezar otra temporada.

**Crecimiento de un árbol** = largo total de sus raíces + nutrientes que recogieron. **Frutos** = crecimiento × frutos por crecimiento. Los números exactos los ajusta el simulador.

### El bosque

- Más árboles se compran con frutos, con una mejora repetible («Plantar otro árbol»). Cada zona tiene un número de huecos.
- Todos los árboles echan raíces a la vez y comparten el suelo, así que compiten por la comida.

### Mejoras (árbol de habilidades)

| Rama | Ejemplos |
| --- | --- |
| Raíces | Raíz más larga, más brotes, más velocidad, una raíz más al empezar, olfato (las puntas buscan comida cercana) |
| Árbol | Más crecimiento, más frutos por crecimiento, fruto dorado (a veces vale ×5), recoger desde más lejos, frutos que caen más despacio |
| Bosque | Plantar otro árbol, raíces que se ayudan cuando se tocan |
| Zonas | Un nodo abre cada zona y trae su rama de unas 8 mejoras |

En la fase 1 serán unos 15 nodos; al final, unos 60.

### Zonas (propuesta)

Todas usan frutos; lo que cambia es el suelo.

| Zona | Qué tiene de nuevo |
| --- | --- |
| Pradera | Tierra blanda, piedras y bolsas de nutrientes. Enseña lo básico |
| Ribera | Agua bajo tierra: las raíces que llegan al agua crecen el doble de rápido, y una corriente las empuja de lado |
| Ladera | Roca dura que solo se cruza por las grietas, vetas minerales que valen mucho y zarzas rivales que roban la comida |
| Bosque viejo | Tocones y raíces muertas de árboles antiguos que se pueden absorber. Aquí está la meta final |

**Final:** «El árbol madre», un nodo que pide tenerlo todo. Al comprarlo, tu bosque se convierte en un bosque antiguo, con su escena de cierre.

### Minijuegos (entre temporadas, con espera)

- **Polinizar:** guías una abeja por las flores durante unos segundos. Más flores dan más frutos en la próxima temporada.
- **Podar:** cortas las ramas secas antes de que caigan. Da frutos al momento.

### Ritmo objetivo

- **Primera temporada:** unos 15–20 s, un árbol y unos 5 frutos. La primera mejora llega en 1–2 temporadas.
- **Temporadas siguientes:** entre 20 y 60 s. Más árboles crecen a la vez, no en fila, así que la temporada no se alarga por tener más.
- **Duración total:** unos 25–30 min por zona y unas 2 h hasta el final.

## Qué se reaprovecha del código actual

- **Se queda:**
  - Vite y la estructura de archivos.
  - El motor de puntas y segmentos de `run.js`.
  - El suelo sin fin por trozos, con su dureza y valor según la profundidad.
  - La cámara que sigue a la red, las capas, la regla en metros y el récord.
  - El estilo pixel cálido y la fuente Jersey 15.
  - La pantalla del árbol de mejoras (`treeview.js`).
  - Ventanas y avisos (`ui.js`), sonidos (`audio.js`), formato de números (`format.js`), la base de los minijuegos (`common.js`) y el simulador.
- **Se rehace:**
  - Las mejoras y zonas (`data.js`) y los parámetros de temporada (`game.js`).
  - En `run.js`: árboles, raíces con largo máximo, brotes y frutos.
  - El dibujo (`render.js`): árboles que crecen, raíces gruesas y cosecha.
  - El flujo y los textos (`main.js`), los iconos y los minijuegos.
- **Se quita:** setas, esporas, colonias, turba, cristales, guano, murciélagos, grillos, oscuridad y las cuatro monedas antiguas.
- **Guardado:** uno nuevo (`savia:save`). La partida de Micelio se queda en el navegador pero no se usa.

## Fases

Cada fase acaba con una prueba tuya antes de seguir. Antes de cada cambio visual grande habrá una maqueta.

### Fase 1: núcleo en la pradera, con un árbol (hecha el 5 de noviembre de 2026)

Cambios respecto al plan:
- La velocidad de las raíces va unida a su largo, para que la temporada no se alargue al comprar «Raíces largas».
- Los brotes extra de las bolsas verdes tienen tope.
- Los frutos saltan del árbol en arco antes de caer, porque con árboles pequeños caían demasiado cerca para atraparlos.
- La fase 1 tiene 20 nodos en lugar de 15.
- Detalles en [diseno.md](diseno.md).

- `run.js`: raíces con largo máximo y brotes desde la raíz vieja, fin al gastar los brotes, crecimiento por árbol y frutos. Se limpia todo lo de setas.
- `render.js`: árbol brote y árbol crecido según el crecimiento, raíces vivas y viejas, cámara que sube al final, frutos que caen y se atrapan con el ratón.
- HUD: brotes que quedan, profundidad, frutos. Resumen nuevo.
- Árbol de habilidades con unos 15 nodos de Raíces y Árbol.
- Nombre, título, textos, iconos, la ventana de bienvenida y el guardado nuevo.
- Simulador adaptado para medir el ritmo de la pradera.

**Pruebas tú:** si se entiende lo del largo máximo y los brotes, cómo se siente la cosecha y si el ritmo engancha.

### Fase 2: el bosque (hecha el 5 de noviembre de 2026)

- Además: un cursor propio. En los menús es una flecha crema con una mano sobre lo que se puede pulsar; en la temporada, un brote al guiar las raíces y una cesta en la cosecha.
- El ritmo se acelera mucho al final: el bot lo compra todo en la pradera hacia el minuto 27. La zona nueva de la fase 3 tendrá que costar lo bastante para frenarlo.

- Plantar más árboles en los huecos de la pradera, raíces que compiten y rama Bosque.
- Minijuego «Polinizar».

**Pruebas tú:** si varios árboles a la vez se siguen entendiendo de un vistazo.

### Fase 3: Ribera y Ladera (hecha el 5 de noviembre de 2026)

- La Ribera se abre con un nodo desde la rama Bosque y la Ladera tras «La crecida». Un selector junto al botón de empezar elige la zona.
- La raíz que choca de frente con la roca se para, pero dentro de una grieta la sigue sola.
- Además, a petición tuya:
  - La profundidad es una barra vertical a la derecha, con las capas, el récord y cuánto vale la comida.
  - Los brotes son una barra que se vacía. Ya no se muestra «creciendo».
- La pantalla de mejoras se encaja sola para que se vea todo el árbol.
- Ritmo del bot: Pradera unos 27 min, Ribera unos 31 y Ladera unos 29 (1 h 30 en total).

- Dos zonas, cada una con su truco de suelo y su rama de mejoras. Antes, maquetas de su aspecto.
- Minijuego «Podar».

### Fase 4: Bosque viejo y final (hecha el 5 de noviembre de 2026)

- El Bosque viejo (comida ×30) tiene tocones que descomponer y raíces muertas que se absorben al seguirlas.
- «El árbol madre» pide todas las mejoras al menos a nivel 1.
- Tras la escena final se empieza de nuevo desde la semilla con frutos ×2 para siempre (×2 más por cada vez que acabes).
- Las piedras ya no paran las raíces: las rodean si pueden. Antes, una piedra junto al árbol podía acabar la temporada en 2 segundos.
- Ritmo del bot: el árbol madre llega entre 1 h 34 min y 1 h 57 min, con unos 25 min por zona.

- Zona final, el árbol madre y la escena de cierre.
- Ajuste del ritmo de todo el juego con el simulador.
- `docs/diseno.md` y el README reescritos para Savia.
