import { html, icon, fmtDate } from '../util.js';
import { session } from '../auth.js';
import { listTrainings } from '../db.js';
import { topbar, emptyState } from '../ui.js';
import { toApp, spark } from './ui.js';
import { TIPI, TIPO_INFO, FASI, isCheckpoint, SESSIONI_PER_TIPO } from './catalogo.js';
import { doneNumbers, progress, fmt1, headline } from './calc.js';

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export default async function view() {
  const trainings = await listTrainings(session.account.playerId);
  const pr = progress(trainings);
  const done = doneNumbers(trainings);

  if (!trainings.length) {
    return {
      html: html`${topbar('I miei progressi', { back: '/', right: toApp })}
        ${emptyState('Il percorso inizia da qui', '100 sessioni per migliorare il tuo gioco, una alla volta.',
          html`<a class="btn primary" href="#/tipo">${icon('play', 18)} Inizia allenamento</a>`)}`,
    };
  }

  const perTipo = TIPI.map((tipo) => {
    const mine = trainings.filter((t) => t.tipo === tipo);
    const crono = [...mine].sort((a, b) => (a.creataIl || 0) - (b.creataIl || 0));
    const vals = crono.map((t) => t.metrica);
    const fin = vals.filter(Number.isFinite);
    return { tipo, n: mine.length, vals, best: fin.length && tipo !== 'pressione' ? Math.max(...fin) : null, last: crono.at(-1) };
  });

  return {
    html: html`
      ${topbar('I miei progressi', { back: '/', right: toApp })}
      <section class="card path">
        <div class="row between"><b>${pr.done} sessioni su ${pr.total}</b><span class="tag gold">${pr.fase.nome}</span></div>
        ${FASI.map((f) => html`
          <div class="phase">
            <div class="row between"><span class="muted small">${f.nome}</span>
              <span class="muted small">${range(f.da, f.a).filter((n) => done.has(n)).length}/${f.a - f.da + 1}</span></div>
            <div class="dots">${range(f.da, f.a).map((n) => html`<span class="dot ${done.has(n) ? 'on' : ''} ${isCheckpoint(n) ? 'cp' : ''}" title="Sessione ${n}"></span>`)}</div>
          </div>`)}
        <p class="muted small">I cerchi dorati sono i checkpoint, ogni 10 sessioni.</p>
      </section>

      <h2 class="section">Per tipo di allenamento</h2>
      <ul class="list">
        ${perTipo.map((p) => html`
          <li class="card tcard">
            <div class="row">
              <span class="badge-ico">${icon(TIPO_INFO[p.tipo].icon, 24)}</span>
              <div class="grow"><strong>${TIPO_INFO[p.tipo].label}</strong>
                <span class="muted small">${p.n}/${SESSIONI_PER_TIPO} sessioni${p.best != null ? ` · record ${fmt1(p.best)}` : ''}</span></div>
              ${p.tipo === 'pressione' ? '' : spark(p.vals)}
            </div>
          </li>`)}
      </ul>

      <h2 class="section">Ultime sessioni</h2>
      <ul class="list">
        ${trainings.slice(0, 8).map((t) => {
          const h = headline(t);
          return html`<li><a class="card row" href="#/risultato/${t.id}">
            <div class="grow"><strong>${TIPO_INFO[t.tipo].label} · sessione ${t.numero}</strong>
              <span class="muted small">${fmtDate(t.data)}${t.durataMin ? ` · ${t.durataMin} min` : ''}</span></div>
            <b class="tres">${h.big}<small>${h.unit}</small></b>
          </a></li>`;
        })}
      </ul>`,
  };
}
