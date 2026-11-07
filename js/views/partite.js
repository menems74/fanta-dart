import { html, $, fmtDate, icon, fullName, todayIso } from '../util.js';
import { session } from '../auth.js';
import { listSeasons, listMatches, listPlayers, listCards } from '../db.js';
import { recordStagione, esito, fmtMedia, hasResult, scoreText, isUpcoming, matchStatus } from '../stats.js';
import { topbar, esitoTag, emptyState } from '../ui.js';
import { getSelectedSeason, setSelectedSeason } from '../season.js';

const shortName = (p) => (p ? `${p.nome} ${p.cognome[0]}.` : '');
const opponentBadge = (name) => name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || '?';

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
  const [matches, players, cards] = await Promise.all([
    listMatches(season.id, { onlyPublished: !session.isAdmin }),
    listPlayers(),
    listCards({ seasonId: season.id }, { onlyPublished: true }),
  ]);
  const byId = new Map(players.map((p) => [p.id, p]));
  const today = todayIso();

  const played = matches.filter((m) => m.pubblicata && hasResult(m));
  const rec = recordStagione(played);
  const media = cards.length ? cards.reduce((s, c) => s + c.voto, 0) / cards.length : null;
  const last = played[0];
  const lastMvp = last?.mvpPlayerId ? byId.get(last.mvpPlayerId) : null;

  // In programma (senza risultato, data non passata) in ordine di data crescente; il resto dal più recente.
  const upcoming = matches.filter((m) => isUpcoming(m, today)).sort((a, b) => a.data.localeCompare(b.data));
  const past = matches.filter((m) => !isUpcoming(m, today));

  const row = (m) => {
    const mvp = m.mvpPlayerId ? byId.get(m.mvpPlayerId) : null;
    const result = hasResult(m);
    const cls = !m.pubblicata ? 'draft' : result ? esito(m).key : 'n';
    return html`
      <li><a class="item ${cls}" href="#/partita/${m.id}">
        <span class="avatar" aria-hidden="true">${opponentBadge(m.avversario)}</span>
        <div class="grow">
          <strong>vs ${m.avversario}</strong>
          <span class="muted small">${fmtDate(m.data)}${m.luogo ? ` · ${m.luogo}` : ''}</span>
        </div>
        ${!m.pubblicata
          ? html`<span class="tag neu">Bozza</span>`
          : result
            ? html`<div class="score"><b>${scoreText(m)}</b>
                ${mvp ? html`<span class="mvp-line">${icon('star', 12)} ${shortName(mvp)}</span>` : esitoTag(m)}</div>`
            : html`<span class="tag neu">${matchStatus(m, today).label}</span>`}
      </a></li>`;
  };

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

      ${last ? html`
        <a class="card last" href="#/partita/${last.id}">
          <p class="muted small">Ultima serata · ${fmtDate(last.data)}</p>
          <p class="last-score">${scoreText(last)}</p>
          <p class="muted">vs ${last.avversario}${last.luogo ? ` · ${last.luogo}` : ''}</p>
          <div class="tricolore"></div>
          ${lastMvp
            ? html`<p class="last-mvp">${icon('star', 16)} MVP <b>${fullName(lastMvp)}</b></p>`
            : html`<p class="muted small">MVP non assegnato</p>`}
        </a>
        <div class="stats season-stats">
          <div class="stat w"><b>${rec.w}</b><span>Vinte</span></div>
          <div class="stat"><b>${rec.d}</b><span>Pari</span></div>
          <div class="stat l"><b>${rec.l}</b><span>Perse</span></div>
          <div class="stat"><b>${fmtMedia(media)}</b><span>Media voti</span></div>
        </div>` : ''}

      ${upcoming.length ? html`
        <h2 class="section">In programma</h2>
        <ul class="list">${upcoming.map(row)}</ul>` : ''}

      ${past.length ? html`
        <h2 class="section">${upcoming.length || last ? 'Serate giocate' : 'Tutte le serate'}</h2>
        <ul class="list">${past.map(row)}</ul>` : ''}

      ${matches.length ? '' : emptyState('Nessuna partita',
          session.isAdmin ? 'Aggiungi la prima serata della stagione.' : 'Qui compariranno le serate pubblicate.',
          session.isAdmin ? html`<a class="btn primary" href="#/partita/nuova">Nuova partita</a>` : '')}`,
    mount(root) {
      $(root, '#season').addEventListener('change', (e) => {
        setSelectedSeason(e.target.value);
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });
    },
  };
}
