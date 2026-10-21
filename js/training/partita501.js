// 501 da solo o in due (contro un compagno o un OSPITE), senza bersaglio: schede dei giocatori e tastierino grande.
// Senza Granboard si scrive la somma delle 3 frecce; con il Granboard le frecce si segnano da sole.
import { html, toast, todayIso, fullName } from '../util.js';
import { session } from '../auth.js';
import { listSessioni, listPlayers, saveSessione } from '../db.js';
import { etichettaDardo } from '../dartboard.js';
import { loadDraft, saveDraft, clearDraft } from './store.js';
import { keepAwake } from './awake.js';
import { pausaMs, pausaSecondi, ritardoCambioTurno } from './pausa.js';
import { onDardo, onStato, tavolaStato, scrivi } from './tavola.js';
import { EFFETTI, comandoNumeri, comandoColpo, effettoTurno } from './led.js';
import { suona, sbloccaAudio } from './suono.js';
import { parla, sbloccaVoce } from './voce.js';
import { visitaValida, applicaVisita, frecceChiusura } from './scorer.js';
import { gioco, partita501, restoProvvisorio, record, migliora, REGOLE } from './giochi.js';
import { barra, svg, nomeGiocatore } from './grafica.js';

const OSPITE = 'ospite';
const overlay = () => document.getElementById('overlay');
const g = gioco('x501');

