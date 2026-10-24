import { html, icon, initials, fullName, votoClass, todayIso } from './util.js';
import { matchStatus } from './stats.js';

export const topbar = (title, { back, right } = {}) => html`
  <header class="topbar">
    ${back ? html`<a class="iconbtn" href="#${back}" aria-label="Indietro">${icon('back')}</a>` : ''}
    <h1>${title}</h1>
    ${right || ''}
  </header>`;

/** Cerchietto del giocatore: la sua foto se l'ha caricata, altrimenti le iniziali. */
export const avatar = (p, size = '') => (p?.foto
  ? html`<span class="avatar foto ${size}" aria-hidden="true"><img src="${p.foto}" alt=""></span>`
  : html`<span class="avatar ${size}" aria-hidden="true">${initials(p)}</span>`);
/** Solo il contenuto del cerchietto (per cerchi con stile proprio, come la figurina del pagellino). */
export const faccia = (p) => (p?.foto ? html`<img src="${p.foto}" alt="">` : initials(p));

export const votoBadge = (v) => html`<span class="voto ${votoClass(v)}">${v}</span>`;

export const esitoTag = (m) => {
  const e = matchStatus(m, todayIso());
  return html`<span class="tag ${e.key}">${e.label}</span>`;
};

export const emptyState = (title, text, action = '') => html`
  <div class="empty"><h2>${title}</h2><p>${text}</p>${action}</div>`;

export const playerName = fullName;
