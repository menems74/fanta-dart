// Pagina "Allenamenti": si apre in una scheda a parte (allenamenti.html) e condivide l'accesso con l'app.
// Mostra il giocatore connesso e due percorsi: i suoi progressi e quelli della squadra (da programmare).
import { watchSession, session } from './auth.js';
import { html, icon, fullName, toast } from './util.js';
import { topbar, avatar, emptyState } from './ui.js';

const root = document.getElementById('view');
let ready = false;
let token = 0;

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
      <div><h2>${p ? fullName(p) : 'Giocatore'}</h2>${p ? html`<p class="muted">Tessera ${p.tessera}</p>` : ''}</div>
    </section>
    <div class="train-actions">
      <button type="button" class="btn primary big" data-soon="I tuoi progressi">${icon('user', 24)} I miei progressi</button>
      <button type="button" class="btn sec big" data-soon="I progressi della squadra">${icon('users', 24)} Progressi della squadra</button>
    </div>`;
}

function navigate() {
  if (!ready) return;
  const out = session.user ? home() : loginNeeded();
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
