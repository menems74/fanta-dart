// Progressi di un giocatore (i miei, o di un compagno dalla pagina Squadra): numeri, dove migliorare, grafici, badge.
import { html, fmtDate, todayIso, toast, fullName } from '../util.js';
import { session } from '../auth.js';
import { listSessioni, deleteSessione, getPlayer } from '../db.js';
import {
  GIOCHI, gioco, votoGioco, skill, trendGioco, record, settimana, BADGES, badgePresi, varianteDi, nomeVariante,
} from './giochi.js';
import { barra, pollice, linea, COLORE, svg } from './grafica.js';

/**
 * Sessioni da mettere nel grafico. Rotation: solo la modalita' giocata per ultima (frecce non confrontabili).
 * Target: tutte, perche' il grafico usa la media a serie; il record e' quello della variante giocata per ultima.
 */
function serieDi(sessioni, id) {
  const g = gioco(id);
  let lista = sessioni.filter((x) => x.gioco === id);
  const variante = lista.length ? varianteDi(g, lista.at(-1).opzioni) : null;
  if (g.VARIANTI?.chiave === 'modo' && variante) lista = lista.filter((x) => varianteDi(g, x.opzioni) === variante);
  const titolo = g.VARIANTI?.chiave === 'modo' && variante ? ` · ${nomeVariante(g, variante)}` : '';
  return { lista, variante, titolo };
}
const valoreGrafico = (g, x) => (g.grafico ? g.grafico(x) : x.valore);
const etichettaVariante = (g, x) => (g.VARIANTI ? ` · ${nomeVariante(g, varianteDi(g, x.opzioni))}` : '');

