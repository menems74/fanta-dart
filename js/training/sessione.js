// Inserimento di una sessione mentre ci si allena: pulsanti grandi, calcoli automatici, bozza sempre salvata.
import { html, $, $$, icon, toast, go, todayIso } from '../util.js';
import { session } from '../auth.js';
import { listTrainings, saveTraining } from '../db.js';
import { topbar, emptyState } from '../ui.js';
import {
  TIPI, TIPO_INFO, DOPPIE_BERSAGLI, CHECKOUT_OUTS, SERIE_SCORING, VISITE_PRESSIONE, sessionInfo, sigFromInfo, signatureOf,
} from './catalogo.js';
import {
  nextK, metricOf, scoringResult, doppieResult, checkoutResult, pressioneResult, fmtTimer,
} from './calc.js';
import { loadDraft, saveDraft, clearDraft } from './store.js';
import { numRow, optsRow, rowAccess } from './inputs.js';
import { keepAwake } from './awake.js';
import partitaView from './partita.js';

const FRECCE = [{ v: 0, t: '✕', fail: true }, { v: 1, t: '1ª' }, { v: 2, t: '2ª' }, { v: 3, t: '3ª' }];
const COLPI = [0, 1, 2, 3].map((v) => ({ v, t: String(v) }));
// Voce obbligatoria di ogni tipo: la sessione si conclude solo quando e' completa.
const MAIN_ARRAY = { scoring: 'serie', doppie: 'hit', checkout: 'frecce', pressione: 'hit' };

function initial(tipo, info) {
  const vuoto = (n) => Array(n).fill(null);
  switch (tipo) {
    case 'scoring': return { serie: vuoto(SERIE_SCORING), t20: null };
    case 'doppie': return { bersagli: DOPPIE_BERSAGLI, hit: vuoto(4) };
    case 'checkout': return { outs: CHECKOUT_OUTS, frecce: vuoto(CHECKOUT_OUTS.length) };
    case 'pressione': return { bersagli: info.bersagli, soglia: info.soglia, hit: vuoto(VISITE_PRESSIONE) };
    default: return {};
  }
}

function intro(tipo, info) {
  switch (tipo) {
    case 'scoring': return 'Dieci serie da 10 frecce al 20. Singolo vale 1 punto, doppio 2, triplo 3: ogni serie vale al massimo 30.';
    case 'doppie': return 'Venti frecce per ogni doppia: conta solo i colpi sulla doppia richiesta.';
    case 'checkout': return 'Un tentativo da 3 frecce per ogni valore. Segna a quale freccia hai chiuso in doppia, oppure la X se hai fallito.';
    case 'pressione': return `Dodici visite da 3 frecce. Una visita riesce se colpisci il bersaglio almeno ${info.soglia} ${info.soglia === 1 ? 'volta' : 'volte'}.`;
    default: return '';
  }
}

function body(tipo, info, d) {
  switch (tipo) {
    case 'scoring': return html`
      ${d.serie.map((_, i) => numRow('serie', i, `Serie ${i + 1}`, 30))}
      <h2 class="section">Triple colpite (facoltativo)</h2>
      ${numRow('t20', '', 'T20 su 100', 100)}`;
    case 'doppie': return html`${d.bersagli.map((b, i) => numRow('hit', i, `${b}`, 20))}`;
    case 'checkout': return html`
      ${d.outs.map((o, i) => optsRow('frecce', i, String(o), FRECCE))}
      <p class="muted small">Se hai chiuso, scegli la freccia (1ª, 2ª o 3ª). ✕ vuol dire che il tentativo è fallito.</p>`;
    case 'pressione': return html`${d.bersagli.map((b, i) => optsRow('hit', i, `Visita ${i + 1}`, COLPI, b))}`;
    default: return html``;
  }
}

