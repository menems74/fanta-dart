import { html, icon, fullName, todayIso, fmtDate } from '../util.js';
import { session } from '../auth.js';
import { listTrainings, listTests } from '../db.js';
import { topbar, avatar } from '../ui.js';
import { toApp } from './ui.js';
import {
  progress, sessionsThisWeek, weeklyStreak, GOAL_SETTIMANALE, skillScore, testDue, fmt1,
  nextSaturday, challengeFor,
} from './calc.js';
import { TIPO_INFO } from './catalogo.js';
import { BADGES, earnedBadges } from './badges.js';

const TITOLO = { iniziale: 'Fai il test iniziale', intermedio: 'Rifai lo Skill test', finale: 'Fai il test finale' };

export default async function view() {
  const p = session.player;
  const pid = session.account.playerId;
  const [trainings, tests] = await Promise.all([listTrainings(pid), listTests(pid)]);
  const today = todayIso();
  const pr = progress(trainings);
  const week = sessionsThisWeek(trainings, today);
  const streak = weeklyStreak(trainings, today);
  const earned = earnedBadges(trainings, tests);
  const due = testDue(tests, pr.done);
  const last = tests[0];
  const first = tests.length > 1 ? tests.at(-1) : null;
  const sat = nextSaturday(today);
  const sfidaTipo = challengeFor(sat);
  const oggi = sat === today;
  const recordSfida = trainings.filter((t) => t.tipo === sfidaTipo && Number.isFinite(t.metrica))
    .reduce((m, t) => Math.max(m, t.metrica), -Infinity);
  const delta = last && first ? Math.round((skillScore(last) - skillScore(first)) * 10) / 10 : null;

  return {
    html: html`
      ${topbar('Allenamenti', { right: toApp })}
      <section class="hero">
        ${avatar(p, 'xl')}
        <div class="grow"><h2>${p ? fullName(p) : 'Giocatore'}</h2>${p ? html`<p class="muted">Tessera ${p.tessera}</p>` : ''}</div>
      </section>
      <a class="btn primary big" href="#/tipo">${icon('play', 22)} Inizia allenamento</a>

      <div class="train-links">
        <a class="prog-card" href="#/miei">
          <span class="prog-head">${icon('user', 26)}<b>I miei progressi</b>${icon('chevron', 22)}</span>
          <span class="pbar" aria-hidden="true"><i style="width:${pr.done}%"></i></span>
          <span class="prog-stats">
            <span><b>${pr.done}/${pr.total}</b><small>Sessioni</small></span>
            <span><b>${week}/${GOAL_SETTIMANALE}</b><small>Questa settimana</small></span>
            <span><b>${earned.size}/${BADGES.length}</b><small>Badge</small></span>
          </span>
          <span class="streakline">${icon('flame', 18)} ${streak > 0
            ? `${streak} ${streak === 1 ? 'settimana' : 'settimane'} di fila con ${GOAL_SETTIMANALE} sessioni`
            : `Obiettivo: ${GOAL_SETTIMANALE} sessioni a settimana`} · ${pr.fase.nome}</span>
        </a>

        ${last ? html`
          <a class="card skill-card" href="#/test/${last.id}">
            <span class="badge-ico">${icon('star', 24)}</span>
            <div class="grow"><strong>Skill Score</strong>
              <span class="muted small">${delta == null ? 'Il tuo punto di partenza' : `${delta > 0 ? '+' : ''}${String(delta).replace('.', ',')} dal primo test`}</span></div>
            <b class="skill-num">${fmt1(skillScore(last))}<small>/100</small></b>
          </a>` : html`
          <a class="card skill-card dashed" href="#/test">
            <span class="badge-ico">${icon('star', 24)}</span>
            <div class="grow"><strong>Skill test</strong>
              <span class="muted small">Facoltativo: misura il tuo punto di partenza</span></div>
            ${icon('chevron', 22)}
          </a>`}
        ${due && last ? html`<a class="btn sec" href="#/test">${icon('target', 18)} ${TITOLO[due]}</a>` : ''}

        <a class="card skill-card ${oggi ? 'now' : ''}" href="#/squadra">
          <span class="badge-ico">${icon('flag', 24)}</span>
          <div class="grow"><strong>Sfida del sabato${oggi ? ' · oggi!' : ''}</strong>
            <span class="muted small">${TIPO_INFO[sfidaTipo].label} · ${fmtDate(sat)}${Number.isFinite(recordSfida) ? ` · record ${fmt1(recordSfida)}` : ''}</span></div>
          ${icon('chevron', 22)}
        </a>
        <a class="pill-btn" href="#/squadra">${icon('users', 24)} Progressi della squadra</a>
      </div>`,
  };
}
