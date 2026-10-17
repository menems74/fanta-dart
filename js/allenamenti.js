// Pagina "Allenamenti": si apre in una scheda a parte (allenamenti.html) e condivide l'accesso con l'app.
// Percorso di 100 sessioni (vedi js/training/): home, scelta del tipo, inserimento, risultato, progressi.
import { watchSession, session } from './auth.js';
import { html } from './util.js';
import { topbar, emptyState } from './ui.js';
import { toApp } from './training/ui.js';
import home from './training/home.js';
import tipo from './training/tipo.js';
import sessione from './training/sessione.js';
import risultato from './training/risultato.js';
import miei from './training/miei.js';
import skill from './training/skill.js';
import skillrisultato from './training/skillrisultato.js';

const root = document.getElementById('view');
const routes = [
  [/^\/$/, home],
  [/^\/tipo$/, tipo],
  [/^\/sessione\/([^/]+)$/, sessione],
  [/^\/risultato\/([^/]+)$/, risultato],
  [/^\/miei$/, miei],
  [/^\/test$/, skill],
  [/^\/test\/([^/]+)$/, skillrisultato],
];
let ready = false;
let token = 0;
let unmount = null;

const loginNeeded = () => html`
  ${topbar('Allenamenti', { right: toApp })}
  ${emptyState('Accedi per continuare',
    'Gli allenamenti sono riservati ai giocatori della squadra.',
    html`<a class="btn primary" href="./#/login">Vai all'accesso</a>`)}`;

async function navigate() {
  if (!ready) return;
  const my = ++token;
  unmount?.();
  unmount = null;
  const path = decodeURI(location.hash.slice(1)) || '/';
  root.setAttribute('aria-busy', 'true');
  try {
    if (!session.user) {
      root.innerHTML = loginNeeded().s;
      return;
    }
    let route = null;
    let params = [];
    for (const r of routes) {
      const m = path.match(r[0]);
      if (m) { route = r[1]; params = m.slice(1).map((x) => x && decodeURIComponent(x)); break; }
    }
    if (!route) { location.replace('#/'); return; }
    const out = await route(params);
    if (my !== token) { out.unmount?.(); return; }
    root.innerHTML = out.html.s;
    window.scrollTo(0, 0);
    unmount = out.unmount || null;
    out.mount?.(root);
  } catch (e) {
    console.error(e);
    if (my !== token) return;
    root.innerHTML = html`
      <div class="empty"><h2>Qualcosa è andato storto</h2>
        <p>${navigator.onLine ? 'Riprova tra poco.' : 'Sei offline e questa pagina non è ancora in memoria.'}</p>
        <button class="btn primary" id="retry">Riprova</button></div>`.s;
    root.querySelector('#retry').addEventListener('click', navigate);
  } finally {
    if (my === token) root.removeAttribute('aria-busy');
  }
}

window.addEventListener('hashchange', navigate);
watchSession(() => { ready = true; navigate(); });

const syncOnline = () => document.body.classList.toggle('offline', !navigator.onLine);
window.addEventListener('online', syncOnline);
window.addEventListener('offline', syncOnline);
syncOnline();
