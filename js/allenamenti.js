// Pagina "Allenamenti": si apre in una scheda a parte (allenamenti.html) e condivide l'accesso con l'app.
// Pensata per tablet in orizzontale. Giochi liberi (js/training/giochi.js), Granboard collegato una volta per tutti.
import { watchSession, session } from './auth.js';
import { html, toast } from './util.js';
import { topbar, emptyState } from './ui.js';
import { collega, onStato, tavolaStato } from './training/tavola.js';
import { sbloccaAudio } from './training/suono.js';
import { schermoIntero } from './training/grafica.js';
import home from './training/home.js';
import gioco from './training/gioco.js';
import progressi from './training/progressi.js';
import squadra from './training/squadra.js';

const root = document.getElementById('view');
const routes = [
  [/^\/$/, home],
  [/^\/gioco\/([^/]+)$/, gioco],
  [/^\/progressi$/, progressi],
  [/^\/progressi\/([^/]+)$/, progressi],
  [/^\/squadra$/, squadra],
];
let ready = false;
let token = 0;
let unmount = null;

const loginNeeded = () => html`
  ${topbar('Allenamenti')}
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

// Comandi validi in ogni schermata: collegare il Granboard e lo schermo intero.
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act="tavola"], [data-act="full"]');
  if (!b) return;
  if (b.dataset.act === 'full') { schermoIntero(); return; }
  if (tavolaStato() !== 'scollegata') return;
  try { await collega(); } catch (err) { console.error(err); toast('Collegamento non riuscito: chiudi le altre app del Granboard e riprova'); }
});
// Aggiorna il pulsante del Granboard in alto senza ridisegnare la pagina.
onStato((st) => {
  for (const b of document.querySelectorAll('.board-chip')) {
    b.className = `board-chip ${st}`;
    b.lastChild.textContent = st === 'collegata' ? 'Granboard collegato' : st === 'collego' ? 'Collegamento…' : 'Collega Granboard';
  }
  if (st === 'collegata') { document.querySelector('.card.collega')?.remove(); toast('Granboard collegato'); }
  if (st === 'scollegata') toast('Granboard scollegato');
});
document.addEventListener('pointerdown', sbloccaAudio, { passive: true });
