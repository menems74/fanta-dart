import { html, $, fmtDate, icon, toast, go } from '../util.js';
import { session } from '../auth.js';
import { getMatch, getSeason, listPlayers, listCards, setMatchPublished, deleteMatch, saveMatch } from '../db.js';
import { suggestedScore, gamesOf, hasResult, scoreText } from '../stats.js';
import { topbar, avatar, votoBadge, esitoTag, emptyState } from '../ui.js';
import { fullName } from '../util.js';

export default async function view([id]) {
  const match = await getMatch(id);
  if (!match) return { html: html`${topbar('Partita', { back: '/partite' })}${emptyState('Partita non trovata', 'Potrebbe non essere ancora pubblicata.')}` };

  const [season, players, cards] = await Promise.all([
    getSeason(match.seasonId),
    listPlayers(),
    listCards({ matchId: id }, { onlyPublished: !session.isAdmin }),
  ]);
  const byId = new Map(players.map((p) => [p.id, p]));
  cards.sort((a, b) => b.voto - a.voto);
  const suggestion = session.isAdmin && cards.length ? suggestedScore(cards) : null;
  const sameScore = !!suggestion && !suggestion.warn
    && suggestion.noi === match.puntiNoi && suggestion.loro === match.puntiLoro;
  const done = new Set(cards.map((c) => c.playerId));
  const missing = session.isAdmin
    ? (season?.playerIds || []).filter((pid) => !done.has(pid)).map((pid) => byId.get(pid)).filter(Boolean)
    : [];

  return {
    html: html`
      ${topbar(`vs ${match.avversario}`, {
        back: '/partite',
        right: session.isAdmin && (!match.pubblicata || !hasResult(match))
          ? html`<a class="iconbtn" href="#/partita/${id}/modifica" aria-label="Modifica partita">${icon('edit')}</a>` : '',
      })}
      <section class="card summary">
        <div class="score big">${hasResult(match) ? html`<b>${scoreText(match)}</b>` : ''}${esitoTag(match)}</div>
        <p class="muted">${fmtDate(match.data, true)}${match.luogo ? ` · ${match.luogo}` : ''}</p>
        <p class="muted small">${season ? `${season.nome} · ${season.squadra}` : ''}
          ${match.pubblicata ? '' : html` · <span class="tag neu">Bozza non pubblicata</span>`}</p>
      </section>

      ${suggestion?.warn ? html`<p class="hint">${icon('info', 18)}<span>${suggestion.warn}</span></p>` : ''}
      ${suggestion && !suggestion.warn && !sameScore ? html`<section class="card suggest">
        <p>Dai pagellini risulta <b>${suggestion.noi} – ${suggestion.loro}</b></p>
        <button class="btn small sec" id="apply">Imposta ${suggestion.noi} – ${suggestion.loro} come risultato</button>
      </section>` : ''}

      <h2 class="section">Pagellini</h2>
      ${cards.length ? html`<ul class="list">
        ${cards.map((c) => {
          const p = byId.get(c.playerId);
          return html`<li><a class="card row" href="#/pagellino/${id}/${c.playerId}">
            ${avatar(p)}
            <div class="grow">
              <strong>${fullName(p)} ${match.mvpPlayerId === c.playerId ? html`<span class="mvp">${icon('star', 14)} MVP</span>` : ''}</strong>
              <span class="small games">Singoli ${gamesOf(c).sv}/${gamesOf(c).sg} · Doppi ${gamesOf(c).dv}/${gamesOf(c).dg}</span>
              <span class="muted small clamp">${c.testo || 'Nessun commento'}</span>
            </div>
            ${votoBadge(c.voto)}
          </a></li>`;
        })}</ul>`
        : html`<p class="muted">Nessun pagellino per questa serata.</p>`}

      ${missing.length ? html`
        <h2 class="section">Da compilare</h2>
        <ul class="list">${missing.map((p) => html`
          <li><a class="card row" href="#/pagellino/${id}/${p.id}/modifica">
            ${avatar(p)}<div class="grow"><strong>${fullName(p)}</strong></div>
            <span class="tag neu">Compila</span>
          </a></li>`)}</ul>` : ''}

      ${session.isAdmin ? html`
        <div class="actions">
          <button class="btn ${match.pubblicata ? 'sec' : 'primary'}" id="pub">
            ${match.pubblicata ? 'Ritira pubblicazione' : 'Pubblica serata'}
          </button>
          <button class="btn danger" id="del">${icon('trash', 18)} Elimina partita</button>
        </div>` : ''}`,
    mount(root) {
      $(root, '#apply')?.addEventListener('click', async (e) => {
        e.target.disabled = true;
        try {
          await saveMatch(id, { puntiNoi: suggestion.noi, puntiLoro: suggestion.loro });
          toast('Risultato aggiornato');
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        } catch (err) { console.error(err); toast('Operazione non riuscita'); e.target.disabled = false; }
      });
      $(root, '#pub')?.addEventListener('click', async (e) => {
        const next = !match.pubblicata;
        const msg = next
          ? 'Pubblicare la serata? Tutti i giocatori vedranno i pagellini.'
          : 'Ritirare la pubblicazione? I Player non vedranno più la serata.';
        if (!confirm(msg)) return;
        e.target.disabled = true;
        try {
          await setMatchPublished(id, next);
          toast(next ? 'Serata pubblicata' : 'Pubblicazione ritirata');
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        } catch (err) { console.error(err); toast('Operazione non riuscita'); e.target.disabled = false; }
      });
      $(root, '#del')?.addEventListener('click', async () => {
        if (!confirm('Eliminare la partita e tutti i suoi pagellini? Non si può annullare.')) return;
        try { await deleteMatch(id); toast('Partita eliminata'); go('/partite'); }
        catch (err) { console.error(err); toast('Eliminazione non riuscita'); }
      });
    },
  };
}
