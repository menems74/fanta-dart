// Schermata di gioco, uguale per tutti i giochi: bersaglio a sinistra (o sopra), pannello a destra (o sotto).
// Le frecce arrivano dal Granboard, dal tocco sul bersaglio o dai pulsanti rapidi; il gioco e' in giochi.js.
import { html, $, toast, todayIso } from '../util.js';
import { session } from '../auth.js';
import { listSessioni, saveSessione } from '../db.js';
import { segmento, etichettaDardo } from '../dartboard.js';
import { loadDraft, saveDraft, clearDraft } from './store.js';
import { keepAwake } from './awake.js';
import { pausaMs, pausaSecondi, ritardoCambioTurno } from './pausa.js';
import { onDardo, onStato, tavolaStato, scrivi } from './tavola.js';
import { EFFETTI, comandoNumeri, comandoColpo, effettoTurno } from './led.js';
import { suona, sbloccaAudio, jingle } from './suono.js';
import { visitaValida, applicaVisita } from './scorer.js';
import { gioco, rigioca, numeriCheckout, record, migliora, varianteDi, nomeVariante, scelteDi, REGOLE } from './giochi.js';
import { pannello, comandi } from './pannelli.js';
import partita501View from './partita501.js';
import partitaScoringView from './partitaScoring.js';
import { barra, bersaglio, svg } from './grafica.js';

const overlay = () => document.getElementById('overlay');

// Checkout: numeri nuovi a ogni partita. Giochi con scelte (Target, Rotation): si sceglie all\'inizio, "Gioca ancora" le tiene.
function opzioniNuove(g, vecchie) {
  if (g.id === 'checkout') return { numeri: numeriCheckout() };
  if (g.SCELTE) return vecchie && g.SCELTE.every((c) => vecchie[c.chiave] != null) ? { ...vecchie } : null;
  return {};
}