export default async function view([tipo]) {
  if (!TIPI.includes(tipo)) return { html: html`${topbar('Allenamento', { back: '/tipo' })}${emptyState('Tipo non valido', 'Torna indietro e scegline uno.')}` };
  const pid = session.account.playerId;
  const trainings = await listTrainings(pid);
  const k = nextK(trainings, tipo);
  if (k === null) {
    return { html: html`${topbar(TIPO_INFO[tipo].label, { back: '/tipo' })}${emptyState('Tipo completato', 'Hai fatto tutte le 20 sessioni di questo tipo. Complimenti!')}` };
  }
  const info = sessionInfo(tipo, k);
  if (tipo === 'partita') return partitaView({ pid, k, info, trainings });
  const sig = sigFromInfo(info);
  const precedenti = trainings.filter((t) => t.tipo === tipo && signatureOf(t) === sig && Number.isFinite(t.metrica));
  const record = tipo === 'partita' || !precedenti.length ? null : Math.max(...precedenti.map((t) => t.metrica));
  const draft = loadDraft(pid, tipo);
  const resume = draft && draft.k === k;
  const s = {
    k,
    startedAt: resume && Date.now() - draft.startedAt < 6 * 3600e3 ? draft.startedAt : Date.now(),
    d: { ...initial(tipo, info), ...(resume ? draft.d : {}) },
  };
  let timer = null;
  let awake = null;

  return {
    html: html`
      ${topbar(TIPO_INFO[tipo].label, { back: '/tipo', right: html`<span class="timer" id="timer">00:00</span>` })}
      <div id="sess" class="sess">
        <section class="card sess-intro">
          <p class="muted small">Sessione ${info.n} · ${info.fase.nome}${resume ? ' · ripresa' : ''}</p>
          <p>${intro(tipo, info)}</p>
          <p class="muted small">Prima di iniziare: 5 minuti di riscaldamento, non contano.</p>
          <p class="muted small" id="awake" hidden></p>
          ${tipo === 'partita' ? '' : record != null
            ? html`<p class="goal">Da battere: <b>${record}</b> (il tuo record)</p>`
            : html`<p class="goal">Primo risultato: da qui si migliora.</p>`}
        </section>
        ${body(tipo, info, s.d)}
      </div>
      <div class="dock"><div class="dock-sum"><span id="sum"></span><small id="goal"></small></div><button type="button" class="btn primary" id="done">Concludi</button></div>`,

    mount(root) {
      const el = $(root, '#sess');
      const persist = () => saveDraft(pid, tipo, { k, startedAt: s.startedAt, d: s.d });
      const main = MAIN_ARRAY[tipo];
      const { get, set } = rowAccess(s.d);

      const summary = () => {
        if (tipo === 'scoring') return `Totale ${scoringResult(s.d).total} / 300`;
        if (tipo === 'doppie') { const r = doppieResult(s.d); return `${r.hit} / 80 · ${r.pct}%`; }
        if (tipo === 'checkout') return `Chiusi ${checkoutResult(s.d).riusciti} / ${s.d.frecce.length}`;
        if (tipo === 'pressione') { const r = pressioneResult(s.d); return `Riuscite ${r.riuscite} / 12 · serie ${r.best}`; }
        return '';
      };

      const paint = () => {
        $$(el, '.nrow').forEach((row) => {
          const v = get(row);
          const n = $(row, '.nval');
          n.textContent = v ?? '—';
          n.classList.toggle("blank", v == null);
        });
        $$(el, '.orow').forEach((row) => {
          const v = get(row);
          $$(row, '.opts button').forEach((b) => b.classList.toggle('sel', v != null && +b.dataset.v === v));
          if (tipo === 'pressione') row.classList.toggle('good', v != null && v >= s.d.soglia);
        });
        $(root, '#sum').textContent = summary();
        const g = $(root, '#goal');
        if (record != null) {
          const diff = metricOf(tipo, s.d) - record;
          g.textContent = diff > 0 ? `Record battuto! +${diff}` : `Da battere: ${record}`;
          g.classList.toggle('win', diff > 0);
        }
      };

      el.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const row = b.closest('[data-arr]');
        if (row && b.dataset.d) {
          set(row, (get(row) ?? 0) + +b.dataset.d);
        } else if (row && b.dataset.v !== undefined) {
          set(row, +b.dataset.v);
        } else return;
        paint();
        persist();
      });

      const tick = () => { $(root, '#timer').textContent = fmtTimer(Date.now() - s.startedAt); };
      tick();
      timer = setInterval(tick, 1000);

      $(root, '#done').addEventListener('click', async (e) => {
        const missing = main ? s.d[main].filter((v) => v == null).length : 0;
        if (missing) {
          toast(`Mancano ${missing} ${missing === 1 ? 'voce' : 'voci'}`);
          const idx = s.d[main].findIndex((v) => v == null);
          $(el, `[data-arr="${main}"][data-i="${idx}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
          return;
        }
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          const dati = JSON.parse(JSON.stringify(s.d));
          const id = await saveTraining({
            playerId: pid, tipo, k, numero: info.n, fase: info.fase.id, data: todayIso(),
            durataMin: Math.min(180, Math.max(1, Math.round((Date.now() - s.startedAt) / 60000))),
            metrica: metricOf(tipo, dati), dati,
          });
          clearDraft(pid, tipo);
          go(`/risultato/${id}`);
        } catch (err) {
          console.error(err);
          toast('Salvataggio non riuscito: la bozza è al sicuro, riprova');
          btn.disabled = false;
        }
      });

      paint();
    },

    unmount() { clearInterval(timer); awake?.release(); },
  };
}
