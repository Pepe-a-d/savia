# Micelio

Incremental de navegador en pixel art. Cada temporada tu micelio crece unos segundos desde la espora, excavando hacia abajo, y tú lo guías con el ratón (o el dedo) hacia la comida. El suelo no se acaba: la cámara baja con la red y lo hondo vale más. Entre temporadas mejoras tu red en un árbol de habilidades. Fase 1: el bosque, que acaba con el anillo de hadas. Fase 2: el pantano, que acaba con el fuego fatuo. Fase 3: la cueva, a oscuras, que acaba con su corazón. El diseño está en [docs/diseno.md](docs/diseno.md).

```bash
npm install
npm run dev      # http://localhost:5190 (o el siguiente puerto libre)
npm run build    # genera dist/ (base relativa: vale para GitHub Pages)
npm run sim      # un bot juega temporadas y compra en el árbol para medir el ritmo
```

## Dónde está cada cosa

| Archivo | Qué hace |
| --- | --- |
| `src/data.js` | Monedas, lugares, capas del suelo, ramas y los 61 nodos del árbol (posición, precio y texto de cada efecto) |
| `src/game.js` | Progreso permanente: niveles, compras, parámetros de la temporada (`computeStats`) y guardado |
| `src/run.js` | Una temporada sin DOM, vista en corte: suelo sin fin generado por trozos, dureza y valor según la profundidad, crecimiento, puntero, absorción, troncos, árboles, setas y, según el lugar, corriente, colonias, turba, juncos, oscuridad, cristales, guano y grillos |
| `src/render.js` | Dibujo pixel de la temporada a pantalla completa (lienzo pequeño ampliado con zoom entero), con cámara que baja con la red, capas, regla en metros y récord |
| `src/treeview.js` | Pantalla del árbol: nodos, líneas, arrastrar, zoom y ficha |
| `src/pixel.js` | Paleta e iconos pixel dibujados con mapas de caracteres |
| `src/ui.js` | Barras de monedas, avisos, ventanas y ajustes |
| `src/main.js` | Bucle y paso entre árbol, temporada y resumen |
| `src/minigames/` | Esporada y Descomposición |
| `sim/balance.mjs` | El bot del simulador |

## Para probar

- En desarrollo, desde la consola: `micelio.debug.give(1e6)` da nutrientes (`give(100, 'e')` da esporas) y `micelio.debug.endRun()` termina la temporada.
- La partida se guarda en `localStorage` (`micelio:save`) tras cada temporada y cada compra. Las partidas de versiones anteriores ya no se cargan.
- Antes de tocar precios o efectos, pasa `npm run sim`.
