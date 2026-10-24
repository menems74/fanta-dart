import { html, raw, $, $$, fmtDate, icon, fullName, toast, votoClass } from '../util.js';
import { session, logout, changeOwnPin, PIN_RE, nomeRuolo } from '../auth.js';
import { getPlayer, listCards, listMatches, listSeasons, setPin, setFoto } from '../db.js';
import { preparaFoto } from '../foto.js';
import { playerStats, gamesOf, fmtMedia, fmtPerc } from '../stats.js';
import { topbar, avatar, votoBadge, emptyState } from '../ui.js';
import { getSelectedSeason } from '../season.js';
import { firma } from '../versione.js';
import { listCampionati, getCampionato, giornateGiocate, ordina, fmtMediaCamp, fmtAggiornato, bilancio, fmtBilancio } from '../campionato.js';

const starIcon = icon('star', 22).s;

/** Barre dei punti fatti in ogni giornata del campionato (una barra per giornata; vuota se non ha giocato). */
function giornateSvg(giornate) {
  const W = 300, H = 96, pad = 12, base = H - 18;
  const max = Math.max(1, ...giornate.map(([, p]) => p));
  const w = (W - 2 * pad) / giornate.length;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Punti per giornata" class="giornate">` + giornate.map(([set, punti], i) => {
    const x = pad + i * w;
    const h = set ? Math.max(3, (punti / max) * (base - 14)) : 0;
    return (set ? `<rect x="${(x + w * 0.18).toFixed(1)}" y="${(base - h).toFixed(1)}" width="${(w * 0.64).toFixed(1)}" height="${h.toFixed(1)}" rx="3" class="bar"/>`
      + `<text x="${(x + w / 2).toFixed(1)}" y="${(base - h - 4).toFixed(1)}" text-anchor="middle" class="dl">${punti}</text>`
      : `<text x="${(x + w / 2).toFixed(1)}" y="${(base - 4).toFixed(1)}" text-anchor="middle" class="nd">–</text>`)
      + `<text x="${(x + w / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle" class="gl">${i + 1}ª</text>`;
  }).join('') + '</svg>';
}

/** Statistiche ufficiali del giocatore in ogni campionato in cui compare (il piu' recente per primo). */
async function campionatiDi(tessera) {
  const elenco = await listCampionati();
  const out = [];
  for (const c of elenco) {
    const camp = await getCampionato(c.id);
    for (const s of camp?.squadre || []) {
      const g = s.giocatori.find((x) => x.tessera === tessera);
      if (g) {
        const pos = ordina(s.giocatori).findIndex((x) => x.tessera === tessera) + 1;
        out.push({ camp, squadra: s.nome, g, pos, tot: s.giocatori.length });
      }
    }
  }
  return out;
}

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
  const campionati = await campionatiDi(player.tessera);
  const [attuale, ...passati] = campionati;
  const sezioneCampionato = attuale ? html`
      <h2 class="section">Campionato · ${attuale.camp.nome}</h2>
      <div class="stats">
        <div class="stat gold"><b>${attuale.g.punti}</b><span>Punti</span></div>
        <div class="stat"><b>${fmtMediaCamp(attuale.g.media)}</b><span>Media</span></div>
        <div class="stat"><b>${attuale.g.set}</b><span>Set</span></div>
        <div class="stat"><b>${attuale.pos}°/${attuale.tot}</b><span>In squadra</span></div>
      </div>
      ${attuale.g.giornate?.length ? html`<div class="card campgiornate">${raw(giornateSvg(attuale.g.giornate))}</div>` : ''}
      <p class="muted small">${attuale.squadra}${giornateGiocate(attuale.g) == null ? '' : ` · ${giornateGiocate(attuale.g)} giornate giocate`} · ${attuale.camp.chiuso ? 'campionato concluso' : `dati softdart.it aggiornati al ${fmtAggiornato(attuale.camp.aggiornato)}`}</p>
      ${passati.length ? html`<h2 class="section">Campionati passati</h2>
        <ul class="list">${passati.map((x) => html`<li><div class="card row"><div class="grow"><strong>${x.camp.nome}</strong>
          <span class="muted small">${x.squadra} · ${x.pos}° in squadra${bilancio(x.camp, x.g.nome) ? ` · ${fmtBilancio(bilancio(x.camp, x.g.nome))}` : ` · ${x.g.set} set`}</span></div>
          <div class="valore"><b class="media">${x.g.punti}</b><span class="muted small">media ${fmtMediaCamp(x.g.media)}</span></div></div></li>`)}</ul>` : ''}` : '';

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
        <div><h2>${fullName(player)}</h2><p class="muted">Tessera ${player.tessera} · ${nomeRuolo(player.ruolo)}</p>
          ${own ? html`<div class="fotoazioni">
            <label class="btn small sec">${player.foto ? 'Cambia foto' : 'Metti la tua foto'}<input type="file" accept="image/*" id="fotoIn" hidden></label>
            ${player.foto ? html`<button type="button" class="btn small sec" id="fotoVia">Togli foto</button>` : ''}
          </div>` : ''}</div>
      </section>
      ${sezioneCampionato}
      <h2 class="section">Pagellini Fanta Dart</h2>
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
        </div>` : ''}
      ${firma()}`,
    mount(root) {
      draw(root);
      $(root, '.seg')?.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-s]');
        if (!b) return;
        scope = b.dataset.s;
        draw(root);
      });
      $(root, '#out')?.addEventListener('click', () => logout());
      // foto profilo: ritagliata e rimpicciolita sul telefono, poi salvata nella scheda del giocatore
      const aggiornaFoto = async (foto) => {
        try {
          await setFoto(playerId, foto);
          player.foto = foto || undefined;
          if (session.player?.id === playerId) session.player.foto = player.foto;
          toast(foto ? 'Foto aggiornata' : 'Foto tolta');
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        } catch (e2) {
          console.error(e2);
          toast('Salvataggio della foto non riuscito');
        }
      };
      $(root, '#fotoIn')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try { await aggiornaFoto(await preparaFoto(file)); } catch (e2) { toast(e2.message || 'Immagine non valida'); }
      });
      $(root, '#fotoVia')?.addEventListener('click', () => { if (confirm('Togliere la foto? Torneranno le iniziali.')) aggiornaFoto(null); });
      $(root, '#pinBtn')?.addEventListener('click', () => { const f = $(root, '#pinForm'); f.hidden = !f.hidden; f.pin.focus(); });
      $(root, '#pinForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pin = e.target.pin.value.trim();
        const err = $(root, '#pinErr');
        if (!PIN_RE.test(pin)) { err.textContent = 'Il PIN è di 4 cifre.'; return; }
        try {
          await changeOwnPin(pin);
          await setPin(playerId, pin).catch((err) => console.warn('PIN non aggiornato', err));
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
