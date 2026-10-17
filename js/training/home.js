import { html, icon, fullName, todayIso, toast } from '../util.js';
import { session } from '../auth.js';
import { listTrainings } from '../db.js';
import { topbar, avatar } from '../ui.js';
import { toApp } from './ui.js';
import { progress, sessionsThisWeek, GOAL_SETTIMANALE } from './calc.js';

export default async function view() {
  const p = session.player;
  const trainings = await listTrainings(session.account.playerId);
  const pr = progress(trainings);
  const week = sessionsThisWeek(trainings, todayIso());

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
            <span><b>${pr.fase.breve}</b><small>Fase</small></span>
            <span><b>${week}/${GOAL_SETTIMANALE}</b><small>Questa settimana</small></span>
          </span>
        </a>
        <button type="button" class="pill-btn" id="squad">${icon('users', 24)} Progressi della squadra</button>
      </div>`,
    mount(root) {
      root.querySelector('#squad').addEventListener('click', () => toast('Progressi della squadra: disponibile a breve'));
    },
  };
}
