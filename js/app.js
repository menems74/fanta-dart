import { watchSession, session } from './auth.js';
import { html, icon } from './util.js';
import login from './views/login.js';
import partite from './views/partite.js';
import partita from './views/partita.js';
import partitaForm from './views/partitaForm.js';
import pagellino from './views/pagellino.js';
import pagellinoForm from './views/pagellinoForm.js';
import classifica from './views/classifica.js';
import profilo from './views/profilo.js';
import gestione from './views/gestione.js';
import stagione from './views/stagione.js';
import giocatore from './views/giocatore.js';

const routes = [
  [/^\/login$/, login, { public: true }],
  [/^\/partite$/, partite],
  [/^\/partita\/nuova$/, partitaForm, { admin: true }],
  [/^\/partita\/([^/]+)\/modifica$/, partitaForm, { admin: true }],
  [/^\/partita\/([^/]+)$/, partita],
  [/^\/pagellino\/([^/]+)\/([^/]+)\/modifica$/, pagellinoForm, { admin: true }],
  [/^\/pagellino\/([^/]+)\/([^/]+)$/, pagellino],
  [/^\/classifica$/, classifica],
  [/^\/profilo(?:\/([^/]+))?$/, profilo],
  [/^\/gestione$/, gestione, { admin: true }],
  [/^\/stagione\/([^/]+)$/, stagione, { admin: true }],
  [/^\/giocatore\/([^/]+)$/, giocatore, { admin: true }],
];

const root = document.getElementById('view');
const nav = document.getElementById('nav');
let ready = false;
let token = 0;

const tabs = () => [
  ['/partite', 'calendar', 'Partite'],
  ['/classifica', 'trophy', 'Classifica'],
  ['/profilo', 'user', 'Profilo'],
  ...(session.isAdmin ? [['/gestione', 'sliders', 'Gestione']] : []),
];

const SECTIONS = {
  '/partite': /^\/(partit|pagellino)/,
  '/classifica': /^\/classifica/,
  '/profilo': /^\/profilo/,
  '/gestione': /^\/(gestione|stagione|giocatore)/,
};

function renderNav(path) {
  if (!session.user) { nav.hidden = true; return; }
  nav.hidden = false;
  nav.innerHTML = tabs().map(([href, ic, label]) => html`
    <a href="#${href}" class="${SECTIONS[href].test(path) ? 'on' : ''}">${icon(ic, 22)}<span>${label}</span></a>`.s).join('');
}

async function navigate() {
  if (!ready) return;
  const my = ++token;
  let path = decodeURI(location.hash.slice(1)) || '/partite';
  if (!session.user && path !== '/login') { location.replace('#/login'); return; }
  if (session.user && path === '/login') { location.replace('#/partite'); return; }

  let route = null;
  let params = [];
  for (const r of routes) {
    const m = path.match(r[0]);
    if (m) { route = r; params = m.slice(1).map((x) => x && decodeURIComponent(x)); break; }
  }
  if (!route) { location.replace('#/partite'); return; }
  if (route[2]?.admin && !session.isAdmin) { location.replace('#/partite'); return; }

  renderNav(path);
  root.setAttribute('aria-busy', 'true');
  try {
    const out = await route[1](params);
    if (my !== token) return;
    root.innerHTML = out.html.s;
    window.scrollTo(0, 0);
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

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker non registrato', e));
}
