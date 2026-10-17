// Skill test: quattro prove brevi, stesse regole ogni volta, che danno uno Skill Score su 100.
import { html, $, $$, toast, go, todayIso } from '../util.js';
import { session } from '../auth.js';
import { listTrainings, listTests, saveTest } from '../db.js';
import { topbar } from '../ui.js';
import { numRow, optsRow, rowAccess } from './inputs.js';
import { loadDraft, saveDraft, clearDraft } from './store.js';
import { keepAwake } from './awake.js';
import { progress, skillScore, testTipoFor, CHECKOUT_TEST, fmt1 } from './calc.js';

const ESITO = [{ v: 0, t: '✕', fail: true }, { v: 1, t: '✓' }];
const TITOLO = { iniziale: 'Test iniziale', intermedio: 'Test intermedio', finale: 'Test finale' };

export default async function view() {
  const pid = session.account.playerId;
  const [trainings, tests] = await Promise.all([listTrainings(pid), listTests(pid)]);
  const done = progress(trainings).done;
  const tipo = testTipoFor(tests, done);
  const draft = loadDraft(pid, 'skill');
  const s = {
    d: { scoring: null, doppie: null, bull: null, checkout: Array(CHECKOUT_TEST.length).fill(null), ...(draft?.d || {}) },
  };
  let awake = null;

  return {
    html: html`
      ${topbar(TITOLO[tipo], { back: '/' })}
      <div id="sess" class="sess">
        <section class="card sess-intro">
          <p>Quattro prove, sempre uguali, per misurare il tuo livello. Prima: 5 minuti di riscaldamento, non contano.</p>
          <p class="muted small">È un indice personale: confrontalo con i tuoi test, non con altri.</p>
        </section>
        <h2 class="section">1 · Scoring · 30 frecce al 20</h2>
        <p class="muted small">Singolo 1 punto, doppio 2, triplo 3. Massimo 90.</p>
        ${numRow('scoring', '', 'Punti', 90)}
        <h2 class="section">2 · Doppie · 20 frecce</h2>
        <p class="muted small">10 frecce alla D20, poi 10 alla D16. Conta solo la doppia richiesta.</p>
        ${numRow('doppie', '', 'Colpi', 20)}
        <h2 class="section">3 · Bull · 20 frecce</h2>
        <p class="muted small">Bull esterno 1 punto, bull interno 2. Massimo 40.</p>
        ${numRow('bull', '', 'Punti', 40)}
        <h2 class="section">4 · Checkout · 7 tentativi</h2>
        <p class="muted small">Un tentativo da 3 frecce per valore, chiudendo in doppia.</p>
        ${CHECKOUT_TEST.map((o, i) => optsRow('checkout', i, String(o), ESITO))}
      </div>
      <div class="dock"><div class="dock-sum"><span id="sum"></span><small>Skill Score</small></div><button type="button" class="btn primary" id="done">Concludi</button></div>`,

    mount(root) {
      const el = $(root, '#sess');
      const { get, set } = rowAccess(s.d);
      const persist = () => saveDraft(pid, 'skill', { d: s.d });
      const missing = () => ['scoring', 'doppie', 'bull'].filter((k) => s.d[k] == null).length
        + s.d.checkout.filter((v) => v == null).length;

      const paint = () => {
        $$(el, '.nrow').forEach((row) => {
          const v = get(row);
          const n = $(row, '.nval');
          n.textContent = v ?? '—';
          n.classList.toggle('blank', v == null);
        });
        $$(el, '.orow').forEach((row) => {
          const v = get(row);
          $$(row, '.opts button').forEach((b) => b.classList.toggle('sel', v != null && +b.dataset.v === v));
        });
        $(root, '#sum').textContent = fmt1(skillScore({
          scoring: s.d.scoring, doppie: s.d.doppie, bull: s.d.bull, checkout: s.d.checkout.filter((v) => v === 1).length,
        }));
      };

      el.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        const row = b?.closest('[data-arr]');
        if (!row) return;
        if (b.dataset.d) set(row, (get(row) ?? 0) + +b.dataset.d);
        else if (b.dataset.v !== undefined) set(row, +b.dataset.v);
        else return;
        paint();
        persist();
      });
      $(root, '#done').addEventListener('click', async (e) => {
        const m = missing();
        if (m) { toast(`Mancano ${m} ${m === 1 ? 'voce' : 'voci'}`); return; }
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          const dati = {
            playerId: pid, tipo, data: todayIso(), sessioniFatte: done,
            scoring: s.d.scoring, doppie: s.d.doppie, bull: s.d.bull,
            checkout: s.d.checkout.filter((v) => v === 1).length,
          };
          const id = await saveTest({ ...dati, skill: skillScore(dati) });
          clearDraft(pid, 'skill');
          go(`/test/${id}`);
        } catch (err) {
          console.error(err);
          toast('Salvataggio non riuscito: i dati sono al sicuro, riprova');
          btn.disabled = false;
        }
      });
      awake = keepAwake();
      el.addEventListener('pointerdown', () => awake?.retry(), { passive: true });
      paint();
    },

    unmount() { awake?.release(); },
  };
}
