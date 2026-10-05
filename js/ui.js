import { html, icon, initials, fullName, votoClass, todayIso } from './util.js';
import { matchStatus } from './stats.js';

export const topbar = (title, { back, right } = {}) => html`
  <header class="topbar">
    ${back ? html`<a class="iconbtn" href="#${back}" aria-label="Indietro">${icon('back')}</a>` : ''}
    <h1>${title}</h1>
    ${right || ''}
  </header>`;

export const avatar = (p, size = '') =>
  html`<span class="avatar ${size}" aria-hidden="true">${initials(p)}</span>`;

export const votoBadge = (v) => html`<span class="voto ${votoClass(v)}">${v}</span>`;

export const esitoTag = (m) => {
  const e = matchStatus(m, todayIso());
  return html`<span class="tag ${e.key}">${e.label}</span>`;
};

export const emptyState = (title, text, action = '') => html`
  <div class="empty"><h2>${title}</h2><p>${text}</p>${action}</div>`;

export const playerName = fullName;