export default async function partita501View() {
  const pid = session.account.playerId;
  const [mie, players] = await Promise.all([listSessioni(pid), listPlayers()]);
  const compagni = players.filter((p) => p.id !== pid && p.attivo !== false);
  const draft = loadDraft(pid, 'gioco');
  const ripresa = !!(draft && draft.gioco === 'x501' && draft.opzioni?.n && draft.eventi?.length);

  const st = {
    fase: ripresa ? 'gioco' : 'setup',
    opzioni: ripresa ? draft.opzioni : { n: 1, avversario: null },
    eventi: ripresa ? draft.eventi : [],
    continua: ripresa ? !!draft.continua : false,
    inizio: ripresa ? draft.inizio : Date.now(),
    input: '',
    chiusura: null,
    bloccoFino: 0,
    finito: false,
  };
  let r = partita501(st.opzioni.n, st.eventi);
  let root = null;
  let offs = [];
  let awake = null;
  let contoTimer = null;
  let ledTimer = null;
  let ledSpeciale = false;
  const ac = new AbortController();
  const lampeggio = () => [0, 500, 1000].forEach((ms) => setTimeout(() => scrivi(EFFETTI.lampeggio), ms)); // festa: tutta la tavola lampeggia 3 volte

  const nomeDi = (i) => (i === 0 ? (session.player?.nome || nomeGiocatore())
    : st.opzioni.avversario === OSPITE ? 'Ospite' : (compagni.find((p) => p.id === st.opzioni.avversario)?.nome || 'Avversario'));
  const persist = () => {
    if (st.eventi.length) saveDraft(pid, 'gioco', { gioco: 'x501', opzioni: st.opzioni, eventi: st.eventi, continua: st.continua, inizio: st.inizio });
    else clearDraft(pid, 'gioco');
  };
  const rigioca = () => { r = partita501(st.opzioni.n, st.eventi); };

  // ---------- schermate ----------
  const setup = () => {
    const due = st.opzioni.n === 2;
    const sel = st.opzioni.avversario;
    return html`<div class="page s501">
      <h2>Come vuoi giocare?</h2>
      <div class="scelta2">
        <button type="button" class="card modo ${!due ? 'sel' : ''}" data-n="1"><b>Da solo</b><span class="mu sm">Conta con quante frecce chiudi</span></button>
        <button type="button" class="card modo ${due ? 'sel' : ''}" data-n="2"><b>In due</b><span class="mu sm">Contro un compagno o un ospite</span></button>
      </div>
      ${due ? html`<h2>Contro chi?</h2>
        <div class="avv">
          <button type="button" class="${sel === OSPITE ? 'sel' : ''}" data-avv="${OSPITE}"><b>OSPITE</b></button>
          ${compagni.map((p) => html`<button type="button" class="${sel === p.id ? 'sel' : ''}" data-avv="${p.id}">${fullName(p)}</button>`)}
        </div>
        <p class="mu sm">Inizi tu. Se giochi contro un compagno, il suo risultato si salva anche nei suoi allenamenti.</p>` : ''}
      <button type="button" class="btn pri grande" data-act="inizia" ${due && !sel ? 'disabled' : ''}>Inizia la partita</button>
    </div>`;
  };

  const carta = (i) => {
    const s = r.stati[i];
    const attivo = r.cur === i && !st.finito && !s.finito;
    const resto = attivo ? restoProvvisorio(s) : s.resto;
    const media = s.frecce ? ((501 - s.resto) / s.frecce * 3).toFixed(2) : '0.00';
    return html`<section class="pcard ${attivo ? 'attivo' : ''} ${s.finito ? 'chiuso' : ''}">
      <header><span class="pnome">${nomeDi(i)}</span>${attivo ? html`<span class="pdot" aria-label="Tocca a lui"></span>` : ''}</header>
      <div class="presto">${s.finito ? '✓' : resto}</div>
      <dl>
        <div><dt>Media delle 3 frecce</dt><dd>${media}</dd></div>
        <div><dt>Ultimo punteggio</dt><dd>${s.visite.length ? s.visite.at(-1) : '–'}</dd></div>
        <div><dt>Frecce lanciate</dt><dd>${s.frecce}</dd></div>
      </dl>
      ${s.finito ? html`<p class="pchiuso">Chiuso in ${s.frecce} frecce</p>` : ''}
    </section>`;
  };

  // Stesso tastierino con e senza Granboard. Se le frecce arrivano dalla tavola, la barra mostra il turno in corso
  // e "Chiudi turno" lo chiude a meta' (le frecce mancanti valgono 0).
  const tastierino = (s) => {
    const parziale = s.turno.length > 0;
    const punti = parziale ? s.resto - restoProvvisorio(s) : 0;
    return html`
    <div class="inbar">
      ${parziale ? html`<div class="indisp turnoin">${s.turno.map(etichettaDardo).join(' · ')} <span>= ${punti}</span></div>
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

  const chiusura = () => html`
    <p class="turno">Chiuso da ${st.chiusura.resto}! Con quale freccia?</p>
    <div class="quick">${frecceChiusura(st.chiusura.resto).map((n) => html`<button type="button" class="q2" data-fr="${n}">${n}ª freccia</button>`)}
      <button type="button" class="q0" data-fr="0">Non in doppia<small>sballato</small></button></div>
    <div class="azioni"><button type="button" class="btn" data-act="nochiusura">Ho sbagliato</button></div>`;

  const gioca = () => {
    const s = r.stati[r.cur];
    const chi = st.opzioni.n === 1 ? 'È il tuo turno!' : `Tocca a ${nomeDi(r.cur)}!`;
    return html`<div class="p501">
      <div class="carte n${st.opzioni.n}">${Array.from({ length: st.opzioni.n }, (_, i) => carta(i))}</div>
      <div class="ctrl">
        ${st.chiusura ? chiusura() : html`<p class="turno">${chi}</p>${tastierino(s)}`}
        <div class="azioni"><button type="button" class="btn" data-act="abbandona">Abbandona</button></div>
      </div>
    </div>`;
  };

  const render = () => {
    if (!root) return;
    root.innerHTML = html`${barra('501', { back: '/', info: true })}${st.fase === 'setup' ? setup() : gioca()}`.s;
  };

  // ---------- eventi di gioco ----------
  function invia(ev, { daTavola = false } = {}) {
    if (st.fase !== 'gioco' || st.finito) return;
    const p = r.cur;
    const vincitorePrima = r.vincitore;
    st.eventi.push({ p, ...ev });
    rigioca();
    const s = r.stati[p];
    if (ev.t === 'd') {
      const speciale = s.fineTurno ? effettoTurno(s.ultimo) : null;
      clearTimeout(ledTimer);
      scrivi(speciale || comandoColpo(ev.id));
      ledSpeciale = !!speciale;
      if (s.fineTurno && !speciale && !s.finito) ledTimer = setTimeout(() => scrivi(EFFETTI.cambioTurno), ritardoCambioTurno()); // quando mancano 2 secondi alla fine della pausa
      suona(ev.id === 'X' ? 'fuori' : 'singolo');
    }
    persist();
    render();
    if (s.fineTurno || s.finito) annuncia(p);
    if (s.finito) lampeggio(); // chiusura: tutta la tavola lampeggia
    if (r.tuttiChiusi) { setTimeout(fine, 700); return; }
    // in due: il primo che chiude vince, l'altro puo' continuare da solo
    if (r.vincitore !== null && vincitorePrima === null) { setTimeout(vittoria, 700); return; }
    if (s.fineTurno && daTavola) contoAllaRovescia(s.ultimo);
  }

  /** La voce dice la somma delle 3 frecce e, da 170 in giu', quanto manca. In due dice anche il nome. */
  function annuncia(p) {
    const s = r.stati[p];
    const nome = st.opzioni.n === 2 ? `${nomeDi(p)}, ` : '';
    if (s.finito) { parla(`${nome}chiuso in ${s.frecce} frecce!`); return; }
    const punti = s.visite.at(-1);
    const sballo = punti === 0 && s.ultimo.some((id) => id !== 'X');
    const somma = sballo ? 'sballato' : punti === 180 ? 'centottanta!' : punti >= 100 ? `${punti}!` : String(punti);
    parla(`${nome}${somma}${s.resto <= 170 ? `${somma.endsWith('!') ? '' : '.'} Mancano ${s.resto}` : ''}`);
  }

  function annulla() {
    if (st.chiusura) { st.chiusura = null; render(); return; }
    if (!st.eventi.length) return;
    st.eventi.pop();
    rigioca();
    persist();
    render();
  }

  function tasto(k) {
    if (k === 'undo') { annulla(); return; }
    if (r.stati[r.cur].turno.length) return; // turno in corso dal Granboard: si finisce tirando o con "Chiudi turno"
    if (k === 'back') st.input = st.input.slice(0, -1);
    else if (k !== 'ok') { if (st.input.length < 3) st.input = st.input === '0' ? k : st.input + k; }
    else {
      if (st.input === '') return;
      const v = Number(st.input);
      if (!visitaValida(v)) { toast('Punteggio impossibile con 3 frecce'); return; }
      st.input = '';
      const resto = r.stati[r.cur].resto;
      const esito = applicaVisita(resto, v);
      if (esito.esito === 'chiuso') { st.chiusura = { s: v, resto }; render(); return; }
      if (esito.esito === 'sballo') toast(`Sballato: resti a ${resto}`);
      invia({ t: 'turno', s: v });
      return;
    }
    render();
  }

  // ---------- conto alla rovescia ----------
  function contoAllaRovescia(ultimo) {
    if (!pausaMs()) return; // pausa disattivata: si tira subito
    st.bloccoFino = Date.now() + pausaMs();
    const secondi = () => Math.ceil((st.bloccoFino - Date.now()) / 1000);
    overlay().innerHTML = html`<div class="conto" role="status"><p>Togli le freccette</p><div class="n">${secondi()}</div>
      ${ultimo.length ? html`<p class="riep">Turno: <b>${ultimo.map(etichettaDardo).join(' · ')}</b></p>` : ''}
      ${st.opzioni.n === 2 ? html`<p class="riep">Poi tocca a <b>${nomeDi(r.cur)}</b></p>` : ''}
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

  // ---------- vittoria e fine ----------
  function vittoria() {
    chiudiConto();
    const v = r.vincitore;
    const altro = 1 - v;
    overlay().innerHTML = html`<div class="fine"><div class="card">
      <p class="mu">501 · in due</p>
      <div class="big">${nomeDi(v)}<small> vince!</small></div>
      <p class="esito">Chiuso in ${r.stati[v].frecce} frecce.</p>
      <p class="mu">${nomeDi(altro)} è a ${r.stati[altro].resto}. Può continuare da solo per chiudere${st.opzioni.avversario !== OSPITE || altro === 0 ? ' e salvare anche il suo risultato' : ''}.</p>
      <div class="azioni"><button type="button" class="btn" data-act="termina">Fine partita</button>
        <button type="button" class="btn pri" data-act="continua">Continua ${nomeDi(altro)}</button></div>
    </div></div>`.s;
  }

  function fine() {
    if (st.finito) return;
    st.finito = true;
    clearTimeout(ledTimer);
    setTimeout(() => scrivi(EFFETTI.fine), ledSpeciale ? 3000 : 800);
    chiudiConto();
    const precedente = record(mie, 'x501');
    const durataMin = Math.max(1, Math.round((Date.now() - st.inizio) / 60000));
    const avversario = st.opzioni.n === 2 ? st.opzioni.avversario : null;
    const salva = (playerId, s, contro) => {
      const nuovo = {
        playerId, gioco: 'x501', valore: s.frecce, voto: Math.round(g.voto(s.frecce)), data: todayIso(), ts: Date.now(),
        opzioni: { avversario: contro }, dati: g.dati(s), durataMin, ...(playerId !== pid ? { inseritoDa: pid } : {}),
      };
      saveSessione(JSON.parse(JSON.stringify(nuovo))).fatto.catch((e) => { console.error(e); toast('Salvataggio non riuscito: controlla la connessione'); });
      return nuovo;
    };
    const mio = r.stati[0].finito ? salva(pid, r.stati[0], avversario) : null;
    if (mio) mie.push(mio);
    const suo = avversario && avversario !== OSPITE && r.stati[1].finito;
    if (suo) salva(avversario, r.stati[1], pid);
    clearDraft(pid, 'gioco');
    const righe = Array.from({ length: st.opzioni.n }, (_, i) => html`<li><span>${nomeDi(i)}</span><b>${r.stati[i].finito ? `${r.stati[i].frecce} frecce` : `a ${r.stati[i].resto}`}</b></li>`);
    overlay().innerHTML = html`<div class="fine"><div class="card">
      <p class="mu">501${st.opzioni.n === 2 ? ' · in due' : ''}</p>
      ${mio ? html`<div class="big">${mio.valore}<small> frecce</small></div>
        <p class="esito">${precedente == null ? 'Primo risultato: da qui si migliora.' : migliora(g, mio.valore, precedente) ? `Nuovo record! Il precedente era ${precedente}.` : `Il tuo record è ${precedente}.`}</p>
        <p class="mu">Voto ${mio.voto} su 100</p>` : html`<p class="esito">Non hai chiuso: questa partita non entra nei tuoi progressi.</p>`}
      ${st.opzioni.n === 2 ? html`<ul class="riep501">${righe}</ul>` : ''}
      ${suo ? html`<p class="mu sm">Salvato anche nei progressi di ${nomeDi(1)}.</p>` : ''}
      <div class="azioni"><a class="btn" href="#/">Torna agli allenamenti</a><button type="button" class="btn pri" data-act="ancora">Gioca ancora</button></div>
    </div></div>`.s;
  }

  function nuovaPartita() {
    st.eventi = [];
    st.continua = false;
    st.finito = false;
    st.chiusura = null;
    st.input = '';
    st.inizio = Date.now();
    rigioca();
  }

  function regole() {
    overlay().innerHTML = html`<div class="modal" data-act="chiudi"><div class="card regole" data-stop>
      <header><h2>Come si gioca · 501</h2>
        <button type="button" class="iconbtn" data-act="chiudi" aria-label="Chiudi">${svg('chiudi')}</button></header>
      <ul>${REGOLE.x501.map((x) => html`<li>${x}</li>`)}</ul>
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
      if (st.fase === 'gioco') scrivi(EFFETTI.inizio);
      render();
      const sig = { signal: ac.signal };
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || b.disabled) return;
        const d = b.dataset;
        if (d.n) { st.opzioni = { n: Number(d.n), avversario: d.n === '2' ? st.opzioni.avversario : null }; render(); }
        else if (d.avv) { st.opzioni.avversario = d.avv; render(); }
        else if (d.act === 'inizia') { st.fase = 'gioco'; nuovaPartita(); scrivi(EFFETTI.inizio); render(); }
        else if (d.k) tasto(d.k);
        else if (d.fr !== undefined) {
          const { s: v } = st.chiusura;
          st.chiusura = null;
          if (d.fr === '0') toast('Sballato: non in doppia');
          invia({ t: 'turno', s: v, d: Number(d.fr) });
        } else if (d.act === 'nochiusura') { st.chiusura = null; render(); }
        else if (d.act === 'completa') { const p = r.cur; while (r.cur === p && r.stati[p].turno.length && !st.finito) invia({ t: 'd', id: 'X' }); }
        else if (d.act === 'info') regole();
        else if (d.act === 'annulla') annulla();
        else if (d.act === 'abbandona') {
          if (!st.eventi.length || confirm('Abbandoni questa partita? Non verrà salvata.')) { clearDraft(pid, 'gioco'); location.hash = '#/'; }
        }
      }, sig);
      el.addEventListener('pointerdown', () => { sbloccaAudio(); sbloccaVoce(); awake?.retry(); }, sig);
      overlay().addEventListener('click', (e) => {
        const b = e.target.closest('button');
        const chiudi = e.target.closest('[data-act="chiudi"]');
        if (chiudi && !(chiudi.classList.contains('modal') && e.target.closest('[data-stop]'))) { overlay().innerHTML = ''; return; }
        const a = b?.dataset.act;
        if (a === 'pronto') chiudiConto();
        else if (a === 'continua') { st.continua = true; persist(); overlay().innerHTML = ''; render(); }
        else if (a === 'termina') fine();
        else if (a === 'ancora') { overlay().innerHTML = ''; nuovaPartita(); scrivi(EFFETTI.inizio); render(); }
      }, sig);
      offs = [
        onDardo((dd) => {
          if (st.fase !== 'gioco' || st.finito || Date.now() < st.bloccoFino || st.chiusura) return;
          if (overlay().querySelector('.fine')) return; // in attesa di "Continua" o "Fine partita"
          st.input = '';
          invia({ t: 'd', id: dd.id }, { daTavola: true });
        }),
        onStato((stt) => { if (stt === 'collegata' && st.fase === 'gioco' && !st.finito) scrivi(EFFETTI.inizio); render(); }),
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