export default async function progressiView([altro]) {
  const mio = session.account.playerId;
  const pid = altro || mio;
  const [sessioni, giocatore] = await Promise.all([listSessioni(pid), altro ? getPlayer(altro) : null]);
  const mia = pid === mio;
  const oggi = todayIso();
  const titolo = mia ? 'I miei progressi' : `Progressi di ${giocatore ? fullName(giocatore) : 'un compagno'}`;

  const giocati = GIOCHI.filter((g) => sessioni.some((x) => x.gioco === g.id))
    .map((g) => ({ g, v: votoGioco(sessioni, g.id), t: trendGioco(sessioni, g.id) }));
  const peggiori = [...giocati].sort((a, b) => (b.t === 'giu') - (a.t === 'giu') || a.v - b.v).slice(0, 2);
  const migliori = [...giocati].sort((a, b) => (b.t === 'su') - (a.t === 'su') || b.v - a.v).filter((x) => !peggiori.includes(x)).slice(0, 2);
  const presi = badgePresi(sessioni);
  const ac = new AbortController();

  const modale = (id) => {
    const g = gioco(id);
    const { lista, titolo: tv } = serieDi(sessioni, id);
    const t = trendGioco(sessioni, id);
    return html`<div class="modal" data-act="chiudi"><div class="card" data-stop>
      <header>${pollice(t, true)}<h2>${g.nome}${tv}</h2>
        <button type="button" class="iconbtn" data-act="chiudi" aria-label="Chiudi">${svg('chiudi')}</button></header>
      <p class="mu">${lista.length} ${lista.length === 1 ? 'sessione' : 'sessioni'} · ${g.unitGrafico || g.unit}${g.basso ? ' · meno è meglio: in alto c\'è il risultato migliore' : ''}</p>
      ${linea(lista.map((x) => valoreGrafico(g, x)), { w: 800, h: 300, colore: COLORE[t], basso: g.basso, assi: true })}
      <ul class="storico">${[...sessioni.filter((x) => x.gioco === id)].reverse().slice(0, 30).map((x) => html`<li>
        <span>${fmtDate(x.data)}${etichettaVariante(g, x)}</span><b>${x.valore}</b><span class="mu">voto ${x.voto}</span>
        ${mia && x.id ? html`<button type="button" class="iconbtn piccolo" data-del="${x.id}" aria-label="Elimina">${svg('cestino')}</button>` : html`<span></span>`}
      </li>`)}</ul>
      ${mia ? html`<a class="btn pri" href="#/gioco/${id}">Allenati ora</a>` : ''}
    </div></div>`;
  };

  return {
    html: html`
      ${barra(titolo, { back: mia ? '/' : '/squadra' })}
      <div class="page progressi">
        <div class="tstats">
          <div class="card"><b>${sessioni.length}</b><span>sessioni</span></div>
          <div class="card"><b>${settimana(sessioni, oggi)}</b><span>questa settimana</span></div>
          <div class="card"><b>${skill(sessioni) ?? '–'}</b><span>skill</span></div>
          <div class="card"><b>${presi.size}/${BADGES.length}</b><span>badge</span></div>
        </div>
        ${giocati.length >= 2 ? html`<div class="focus">
          <section class="card bad"><h2>Dove impegnarsi</h2><ul>${peggiori.map(({ g, v, t }) => html`<li><span>${g.nome}</span><span>voto <b>${v}</b>${t === 'giu' ? ' · in calo' : ''}</span></li>`)}</ul></section>
          <section class="card good"><h2>Dove va forte</h2><ul>${migliori.map(({ g, v, t }) => html`<li><span>${g.nome}</span><span>voto <b>${v}</b>${t === 'su' ? ' · in crescita' : ''}</span></li>`)}</ul></section>
        </div>` : html`<p class="card mu">Gioca almeno due giochi diversi per vedere dove migliorare.</p>`}
        <div class="charts">
          ${GIOCHI.map((g) => {
            const { lista, variante, titolo: tv } = serieDi(sessioni, g.id);
            const t = trendGioco(sessioni, g.id);
            const rec = record(sessioni, g.id, variante);
            return html`<button type="button" class="card chartcard" data-chart="${g.id}" ${lista.length ? '' : 'disabled'}>
              ${pollice(t)}<h3>${g.nome}${tv}</h3>
              <p class="mu sm">${lista.length ? `Voto ${votoGioco(sessioni, g.id)} · record ${rec} ${g.unit}${g.VARIANTI?.chiave === 'serie' ? ` in ${variante} serie` : ''}${g.basso ? ' · meno è meglio' : ''}` : 'Mai giocato'}</p>
              ${linea(lista.slice(-20).map((x) => valoreGrafico(g, x)), { colore: COLORE[t], basso: g.basso })}
            </button>`;
          })}
        </div>
        <h2 class="sezione">Badge</h2>
        <div class="bdgs">${BADGES.map((b) => html`<div class="bdg ${presi.has(b.id) ? 'on' : ''}"><b>${b.nome}</b><span>${b.desc}</span></div>`)}</div>
      </div>`,
    mount(root) {
      const ov = document.getElementById('overlay');
      root.addEventListener('click', (e) => {
        const c = e.target.closest('[data-chart]');
        if (c && !c.disabled) ov.innerHTML = modale(c.dataset.chart).s;
      }, { signal: ac.signal });
      ov.addEventListener('click', async (e) => {
        const del = e.target.closest('[data-del]');
        if (del) {
          if (!confirm('Eliminare questa sessione?')) return;
          try { await deleteSessione(del.dataset.del); toast('Sessione eliminata'); ov.innerHTML = ''; window.dispatchEvent(new HashChangeEvent('hashchange')); } catch (err) { console.error(err); toast('Eliminazione non riuscita'); }
          return;
        }
        const a = e.target.closest('[data-act="chiudi"]');
        if (!a) return;
        if (a.classList.contains('modal') && e.target.closest('[data-stop]')) return;
        ov.innerHTML = '';
      }, { signal: ac.signal });
    },
    unmount() { ac.abort(); document.getElementById('overlay').innerHTML = ''; },
  };
}
