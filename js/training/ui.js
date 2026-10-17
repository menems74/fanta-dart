import { html, raw } from '../util.js';
import { votoClass, icon } from '../util.js';

export const toApp = html`<a class="iconbtn" href="./#/partite" aria-label="Torna all'app" title="Torna all'app">${icon('home')}</a>`;

/** Grafico a linea dei risultati (dal piu' vecchio al piu' recente). */
export function spark(values, { w = 140, h = 44 } = {}) {
  const v = values.filter(Number.isFinite).slice(-8);
  if (v.length < 2) return html`<span class="muted small">Servono 2 sessioni</span>`;
  const pad = 6;
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const x = (i) => pad + (i * (w - 2 * pad)) / (v.length - 1);
  const y = (n) => (hi === lo ? h / 2 : h - pad - ((n - lo) / (hi - lo)) * (h - 2 * pad));
  const pts = v.map((n, i) => `${x(i).toFixed(1)},${y(n).toFixed(1)}`).join(' ');
  const last = v.length - 1;
  return raw(`<svg viewBox="0 0 ${w} ${h}" class="tspark" role="img" aria-label="Andamento: ${v.join(', ')}">`
    + `<polyline points="${pts}" class="line"/>`
    + `<circle cx="${x(last).toFixed(1)}" cy="${y(v[last]).toFixed(1)}" r="4" class="dot"/></svg>`);
}

export { votoClass };
