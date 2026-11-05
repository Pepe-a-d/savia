// Ventana común de los minijuegos: título, lienzo, botón de saltar y pantalla de resultado.

export function openMinigame({ title, intro, controls = '' }) {
  const wrap = document.createElement('div');
  wrap.className = 'mg-wrap';
  wrap.innerHTML = `
    <div class="mg" role="dialog" aria-modal="true">
      <div class="mg-head">
        <h2></h2>
        <button type="button" class="btn small mg-skip">Saltar</button>
      </div>
      <p class="mg-intro"></p>
      <div class="mg-stage"><canvas></canvas><div class="mg-over"></div></div>
      <div class="mg-controls">${controls}</div>
    </div>`;
  wrap.querySelector('h2').textContent = title;
  wrap.querySelector('.mg-intro').textContent = intro;
  document.getElementById('modal-root').append(wrap);
  const canvas = wrap.querySelector('canvas');
  const over = wrap.querySelector('.mg-over');
  const ctx = canvas.getContext('2d');
  const stage = wrap.querySelector('.mg-stage');

  const size = () => {
    const r = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: r.width, h: r.height };
  };

  const close = () => {
    wrap.classList.add('out');
    setTimeout(() => wrap.remove(), 180);
  };

  /** Muestra un mensaje centrado con un botón; resuelve al pulsarlo. */
  const message = (html, label) => new Promise((resolve) => {
    over.innerHTML = `<div class="mg-msg">${html}<button type="button" class="btn primary">${label}</button></div>`;
    over.hidden = false;
    const b = over.querySelector('button');
    b.focus();
    b.addEventListener('click', () => { over.hidden = true; over.innerHTML = ''; resolve(); }, { once: true });
  });

  return { wrap, canvas, ctx, size, close, message, skip: wrap.querySelector('.mg-skip'), controls: wrap.querySelector('.mg-controls') };
}

export const fmtMult = (m) => `×${m.toFixed(1).replace('.', ',')}`;
