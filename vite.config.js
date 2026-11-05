import { defineConfig } from 'vite';

// base relativa: el build funciona igual en la raíz de un dominio o en una subcarpeta (GitHub Pages).
export default defineConfig({
  base: './',
  server: { port: 5190 },
});
