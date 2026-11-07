// Pagina "Allenamenti" (allenamenti.html): aperta a tutti. Con l'accesso le sessioni vanno su Firestore,
// senza (ospite) restano sul dispositivo: vedi training/archivio.js.
// Pensata per tablet in orizzontale. Giochi liberi (js/training/giochi.js), Granboard collegato una volta per tutti.
import { watchSession, session } from './auth.js';
import { html, toast } from './util.js';
import { topbar, emptyState } from './ui.js';
import { collega, onStato, tavolaStato } from './training/tavola.js';
import { sbloccaAudio } from './training/suono.js';
import { schermoIntero, etichettaStato } from './training/grafica.js';
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
  ${topbar('Squadra', { back: '/' })}
  ${emptyState('Accedi per continuare',
    'La pagina della squadra è riservata ai giocatori con la tessera.',
    html`<a class="btn primary" href="./#/login/allenamenti">Vai all'accesso</a>`)}`;
const soloConAccesso = new Set([squadra]);

async function navigate() {
  if (!ready) return;
  const my = ++token;
  unmount?.();
  unmount = null;
  const path = decodeURI(location.hash.slice(1)) || '/';
  root.setAttribute('aria-busy', 'true');
  try {
    let route = null;
    let params = [];
    for (const r of routes) {
      const m = path.match(r[0]);
      if (m) { route = r[1]; params = m.slice(1).map((x) => x && decodeURIComponent(x)); break; }
    }
    if (!route) { location.replace('#/'); return; }
    if (!session.user && soloConAccesso.has(route)) {
      root.innerHTML = loginNeeded().s;
      return;
    }
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
    b.setAttribute('aria-label', etichettaStato(st));
    b.title = etichettaStato(st);
  }
  if (st === 'collegata') { document.querySelector('.card.collega')?.remove(); toast('Granboard collegato'); }
  if (st === 'scollegata') toast('Granboard scollegato');
});
document.addEventListener('pointerdown', sbloccaAudio, { passive: true });
