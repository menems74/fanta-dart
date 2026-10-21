// Scoring con la stessa schermata del 501: scheda con il totale, i 6 turni, somma del turno e tastierino grande.
// Senza Granboard si scrive la somma delle 3 frecce; con il Granboard le frecce si segnano da sole.
import { html, toast, todayIso } from '../util.js';
import { session } from '../auth.js';
import { listSessioni, saveSessione } from '../db.js';
import { etichettaDardo } from '../dartboard.js';
import { loadDraft, saveDraft, clearDraft } from './store.js';
import { keepAwake } from './awake.js';
import { pausaMs, pausaSecondi, ritardoCambioTurno } from './pausa.js';
import { onDardo, onStato, tavolaStato, scrivi } from './tavola.js';
import { EFFETTI, comandoNumeri, comandoColpo, effettoTurno } from './led.js';
import { suona, sbloccaAudio } from './suono.js';
import { visitaValida } from './scorer.js';
import { gioco, rigioca, record, migliora, REGOLE } from './giochi.js';
import { barra, svg, nomeGiocatore } from './grafica.js';

const TURNI = 6;
const overlay = () => document.getElementById('overlay');
const g = gioco('scoring');
const somma = (a) => a.reduce((t, v) => t + v, 0);

export default async function partitaScoringView() {
  const pid = session.account.playerId;
  const mie = await listSessioni(pid);
  const draft = loadDraft(pid, 'gioco');
  const ripresa = !!(draft && draft.gioco === 'scoring' && draft.eventi?.length);

  const st = {
    eventi: ripresa ? draft.eventi : [],
    inizio: ripresa ? draft.inizio : Date.now(),
    input: '',
    bloccoFino: 0,
    finito: false,
  };
  let s = rigioca(g, {}, st.eventi);
  let root = null;
  let offs = [];
  let awake = null;
  let contoTimer = null;
  let ledTimer = null;
  let ledSpeciale = false;
  const ac = new AbortController();
  const lampeggio = () => [0, 500, 1000].forEach((ms) => setTimeout(() => scrivi(EFFETTI.lampeggio), ms)); // festa: tutta la tavola lampeggia 3 volte

  const persist = () => {
    if (st.eventi.length) saveDraft(pid, 'gioco', { gioco: 'scoring', opzioni: {}, eventi: st.eventi, inizio: st.inizio });
    else clearDraft(pid, 'gioco');
  };

  // ---------- schermata ----------
  const scheda = () => {
    const rec = record(mie, 'scoring');
    const media = s.visite.length ? (somma(s.visite) / s.visite.length).toFixed(1) : '0.0';
    return html`<section class="pcard attivo">
      <header><span class="pnome">${session.player?.nome || nomeGiocatore()}</span><span class="mu sm">Frecce ${s.frecce} di ${g.FRECCE}</span></header>
      <div class="presto">${g.valore(s)}</div>
      <dl>
        <div><dt>Media del turno</dt><dd>${media}</dd></div>
        <div><dt>Record</dt><dd>${rec ?? '–'}</dd></div>
      </dl>
    </section>`;
  };

  const turni = () => html`<div class="serie sei">${Array.from({ length: TURNI }, (_, i) => {
    const fatto = i < s.visite.length;
    const ora = i === s.visite.length && !s.finito;
    return html`<span class="${fatto ? 'fatta' : ora ? 'ora' : ''}">${fatto ? s.visite[i] : ora && s.turno.length ? s.parziale : ''}</span>`;
  })}</div>`;

  // Stesso tastierino del 501. Se le frecce arrivano dal Granboard, la barra mostra il turno in corso
  // e "Chiudi turno" lo chiude a meta' (le frecce mancanti valgono 0).
  const tastierino = () => {
    const parziale = s.turno.length > 0;
    return html`
    <div class="inbar">
      ${parziale ? html`<div class="indisp turnoin">${s.turno.map(etichettaDardo).join(' · ')} <span>= ${s.parziale}</span></div>
        <button type="button" class="invia chiudi" data-act="completa">Chiudi turno</button>`
      : html`<div class="indisp ${st.input ? '' : 'vuoto'}">${st.input || 'Somma delle 3 frecce'}</div>
        <button type="button" class="invia" data-k="ok">Invia</button>`}
    </div>
    <div class="k501 ${parziale ? 'bloccato' : ''}">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => html`<button type="button" data-k="${n}">${n}</button>`)}
      <button type="button" data-k="undo" class="annulla" aria-label="Annulla l'ultima mossa" title="Annulla l'ultima mossa">↶</button>
      <button type="button" data-k="0">0</button>
      <button type="button" data-k="back" class="canc" aria-label="Cancella l'ultima cifra">⌫</button>
    </div>`;
  };

  const render = () => {
    if (!root) return;
    root.innerHTML = html`${barra('Scoring', { back: '/', info: true })}
      <div class="p501">
        <div class="carte n1">${scheda()}${turni()}</div>
        <div class="ctrl">
          <p class="turno">${s.finito ? 'Finito!' : `Turno ${Math.min(s.visite.length + 1, TURNI)} di ${TURNI}`}</p>
          ${s.finito ? '' : tastierino()}
          <div class="azioni"><button type="button" class="btn" data-act="abbandona">Abbandona</button></div>
        </div>
      </div>`.s;
  };

  // ---------- eventi ----------
  function invia(ev, { daTavola = false } = {}) {
    if (st.finito || s.finito) return;
    st.eventi.push(ev);
    s = g.passo(structuredClone(s), ev);
    if (ev.t === 'd') {
      const speciale = s.fineTurno ? effettoTurno(s.ultimo) : null;
      clearTimeout(ledTimer);
      scrivi(speciale || comandoColpo(ev.id));
      ledSpeciale = !!speciale;
      if (s.fineTurno && !speciale && !s.finito) ledTimer = setTimeout(() => scrivi(EFFETTI.cambioTurno), ritardoCambioTurno());
      suona(ev.id === 'X' ? 'fuori' : 'singolo');
    }
    persist();
    render();
    if (s.finito) { setTimeout(fine, 700); return; }
    if (s.fineTurno) {
      setTimeout(() => suona('fine'), 350);
      if (daTavola) contoAllaRovescia(s.ultimo);
    }
  }

  function annulla() {
    if (!st.eventi.length) return;
    st.eventi.pop();
    s = rigioca(g, {}, st.eventi);
    persist();
    render();
  }

  function tasto(k) {
    if (k === 'undo') { annulla(); return; }
    if (s.turno.length) return; // turno in corso dal Granboard: si finisce tirando o con "Chiudi turno"
    if (k === 'back') st.input = st.input.slice(0, -1);
    else if (k !== 'ok') { if (st.input.length < 3) st.input = st.input === '0' ? k : st.input + k; }
    else {
      if (st.input === '') return;
      const v = Number(st.input);
      if (!visitaValida(v)) { toast('Punteggio impossibile con 3 frecce'); return; }
      st.input = '';
      invia({ t: 'turno', s: v });
      return;
    }
    render();
  }

  // ---------- conto alla rovescia e fine ----------
  function contoAllaRovescia(ultimo) {
    if (!pausaMs()) return; // pausa disattivata: si tira subito
    st.bloccoFino = Date.now() + pausaMs();
    const secondi = () => Math.ceil((st.bloccoFino - Date.now()) / 1000);
    overlay().innerHTML = html`<div class="conto" role="status"><p>Togli le freccette</p><div class="n">${secondi()}</div>
      ${ultimo.length ? html`<p class="riep">Turno: <b>${ultimo.map(etichettaDardo).join(' · ')}</b> = <b>${s.visite.at(-1)}</b></p>` : ''}
      <button type="button" class="btn" data-act="pronto">Sono pronto</button></div>`.s;
    const disegna = () => {
      const resta = secondi();
      if (resta <= 0) { chiudiConto(); return; }
      const n = overlay().querySelector('.conto .n');
      if (n) n.textContent = resta;
    };
    clearInterval(contoTimer);
    contoTimer = setInterval(disegna, 250);
  }
  function chiudiConto() {
    if (ledSpeciale) { scrivi(EFFETTI.spento); ledSpeciale = false; }
    clearInterval(contoTimer);
    st.bloccoFino = 0;
    if (overlay().querySelector('.conto')) overlay().innerHTML = '';
  }

  function fine() {
    if (st.finito) return;
    st.finito = true;
    clearTimeout(ledTimer);
    setTimeout(() => scrivi(EFFETTI.fine), ledSpeciale ? 3000 : 800);
    chiudiConto();
    const valore = g.valore(s);
    const voto = Math.round(g.voto(valore));
    const precedente = record(mie, 'scoring');
    const nuovo = { playerId: pid, gioco: 'scoring', valore, voto, data: todayIso(), ts: Date.now(), opzioni: {}, dati: g.dati(s), durataMin: Math.max(1, Math.round((Date.now() - st.inizio) / 60000)) };
    saveSessione(JSON.parse(JSON.stringify(nuovo))).fatto.catch((e) => { console.error(e); toast('Salvataggio non riuscito: controlla la connessione'); });
    mie.push(nuovo);
    clearDraft(pid, 'gioco');
    if (precedente != null && migliora(g, valore, precedente)) lampeggio(); // nuovo record: tutta la tavola lampeggia
    overlay().innerHTML = html`<div class="fine"><div class="card">
      <p class="mu">Scoring · 18 frecce</p>
      <div class="big">${valore}<small> punti</small></div>
      <p class="esito">${precedente == null ? 'Primo risultato: da qui si migliora.' : migliora(g, valore, precedente) ? `Nuovo record! Il precedente era ${precedente}.` : `Il tuo record è ${precedente}.`}</p>
      <p class="mu">Media del turno ${(valore / TURNI).toFixed(1)} · voto ${voto} su 100</p>
      <div class="azioni"><a class="btn" href="#/">Torna agli allenamenti</a><button type="button" class="btn pri" data-act="ancora">Gioca ancora</button></div>
    </div></div>`.s;
  }

  function nuovaPartita() {
    st.eventi = [];
    st.finito = false;
    st.input = '';
    st.inizio = Date.now();
    s = rigioca(g, {}, []);
  }

  function regole() {
    overlay().innerHTML = html`<div class="modal" data-act="chiudi"><div class="card regole" data-stop>
      <header><h2>Come si gioca · Scoring</h2>
        <button type="button" class="iconbtn" data-act="chiudi" aria-label="Chiudi">${svg('chiudi')}</button></header>
      <ul>${REGOLE.scoring.map((x) => html`<li>${x}</li>`)}</ul>
      <p class="mu sm">${tavolaStato() === 'collegata' ? `Con il Granboard le frecce si segnano da sole: ${pausaSecondi() ? `dopo ogni turno hai ${pausaSecondi()} secondi per togliere le freccette (lo cambi nella home, Pausa dopo il turno).` : 'la pausa dopo il turno è disattivata (la cambi nella home).'}`
        : 'Senza Granboard scrivi la somma delle 3 frecce e premi Invia. Con ↶ annulli l\'ultimo turno.'}</p>
      <button type="button" class="btn pri" data-act="chiudi">Ho capito</button>
    </div></div>`.s;
  }

  return {
    html: html``,
    mount(el) {
      root = el;
      if (ripresa) toast('Partita ripresa da dove eri rimasto');
      scrivi(EFFETTI.inizio);
      render();
      const sig = { signal: ac.signal };
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || b.disabled) return;
        const d = b.dataset;
        if (d.k) tasto(d.k);
        else if (d.act === 'completa') { while (s.turno.length && !s.finito) invia({ t: 'd', id: 'X' }); }
        else if (d.act === 'info') regole();
        else if (d.act === 'abbandona') {
          if (!st.eventi.length || confirm('Abbandoni questa partita? Non verrà salvata.')) { clearDraft(pid, 'gioco'); location.hash = '#/'; }
        }
      }, sig);
      el.addEventListener('pointerdown', () => { sbloccaAudio(); awake?.retry(); }, sig);
      overlay().addEventListener('click', (e) => {
        const b = e.target.closest('button');
        const chiudi = e.target.closest('[data-act="chiudi"]');
        if (chiudi && !(chiudi.classList.contains('modal') && e.target.closest('[data-stop]'))) { overlay().innerHTML = ''; return; }
        if (b?.dataset.act === 'pronto') chiudiConto();
        else if (b?.dataset.act === 'ancora') { overlay().innerHTML = ''; nuovaPartita(); scrivi(EFFETTI.inizio); render(); }
      }, sig);
      offs = [
        onDardo((dd) => {
          if (st.finito || s.finito || Date.now() < st.bloccoFino) return;
          st.input = '';
          invia({ t: 'd', id: dd.id }, { daTavola: true });
        }),
        onStato((stt) => { if (stt === 'collegata' && !st.finito) scrivi(EFFETTI.inizio); render(); }),
      ];
      awake = keepAwake(() => {});
    },
    unmount() {
      clearTimeout(ledTimer);
      ac.abort();
      offs.forEach((f) => f());
      chiudiConto();
      scrivi(EFFETTI.attesa);
      overlay().innerHTML = '';
      awake?.release();
      root = null;
    },
  };
}
