// Partita: contapunti 501 (straight-in, double-out) con bot, da solo o contro avversari reali.
// Inserisci i punti di ogni tuo turno: media, first 9, visite alte e miglior chiusura le calcola l'app.
import { html, $, icon, toast, go, todayIso } from '../util.js';
import { session } from '../auth.js';
import { saveTraining } from '../db.js';
import { topbar } from '../ui.js';
import { loadDraft, saveDraft, clearDraft } from './store.js';
import { keepAwake } from './awake.js';
import { fmtTimer, fmt1 } from './calc.js';
import {
  visitaValida, applicaVisita, frecceChiusura, restoDi, vincitore, prossimoTurno, riepilogoLeg, statistichePartita,
} from './scorer.js';
import { BOT_LIVELLI, livelloBot, visitaBot } from './bot.js';

const OPP = [['solo', 'Da solo'], ['bot', 'Bot'], ['amico', 'Amico'], ['club', 'Club'], ['torneo', 'Torneo']];
const OPP_NOME = { amico: 'Amico', club: 'Club', torneo: 'Torneo' };
const altro = (w) => (w === 'i' ? 'b' : 'i');

export default function partitaView({ pid, k, info }) {
  const L = info.legsToWin;
  const draft = loadDraft(pid, 'partita');
  const resume = !!(draft && draft.k === k && draft.fase);
  const s = {
    startedAt: resume && Date.now() - draft.startedAt < 6 * 3600e3 ? draft.startedAt : Date.now(),
    fase: resume ? draft.fase : 'setup',
    opp: resume ? draft.opp : null,
    livello: resume ? draft.livello : 'medio',
    legs: resume ? draft.legs : [],
    ev: resume ? draft.ev : [],
    starter: resume ? draft.starter : 'i',
    pausa: resume ? draft.pausa : false,
    input: '',
    closing: null,
  };
  let timer = null;
  let awake = null;

  const conBot = () => s.opp === 'bot';
  const vinti = (w) => s.legs.filter((l) => l.vinse === w).length;
  const finita = () => s.opp !== 'solo' && (vinti('i') >= L || vinti('b') >= L);
  const nomeAvv = () => (conBot() ? `Bot ${livelloBot(s.livello).nome}` : OPP_NOME[s.opp] || 'Avversario');
  const turno = () => (conBot() ? prossimoTurno(s.ev, s.starter, altro(s.starter)) : 'i');

  const chiudiLeg = (vinse, manuale = false) => {
    s.legs.push({ ev: s.ev, vinse, starter: s.starter, manuale });
    s.ev = [];
    s.pausa = true;
  };
  const avanza = () => {
    if (conBot()) {
      const media = livelloBot(s.livello).media;
      while (!vincitore(s.ev) && turno() === 'b') {
        const r = restoDi(s.ev, 'b');
        const v = visitaBot(r, media);
        s.ev.push({ w: 'b', s: v.s, d: v.d, r, esito: v.esito });
      }
    }
    const w = vincitore(s.ev);
    if (w) chiudiLeg(w);
  };
  const prossimoLeg = () => {
    s.starter = altro(s.legs.at(-1).starter);
    s.pausa = false;
    avanza();
  };
  const annulla = () => {
    if (s.closing) { s.closing = null; return; }
    if (s.pausa) {
      const l = s.legs.pop();
      s.ev = l.ev;
      s.starter = l.starter;
      s.pausa = false;
      if (l.manuale) return;
    }
    const idx = s.ev.map((e) => e.w).lastIndexOf('i');
    if (idx >= 0) s.ev = s.ev.slice(0, idx);
  };

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
    avanza();
  };
  const chiudiConFrecce = (n) => {
    const { s: val, r } = s.closing;
    s.closing = null;
    s.input = '';
    if (n === 0) {
      s.ev.push({ w: 'i', s: 0, d: 3, r, esito: 'sballo' });
      toast(`Sballato: resti a ${r}`);
      avanza();
    } else {
      s.ev.push({ w: 'i', s: val, d: n, r, esito: 'chiuso' });
      avanza();
    }
  };

  // ---------- schermate ----------
  const setup = () => html`
    <section class="card sess-intro">
      <p class="muted small">Sessione ${info.n} · ${info.fase.nome}${resume ? ' · ripresa' : ''}</p>
      <p>501 straight-in, double-out. Inserisci i punti di ogni tuo turno: media e statistiche le calcola l'app.</p>
      <p class="muted small">Prima di iniziare: 5 minuti di riscaldamento, non contano.</p>
      <p class="muted small" id="awake" hidden></p>
    </section>
    <div class="field">Contro chi giochi
      <div class="opts wrap">${OPP.map(([v, t]) => html`<button type="button" data-opp="${v}" class="${s.opp === v ? 'sel' : ''}">${t}</button>`)}</div>
    </div>
    ${s.opp === 'bot' ? html`<div class="field">Livello del bot
      <div class="opts wrap">${BOT_LIVELLI.map((l) => html`<button type="button" data-liv="${l.id}" class="two ${s.livello === l.id ? 'sel' : ''}">${l.nome}<small>media ${l.media}</small></button>`)}</div>
    </div>` : ''}
    <p class="muted small">${!s.opp ? 'Scegli contro chi giochi.'
      : s.opp === 'solo' ? 'Giochi leg di 501 da solo, quanti ne vuoi: ti allena la chiusura e la media. Concludi quando hai finito.'
      : s.opp === 'bot' ? `Dopo ogni tuo turno tira il bot, alla media del livello scelto. Formato: meglio di ${L * 2 - 1} leg.`
      : `Inserisci solo i tuoi turni. Se l'avversario chiude prima di te, premi «Ho perso il leg». Formato suggerito: meglio di ${L * 2 - 1} leg.`}</p>
    <button type="button" class="btn primary" id="start">Inizia la partita</button>`;

  const tabellone = () => (s.opp === 'solo'
    ? html`<p class="muted center">Da solo · ${s.legs.length} ${s.legs.length === 1 ? 'leg completato' : 'leg completati'}</p>`
    : html`<div class="mscore"><div><small>Io</small><b>${vinti('i')}</b></div><span>–</span><div><small>${nomeAvv()}</small><b>${vinti('b')}</b></div></div>
        <p class="muted small center">Meglio di ${L * 2 - 1} leg · vince chi arriva a ${L}</p>`);

  const tastiera = () => html`
    <div class="kdisp ${s.input ? '' : 'vuoto'}" aria-live="polite">${s.input || 'Punti del turno'}</div>
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
    const st = statistichePartita(s.legs);
    return html`
      <section class="card legend ${r.vinto ? 'win' : ''}">
        <b>${r.vinto ? `Leg vinto in ${r.frecce} frecce` : l.manuale ? 'Leg perso' : `Leg perso: ha chiuso ${nomeAvv()}`}</b>
        <p class="muted">${r.media != null ? `Media del leg ${fmt1(r.media)} · ` : ''}media partita ${fmt1(st.media)}</p>
      </section>
      ${finita() ? html`<p class="center"><b>${vinti('i') > vinti('b') ? 'Partita vinta' : 'Partita persa'} ${vinti('i')} – ${vinti('b')}</b></p>` : ''}
      <div class="actions tight">
        ${finita()
          ? html`<button type="button" class="btn primary" id="conclude">Salva la partita</button>`
          : s.opp === 'solo'
            ? html`<button type="button" class="btn primary" id="next">Altro leg</button><button type="button" class="btn sec" id="conclude">Concludi la partita</button>`
            : html`<button type="button" class="btn primary" id="next">Prossimo leg</button>`}
        <button type="button" class="btn sec" id="undo">Annulla l'ultima mossa</button>
      </div>`;
  };

  const gioco = () => {
    if (s.pausa) return html`${tabellone()}${fineLeg()}`;
    const resto = restoDi(s.ev, 'i');
    const mie = s.ev.filter((e) => e.w === 'i');
    const ultima = mie.at(-1);
    const st = statistichePartita([...s.legs, { ev: s.ev, vinse: null }]);
    const restoBot = restoDi(s.ev, 'b');
    const ultimaBot = s.ev.filter((e) => e.w === 'b').at(-1);
    return html`
      ${tabellone()}
      <section class="card mmain">
        <p class="muted small">Leg ${s.legs.length + 1}${conBot() ? (s.starter === 'i' ? ' · inizi tu' : ' · inizia il bot') : ''}</p>
        <p class="mresto">${resto}</p>
        <p class="muted">${ultima ? `Ultimo turno: ${ultima.esito === 'sballo' ? 'sballato' : ultima.s}` : 'Tocca a te'}${st.media != null ? ` · media ${fmt1(st.media)}` : ''}</p>
      </section>
      ${conBot() ? html`<section class="card mbot"><span>${nomeAvv()}</span><b>${restoBot}</b>
        <small>${ultimaBot ? `ultimo turno ${ultimaBot.s}` : 'deve ancora tirare'}</small></section>` : ''}
      ${s.closing ? chiusura() : tastiera()}
      <div class="actions tight">
        <button type="button" class="btn sec" id="undo">${icon('back', 18)} Annulla l'ultima mossa</button>
        ${s.opp !== 'solo' && !conBot() ? html`<button type="button" class="btn danger" id="lost">Ho perso il leg</button>` : ''}
      </div>`;
  };

  const salva = async (btn) => {
    btn.disabled = true;
    try {
      const st = statistichePartita(s.legs);
      const dati = JSON.parse(JSON.stringify({
        avvTipo: s.opp, botLivello: conBot() ? s.livello : null, legsToWin: s.opp === 'solo' ? null : L,
        io: vinti('i'), avv: vinti('b'), average: st.media, first9: st.first9,
        doppieChiuse: null, frecceDoppie: null, bestCheckout: st.bestCheckout, bestLeg: st.bestLeg,
        v100: st.v100, v140: st.v140, v180: st.v180, legs: s.legs,
      }));
      const id = await saveTraining({
        playerId: pid, tipo: 'partita', k, numero: info.n, fase: info.fase.id, data: todayIso(),
        durataMin: Math.min(180, Math.max(1, Math.round((Date.now() - s.startedAt) / 60000))),
        metrica: st.media, dati,
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
      const persist = () => saveDraft(pid, 'partita', {
        k, startedAt: s.startedAt, fase: s.fase, opp: s.opp, livello: s.livello, legs: s.legs, ev: s.ev, starter: s.starter, pausa: s.pausa,
      });
      const render = () => {
        el.innerHTML = (s.fase === 'setup' ? setup() : gioco()).s;
        const a = $(root, '#awake');
        if (a && awakeOn) { a.hidden = false; a.textContent = 'Lo schermo resta acceso durante la partita.'; }
      };
      let awakeOn = false;

      el.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const d = b.dataset;
        if (d.opp) s.opp = d.opp;
        else if (d.liv) s.livello = d.liv;
        else if (b.id === 'start') {
          if (!s.opp) { toast('Scegli contro chi giochi'); return; }
          s.fase = 'gioco';
          s.starter = 'i';
          s.ev = [];
          s.legs = [];
          s.pausa = false;
        } else if (d.k !== undefined) {
          if (d.k === 'ok') invia();
          else if (d.k === 'back') s.input = s.input.slice(0, -1);
          else if (s.input.length < 3) s.input = s.input === '0' ? d.k : s.input + d.k;
        } else if (d.fr !== undefined) chiudiConFrecce(+d.fr);
        else if (b.id === 'undo') annulla();
        else if (b.id === 'lost') {
          if (!confirm('Segnare questo leg come perso?')) return;
          chiudiLeg('b', true);
        } else if (b.id === 'next') prossimoLeg();
        else if (b.id === 'conclude') {
          if (!s.legs.length) { toast('Completa almeno un leg'); return; }
          salva(b);
          return;
        } else return;
        persist();
        render();
      });

      awake = keepAwake((on) => {
        awakeOn = on;
        const a = $(root, '#awake');
        if (a) { a.hidden = !on; a.textContent = 'Lo schermo resta acceso durante la partita.'; }
      });
      el.addEventListener('pointerdown', () => awake?.retry(), { passive: true });

      const tick = () => { $(root, '#timer').textContent = fmtTimer(Date.now() - s.startedAt); };
      tick();
      timer = setInterval(tick, 1000);
      // Se riprendi con il bot che deve tirare per primo (bozza vecchia), fallo giocare.
      if (s.fase === 'gioco' && !s.pausa && conBot() && turno() === 'b' && !vincitore(s.ev)) avanza();
      render();
    },

    unmount() { clearInterval(timer); awake?.release(); },
  };
}
