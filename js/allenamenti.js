// Pagina "Allenamenti": si apre in una scheda a parte (allenamenti.html) e condivide l'accesso con l'app.
// Home: il giocatore connesso, "Inizia allenamento" (scelta del tipo) e i due percorsi dei progressi.
import { watchSession, session } from './auth.js';
import { html, icon, fullName, toast } from './util.js';
import { topbar, avatar, emptyState } from './ui.js';

const root = document.getElementById('view');
let ready = false;

const toApp = html`<a class="iconbtn" href="./#/partite" aria-label="Torna all'app" title="Torna all'app">${icon('home')}</a>`;

function loginNeeded() {
  return html`
    ${topbar('Allenamenti', { right: toApp })}
    ${emptyState('Accedi per continuare',
      'Gli allenamenti sono riservati ai giocatori della squadra.',
      html`<a class="btn primary" href="./#/login">Vai all'accesso</a>`)}`;
}

function home() {
  const p = session.player;
  return html`
    ${topbar('Allenamenti', { right: toApp })}
    <section class="hero">
      ${avatar(p, 'xl')}
      <div class="grow"><h2>${p ? fullName(p) : 'Giocatore'}</h2>${p ? html`<p class="muted">Tessera ${p.tessera}</p>` : ''}</div>
    </section>
    <a class="btn primary big" href="#/tipo">${icon('play', 22)} Inizia allenamento</a>

    <div class="train-links">
      <button type="button" class="prog-card" data-soon="I tuoi progressi">
        <span class="prog-head">${icon('user', 26)}<b>I miei progressi</b>${icon('chevron', 22)}</span>
        <span class="prog-stats">
          <span><b>—</b><small>Sessioni</small></span>
          <span><b>—</b><small>Media</small></span>
          <span><b>—</b><small>Record</small></span>
        </span>
      </button>
      <button type="button" class="pill-btn" data-soon="I progressi della squadra">${icon('users', 24)} Progressi della squadra</button>
    </div>`;
}

function chooseType() {
  return html`
    ${topbar('Tipo di allenamento', { back: '/' })}
    <div class="card soon">
      <span class="soon-ico">${icon('target', 26)}</span>
      <strong>Le tipologie arrivano presto</strong>
      <p class="muted">Qui sceglierai l'allenamento da svolgere. Le sessioni verranno aggiunte appena pronte.</p>
    </div>`;
}

function navigate() {
  if (!ready) return;
  const path = decodeURI(location.hash.slice(1)) || '/';
  const out = !session.user ? loginNeeded() : path === '/tipo' ? chooseType() : home();
  root.innerHTML = out.s;
  window.scrollTo(0, 0);
  root.querySelectorAll('[data-soon]').forEach((b) =>
    b.addEventListener('click', () => toast(`${b.dataset.soon}: disponibile a breve`)));
}

window.addEventListener('hashchange', navigate);
watchSession(() => { ready = true; navigate(); });

const syncOnline = () => document.body.classList.toggle('offline', !navigator.onLine);
window.addEventListener('online', syncOnline);
window.addEventListener('offline', syncOnline);
syncOnline();
