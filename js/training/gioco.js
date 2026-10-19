// Schermata di gioco, uguale per tutti i giochi: bersaglio a sinistra (o sopra), pannello a destra (o sotto).
// Le frecce arrivano dal Granboard, dal tocco sul bersaglio o dai pulsanti rapidi; il gioco e' in giochi.js.
import { html, $, toast, todayIso } from '../util.js';
import { session } from '../auth.js';
import { listSessioni, saveSessione } from '../db.js';
import { segmento, etichettaDardo } from '../dartboard.js';
import { loadDraft, saveDraft, clearDraft } from './store.js';
import { keepAwake } from './awake.js';
import { onDardo, onStato, tavolaStato, scrivi } from './tavola.js';
import { EFFETTI, comandoColpo, effettoTurno } from './led.js';
import { suona, sbloccaAudio } from './suono.js';
import { visitaValida, applicaVisita } from './scorer.js';
import { gioco, rigioca, numeriCheckout, record, migliora, REGOLE } from './giochi.js';
import { pannello, comandi } from './pannelli.js';
import { barra, bersaglio, svg } from './grafica.js';

const PAUSA_MS = 6000; // dopo 3 frecce dal Granboard: il tempo di togliere le freccette
const overlay = () => document.getElementById('overlay');

const opzioniNuove = (g, vecchie) => (g.id === 'checkout' ? { numeri: numeriCheckout() } : g.id === 'rotation' ? (vecchie?.modo ? { modo: vecchie.modo } : null) : {});

