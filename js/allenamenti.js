// Pagina "Allenamenti": si apre in una scheda a parte (allenamenti.html) e condivide l'accesso con l'app.
// Percorso: scelta del giocatore -> scelta del tipo di allenamento.
import { watchSession, session } from './auth.js';
import { listPlayers, getPlayer } from './db.js';
import { html, icon, fullName } from './util.js';
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

async function pickPlayer() {
  const players = (await listPlayers()).filter((p) => p.attivo !== false);
  const me = session.account?.playerId;
  return html`
    ${topbar('Allenamenti', { right: toApp })}
    <p class="muted lead">Per chi vuoi aprire gli allenamenti?</p>
    <h2 class="section">Scegli il giocatore</h2>
    ${players.length ? html`<ul class="list">
      ${players.map((p) => html`
        <li><a class="card row" href="#/giocatore/${p.id}">
          ${avatar(p)}
          <div class="grow"><strong>${fullName(p)}</strong>
            <span class="muted small">${p.id === me ? 'Sei tu' : `Tessera ${p.tessera}`}</span></div>
          ${icon('chevron')}
        </a></li>`)}
    </ul>` : emptyState('Nessun giocatore', 'Un admin deve ancora inserire i giocatori nell\'app.')}`;
}

async function pickTraining(playerId) {
  const p = await getPlayer(playerId);
  if (!p) return html`${topbar('Allenamenti', { back: '/' })}${emptyState('Giocatore non trovato', 'Torna indietro e scegline un altro.')}`;
  return html`
    ${topbar('Allenamenti', { back: '/' })}
    <section class="hero">
      ${avatar(p, 'xl')}
      <div><h2>${fullName(p)}</h2><p class="muted">Tessera ${p.tessera}</p></div>
    </section>
    <h2 class="section">Tipo di allenamento</h2>
    <div class="card soon">
      <span class="soon-ico">${icon('target', 26)}</span>
      <strong>Le tipologie arrivano presto</strong>
      <p class="muted">Qui sceglierai l'allenamento da svolgere. Le sessioni verranno aggiunte appena pronte.</p>
    </div>`;
}

async function navigate() {
  if (!ready) return;
  const my = ++token;
  const path = decodeURI(location.hash.slice(1)) || '/';
  let out;
  try {
    if (!session.user) out = loginNeeded();
    else {
      const m = path.match(/^\/giocatore\/([^/]+)$/);
      out = m ? await pickTraining(decodeURIComponent(m[1])) : await pickPlayer();
    }
  } catch (e) {
    console.error(e);
    out = html`
      <div class="empty"><h2>Qualcosa è andato storto</h2>
        <p>${navigator.onLine ? 'Riprova tra poco.' : 'Sei offline e questa pagina non è ancora in memoria.'}</p>
        <button class="btn primary" id="retry">Riprova</button></div>`;
  }
  if (my !== token) return;
  root.innerHTML = out.s;
  window.scrollTo(0, 0);
  root.querySelector('#retry')?.addEventListener('click', navigate);
}

window.addEventListener('hashchange', navigate);
watchSession(() => { ready = true; navigate(); });

const syncOnline = () => document.body.classList.toggle('offline', !navigator.onLine);
window.addEventListener('online', syncOnline);
window.addEventListener('offline', syncOnline);
syncOnline();
