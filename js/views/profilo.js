import { html, $, $$, fmtDate, icon, fullName, toast, votoClass } from '../util.js';
import { session, logout, changeOwnPin, PIN_RE } from '../auth.js';
import { getPlayer, listCards, listMatches, listSeasons } from '../db.js';
import { playerStats, gamesOf, fmtMedia, fmtPerc } from '../stats.js';
import { topbar, avatar, votoBadge, emptyState } from '../ui.js';
import { getSelectedSeason } from '../season.js';

const starIcon = icon('star', 22).s;

/** Grafico a linea degli ultimi voti (dal più vecchio al più recente). */
function trendSvg(votes) {
  const v = votes.slice(-8);
  if (v.length < 2) return "<p class=\"muted small\">Servono almeno due serate per vedere l'andamento.</p>";
  const W = 300, H = 90, pad = 14;
  const x = (i) => pad + (i * (W - 2 * pad)) / (v.length - 1);
  const y = (n) => H - pad - ((n - 1) / 9) * (H - 2 * pad);
  const pts = v.map((n, i) => `${x(i).toFixed(1)},${y(n).toFixed(1)}`).join(' ');
  const dots = v.map((n, i) =>
    `<circle cx="${x(i).toFixed(1)}" cy="${y(n).toFixed(1)}" r="4.5" class="dot ${votoClass(n)}"/>` +
    `<text x="${x(i).toFixed(1)}" y="${(y(n) - 9).toFixed(1)}" text-anchor="middle" class="dl">${n}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ultimi voti: ${v.join(', ')}" class="spark">` +
    `<line x1="${pad}" x2="${W - pad}" y1="${y(6).toFixed(1)}" y2="${y(6).toFixed(1)}" class="sufficienza"/>` +
    `<polyline points="${pts}" class="line"/>${dots}</svg>`;
}

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
      <div class="stat"><b>${st.serate}</b><span>Serate</span></div>
      <div class="stat"><b>${st.vinte}/${st.giocate}</b><span>Vinte</span></div>
      <div class="stat gold"><b>${st.mvp}</b><span>MVP</span></div>`;
    $(root, '#avwrap').classList.toggle('mvp', st.mvp > 0);
    $(root, '#badges').innerHTML = st.mvp > 0
      ? `<div class="medal" title="MVP della serata"><span class="medal-disc">${starIcon}</span><b>MVP</b><span>×${st.mvp}</span></div>`
      : "<p class=\"muted small\">Ancora nessun badge: il primo è l'MVP di una serata.</p>";
    $(root, '#trend').innerHTML = trendSvg(history.map((x) => x.c.voto).reverse());
    $(root, '#split').textContent = st.giocate
      ? `Singoli ${st.sv}/${st.sg} (${fmtPerc(st.sv, st.sg)}) · Doppi ${st.dv}/${st.dg} (${fmtPerc(st.dv, st.dg)})`
      : '';
    $(root, '#history').innerHTML = history.length
      ? history.map(({ c, m }) => html`
          <li><a class="card row" href="#/pagellino/${c.matchId}/${playerId}">
            <div class="grow"><strong>vs ${m.avversario}</strong>
              <span class="muted small">${fmtDate(m.data)} · ${gamesOf(c).vinte}/${gamesOf(c).giocate} vinte ${m.mvpPlayerId === playerId ? '· MVP' : ''}</span></div>
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
        <span class="avatar-wrap" id="avwrap">${avatar(player, 'xl')}<span class="avatar-star" aria-hidden="true">${icon('star', 16)}</span></span>
        <div><h2>${fullName(player)}</h2><p class="muted">Tessera ${player.tessera} · ${player.ruolo === 'admin' ? 'Admin' : 'Player'}</p></div>
      </section>
      ${season ? html`<div class="seg" role="tablist">
        <button data-s="stagione" role="tab">${season.nome}</button>
        <button data-s="carriera" role="tab">Carriera</button>
      </div>` : ''}
      <div class="stats" id="stats"></div>
      <p class="muted small split" id="split"></p>
      <h2 class="section">Andamento voti</h2>
      <div class="card trend" id="trend"></div>
      <h2 class="section">Badge</h2>
      <div class="badges" id="badges"></div>
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
