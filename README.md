# Savia

Incremental de navegador en pixel art. Cada temporada tu árbol echa raíces y tú las guías con el ratón (o el dedo) hacia la comida. Cada raíz llega hasta un largo máximo, se para y de ella brota otra. Cuando se acaban los brotes, el árbol crece según sus raíces y suelta frutos: los que atrapas al vuelo valen el doble. Con los frutos compras mejoras en el árbol de mejoras.

El juego está completo:

- Cuatro zonas: la Pradera (con un bosque de hasta 4 árboles), la Ribera (agua subterránea), la Ladera (roca con grietas, vetas y zarzas) y el Bosque viejo (tocones y raíces muertas).
- Dos minijuegos: Polinizar y Podar.
- Un final, «El árbol madre», tras el que se empieza de nuevo con frutos ×2 para siempre.

Al bot le cuesta entre 1 h 30 y 2 h llegar al final. El plan completo está en [docs/plan-savia.md](docs/plan-savia.md) y el diseño en [docs/diseno.md](docs/diseno.md). El juego anterior, Micelio, está en la etiqueta de git `micelio`.

```bash
npm install
npm run dev      # http://localhost:5190 (o el siguiente puerto libre)
npm run build    # genera dist/ (base relativa: vale para GitHub Pages)
npm run sim      # un bot juega temporadas y compra mejoras para medir el ritmo
```

## Dónde está cada cosa

| Archivo | Qué hace |
| --- | --- |
| `src/data.js` | La moneda (frutos), las zonas, las capas del suelo, la base de una temporada y los nodos del árbol de mejoras (posición, precio y texto de cada efecto) |
| `src/game.js` | Progreso permanente: niveles, compras, parámetros de la temporada (`computeStats`) y guardado |
| `src/run.js` | Una temporada sin DOM: suelo sin fin por trozos, raíces con largo máximo que brotan de las viejas, comida, piedras, charcos, agua con corriente (Ribera), roca con grietas, vetas y zarzas (Ladera), tocones y raíces muertas (Bosque viejo), crecimiento del árbol y frutos que saltan y caen |
| `src/render.js` | Dibujo pixel de la temporada a pantalla completa (lienzo pequeño ampliado con zoom entero): cielo, raíces vivas y viejas, árbol que crece, frutos y cámara |
| `src/treeview.js` | Pantalla de mejoras: nodos, líneas, arrastrar, zoom y ficha |
| `src/pixel.js` | Paleta, iconos y cursores pixel dibujados con mapas de caracteres |
| `src/ui.js` | Barra de frutos, avisos, ventanas y ajustes |
| `src/main.js` | Bucle, HUD de la temporada (brotes, crecimiento, profundidad), selector de zona y paso entre mejoras, temporada, resumen y final |
| `src/ending.js` | Escena final del árbol madre |
| `src/minigames/common.js` | Ventana común de los minijuegos |
| `src/minigames/polinizar.js` | Polinizar: una abeja entre las flores de las copas |
| `src/minigames/podar.js` | Podar: cortar las ramas secas antes de que caigan |
| `sim/balance.mjs` | El bot del simulador |

## Para probar

- En desarrollo, desde la consola: `savia.debug.give(1000)` da frutos y `savia.debug.endRun()` para las raíces y pasa a la cosecha.
- `savia.paused = true` congela la temporada (solo dibuja), útil para hacer capturas.
- La partida se guarda en `localStorage` (`savia:save`) tras cada temporada y cada compra.
- Antes de tocar precios o efectos, pasa `npm run sim`.
