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

/** Linea della media (punti per sfida) di campionato in campionato, dal piu' vecchio al piu' recente. */
function carrieraSvg(voci) {
  const W = 300, H = 96, pad = 50, top = 24, base = H - 24;
  // scala tra un po' sotto il minimo e il massimo, cosi' le differenze si vedono
  const max = Math.max(...voci.map((v) => v.media), 0.5);
  const min = Math.max(0, Math.min(...voci.map((v) => v.media)) - 0.5);
  const x = (i) => (voci.length === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (voci.length - 1));
  const y = (m) => base - ((m - min) / (max - min || 1)) * (base - top);
  const pts = voci.map((v, i) => `${x(i).toFixed(1)},${y(v.media).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Media per campionato" class="giornate carriera">`
    + (voci.length > 1 ? `<polyline points="${pts}" class="lineac"/>` : '')
    + voci.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v.media).toFixed(1)}" r="5" class="puntoc"/>`
      + `<text x="${x(i).toFixed(1)}" y="${(y(v.media) - 10).toFixed(1)}" text-anchor="middle" class="dl">${fmtMediaCamp(v.media)}</text>`
      + `<text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="gl">${v.etichetta}</text>`).join('')
    + '</svg>';
}

/** Somma di tutti i campionati: sfide, punti, media, singoli e doppi (dove ci sono gli incontri). */
function carrieraDi(campionati) {
  const c = { campionati: campionati.length, sfide: 0, punti: 0, sg: 0, sv: 0, dg: 0, dv: 0, conIncontri: 0 };
  for (const x of campionati) {
    c.sfide += x.g.set;
    c.punti += x.g.punti;
    const b = bilancio(x.camp, x.g.nome);
    if (b) { c.sg += b.sg; c.sv += b.sv; c.dg += b.dg; c.dv += b.dv; c.conIncontri += 1; }
  }
  c.media = c.sfide ? c.punti / c.sfide : 0;
  return c;
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

const escSvg = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const breveAvv = (s) => { const x = String(s || '').trim(); return x.length > 7 ? `${x.slice(0, 6)}.` : x; };

/**
 * Andamento serate: una barra per serata (dalla piu' vecchia), verde le sfide vinte e rossa le perse,
 * sopra il voto del pagellino (stella se MVP), sotto l'avversario. Con tante serate il grafico si scorre di lato.
 */
function serateSvg(serate, playerId) {
  if (!serate.length) return '<p class="muted small">Ancora nessuna serata.</p>';
  const passo = 52, pad = 10, H = 170, base = H - 34, top = 48;
  const W = Math.max(300, pad * 2 + serate.length * passo);
  const max = Math.max(1, ...serate.map(({ c }) => gamesOf(c).giocate));
  const h = (n) => (n / max) * (base - top);
  const barre = serate.map(({ c, m }, i) => {
    const g = gamesOf(c);
    const x = pad + i * passo + passo / 2;
    const hv = h(g.vinte), hp = h(g.giocate - g.vinte);
    const mvp = m.mvpPlayerId === playerId;
    return `<rect x="${x - 12}" y="${(base - hv).toFixed(1)}" width="24" height="${hv.toFixed(1)}" rx="3" class="vinte"/>`
      + `<rect x="${x - 12}" y="${(base - hv - hp).toFixed(1)}" width="24" height="${hp.toFixed(1)}" rx="3" class="perse"/>`
      + `<text x="${x}" y="${(base - hv - hp - 6).toFixed(1)}" text-anchor="middle" class="vp">${g.vinte}/${g.giocate}</text>`
      + `<circle cx="${x}" cy="18" r="13" class="voto ${votoClass(c.voto)}"/>`
      + `<text x="${x}" y="23" text-anchor="middle" class="vv">${c.voto}</text>`
      + (mvp ? `<text x="${x + 13}" y="11" text-anchor="middle" class="mvp">★</text>` : '')
      + `<text x="${x}" y="${H - 18}" text-anchor="middle" class="avv">${escSvg(breveAvv(m.avversario))}</text>`
      + `<text x="${x}" y="${H - 4}" text-anchor="middle" class="data">${escSvg(fmtDate(m.data).replace(/^\S+\s/, ''))}</text>`;
  }).join('');
  return `<div class="scorri"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Sfide vinte e perse e voto, serata per serata" class="serate">${barre}</svg></div>`
    + '<p class="legenda"><i class="vinte"></i> vinte <i class="perse"></i> perse · nel cerchio il voto · ★ MVP</p>';
}

/** Percentuale di sfide vinte nel tempo (cumulata), una linea per i singoli e una per i doppi. */
function vittorieSvg(serate) {
  if (!serate.length) return '<p class="muted small">Ancora nessuna serata.</p>';
  const W = 300, H = 130, padL = 30, padR = 34, top = 12, base = H - 22;
  const n = serate.length;
  const x = (i) => (n === 1 ? (padL + W - padR) / 2 : padL + (i * (W - padL - padR)) / (n - 1));
  const y = (p) => base - (p / 100) * (base - top);
  const serie = (k) => {
    let v = 0, g = 0;
    return serate.map(({ c }) => { const s = gamesOf(c); v += s[`${k}v`]; g += s[`${k}g`]; return g ? (v / g) * 100 : null; });
  };
  const linea = (vals, cls) => {
    const pts = vals.map((p, i) => (p == null ? null : `${x(i).toFixed(1)},${y(p).toFixed(1)}`)).filter(Boolean);
    const ultimo = [...vals].reverse().find((p) => p != null);
    if (!pts.length) return '';
    const [lx, ly] = pts.at(-1).split(',');
    return (pts.length > 1 ? `<polyline points="${pts.join(' ')}" class="${cls}"/>` : '')
      + `<circle cx="${lx}" cy="${ly}" r="4" class="${cls} punto"/>`
      + `<text x="${(+lx + 6).toFixed(1)}" y="${(+ly + 4).toFixed(1)}" class="fine ${cls}">${Math.round(ultimo)}%</text>`;
  };
  const griglia = [0, 50, 100].map((p) => `<line x1="${padL}" x2="${W - padR}" y1="${y(p)}" y2="${y(p)}" class="${p === 50 ? 'meta' : 'asse'}"/>`
    + `<text x="${padL - 6}" y="${y(p) + 4}" text-anchor="end" class="ass">${p}%</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Percentuale di sfide vinte nel tempo" class="vittorie">${griglia}`
    + `${linea(serie('s'), 'singoli')}${linea(serie('d'), 'doppi')}`
    + `<text x="${padL}" y="${H - 4}" class="ass">prima serata</text><text x="${W - padR}" y="${H - 4}" text-anchor="end" class="ass">ultima</text></svg>`
    + '<p class="legenda"><i class="singoli"></i> singoli <i class="doppi"></i> doppi · percentuale vinte, serata dopo serata</p>';
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
  const carriera = carrieraDi(campionati);
  const pagellini = playerStats(playerId, matches, cards); // tutti i pagellini, di ogni stagione
  const perc = (v, g) => (g ? `${Math.round((v / g) * 100)}%` : '–');
  const sezioneCarriera = campionati.length ? html`
      <h2 class="section">Carriera</h2>
      <div class="stats">
        <div class="stat gold"><b>${fmtMediaCamp(carriera.media)}</b><span>Media</span></div>
        <div class="stat"><b>${carriera.punti}</b><span>Punti</span></div>
        <div class="stat"><b>${carriera.sfide}</b><span>Sfide</span></div>
        <div class="stat"><b>${carriera.campionati}</b><span>${carriera.campionati === 1 ? 'Campionato' : 'Campionati'}</span></div>
      </div>
      ${carriera.conIncontri ? html`<div class="stats">
        <div class="stat"><b>${carriera.sv}/${carriera.sg}</b><span>Singoli vinti</span></div>
        <div class="stat"><b>${perc(carriera.sv, carriera.sg)}</b><span>Singoli</span></div>
        <div class="stat"><b>${carriera.dv}/${carriera.dg}</b><span>Doppi vinti</span></div>
        <div class="stat"><b>${perc(carriera.dv, carriera.dg)}</b><span>Doppi</span></div>
      </div>` : ''}
      <div class="card campgiornate">${raw(carrieraSvg([...campionati].reverse().map((x) => ({ media: x.g.media, etichetta: x.camp.breve || x.camp.nome }))))}</div>
      <p class="muted small">Media = punti per sfida, campionato per campionato.${carriera.conIncontri && carriera.conIncontri < carriera.campionati ? ' Singoli e doppi: solo dei campionati di cui abbiamo gli incontri.' : ''}${pagellini.serate ? ` Voto medio dei pagellini Fanta Dart: ${fmtMedia(pagellini.media)} in ${pagellini.serate} serate.` : ''}</p>` : '';
  const sezioneCampionato = attuale ? html`
      <h2 class="section">Campionato · ${attuale.camp.nome}</h2>
      <div class="stats">
        <div class="stat gold"><b>${attuale.g.punti}</b><span>Punti</span></div>
        <div class="stat"><b>${fmtMediaCamp(attuale.g.media)}</b><span>Media</span></div>
        <div class="stat"><b>${attuale.g.set}</b><span>Set</span></div>
        <div class="stat"><b>${attuale.pos}°/${attuale.tot}</b><span>In squadra</span></div>
      </div>
      ${attuale.g.giornate?.length ? html`<div class="card campgiornate">${raw(giornateSvg(attuale.g.giornate))}</div>` : ''}
      ${bilancio(attuale.camp, attuale.g.nome) ? html`<p class="muted small">${fmtBilancio(bilancio(attuale.camp, attuale.g.nome))} vinti</p>` : ''}
      <p class="muted small">${attuale.squadra}${giornateGiocate(attuale.g) == null ? '' : ` · ${giornateGiocate(attuale.g)} giornate giocate`} · ${attuale.camp.chiuso ? 'campionato concluso' : `dati softdart.it aggiornati al ${fmtAggiornato(attuale.camp.aggiornato)}`}</p>` : '';
  const sezionePassati = passati.length ? html`<h2 class="section">Campionati passati</h2>
        <ul class="list">${passati.map((x) => html`<li><div class="card row"><div class="grow"><strong>${x.camp.nome}</strong>
          <span class="muted small">${x.squadra} · ${x.pos}° in squadra${bilancio(x.camp, x.g.nome) ? ` · ${fmtBilancio(bilancio(x.camp, x.g.nome))}` : ` · ${x.g.set} set`}</span></div>
          <div class="valore"><b class="media">${x.g.punti}</b><span class="muted small">media ${fmtMediaCamp(x.g.media)}</span></div></div></li>`)}</ul>` : '';


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
    const cronologia = [...history].reverse(); // dalla serata piu' vecchia
    $(root, '#serate').innerHTML = serateSvg(cronologia, playerId);
    $(root, '#vittorie').innerHTML = vittorieSvg(cronologia);
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
      ${sezioneCarriera}
      ${sezionePassati}
      <h2 class="section">Pagellini Fanta Dart</h2>
      ${season ? html`<div class="seg" role="tablist">
        <button data-s="stagione" role="tab">${season.nome}</button>
        <button data-s="carriera" role="tab">Carriera</button>
      </div>` : ''}
      <div class="stats" id="stats"></div>
      <p class="muted small split" id="split"></p>
      <h2 class="section">Andamento serate</h2>
      <div class="card grafico" id="serate"></div>
      <h2 class="section">Vittorie nel tempo</h2>
      <div class="card grafico" id="vittorie"></div>
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
