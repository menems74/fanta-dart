// Partita: contapunti 501 (straight-in, double-out) sempre da solo, da 1 a 5 leg.
// Scrivi la somma di ogni turno da 3 frecce e, quando chiudi, con quale freccia. Il dato da superare: con quante frecce chiudi.
import { html, $, icon, toast, go, todayIso } from '../util.js';
import { saveTraining } from '../db.js';
import { topbar } from '../ui.js';
import { loadDraft, saveDraft, clearDraft } from './store.js';
import { keepAwake } from './awake.js';
import { tavolaDisponibile, tavolaStato, onDardo, onStato, collega } from './tavola.js';
import { segmento, etichettaDardo } from '../dartboard.js';
import { fmtTimer, fmt1, bestOf } from './calc.js';
import {
  visitaValida, applicaVisita, elaboraTurno, frecceChiusura, restoDi, vincitore, riepilogoLeg, statistichePartita,
} from './scorer.js';

const MAX_LEG = 5;
const dardoDaId = (id) => {
  const g = segmento(id);
  return g ? { id, v: g.valore, m: g.moltiplicatore } : { id: 'X', v: 0, m: 1 };
};
const round1 = (v) => Math.round(v * 10) / 10;

export default function partitaView({ pid, k, info, trainings }) {
  const draft = loadDraft(pid, 'partita');
  const resume = !!(draft && draft.k === k && draft.v === 2 && draft.fase);
  const s = {
    startedAt: resume && Date.now() - draft.startedAt < 6 * 3600e3 ? draft.startedAt : Date.now(),
    fase: resume ? draft.fase : 'setup',
    nLegs: resume ? draft.nLegs : 3,
    legs: resume ? draft.legs : [],
    ev: resume ? draft.ev : [],
    pausa: resume ? draft.pausa : false,
    input: '',
    closing: null,
    turno: resume && draft.turno ? draft.turno : [], // frecce del turno in corso lette dalla tavola
    manuale: resume ? !!draft.manuale : false,
  };
  const record = bestOf(trainings, 'partita'); // frecce del miglior leg di sempre (meno e' meglio)
  let timer = null;
  let awake = null;
  let offs = [];

  const finita = () => s.legs.length >= s.nLegs;
  const frecceLeg = (ev) => ev.reduce((t, e) => t + e.d, 0);

  const chiudiLeg = () => {
    s.legs.push({ ev: s.ev, vinse: 'i', starter: 'i' });
    s.ev = [];
    s.pausa = true;
  };
  const dopoVisita = () => { if (vincitore(s.ev)) chiudiLeg(); };
  const annulla = () => {
    if (s.closing) { s.closing = null; return; }
    if (s.turno.length) { s.turno.pop(); return; }
    if (s.pausa) {
      const l = s.legs.pop();
      s.ev = l.ev;
      s.pausa = false;
    }
    const idx = s.ev.map((e) => e.w).lastIndexOf('i');
    if (idx >= 0) {
      const ult = s.ev[idx];
      s.ev = s.ev.slice(0, idx);
      if (ult.dardi?.length) s.turno = ult.dardi.slice(0, -1).map(dardoDaId); // riparte dall'ultima freccia
    }
  };
  // Aggiunge una freccia letta dalla tavola (o 'X' = fuori) e chiude il turno quando e' finito.
  const registraFreccia = (dardo) => {
    s.turno.push(dardo);
    const r = restoDi(s.ev, 'i');
    const res = elaboraTurno(r, s.turno);
    if (!res.fine) return;
    s.ev.push({ w: 'i', s: res.s, d: res.d, r, esito: res.esito, dardi: s.turno.map((x) => x.id) });
    s.turno = [];
    if (res.esito === 'sballo') toast(`Sballato: resti a ${r}`);
    dopoVisita();
  };
  const fineTurno = () => { while (s.turno.length < 3 && !s.pausa) registraFreccia({ id: 'X', v: 0, m: 1 }); };
  const conTavola = () => tavolaStato() === 'collegata' && !s.manuale;
  const invia = () => {
    if (s.input === '') return;
    const val = Number(s.input);
    if (!visitaValida(val)) { toast('Punteggio impossibile con 3 frecce'); return; }
    const r = restoDi(s.ev, 'i');
    const res = applicaVisita(r, val);
    if (res.esito === 'chiuso') { s.closing = { s: val, r }; return; }
    s.ev.push({ w: 'i', s: res.esito === 'sballo' ? 0 : val, d: 3, r, esito: res.esito });
    if (res.esito === 'sballo') toast(`Sballato: resti a ${r}`);
    s.input = '';
    dopoVisita();
  };
  const chiudiConFrecce = (n) => {
    const { s: val, r } = s.closing;
    s.closing = null;
    s.input = '';
    if (n === 0) { s.ev.push({ w: 'i', s: 0, d: 3, r, esito: 'sballo' }); toast(`Sballato: resti a ${r}`); }
    else s.ev.push({ w: 'i', s: val, d: n, r, esito: 'chiuso' });
    dopoVisita();
  };

  // ---------- schermate ----------
  const blocco = () => {
    if (!tavolaDisponibile()) return '';
    const st = tavolaStato();
    return html`<div class="tavola">
      <p class="small ${st === 'collegata' ? 'ok' : 'muted'}">${st === 'collegata' ? 'Granboard collegato: le frecce si segnano da sole.' : st === 'collego' ? 'Collegamento in corso…' : 'Granboard non collegato.'}</p>
      ${st === 'collegata' ? '' : html`<button type="button" class="btn sec" id="collega" ${st === 'collego' ? 'disabled' : ''}>Collega il Granboard</button>`}
    </div>`;
  };
  const frecceTurno = () => html`
    <div class="dardi" aria-live="polite">${[0, 1, 2].map((i) => html`<span class="dardo ${s.turno[i] ? '' : 'vuoto'}">${s.turno[i] ? etichettaDardo(s.turno[i].id) : '–'}</span>`)}</div>
    <div class="actions tight">
      <button type="button" class="btn sec" id="fuori">Freccia fuori</button>
      <button type="button" class="btn sec" id="fineturno">Fine turno</button>
      <button type="button" class="btn sec" id="manuale">Inserisci a mano</button>
    </div>`;
  const setup = () => html`
    <section class="card sess-intro">
      <p class="muted small">Sessione ${info.n} · ${info.fase.nome}${resume ? ' · ripresa' : ''}</p>
      <p>501 straight-in, double-out, sempre da solo. Scrivi la somma di ogni turno da 3 frecce e, quando chiudi, con quale freccia.</p>
      <p class="muted small">Il dato che conta è con quante frecce chiudi un 501: prova a superarti.</p>
      <p class="muted small">Prima di iniziare: 5 minuti di riscaldamento, non contano.</p>
      <p class="muted small" id="awake" hidden></p>
      ${blocco()}
      ${record != null ? html`<p class="goal">Da battere: <b>${record}</b> frecce (il tuo record)</p>` : html`<p class="goal">Primo risultato: da qui si migliora.</p>`}
    </section>
    <div class="field">Quanti leg vuoi giocare?
      <div class="chips" role="group" aria-label="Numero di leg">
        ${Array.from({ length: MAX_LEG }, (_, i) => i + 1).map((n) => html`<button type="button" data-n="${n}" class="${s.nLegs === n ? 'sel' : ''}">${n}</button>`)}
      </div>
    </div>
    <button type="button" class="btn primary" id="start">Inizia la partita</button>`;

  const tabellone = () => html`
    <div class="mscore"><div><small>Leg</small><b>${Math.min(s.legs.length + (s.pausa ? 0 : 1), s.nLegs)} / ${s.nLegs}</b></div></div>
    ${record != null ? html`<p class="muted small center">Record da battere: ${record} frecce</p>` : ''}`;

  const tastiera = () => html`
    <div class="kdisp ${s.input ? '' : 'vuoto'}" aria-live="polite">${s.input || 'Somma del turno'}</div>
    <div class="kpad">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => html`<button type="button" data-k="${n}">${n}</button>`)}
      <button type="button" data-k="back" aria-label="Cancella">⌫</button>
      <button type="button" data-k="0">0</button>
      <button type="button" data-k="ok" class="ok">OK</button>
    </div>`;

  const chiusura = () => html`
    <section class="card mclose">
      <b>Chiuso da ${s.closing.r}!</b>
      <p class="muted">Con quale freccia hai chiuso in doppia?</p>
      <div class="opts wrap">${frecceChiusura(s.closing.r).map((n) => html`<button type="button" data-fr="${n}">${n}ª freccia</button>`)}
        <button type="button" data-fr="0" class="fail">Non in doppia</button></div>
    </section>`;

  const fineLeg = () => {
    const l = s.legs.at(-1);
    const r = riepilogoLeg(l);
    const migliore = Math.min(...s.legs.map((x) => riepilogoLeg(x).frecce));
    const nuovoRecord = record != null && r.frecce < record;
    return html`
      <section class="card legend ${nuovoRecord ? 'rec' : 'win'}">
        <b>Leg chiuso in ${r.frecce} frecce</b>
        <p class="muted">${nuovoRecord ? `Nuovo record personale! Il precedente era ${record}.`
          : record != null ? `Il tuo record è ${record} frecce.` : 'Primo risultato: da qui si migliora.'}</p>
        <p class="muted small">Media del leg ${fmt1(r.media)}${s.legs.length > 1 ? ` · miglior leg di oggi ${migliore} frecce` : ''}</p>
      </section>
      <div class="actions tight">
        ${finita()
          ? html`<button type="button" class="btn primary" id="conclude">Salva la partita</button>`
          : html`<button type="button" class="btn primary" id="next">Prossimo leg</button>
                 <button type="button" class="btn sec" id="conclude">Concludi qui</button>`}
        <button type="button" class="btn sec" id="undo">Annulla l'ultima mossa</button>
      </div>`;
  };

  const gioco = () => {
    if (s.pausa) return html`${tabellone()}${fineLeg()}`;
    const resto = elaboraTurno(restoDi(s.ev, 'i'), s.turno).resto;
    const ultima = s.ev.at(-1);
    const st = statistichePartita([...s.legs, { ev: s.ev, vinse: null }]);
    const frecce = frecceLeg(s.ev);
    return html`
      ${tabellone()}
      <section class="card mmain">
        <p class="muted small">Leg ${s.legs.length + 1} di ${s.nLegs}</p>
        <p class="mresto">${resto}</p>
        <p class="muted">${ultima ? `Ultimo turno: ${ultima.esito === 'sballo' ? 'sballato' : ultima.s}` : 'Tocca a te'}${st.media != null ? ` · media ${fmt1(st.media)}` : ''}</p>
        <p class="mfrecce ${record != null && frecce >= record ? 'over' : ''}">Frecce usate: <b>${frecce}</b>${record != null ? ` · da battere: ${record}` : ''}</p>
      </section>
      ${s.closing ? chiusura() : conTavola() ? frecceTurno() : html`${tastiera()}${s.manuale && tavolaStato() === 'collegata' ? html`<div class="actions tight"><button type="button" class="btn sec" id="usatavola">Usa la tavola</button></div>` : blocco()}`}
      <div class="actions tight">
        <button type="button" class="btn sec" id="undo">${icon('back', 18)} Annulla l'ultima mossa</button>
      </div>`;
  };

  const salva = async (btn) => {
    btn.disabled = true;
    try {
      const st = statistichePartita(s.legs);
      const frecceLegs = s.legs.map((l) => riepilogoLeg(l).frecce);
      const dati = JSON.parse(JSON.stringify({
        versione: 2, avvTipo: 'solo', legsTarget: s.nLegs, io: s.legs.length, avv: 0,
        bestLeg: st.bestLeg, mediaFrecce: round1(frecceLegs.reduce((a, b) => a + b, 0) / frecceLegs.length),
        average: st.media, first9: st.first9, bestCheckout: st.bestCheckout,
        v100: st.v100, v140: st.v140, v180: st.v180, legs: s.legs,
      }));
      const id = await saveTraining({
        playerId: pid, tipo: 'partita', k, numero: info.n, fase: info.fase.id, data: todayIso(),
        durataMin: Math.min(180, Math.max(1, Math.round((Date.now() - s.startedAt) / 60000))),
        metrica: st.bestLeg, dati,
      });
      clearDraft(pid, 'partita');
      go(`/risultato/${id}`);
    } catch (err) {
      console.error(err);
      toast('Salvataggio non riuscito: la partita è al sicuro, riprova');
      btn.disabled = false;
    }
  };

  return {
    html: html`
      ${topbar('Partita', { back: '/tipo', right: html`<span class="timer" id="timer">00:00</span>` })}
      <div id="match" class="sess"></div>`,

    mount(root) {
      const el = $(root, '#match');
      let awakeOn = false;
      const persist = () => saveDraft(pid, 'partita', {
        v: 2, k, startedAt: s.startedAt, fase: s.fase, nLegs: s.nLegs, legs: s.legs, ev: s.ev, pausa: s.pausa, turno: s.turno, manuale: s.manuale,
      });
      const render = () => {
        el.innerHTML = (s.fase === 'setup' ? setup() : gioco()).s;
        const a = $(root, '#awake');
        if (a && awakeOn) { a.hidden = false; a.textContent = 'Lo schermo resta acceso durante la partita.'; }
      };

      el.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const d = b.dataset;
        if (d.n) s.nLegs = +d.n;
        else if (b.id === 'start') { s.fase = 'gioco'; s.legs = []; s.ev = []; s.pausa = false; s.turno = []; }
        else if (d.k !== undefined) {
          if (d.k === 'ok') invia();
          else if (d.k === 'back') s.input = s.input.slice(0, -1);
          else if (s.input.length < 3) s.input = s.input === '0' ? d.k : s.input + d.k;
        } else if (d.fr !== undefined) chiudiConFrecce(+d.fr);
        else if (b.id === 'collega') { collegaTavola(); return; }
        else if (b.id === 'fuori') registraFreccia({ id: 'X', v: 0, m: 1 });
        else if (b.id === 'fineturno') fineTurno();
        else if (b.id === 'manuale') { s.turno = []; s.manuale = true; }
        else if (b.id === 'usatavola') s.manuale = false;
        else if (b.id === 'undo') annulla();
        else if (b.id === 'next') s.pausa = false;
        else if (b.id === 'conclude') { salva(b); return; }
        else return;
        persist();
        render();
      });

      const collegaTavola = async () => {
        try { await collega(); } catch (err) { console.error(err); toast('Collegamento non riuscito: chiudi le altre app del Granboard e riprova'); }
        render();
      };
      const daTavola = (d) => {
        if (s.fase !== 'gioco' || s.pausa || s.closing || !conTavola()) return;
        registraFreccia({ id: d.id, v: d.valore, m: d.moltiplicatore });
        persist();
        render();
      };
      offs = [onDardo(daTavola), onStato(() => { if (s.fase !== 'gioco' || !s.closing) render(); })];

      awake = keepAwake((on) => {
        awakeOn = on;
        const a = $(root, '#awake');
        if (a) { a.hidden = !on; a.textContent = 'Lo schermo resta acceso durante la partita.'; }
      });
      el.addEventListener('pointerdown', () => awake?.retry(), { passive: true });

      const tick = () => { $(root, '#timer').textContent = fmtTimer(Date.now() - s.startedAt); };
      tick();
      timer = setInterval(tick, 1000);
      render();
    },

    unmount() { clearInterval(timer); offs.forEach((f) => f()); awake?.release(); },
  };
}
