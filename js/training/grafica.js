// Pezzi grafici degli allenamenti: barra in alto, pollici, grafici a linea, bersaglio da toccare.
import { html, raw, fullName } from '../util.js';
import { session } from '../auth.js';
import { SEGMENTI, SETTORI } from '../dartboard.js';
import { tavolaDisponibile, tavolaStato } from './tavola.js';

const SVG = {
  su: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 21h4V9H2v12zm20-11a2 2 0 0 0-2-2h-6.3l1-4.6v-.3c0-.4-.2-.8-.4-1.1L13.2 1 6.6 7.6C6.2 8 6 8.5 6 9v10a2 2 0 0 0 2 2h9c.8 0 1.5-.5 1.8-1.2l3-7.1c.1-.2.2-.5.2-.7v-2z"/></svg>',
  giu: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 3h-4v12h4V3zM2 14a2 2 0 0 0 2 2h6.3l-1 4.6v.3c0 .4.2.8.4 1.1l1.1 1 6.6-6.6c.4-.4.6-.9.6-1.4V5a2 2 0 0 0-2-2H7c-.8 0-1.5.5-1.8 1.2l-3 7.1c-.1.2-.2.5-.2.7v2z"/></svg>',
  pari: '<svg viewBox="0 0 24 24"><path d="M5 12h14" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  chiudi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-5M12 8h.01"/></svg>',
  cestino: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
};
export const svg = (n) => raw(SVG[n]);

export const COLORE = { su: '#34d399', giu: '#f87171', pari: '#f59e0b', nuovo: '#94a9cb' };
const TREND_TITOLO = { su: 'In miglioramento', giu: 'In calo', pari: 'Stabile', nuovo: 'Poche sessioni per dirlo' };
export const pollice = (t, statico = false) =>
  html`<span class="pol ${t} ${statico ? 'statico' : ''}" title="${TREND_TITOLO[t]}" aria-label="${TREND_TITOLO[t]}">${t === 'nuovo' ? 'NUOVO' : svg(t)}</span>`;

/** Barra in alto: indietro, titolo, stato del Granboard, schermo intero. */
export function barra(titolo, { back = null, home = false, info = false } = {}) {
  const st = tavolaStato();
  return html`<header class="top">
    ${back ? html`<a class="iconbtn" href="#${back}" aria-label="Indietro">${svg('back')}</a>` : ''}
    ${home && !session.soloAllenamenti ? html`<a class="iconbtn" href="./#/partite" aria-label="Torna a Fanta Dart" title="Torna a Fanta Dart">${svg('home')}</a>` : ''}
    <h1>${titolo}</h1>
    ${info ? html`<button type="button" class="iconbtn info" data-act="info" aria-label="Regole del gioco" title="Regole del gioco">${svg('info')}</button>` : ''}
    ${tavolaDisponibile() ? html`<button type="button" class="board-chip ${st}" data-act="tavola">
      <span class="dot"></span>${st === 'collegata' ? 'Granboard collegato' : st === 'collego' ? 'Collegamento…' : 'Collega Granboard'}</button>` : ''}
    <button type="button" class="iconbtn" data-act="full" aria-label="Schermo intero">${svg('full')}</button>
  </header>`;
}

export const nomeGiocatore = () => (session.player ? fullName(session.player) : 'Giocatore');

/** Grafico a linea. basso: meno e' meglio, quindi l'asse e' rovesciato (in alto sempre il risultato migliore). */
export function linea(valori, { w = 300, h = 90, colore = '#3b82f6', basso = false, assi = false, cls = 'line' } = {}) {
  if (valori.length < 2) return html`<p class="mu sm vuoto">${valori.length ? 'Serve un\'altra sessione per il grafico' : 'Ancora nessuna sessione'}</p>`;
  const pad = assi ? { l: 44, r: 16, t: 22, b: 28 } : { l: 4, r: 4, t: 6, b: 6 };
  const min = Math.min(...valori);
  const max = Math.max(...valori);
  const span = max - min || 1;
  const x = (i) => pad.l + (i * (w - pad.l - pad.r)) / (valori.length - 1);
  const y = (v) => { const t = (v - min) / span; return pad.t + (basso ? t : 1 - t) * (h - pad.t - pad.b); };
  const pts = valori.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const area = `M${x(0)},${h - pad.b} L${pts.join(' L')} L${x(valori.length - 1)},${h - pad.b} Z`;
  let extra = '';
  if (assi) {
    const [top, bot] = basso ? [min, max] : [max, min];
    extra = `<line class="ax" x1="${pad.l}" x2="${w - pad.r}" y1="${pad.t}" y2="${pad.t}"/><line class="ax" x1="${pad.l}" x2="${w - pad.r}" y1="${h - pad.b}" y2="${h - pad.b}"/>
      <text x="${pad.l - 8}" y="${pad.t + 5}" text-anchor="end">${top}</text><text x="${pad.l - 8}" y="${h - pad.b + 5}" text-anchor="end">${bot}</text>
      <text x="${pad.l}" y="${h - 6}">prima</text><text x="${w - pad.r}" y="${h - 6}" text-anchor="end">ultima</text>
      ${valori.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="5" fill="${colore}"/>`).join('')}
      <text x="${x(valori.length - 1)}" y="${y(valori.at(-1)) - 12}" text-anchor="end" style="fill:${colore};font-weight:800">${valori.at(-1)}</text>`;
  }
  return raw(`<svg class="${cls}${assi ? ' assi' : ''}" viewBox="0 0 ${w} ${h}"${assi ? '' : ' preserveAspectRatio="none"'} aria-hidden="true">
    <path class="area" d="${area}" fill="${colore}"/><path class="l" d="M${pts.join(' L')}" stroke="${colore}" vector-effect="non-scaling-stroke"/>${extra}</svg>`);
}

/** Bersaglio da toccare. bersagli: id dei settori da colpire (in oro). */
export function bersaglio(bersagli = []) {
  const set = new Set(bersagli);
  const numeriTarget = new Set(bersagli.map((id) => /\d+/.exec(id)?.[0]).filter(Boolean).map(Number));
  const paths = SEGMENTI.map((s) => {
    const cls = ['seg', s.pari ? 'alt' : '', s.anello === 't' || s.anello === 'd' ? 'ring' : '', s.anello === 'b' ? 'bull' : '', set.has(s.id) ? 'target' : ''].filter(Boolean).join(' ');
    return `<path class="${cls}" data-id="${s.id}" d="${s.path}"${s.evenodd ? ' fill-rule="evenodd"' : ''}/>`;
  }).join('');
  const numeri = SETTORI.map((n, i) => {
    const a = (i * 18 * Math.PI) / 180;
    return `<text class="${numeriTarget.has(n) ? 'tg' : ''}" x="${(108 * Math.sin(a)).toFixed(1)}" y="${(-108 * Math.cos(a)).toFixed(1)}">${n}</text>`;
  }).join('');
  return raw(`<svg viewBox="-118 -118 236 236" role="img" aria-label="Bersaglio: tocca dove hai colpito"><circle class="miss" data-id="X" r="118"/>${paths}${numeri}</svg>`);
}

/** Schermo intero (e orizzontale, dove il telefono lo permette). */
export function schermoIntero() {
  if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
  document.documentElement.requestFullscreen?.()
    .then(() => screen.orientation?.lock?.('landscape').catch(() => {}))
    .catch(() => {});
}
