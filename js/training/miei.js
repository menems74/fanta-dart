import { html, icon, fmtDate } from '../util.js';
import { session } from '../auth.js';
import { listTrainings, listTests } from '../db.js';
import { topbar, emptyState } from '../ui.js';
import { toApp, spark, badgeTile } from './ui.js';
import { TIPI, TIPO_INFO, FASI, isCheckpoint, SESSIONI_PER_TIPO, meglioSeBasso } from './catalogo.js';
import {
  doneNumbers, progress, fmt1, headline, pairsOf, doppieMedie, checkoutFails, skillScore, bestOf,
} from './calc.js';
import { BADGES, earnedBadges } from './badges.js';

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const TEST_NOME = { iniziale: 'Test iniziale', intermedio: 'Test intermedio', finale: 'Test finale' };

export default async function view() {
  const pid = session.account.playerId;
  const [trainings, tests] = await Promise.all([listTrainings(pid), listTests(pid)]);
  const pr = progress(trainings);
  const done = doneNumbers(trainings);

  if (!trainings.length && !tests.length) {
    return {
      html: html`${topbar('I miei progressi', { back: '/', right: toApp })}
        ${emptyState('Il percorso inizia da qui', '100 sessioni per migliorare il tuo gioco, una alla volta.',
          html`<a class="btn primary" href="#/tipo">${icon('play', 18)} Inizia allenamento</a>`)}`,
    };
  }

  const earned = earnedBadges(trainings, tests);
  const got = BADGES.filter((b) => earned.has(b.id));
  const locked = BADGES.filter((b) => !earned.has(b.id));
  const confronti = pairsOf(trainings).slice(0, 4);
  const migl = (c) => (meglioSeBasso(c.b) ? -c.delta : c.delta); // positivo = migliorato
  const doppie = doppieMedie(trainings);
  const fails = checkoutFails(trainings);

  const perTipo = TIPI.map((tipo) => {
    const mine = trainings.filter((t) => t.tipo === tipo);
    const crono = [...mine].sort((a, b) => (a.creataIl || 0) - (b.creataIl || 0));
    const vals = crono.map((t) => t.metrica);
    return { tipo, n: mine.length, vals, best: bestOf(trainings, tipo) };
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

      <h2 class="section">Badge · ${got.length} su ${BADGES.length}</h2>
      ${got.length ? html`<div class="bgrid">${got.map((b) => badgeTile(b, true))}</div>`
        : html`<p class="muted">Il primo badge arriva con la prima sessione.</p>`}
      ${locked.length ? html`<details class="more"><summary>Da sbloccare (${locked.length})</summary>
        <div class="bgrid">${locked.map((b) => badgeTile(b, false))}</div></details>` : ''}

      ${tests.length ? html`
        <h2 class="section">Skill Score</h2>
        <ul class="list">${tests.map((t) => html`
          <li><a class="card row" href="#/test/${t.id}">
            <div class="grow"><strong>${TEST_NOME[t.tipo]}</strong><span class="muted small">${fmtDate(t.data)} · dopo ${t.sessioniFatte ?? 0} sessioni</span></div>
            <b class="tres">${fmt1(skillScore(t))}<small>/100</small></b>
          </a></li>`)}</ul>` : ''}

      ${confronti.length ? html`
        <h2 class="section">Primo e secondo giro</h2>
        <ul class="list">${confronti.map((c) => html`
          <li class="card row">
            <div class="grow"><strong>${TIPO_INFO[c.tipo].label}</strong>
              <span class="muted small">Sessione ${c.a.numero} → ${c.b.numero}</span></div>
            <b class="tres ${migl(c) > 0 ? 'up' : migl(c) < 0 ? 'down' : ''}">${fmt1(c.a.metrica)} → ${fmt1(c.b.metrica)}
              <small>${c.delta > 0 ? '+' : ''}${fmt1(c.delta)}</small></b>
          </li>`)}</ul>` : ''}

      ${doppie || fails.length ? html`
        <h2 class="section">Punti da lavorare</h2>
        <div class="card insight">
          ${doppie ? html`<p>${icon('crosshair', 18)} Doppia più debole: <b>${doppie[0].b}</b> (${doppie[0].pct}% di colpi). La più solida: <b>${doppie.at(-1).b}</b> (${doppie.at(-1).pct}%).</p>` : ''}
          ${fails.length ? html`<p>${icon('flag', 18)} Chiusure da riprendere: <b>${fails.map((f) => f.out).join(', ')}</b> (riescono meno di una volta su due).</p>` : ''}
        </div>` : ''}

      <h2 class="section">Per tipo di allenamento</h2>
      <ul class="list">
        ${perTipo.map((p) => html`
          <li class="card tcard">
            <div class="row">
              <span class="badge-ico">${icon(TIPO_INFO[p.tipo].icon, 24)}</span>
              <div class="grow"><strong>${TIPO_INFO[p.tipo].label}</strong>
                <span class="muted small">${p.n}/${SESSIONI_PER_TIPO} sessioni${p.best != null ? ` · record ${fmt1(p.best)}${p.tipo === 'partita' ? ' frecce' : ''}` : ''}</span></div>
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
