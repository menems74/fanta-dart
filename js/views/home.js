// Schermata iniziale: tre strade. Campionato (solo tessere della squadra), Allenamento (per tutti, anche senza accesso)
// e Torneo (sito esterno delle estrazioni).
import { html, icon, fullName } from '../util.js';
import { firma } from '../versione.js';
import { session, logout } from '../auth.js';

export const TORNEO_URL = 'https://menems74.github.io/estrazioni_torneo/';

export default async function homeView() {
  const dentro = !!session.user;
  const squadra = dentro && !session.soloAllenamenti;
  const campionato = squadra
    ? html`<a class="card link-card scelta" href="#/partite">
        <span class="badge-ico">${icon('trophy', 26)}</span>
        <div class="grow"><strong>Campionato</strong><span class="muted small">Partite, pagellini e classifica</span></div>
        ${icon('chevron', 20)}</a>`
    : dentro
      ? html`<div class="card link-card scelta off" aria-disabled="true">
          <span class="badge-ico">${icon('trophy', 26)}</span>
          <div class="grow"><strong>Campionato</strong><span class="muted small">Riservato ai giocatori della squadra</span></div></div>`
      : html`<a class="card link-card scelta" href="#/login">
          <span class="badge-ico">${icon('trophy', 26)}</span>
          <div class="grow"><strong>Campionato</strong><span class="muted small">Solo tessere della squadra: accedi con tessera e PIN</span></div>
          ${icon('chevron', 20)}</a>`;

  return {
    html: html`
      <section class="login home-scelte">
        <img src="assets/logo-320.png" width="104" height="104" alt="Logo Fanta Dart">
        <h1>Fanta Dart</h1>
        <div class="tricolore"></div>
        <nav class="scelte" aria-label="Cosa vuoi fare">
          ${campionato}
          <a class="card link-card scelta" href="allenamenti.html">
            <span class="badge-ico">${icon('target', 26)}</span>
            <div class="grow"><strong>Allenamento</strong><span class="muted small">Per tutti, anche senza tessera</span></div>
            ${icon('chevron', 20)}</a>
          <a class="card link-card scelta" href="${TORNEO_URL}" target="_blank" rel="noopener">
            <span class="badge-ico">${icon('flag', 26)}</span>
            <div class="grow"><strong>Torneo</strong><span class="muted small">Estrazioni del torneo · si apre in una nuova scheda</span></div>
            ${icon('external', 20)}</a>
        </nav>
        ${dentro
          ? html`<p class="muted small">Accesso come <b>${session.player ? fullName(session.player) : 'giocatore'}</b> ·
              <button type="button" class="linkbtn" id="out">Esci</button></p>`
          : ''}
        ${firma()}
      </section>`,
    mount(root) {
      root.querySelector('#out')?.addEventListener('click', () => logout());
    },
  };
}
