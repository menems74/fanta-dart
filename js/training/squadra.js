// Squadra: sfida del sabato (anche contro se stessi) e riepilogo di chi si sta allenando.
import { html, icon, fmtDate, todayIso, fullName } from '../util.js';
import { session } from '../auth.js';
import { listPlayers, listAllTrainings, listAllTests } from '../db.js';
import { topbar, avatar, emptyState } from '../ui.js';
import { toApp } from './ui.js';
import { TIPO_INFO } from './catalogo.js';
import {
  challengeFor, lastSaturday, nextSaturday, challengeResults, teamRows, fmt1,
} from './calc.js';

const delta = (r) => (r.prevBest == null ? 'Primo risultato'
  : r.delta > 0 ? `+${fmt1(r.delta)} sul suo record`
  : r.delta === 0 ? 'Pari al suo record' : `${fmt1(r.delta)} dal suo record`);

export default async function view() {
  const me = session.account.playerId;
  const today = todayIso();
  const [players, all, tests] = await Promise.all([listPlayers(), listAllTrainings(), listAllTests()]);
  const byId = new Map(players.map((p) => [p.id, p]));

  const next = { sabato: nextSaturday(today) };
  next.tipo = challengeFor(next.sabato);
  const oggi = next.sabato === today;
  const last = { sabato: lastSaturday(today) };
  last.tipo = challengeFor(last.sabato);

  // Se oggi e' sabato la sfida e' in corso: mostro i risultati di oggi. Altrimenti quelli dell'ultimo sabato.
  const showing = oggi ? next : last;
  const results = challengeResults(all, showing.sabato, showing.tipo);
  const mineBest = all.filter((t) => t.playerId === me && t.tipo === next.tipo && Number.isFinite(t.metrica))
    .reduce((m, t) => Math.max(m, t.metrica), -Infinity);
  const rows = teamRows(players, all, tests, today);
  const settimanaSquadra = rows.reduce((s, r) => s + r.settimana, 0);

  const board = (res) => html`<ul class="list">
    ${res.map((r, i) => {
      const p = byId.get(r.playerId);
      return html`<li><div class="card row rank ${r.playerId === me ? 'me' : ''}">
        <span class="pos">${i + 1}</span>${avatar(p)}
        <div class="grow"><strong>${fullName(p)}${r.playerId === me ? ' (tu)' : ''} ${i === 0 && res.length > 1 ? icon('trophy', 16) : ''}</strong>
          <span class="muted small">${delta(r)}</span></div>
        <b class="media">${fmt1(r.metrica)}</b>
      </div></li>`;
    })}
  </ul>`;

  return {
    html: html`
      ${topbar('Squadra', { back: '/', right: toApp })}

      <section class="card chal ${oggi ? 'now' : ''}">
        <div class="row between"><b>Sfida del sabato</b>${oggi ? html`<span class="tag gold">Oggi</span>` : ''}</div>
        <p class="chal-title">${TIPO_INFO[next.tipo].label} · ${TIPO_INFO[next.tipo].desc}</p>
        <p class="muted">${fmtDate(next.sabato, true)}</p>
        <p class="muted small">Conta la sessione di questo tipo fatta di sabato. Puoi sfidare la squadra o solo te stesso: nessun obbligo di essere in tanti.</p>
        <p class="chal-rec">${Number.isFinite(mineBest) ? html`Il tuo record: <b>${fmt1(mineBest)}</b>. Battilo sabato.` : 'Non hai ancora un record: sabato lo stabilisci.'}</p>
        ${oggi ? html`<a class="btn primary" href="#/sessione/${next.tipo}">${icon('play', 18)} Inizia la sfida</a>` : ''}
      </section>

      ${results.length ? html`
        <h2 class="section">${oggi ? 'In gara oggi' : `Sfida di ${fmtDate(last.sabato)} · ${TIPO_INFO[last.tipo].label}`}</h2>
        <p class="muted small record">${results.length > 1 ? `${results.length} giocatori in gara.` : 'Una sfida contro se stessi.'}</p>
        ${board(results)}` : (oggi ? '' : html`
        <h2 class="section">Ultima sfida</h2>
        ${emptyState('Nessun risultato', `Sabato ${fmtDate(last.sabato)} nessuno ha fatto la prova di ${TIPO_INFO[last.tipo].label}.`)}`)}

      <h2 class="section">La squadra · ${settimanaSquadra} ${settimanaSquadra === 1 ? 'sessione' : 'sessioni'} questa settimana</h2>
      <ul class="list">
        ${rows.map((r) => html`
          <li><div class="card row ${r.totale ? '' : 'off'} ${r.player.id === me ? 'rank me' : ''}">
            ${avatar(r.player)}
            <div class="grow"><strong>${fullName(r.player)}${r.player.id === me ? ' (tu)' : ''}</strong>
              <span class="muted small">${r.totale ? `${r.totale} sessioni · ${r.settimana} questa settimana` : 'Non ha ancora iniziato'}</span></div>
            ${r.skill != null ? html`<b class="tres">${fmt1(r.skill)}<small>skill</small></b>` : ''}
          </div></li>`)}
      </ul>`,
  };
}