export default async function giocoView([id]) {
  // 501 e Scoring hanno una schermata tutta loro, senza bersaglio, con il tastierino grande
  if (id === 'x501') return partita501View();
  if (id === 'scoring') return partitaScoringView();
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
    bozza: null, // scelte in corso nella schermata iniziale
  };
  let s = st.opzioni ? rigioca(g, st.opzioni, st.eventi) : null;
  let root = null;
  let offs = [];
  let awake = null;
  let contoTimer = null;
  const ac = new AbortController();
  const lampeggio = () => [0, 500, 1000].forEach((ms) => setTimeout(() => scrivi(EFFETTI.lampeggio), ms)); // festa: tutta la tavola lampeggia 3 volte
  let ledSpeciale = false; // effetto speciale in corso: a fine pausa si spengono i led
  let ledTimer = null;
  let bersTimer = null; // riaccende in verde il bersaglio da colpire

  const variante = () => varianteDi(g, st.opzioni);
  const titoloGioco = () => (s && g.SCELTE ? `${g.nome} · ${nomeVariante(g, variante())}` : g.nome);
  const rec = () => record(mie, g.id, variante());
  const persist = () => {
    if (st.eventi.length) saveDraft(pid, 'gioco', { gioco: id, opzioni: st.opzioni, eventi: st.eventi, inizio: st.inizio });
    else clearDraft(pid, 'gioco');
  };

  // ---------- schermate ----------
  // Schermata iniziale per i giochi con scelte. Una sola scelta (Rotation): si tocca e si parte.
  // Piu' scelte (Target: bersaglio e serie): si selezionano e poi "Inizia".
  const sceltaModo = () => {
    if (g.SCELTE.length === 1) {
      const c = g.SCELTE[0];
      return html`<div class="page modi">
        <p class="intro">${c.titolo}</p>
        <div class="modigrid n${c.lista.length}">${c.lista.map(([k, nome, descr]) => {
          const r = record(mie, g.id, varianteDi(g, { [c.chiave]: k }));
          return html`<button type="button" class="card modo" data-modo="${k}"><b>${nome}</b>
            <span class="mu sm">${descr}</span>
            <span class="mu sm">${r == null ? 'Mai giocato' : `Record: ${r} ${g.unit}`}</span></button>`;
        })}</div>
      </div>`;
    }
    st.bozza ??= scelteDi(g, mie.filter((x) => x.gioco === g.id).at(-1)?.opzioni);
    const r = record(mie, g.id, varianteDi(g, st.bozza));
    return html`<div class="page modi">
      ${g.SCELTE.map((c) => html`<p class="intro">${c.titolo}</p>
        <div class="modigrid n${c.lista.length} scelta">${c.lista.map(([k, nome, descr]) => html`<button type="button"
          class="card modo ${String(st.bozza[c.chiave]) === String(k) ? 'sel' : ''}" data-scelta="${c.chiave}" data-val="${k}"><b>${nome}</b>
          <span class="mu sm">${descr}</span></button>`)}</div>`)}
      <p class="mu">${r == null ? `Mai giocato: ${nomeVariante(g, varianteDi(g, st.bozza))}` : `Record ${nomeVariante(g, varianteDi(g, st.bozza))}: ${r} ${g.unit}`}</p>
      <button type="button" class="btn pri grande" data-act="iniziascelte">Inizia</button>
    </div>`;
  };

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
    const titolo = titoloGioco();
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
      // giochi con il bersaglio illuminato: in Doppie e Rotation, se lo prendi parte un gioco di luci
      const preso = !!g.festa && bersagliPrima.includes(ev.id);
      clearTimeout(ledTimer);
      clearTimeout(bersTimer);
      scrivi(speciale || (preso ? EFFETTI.festa : comandoColpo(ev.id)));
      ledSpeciale = !!speciale;
      if (s.fineTurno && !speciale && !s.finito) ledTimer = setTimeout(() => scrivi(EFFETTI.cambioTurno), ritardoCambioTurno()); // quando mancano 2 secondi alla fine della pausa
      if (g.ledBersaglio && !s.finito) {
        // il bersaglio si accende solo a inizio turno (prima delle 3 frecce): la tavola non lo tiene acceso fisso
        if (s.fineTurno && (!daTavola || !pausaMs())) illuminaBersaglio(ritardoCambioTurno() + 1500);
        // a meta' turno, dopo la luce del colpo, si rimette la luce fissa sul numero da colpire
        else if (!s.fineTurno) illuminaBersaglio(preso ? 1500 : 1000);
        // con la pausa il bersaglio si riaccende alla fine del conto alla rovescia
      }
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

  /** Illumina in verde sulla tavola il bersaglio da colpire (solo nei giochi che lo prevedono). */
  function illuminaBersaglio(ritardo = 0) {
    if (!g.ledBersaglio) return;
    clearTimeout(bersTimer);
    bersTimer = setTimeout(() => {
      const id = s && !s.finito && Date.now() >= st.bloccoFino ? g.ledBersaglio(s) : null;
      // luce fissa sul numero (quella dei numeri aperti nel Cricket): resta accesa fino al prossimo comando
      if (id) scrivi(comandoNumeri([Number(/\d+/.exec(id)[0])]));
    }, ritardo);
  }

  function annulla() {
    if (st.chiusura) { st.chiusura = null; render(); return; }
    if (!st.eventi.length) return;
    st.eventi.pop();
    s = rigioca(g, st.opzioni, st.eventi);
    if (!s.turno.length) illuminaBersaglio(0); // si torna a inizio turno
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
    if (!pausaMs()) return; // pausa disattivata: si tira subito
    st.bloccoFino = Date.now() + pausaMs();
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
    const eraInPausa = st.bloccoFino > 0;
    clearInterval(contoTimer);
    st.bloccoFino = 0;
    if (overlay().querySelector('.conto')) overlay().innerHTML = '';
    if (eraInPausa && g.ledBersaglio) { clearTimeout(ledTimer); illuminaBersaglio(300); } // "Sono pronto": niente cambio turno in ritardo sopra il bersaglio
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
    if (record_ && precedente != null) lampeggio(); // nuovo record: tutta la tavola lampeggia
    overlay().innerHTML = html`<div class="fine"><div class="card">
      <p class="mu">${titoloGioco()}</p>
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
      <p class="mu sm">${tavolaStato() === 'collegata' ? `Con il Granboard le frecce si segnano da sole: ${pausaSecondi() ? `dopo ogni turno hai ${pausaSecondi()} secondi per togliere le freccette (lo cambi nella home, Pausa dopo il turno).` : 'la pausa dopo il turno è disattivata (la cambi nella home).'}`
        : 'Senza Granboard tocca sul bersaglio il settore colpito, oppure usa i pulsanti.'}</p>
      <button type="button" class="btn pri" data-act="chiudi">Ho capito</button>
    </div></div>`.s;
  }

  function ancora() {
    jingle();
    scrivi(EFFETTI.inizio);
    illuminaBersaglio(2500);
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
      if (s) { if (!ripresa) jingle(); scrivi(EFFETTI.inizio); illuminaBersaglio(2500); }
      render();
      const sig = { signal: ac.signal };
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || b.disabled) return;
        const d = b.dataset;
        if (d.modo) {
          st.opzioni = scelteDi(g, { [g.SCELTE[0].chiave]: d.modo });
          s = rigioca(g, st.opzioni, []);
          jingle();
          scrivi(EFFETTI.inizio);
          illuminaBersaglio(2500);
          render();
        } else if (d.scelta) {
          st.bozza[d.scelta] = d.scelta === 'serie' ? Number(d.val) : d.val;
          render();
        } else if (d.act === 'iniziascelte') {
          st.opzioni = { ...st.bozza };
          s = rigioca(g, st.opzioni, []);
          jingle();
          scrivi(EFFETTI.inizio);
          illuminaBersaglio(2500);
          render();
        }
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
        onStato((stt) => { if (stt === 'collegata' && s && !s.finito) { scrivi(EFFETTI.inizio); illuminaBersaglio(2500); } render(); }),
      ];
      awake = keepAwake(() => {});
    },
    unmount() {
      clearTimeout(ledTimer);
      clearTimeout(bersTimer);
      ac.abort();
      offs.forEach((f) => f());
      chiudiConto();
      if (g.ledBersaglio) scrivi(comandoNumeri([])); // spegne la luce fissa
      scrivi(EFFETTI.attesa);
      overlay().innerHTML = '';
      awake?.release();
      root = null;
    },
  };
}
