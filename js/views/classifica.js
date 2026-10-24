// Classifica con i dati ufficiali del campionato (softdart.it): la nostra squadra o tutto il girone,
// per punti o per media. Il voto medio dei pagellini resta come informazione accanto al nome.
import { html, $, $$, fullName } from '../util.js';
import { listPlayers, listCards, listMatches } from '../db.js';
import { playerStats, fmtMedia } from '../stats.js';
import { topbar, avatar, emptyState } from '../ui.js';
import {
  listCampionati, getCampionato, campionatoScelto, scegliCampionato, giocatoriDi, nostraSquadra, giornateGiocate,
  ordina, fmtMediaCamp, fmtAggiornato, risultatoIncontro, bilancio, fmtBilancio,
} from '../campionato.js';

const iniziali = (nome) => nome.split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase();

export default async function view() {
  const [elenco, players, cards, matches] = await Promise.all([
    listCampionati(), listPlayers(), listCards({}, { onlyPublished: true }), listMatches(null, { onlyPublished: true }),
  ]);
  if (!elenco.length) {
    return { html: html`${topbar('Classifica')}${emptyState('Nessun campionato', 'La classifica comparirà quando saranno caricati i dati del campionato.')}` };
  }
  const perTessera = new Map(players.map((p) => [p.tessera, p]));
  const voti = new Map(players.map((p) => [p.id, playerStats(p.id, matches, cards)])); // pagellini di tutta la carriera
  let camp = await getCampionato(campionatoScelto(elenco).id);
  let vista = 'squadra'; // squadra | girone
  let criterio = 'punti';

  const riga = (g, i) => {
    const p = perTessera.get(g.tessera);
    const st = p ? voti.get(p.id) : null;
    const sotto = [
      vista === 'girone' ? g.squadra : null,
      giornateGiocate(g) == null ? `${g.set} set` : `${giornateGiocate(g)} ${giornateGiocate(g) === 1 ? 'giornata' : 'giornate'} · ${g.set} set`,
      fmtBilancio(bilancio(camp, g.nome)) || null,
      st?.serate ? `pagellini ${fmtMedia(st.media)}` : null,
    ].filter(Boolean).join(' · ');
    const principale = criterio === 'punti' ? String(g.punti) : fmtMediaCamp(g.media);
    const secondario = criterio === 'punti' ? `media ${fmtMediaCamp(g.media)}` : `${g.punti} punti`;
    const corpo = html`
      <span class="pos">${i + 1}</span>
      ${p ? avatar(p) : html`<span class="avatar" aria-hidden="true">${iniziali(g.nome)}</span>`}
      <div class="grow"><strong>${p ? fullName(p) : g.nome}</strong><span class="muted small">${sotto}</span></div>
      <div class="valore"><b class="media">${principale}</b><span class="muted small">${secondario}</span></div>`;
    return p
      ? html`<li><a class="card row rank" href="#/profilo/${p.id}">${corpo}</a></li>`
      : html`<li><div class="card row rank esterno">${corpo}</div></li>`;
  };

  // Incontri della squadra: risultato e, aprendolo, tutte le sfide (in evidenza i nostri)
  const incontri = (nostra) => (camp.incontri || []).map((inc) => {
    const [c, o] = risultatoIncontro(inc);
    const noi = inc.casa === nostra ? 0 : 1;
    const vinto = (noi === 0 ? c > o : o > c);
    return html`<li><details class="card incontro ${vinto ? 'vinto' : 'perso'}">
      <summary><span class="grow"><strong>${inc.casa} – ${inc.ospite}</strong>${inc.incompleto ? html`<span class="muted small">${inc.incompleto}</span>` : ''}</span>
        <b class="media">${c} – ${o}</b></summary>
      <ul class="sfide">${inc.giochi.map((g) => html`<li class="${g.casa.length > 1 ? 'doppio' : ''}">
        <span>${g.casa.join(' + ')}</span><b class="${(g.set[0] > g.set[1]) === (noi === 0) ? 'noi' : ''}">${g.set[0]}-${g.set[1]}</b><span>${g.ospite.join(' + ')}</span></li>`)}</ul>
    </details></li>`;
  });

  const draw = (root) => {
    const tutti = giocatoriDi(camp);
    if (vista === 'incontri' && !camp.incontri?.length) vista = 'squadra';
    const conIncontri = !!camp.incontri?.length;
    root.querySelector('[data-v="incontri"]').hidden = !conIncontri;
    root.querySelector('.seg.criterio').hidden = vista === 'incontri';
    const nostra = nostraSquadra(camp, players.map((p) => p.tessera));
    const lista = ordina(vista === 'squadra' ? tutti.filter((g) => g.squadra === nostra) : tutti, criterio);
    $(root, '#rows').innerHTML = vista === 'incontri' ? incontri(nostra).map((x) => x.s).join('')
      : lista.length ? lista.map((g, i) => riga(g, i).s).join('') : '<li class="muted">Nessun dato.</li>';
    $(root, '#info').textContent = `${camp.chiuso ? 'Campionato concluso' : `Aggiornata al ${fmtAggiornato(camp.aggiornato)}`} · dati ufficiali softdart.it.`
      + ` Media = punti per set. ${vista === 'squadra' && nostra ? `Squadra: ${nostra}.` : ''}`;
    $$(root, '.seg.vista button').forEach((b) => {
      b.classList.toggle('sel', b.dataset.v === vista);
      if (b.dataset.v === 'squadra') b.textContent = nostra || 'La squadra';
    });
    $$(root, '.seg.criterio button').forEach((b) => b.classList.toggle('sel', b.dataset.c === criterio));
  };

  return {
    html: html`
      ${topbar('Classifica')}
      <div id="clas">
      ${elenco.length > 1 ? html`<label class="field camp">Campionato
        <select id="camp">${elenco.map((c) => html`<option value="${c.id}" ${c.id === camp.id ? 'selected' : ''}>${c.nome}${c.chiuso ? ' · concluso' : ''}</option>`)}</select>
      </label>` : html`<p class="campnome">${camp.nome}</p>`}
      <div class="seg vista" role="tablist">
        <button data-v="squadra" role="tab">La squadra</button>
        <button data-v="girone" role="tab">Tutto il girone</button>
        <button data-v="incontri" role="tab" hidden>Incontri</button>
      </div>
      <div class="seg criterio small" role="tablist">
        <button data-c="punti" role="tab">Punti</button>
        <button data-c="media" role="tab">Media</button>
      </div>
      <p class="muted small record" id="info"></p>
      <ul class="list" id="rows"></ul>
      </div>`,
    mount(root) {
      draw(root);
      $(root, '#clas').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-v], button[data-c]');
        if (!b) return;
        if (b.dataset.v) vista = b.dataset.v;
        if (b.dataset.c) criterio = b.dataset.c;
        draw(root);
      });
      $(root, '#camp')?.addEventListener('change', async (e) => {
        scegliCampionato(e.target.value);
        camp = await getCampionato(e.target.value);
        draw(root);
      });
    },
  };
}
