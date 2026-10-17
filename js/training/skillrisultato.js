import { html, $, icon, toast, go, fmtDate } from '../util.js';
import { session } from '../auth.js';
import { getTest, listTests, listTrainings, deleteTest } from '../db.js';
import { topbar, emptyState } from '../ui.js';
import { skillScore, skillQuotas, SKILL_MAX, fmt1 } from './calc.js';
import { newBadges } from './badges.js';
import { badgeTile } from './ui.js';

const TITOLO = { iniziale: 'Test iniziale', intermedio: 'Test intermedio', finale: 'Test finale' };
const PROVE = [
  ['scoring', 'Scoring', 'punti'], ['doppie', 'Doppie', 'colpi'], ['bull', 'Bull', 'punti'], ['checkout', 'Checkout', 'chiusure'],
];

export default async function view([id]) {
  const t = await getTest(id);
  if (!t) return { html: html`${topbar('Skill test', { back: '/' })}${emptyState('Test non trovato', 'Potrebbe essere stato eliminato.')}` };
  const mine = t.playerId === session.account.playerId;
  const [tests, trainings] = await Promise.all([listTests(t.playerId), listTrainings(t.playerId)]);
  const prima = tests.filter((x) => x.id !== t.id && (x.creataIl || 0) < (t.creataIl || 0));
  const score = skillScore(t);
  const ref = prima[0];
  const delta = ref ? Math.round((score - skillScore(ref)) * 10) / 10 : null;
  const q = skillQuotas(t);
  const nuovi = newBadges(trainings, tests, { testId: t.id });

  return {
    html: html`
      ${topbar('Skill test', { back: '/' })}
      <section class="card result ${delta > 0 ? 'pb' : ''}">
        <p class="muted small">${TITOLO[t.tipo]} · ${fmtDate(t.data)}</p>
        <p class="result-big">${fmt1(score)}<small>/ 100</small></p>
        <p class="muted">Skill Score</p>
        ${delta == null
          ? html`<div class="result-msg first"><div><b>Il tuo punto di partenza</b><span>Rifallo dopo un po' di sessioni: vedrai quanto sei migliorato.</span></div></div>`
          : html`<div class="result-msg ${delta > 0 ? 'pb' : 'same'}">${delta > 0 ? icon('trophy', 22) : ''}
              <div><b>${delta > 0 ? '+' : ''}${String(delta).replace('.', ',')} rispetto al test precedente</b>
              <span>${delta > 0 ? 'Stai migliorando: continua così.' : delta === 0 ? 'Stesso livello: la costanza conta.' : 'Capita: il test di un giorno non dice tutto.'}</span></div></div>`}
      </section>

      <h2 class="section">Le quattro prove</h2>
      <div class="card quote">
        ${PROVE.map(([k, nome, unita]) => html`
          <div class="qrow">
            <div class="row between"><b>${nome}</b><span class="muted small">${t[k]} / ${SKILL_MAX[k]} ${unita}</span></div>
            <span class="pbar" aria-hidden="true"><i style="width:${Math.round((q[k] / 25) * 100)}%"></i></span>
            <small class="muted">${fmt1(q[k])} su 25 punti</small>
          </div>`)}
      </div>

      ${nuovi.length ? html`<h2 class="section">Nuovi badge</h2><div class="bgrid">${nuovi.map((b) => badgeTile(b, true))}</div>` : ''}

      <div class="actions">
        <a class="btn primary" href="#/">Torna alla home</a>
        <a class="btn sec" href="#/miei">I miei progressi</a>
        ${mine ? html`<button type="button" class="btn danger" id="del">${icon('trash', 18)} Elimina test</button>` : ''}
      </div>`,
    mount(root) {
      $(root, '#del')?.addEventListener('click', async () => {
        if (!confirm('Eliminare questo test?')) return;
        try { await deleteTest(id); toast('Test eliminato'); go('/miei'); }
        catch (e) { console.error(e); toast('Eliminazione non riuscita'); }
      });
    },
  };
}

