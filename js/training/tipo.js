import { html, icon, todayIso } from '../util.js';
import { session } from '../auth.js';
import { listTrainings } from '../db.js';
import { topbar } from '../ui.js';
import { TIPI, TIPO_INFO, numeroOf, faseOf } from './catalogo.js';
import { nextK, fmt1, nextSaturday, challengeFor, bestOf } from './calc.js';
import { loadDraft } from './store.js';

export default async function view() {
  const pid = session.account.playerId;
  const trainings = await listTrainings(pid);

  const rows = TIPI.map((tipo) => {
    const k = nextK(trainings, tipo);
    const mine = trainings.filter((t) => t.tipo === tipo);
    const best = bestOf(trainings, tipo);
    return {
      tipo, k, done: mine.length,
      n: k ? numeroOf(tipo, k) : null,
      best,
      draft: !!loadDraft(pid, tipo),
    };
  });
  const rec = rows.filter((r) => r.k).sort((a, b) => a.n - b.n)[0]?.tipo;
  const oggi = todayIso();
  const sfida = nextSaturday(oggi) === oggi ? challengeFor(oggi) : null;

  return {
    html: html`
      ${topbar('Che allenamento fai?', { back: '/' })}
      <p class="muted lead">Scegli il tipo: ti proponiamo la prossima sessione del percorso.</p>
      <ul class="list tipi">
        ${rows.map((r) => {
          const info = TIPO_INFO[r.tipo];
          const body = html`
            <span class="badge-ico">${icon(info.icon, 24)}</span>
            <div class="grow">
              <strong>${info.label} ${r.draft ? html`<span class="tag gold">In corso</span>` : r.tipo === sfida ? html`<span class="tag gold">Sfida di oggi</span>` : r.tipo === rec ? html`<span class="tag w">Consigliata</span>` : ''}</strong>
              <span class="muted small">${r.k ? `Sessione ${r.n} · ${faseOf(r.n).nome}` : 'Tutte e 20 completate'}</span>
              <span class="muted small">${info.desc}${r.best != null ? ` · record ${fmt1(r.best)}${r.tipo === 'partita' ? ' frecce' : ''}` : ''}</span>
            </div>
            <span class="tipo-side">${r.k ? icon('chevron', 22) : icon('check', 22)}</span>`;
          return r.k
            ? html`<li><a class="card row type-card" href="#/sessione/${r.tipo}">${body}</a></li>`
            : html`<li><div class="card row type-card off">${body}</div></li>`;
        })}
      </ul>`,
  };
}
