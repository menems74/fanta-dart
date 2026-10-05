import { html, icon, fullName } from '../util.js';
import { listSeasons, listPlayers } from '../db.js';
import { topbar, avatar } from '../ui.js';

export default async function view() {
  const [seasons, players] = await Promise.all([listSeasons(), listPlayers()]);
  return {
    html: html`
      ${topbar('Gestione')}
      <div class="row between">
        <h2 class="section">Stagioni</h2>
        <a class="btn small primary" href="#/stagione/nuova">${icon('plus', 16)} Nuova</a>
      </div>
      <ul class="list">
        ${seasons.map((s) => html`
          <li><a class="card row" href="#/stagione/${s.id}">
            <div class="grow"><strong>${s.nome}</strong><span class="muted small">${s.squadra} · ${s.playerIds?.length || 0} giocatori</span></div>
            ${icon('chevron')}
          </a></li>`)}
        ${seasons.length ? '' : html`<li class="muted">Nessuna stagione.</li>`}
      </ul>

      <div class="row between">
        <h2 class="section">Giocatori</h2>
        <a class="btn small primary" href="#/giocatore/nuovo">${icon('plus', 16)} Nuovo</a>
      </div>
      <ul class="list">
        ${players.map((p) => html`
          <li><a class="card row ${p.attivo === false ? 'off' : ''}" href="#/giocatore/${p.id}">
            ${avatar(p)}
            <div class="grow"><strong>${fullName(p)}</strong>
              <span class="muted small">${p.ruolo === 'admin' ? 'Admin' : 'Player'}${p.attivo === false ? ' · non attivo' : ''}</span></div>
            <span class="tessera" aria-label="Tessera ${p.tessera}">${p.tessera}</span>
          </a></li>`)}
      </ul>`,
  };
}
