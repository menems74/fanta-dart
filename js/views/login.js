import { html, $, formatTessera } from '../util.js';
import { login, session, normalizeTessera, TESSERA_RE, PIN_RE } from '../auth.js';

const MESSAGES = {
  'auth/invalid-credential': 'Tessera o PIN non corretti.',
  'auth/user-not-found': 'Tessera o PIN non corretti.',
  'auth/wrong-password': 'Tessera o PIN non corretti.',
  'auth/too-many-requests': 'Troppi tentativi. Riprova tra qualche minuto.',
  'auth/network-request-failed': 'Connessione assente. Riprova online.',
};

export default async function view() {
  return {
    html: html`
      <section class="login">
        <img src="assets/logo-320.png" width="104" height="104" alt="Logo Fanta Dart">
        <h1>Fanta Dart</h1>
        <div class="tricolore"></div>
        <p class="muted">Le pagelle di fine serata</p>
        <form id="f" novalidate>
          <label class="field">Numero tessera
            <input name="tessera" inputmode="numeric" maxlength="7" autocomplete="username" placeholder="08/4272" required>
            <small class="muted">Scrivi solo i numeri: la barra si inserisce da sola.</small>
          </label>
          <label class="field">PIN
            <input name="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password" placeholder="••••" required>
          </label>
          <p class="error" id="err" role="alert">${session.error || ''}</p>
          <button class="btn primary" id="go">Entra</button>
        </form>
        <p class="muted small">Non hai il PIN? Chiedilo a un admin.</p>
      </section>`,
    mount(root) {
      const f = $(root, '#f');
      const err = $(root, '#err');
      f.tessera.addEventListener('input', () => { f.tessera.value = formatTessera(f.tessera.value); });
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tessera = normalizeTessera(f.tessera.value);
        const pin = f.pin.value.trim();
        if (!TESSERA_RE.test(tessera)) { err.textContent = 'Tessera non valida: usa il formato 08/4272.'; return; }
        if (!PIN_RE.test(pin)) { err.textContent = 'Il PIN è di 4 cifre.'; return; }
        err.textContent = '';
        const btn = $(root, '#go');
        btn.disabled = true;
        btn.textContent = 'Accesso…';
        try {
          await login(tessera, pin);
        } catch (e2) {
          err.textContent = MESSAGES[e2.code] || 'Accesso non riuscito. Riprova.';
          btn.disabled = false;
          btn.textContent = 'Entra';
        }
      });
    },
  };
}
