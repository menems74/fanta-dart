import { html, $, $$, fmtDate, icon, fullName, toast } from '../util.js';
import { session, logout, changeOwnPin, PIN_RE } from '../auth.js';
import { getPlayer, listCards, listMatches, listSeasons } from '../db.js';
import { playerStats, fmtMedia } from '../stats.js';
import { topbar, avatar, votoBadge, emptyState } from '../ui.js';
import { getSelectedSeason } from '../season.js';

export default async function view([paramId]) {
  const playerId = paramId || session.account.playerId;
  const own = playerId === session.account.playerId;
  const [player, seasons, cards, matches] = await Promise.all([
    getPlayer(playerId),
    listSeasons(),
    listCards({ playerId }, { onlyPublished: true }),
    listMatches(null, { onlyPublished: true }),
  ]);
  if (!player) return { html: html`${topbar('Profilo', { back: '/classifica' })}${emptyState('Giocatore non trovato', '')}` };

  const season = seasons.length ? getSelectedSeason(seasons) : null;
  const byMatch = new Map(matches.map((m) => [m.id, m]));
  let scope = season ? 'stagione' : 'carriera';

  const draw = (root) => {
    const inScope = (x) => scope === 'carriera' || x.seasonId === season?.id;
    const sMatches = matches.filter(inScope);
    const sCards = cards.filter(inScope);
    const st = playerStats(playerId, sMatches, sCards);
    const history = sCards
      .map((c) => ({ c, m: byMatch.get(c.matchId) }))
      .filter((x) => x.m)
      .sort((a, b) => b.m.data.localeCompare(a.m.data));
    $(root, '#stats').innerHTML = `
      <div class="stat"><b>${fmtMedia(st.media)}</b><span>Media voto</span></div>
      <div class="stat"><b>${st.partite}</b><span>Partite</span></div>
      <div class="stat"><b>${st.vinte}</b><span>Vinte</span></div>
      <div class="stat gold"><b>${st.mvp}</b><span>MVP</span></div>`;
    $(root, '#history').innerHTML = history.length
      ? history.map(({ c, m }) => html`
          <li><a class="card row" href="#/pagellino/${c.matchId}/${playerId}">
            <div class="grow"><strong>vs ${m.avversario}</strong>
              <span class="muted small">${fmtDate(m.data)} · ${c.partiteVinte || 0} vinte ${m.mvpPlayerId === playerId ? '· MVP' : ''}</span></div>
            ${votoBadge(c.voto)}
          </a></li>`.s).join('')
      : '<li class="muted">Ancora nessun pagellino pubblicato.</li>';
    $$(root, '.seg button').forEach((b) => b.classList.toggle('sel', b.dataset.s === scope));
  };

  return {
    html: html`
      ${topbar('Profilo', {
        back: own ? '' : '/classifica',
        right: session.isAdmin ? html`<a class="iconbtn" href="#/giocatore/${playerId}" aria-label="Modifica giocatore">${icon('edit')}</a>` : '',
      })}
      <section class="hero">
        ${avatar(player, 'xl')}
        <div><h2>${fullName(player)}</h2><p class="muted">Tessera ${player.tessera} · ${player.ruolo === 'admin' ? 'Admin' : 'Player'}</p></div>
      </section>
      ${season ? html`<div class="seg" role="tablist">
        <button data-s="stagione" role="tab">${season.nome}</button>
        <button data-s="carriera" role="tab">Carriera</button>
      </div>` : ''}
      <div class="stats" id="stats"></div>
      <h2 class="section">Storico pagellini</h2>
      <ul class="list" id="history"></ul>
      ${own ? html`
        <h2 class="section">Account</h2>
        <form id="pinForm" class="form inline" novalidate hidden>
          <label class="field">Nuovo PIN (4 cifre)
            <input name="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password" required>
          </label>
          <p class="error" id="pinErr" role="alert"></p>
          <button class="btn primary">Salva PIN</button>
        </form>
        <div class="actions">
          <button class="btn sec" id="pinBtn">Cambia PIN</button>
          <button class="btn sec" id="out">${icon('logout', 18)} Esci</button>
        </div>` : ''}`,
    mount(root) {
      draw(root);
      $(root, '.seg')?.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-s]');
        if (!b) return;
        scope = b.dataset.s;
        draw(root);
      });
      $(root, '#out')?.addEventListener('click', () => logout());
      $(root, '#pinBtn')?.addEventListener('click', () => { const f = $(root, '#pinForm'); f.hidden = !f.hidden; f.pin.focus(); });
      $(root, '#pinForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pin = e.target.pin.value.trim();
        const err = $(root, '#pinErr');
        if (!PIN_RE.test(pin)) { err.textContent = 'Il PIN è di 4 cifre.'; return; }
        try {
          await changeOwnPin(pin);
          toast('PIN aggiornato');
          e.target.reset();
          e.target.hidden = true;
        } catch (e2) {
          err.textContent = e2.code === 'auth/requires-recent-login'
            ? 'Per sicurezza esci, rientra e riprova.' : 'Aggiornamento non riuscito.';
        }
      });
    },
  };
}
