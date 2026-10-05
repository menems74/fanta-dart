import { html, $, fmtDate, icon } from '../util.js';
import { session } from '../auth.js';
import { listSeasons, listMatches } from '../db.js';
import { recordStagione } from '../stats.js';
import { topbar, esitoTag, emptyState } from '../ui.js';
import { getSelectedSeason, setSelectedSeason } from '../season.js';

export default async function view() {
  const seasons = await listSeasons();
  if (!seasons.length) {
    return {
      html: html`${topbar('Partite')}${emptyState(
        'Nessuna stagione',
        session.isAdmin ? 'Crea la prima stagione per iniziare.' : 'Un admin deve ancora creare la stagione.',
        session.isAdmin ? html`<a class="btn primary" href="#/stagione/nuova">Crea stagione</a>` : '')}`,
    };
  }
  const season = getSelectedSeason(seasons);
  const matches = await listMatches(season.id, { onlyPublished: !session.isAdmin });
  const rec = recordStagione(matches.filter((m) => m.pubblicata));

  return {
    html: html`
      ${topbar('Partite', {
        right: session.isAdmin
          ? html`<a class="iconbtn" href="#/partita/nuova" aria-label="Nuova partita">${icon('plus')}</a>` : '',
      })}
      <label class="field season">
        <select id="season" aria-label="Stagione">
          ${seasons.map((s) => html`<option value="${s.id}" ${s.id === season.id ? 'selected' : ''}>${s.nome} · ${s.squadra}</option>`)}
        </select>
      </label>
      ${matches.length ? html`
        <p class="muted small record">${rec.w} vinte · ${rec.d} pari · ${rec.l} perse</p>
        <ul class="list">
          ${matches.map((m) => html`
            <li><a class="card match ${m.pubblicata ? '' : 'draft'}" href="#/partita/${m.id}">
              <div class="grow">
                <strong>vs ${m.avversario}</strong>
                <span class="muted small">${fmtDate(m.data)}${m.luogo ? ` · ${m.luogo}` : ''}</span>
              </div>
              ${m.pubblicata
                ? html`<div class="score"><b>${m.puntiNoi} – ${m.puntiLoro}</b>${esitoTag(m)}</div>`
                : html`<span class="tag neu">Bozza</span>`}
            </a></li>`)}
        </ul>`
        : emptyState('Nessuna partita', session.isAdmin ? 'Aggiungi la prima serata della stagione.' : 'Qui compariranno le serate pubblicate.',
            session.isAdmin ? html`<a class="btn primary" href="#/partita/nuova">Nuova partita</a>` : '')}`,
    mount(root) {
      $(root, '#season').addEventListener('change', (e) => {
        setSelectedSeason(e.target.value);
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });
    },
  };
}