export default async function giocoView([id]) {
  const g = gioco(id);
  if (!g) { location.replace('#/'); return { html: html`` }; }
  const pid = session.account.playerId;
  const mie = await listSessioni(pid);
  const draft = loadDraft(pid, 'gioco');
  const ripresa = !!(draft && draft.gioco === id && draft.opzioni && draft.eventi?.length);

  const st = {
    opzioni: ripresa ? draft.opzioni : opzioniNuove(g),
    eventi: ripresa ? draft.eventi : [],
    inizio: ripresa ? draft.inizio : Date.now(),
    input: '',
    chiusura: null, // 501 a mano: punteggio che chiude, in attesa della freccia di chiusura
    manuale: false, // pulsanti visibili anche con il Granboard collegato
    bloccoFino: 0,
  };
  let s = st.opzioni ? rigioca(g, st.opzioni, st.eventi) : null;
  let root = null;
  let offs = [];
  let awake = null;
  let contoTimer = null;
  const ac = new AbortController();
  let ledSpeciale = false; // effetto speciale in corso: a fine pausa si spengono i led
  let ledTimer = null;

  const rec = () => record(mie, g.id, st.opzioni?.modo);
  const persist = () => {
    if (st.eventi.length) saveDraft(pid, 'gioco', { gioco: id, opzioni: st.opzioni, eventi: st.eventi, inizio: st.inizio });
    else clearDraft(pid, 'gioco');
  };

  // ---------- schermate ----------
  const sceltaModo = () => html`
    <div class="page modi">
      <p class="intro">Colpisci i numeri dall'1 al 20 in ordine e chiudi con il bull. Su cosa vuoi mirare?</p>
      <div class="modigrid">${Object.entries(g.MODI).map(([k, nome]) => {
        const r = record(mie, g.id, k);
        return html`<button type="button" class="card modo" data-modo="${k}"><b>${nome}</b>
          <span class="mu sm">${k === 'D' ? 'Doppi e alla fine il Bull 50' : k === 'T' ? 'Tripli, poi un bull qualsiasi' : 'Solo il settore singolo, poi un bull'}</span>
          <span class="mu sm">${r == null ? 'Mai giocato' : `Record: ${r} frecce`}</span></button>`;
      })}</div>
    </div>`;

  const gioca = () => {
    const collegata = tavolaStato() === 'collegata';
    const mostraComandi = !collegata || st.manuale;
    return html`
      <div class="play">
        <div class="bersaglio" id="board">${bersaglio(s.finito ? [] : g.bersagli(s))}</div>
        <div class="panel">
          ${pannello(g, s, { rec: rec() })}
          ${mostraComandi ? comandi(g, s, st) : html`<p class="mu sm">Tira: le frecce si segnano da sole. Puoi anche toccare il bersaglio.</p>`}
          <div class="azioni">
            <button type="button" class="btn" data-act="annulla" ${st.eventi.length || st.chiusura ? '' : 'disabled'}>Annulla</button>
            ${collegata ? html`<button type="button" class="btn" data-act="manuale">${st.manuale ? 'Nascondi pulsanti' : 'Pulsanti'}</button>` : ''}
            <button type="button" class="btn" data-act="abbandona">Abbandona</button>
          </div>
        </div>
      </div>`;
  };

  const render = () => {
    if (!root) return;
    const titolo = g.id === 'rotation' && s ? `Rotation · ${g.MODI[s.modo]}` : g.nome;
    root.innerHTML = html`${barra(titolo, { back: '/', info: true })}${s ? gioca() : sceltaModo()}`.s;
  };

  const lampeggia = (dId, ok) => {
    const p = root?.querySelector(`#board [data-id="${dId}"]`);
    if (!p) return;
    p.classList.add(ok ? 'hitok' : 'hit');
    setTimeout(() => p.classList.remove('hitok', 'hit'), 500);
  };

  // ---------- eventi di gioco ----------
  function invia(ev, { daTavola = false } = {}) {
    if (!s || s.finito) return;
    const bersagliPrima = g.bersagli(s);
    st.eventi.push(ev);
    s = g.passo(structuredClone(s), ev);
    if (ev.t === 'd') {
      // led: il settore colpito, oppure a fine turno l'effetto speciale (180, tre tripli uguali, 100 o piu')
      const speciale = s.fineTurno ? effettoTurno(s.ultimo) : null;
      clearTimeout(ledTimer);
      scrivi(speciale || comandoColpo(ev.id));
      ledSpeciale = !!speciale;
      if (s.fineTurno && !speciale && !s.finito) ledTimer = setTimeout(() => scrivi(EFFETTI.cambioTurno), 1500);
      const ok = bersagliPrima.length ? bersagliPrima.includes(ev.id) : ev.id !== 'X';
      const sg = segmento(ev.id);
      suona(ev.id === 'X' ? 'fuori' : sg && (sg.moltiplicatore > 1 || sg.id === 'B25') ? 'speciale' : 'singolo');
      persist();
      render();
      lampeggia(ev.id, ok);
    } else { persist(); render(); }
    if (s.finito) { setTimeout(fine, 600); return; }
    if (s.fineTurno) {
      setTimeout(() => suona('fine'), 350);
      if (daTavola) contoAllaRovescia(s.ultimo);
    }
  }

  function annulla() {
    if (st.chiusura) { st.chiusura = null; render(); return; }
    if (!st.eventi.length) return;
    st.eventi.pop();
    s = rigioca(g, st.opzioni, st.eventi);
    persist();
    render();
  }

  function tasto(k) {
    if (k === 'back') st.input = st.input.slice(0, -1);
    else if (k !== 'ok') { if (st.input.length < 3) st.input = st.input === '0' ? k : st.input + k; }
    else {
      if (st.input === '') return;
      const v = Number(st.input);
      if (!visitaValida(v)) { toast('Punteggio impossibile con 3 frecce'); return; }
      st.input = '';
      if (g.id === 'x501') {
        const r = applicaVisita(s.resto, v);
        if (r.esito === 'chiuso') { st.chiusura = { s: v, resto: s.resto }; render(); return; }
        if (r.esito === 'sballo') toast(`Sballato: resti a ${s.resto}`);
      }
      invia({ t: 'turno', s: v });
      return;
    }
    render();
  }

  // ---------- conto alla rovescia e fine ----------
  function contoAllaRovescia(ultimo) {
    st.bloccoFino = Date.now() + PAUSA_MS;
    const secondi = () => Math.ceil((st.bloccoFino - Date.now()) / 1000);
    overlay().innerHTML = html`<div class="conto" role="status"><p>Togli le freccette</p><div class="n">${secondi()}</div>
      ${ultimo.length ? html`<p class="riep">Turno: <b>${ultimo.map(etichettaDardo).join(' · ')}</b></p>` : ''}
      <button type="button" class="btn" data-act="pronto">Sono pronto</button></div>`.s;
    // aggiorno solo il numero: ridisegnare tutto farebbe ripartire l'animazione di comparsa
    const disegna = () => {
      const resta = secondi();
      if (resta <= 0) { chiudiConto(); return; }
      const n = overlay().querySelector('.conto .n');
      if (n) n.textContent = resta;
    };
    clearInterval(contoTimer);
    disegna();
    contoTimer = setInterval(disegna, 250);
  }
  function chiudiConto() {
    if (ledSpeciale) { scrivi(EFFETTI.spento); ledSpeciale = false; }
    clearInterval(contoTimer);
    st.bloccoFino = 0;
    if (overlay().querySelector('.conto')) overlay().innerHTML = '';
  }

  function fine() {
    clearTimeout(ledTimer);
    setTimeout(() => scrivi(EFFETTI.fine), ledSpeciale ? 3000 : 800);
    chiudiConto();
    const valore = g.valore(s);
    const voto = Math.round(g.voto(valore, st.opzioni));
    const precedente = rec();
    const nuovo = { playerId: pid, gioco: id, valore, voto, data: todayIso(), ts: Date.now(), opzioni: st.opzioni, dati: g.dati(s), durataMin: Math.max(1, Math.round((Date.now() - st.inizio) / 60000)) };
    const { fatto } = saveSessione(JSON.parse(JSON.stringify(nuovo)));
    fatto.catch((e) => { console.error(e); toast('Salvataggio non riuscito: controlla la connessione'); });
    mie.push(nuovo);
    clearDraft(pid, 'gioco');
    const record_ = migliora(g, valore, precedente);
    overlay().innerHTML = html`<div class="fine"><div class="card">
      <p class="mu">${g.nome}${st.opzioni?.modo ? ` · ${g.MODI[st.opzioni.modo]}` : ''}</p>
      <div class="big">${valore}<small> ${g.unit}</small></div>
      <p class="esito">${precedente == null ? 'Primo risultato: da qui si migliora.' : record_ ? `Nuovo record! Il precedente era ${precedente}.` : `Il tuo record è ${precedente}.`}</p>
      <p class="mu">Voto ${voto} su 100</p>
      <div class="azioni"><a class="btn" href="#/">Torna agli allenamenti</a><button type="button" class="btn pri" data-act="ancora">Gioca ancora</button></div>
    </div></div>`.s;
  }

  function regole() {
    overlay().innerHTML = html`<div class="modal" data-act="chiudi"><div class="card regole" data-stop>
      <header><h2>Come si gioca · ${g.nome}</h2>
        <button type="button" class="iconbtn" data-act="chiudi" aria-label="Chiudi">${svg('chiudi')}</button></header>
      <ul>${REGOLE[g.id].map((r) => html`<li>${r}</li>`)}</ul>
      <p class="mu sm">${tavolaStato() === 'collegata' ? 'Con il Granboard le frecce si segnano da sole: dopo ogni turno hai 6 secondi per togliere le freccette.'
        : 'Senza Granboard tocca sul bersaglio il settore colpito, oppure usa i pulsanti.'}</p>
      <button type="button" class="btn pri" data-act="chiudi">Ho capito</button>
    </div></div>`.s;
  }

  function ancora() {
    scrivi(EFFETTI.inizio);
    overlay().innerHTML = '';
    st.opzioni = opzioniNuove(g, st.opzioni);
    st.eventi = [];
    st.inizio = Date.now();
    st.chiusura = null;
    s = rigioca(g, st.opzioni, []);
    render();
  }

  return {
    html: html``,
    mount(el) {
      root = el;
      if (ripresa) toast('Partita ripresa da dove eri rimasto');
      if (s) scrivi(EFFETTI.inizio);
      render();
      const sig = { signal: ac.signal };
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || b.disabled) return;
        const d = b.dataset;
        if (d.modo) { st.opzioni = { modo: d.modo }; s = rigioca(g, st.opzioni, []); scrivi(EFFETTI.inizio); render(); }
        else if (d.ev) invia(JSON.parse(d.ev));
        else if (d.k) tasto(d.k);
        else if (d.act === 'info') regole();
        else if (d.act === 'annulla') annulla();
        else if (d.act === 'manuale') { st.manuale = !st.manuale; render(); }
        else if (d.act === 'abbandona') {
          if (!st.eventi.length || confirm('Abbandoni questa partita? Non verrà salvata.')) { clearDraft(pid, 'gioco'); location.hash = '#/'; }
        }
      }, sig);
      // tocco sul bersaglio: pointerdown e' piu' immediato del click
      el.addEventListener('pointerdown', (e) => {
        sbloccaAudio();
        awake?.retry();
        const p = e.target.closest('#board [data-id]');
        if (p && s && !s.finito) { e.preventDefault(); invia({ t: 'd', id: p.dataset.id }); }
      }, sig);
      const ov = (e) => {
        const b = e.target.closest('button');
        const chiudi = e.target.closest('[data-act="chiudi"]');
        if (chiudi && !(chiudi.classList.contains('modal') && e.target.closest('[data-stop]'))) { overlay().innerHTML = ''; return; }
        if (b?.dataset.act === 'pronto') chiudiConto();
        else if (b?.dataset.act === 'ancora') ancora();
      };
      overlay().addEventListener('click', ov, sig);
      offs = [
        onDardo((dd) => {
          if (!s || s.finito || Date.now() < st.bloccoFino || st.chiusura) return;
          invia({ t: 'd', id: dd.id }, { daTavola: true });
        }),
        onStato((stt) => { if (stt === 'collegata' && s && !s.finito) scrivi(EFFETTI.inizio); render(); }),
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
