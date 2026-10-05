import { html, $, toast, go, randomPin, formatTessera } from '../util.js';
import { session, createAccount, verifyPin, normalizeTessera, playerIdOf, TESSERA_RE, PIN_RE, MAX_VERSIONS } from '../auth.js';
import { getPlayer, savePlayer, setAccount, delAccount, listSeasons, saveSeason, getPin, setPin } from '../db.js';
import { topbar } from '../ui.js';
import { getSelectedSeason } from '../season.js';

export default async function view([param]) {
  const isNew = param === 'nuovo';
  const p = isNew ? null : await getPlayer(param);
  if (!isNew && !p) return { html: html`${topbar('Giocatore', { back: '/gestione' })}<p class="muted">Giocatore non trovato.</p>` };
  const [seasons, pin] = await Promise.all([listSeasons(), isNew ? null : getPin(p.id)]);
  const season = seasons.length ? getSelectedSeason(seasons) : null;
  const isSelf = p?.id === session.account.playerId;

  return {
    html: html`
      ${topbar(isNew ? 'Nuovo giocatore' : 'Modifica giocatore', { back: '/gestione' })}
      <form id="f" class="form" novalidate>
        <div class="two">
          <label class="field">Nome<input name="nome" value="${p?.nome || ''}" maxlength="40" required></label>
          <label class="field">Cognome<input name="cognome" value="${p?.cognome || ''}" maxlength="40" required></label>
        </div>
        <label class="field">Numero tessera
          <input name="tessera" value="${p?.tessera || ''}" placeholder="08/4272" inputmode="numeric" maxlength="7" ${isNew ? '' : 'disabled'} required>
        </label>
        <label class="field">Ruolo
          <select name="ruolo" ${isSelf ? 'disabled' : ''}>
            <option value="player" ${p?.ruolo !== 'admin' ? 'selected' : ''}>Player (sola lettura)</option>
            <option value="admin" ${p?.ruolo === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </label>
        ${isNew ? html`
          <label class="field">PIN iniziale (4 cifre)
            <input name="pin" inputmode="numeric" maxlength="4" value="${randomPin()}" required>
          </label>
          ${season ? html`<label class="switch"><span class="grow">Aggiungi al roster di ${season.nome}</span>
            <input type="checkbox" name="roster" checked><span class="knob" aria-hidden="true"></span></label>` : ''}`
          : html`<label class="switch"><span class="grow">Attivo</span>
            <input type="checkbox" name="attivo" ${p.attivo !== false ? 'checked' : ''} ${isSelf ? 'disabled' : ''}><span class="knob" aria-hidden="true"></span></label>`}
        <p class="error" id="err" role="alert"></p>
        <button class="btn primary" id="save">${isNew ? 'Crea giocatore' : 'Salva'}</button>
      </form>

      ${isNew ? '' : html`
        <h2 class="section">PIN attuale</h2>
        <div class="card pinbox">
          ${pin ? html`
            <div class="row between">
              <b class="pinval" id="pinval" data-pin="${pin}" aria-live="polite">••••</b>
              <button type="button" class="btn small sec" id="pinshow">Mostra</button>
            </div>`
            : html`
            <p class="muted small">PIN non registrato. Se lo conosci, inseriscilo: l'app verifica che sia giusto e lo salva.</p>
            <form id="regpin" class="row" novalidate>
              <input class="pininput" name="pin" inputmode="numeric" maxlength="4" placeholder="0000" aria-label="PIN attuale">
              <button class="btn small primary">Registra</button>
            </form>
            <p class="error" id="regerr" role="alert"></p>`}
          <p class="muted small acct">Codice account: <span class="uid">${p.uid || 'non presente'}</span> · versione ${p.authVersion || 0}</p>
          ${p.uid ? html`<button type="button" class="btn small sec" id="repair">Ripristina collegamento account</button>` : ''}
        </div>
        <h2 class="section">Reset PIN</h2>
        <form id="reset" class="form" novalidate>
          <label class="field">Nuovo PIN (4 cifre)
            <input name="pin" inputmode="numeric" maxlength="4" value="${randomPin()}" required>
          </label>
          <p class="error" id="rerr" role="alert"></p>
          <button class="btn sec">Imposta nuovo PIN</button>
        </form>`}`,
    mount(root) {
      const f = $(root, '#f');
      const err = $(root, '#err');
      if (isNew) f.tessera.addEventListener('input', () => { f.tessera.value = formatTessera(f.tessera.value); });

      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = f.nome.value.trim();
        const cognome = f.cognome.value.trim();
        if (!nome || !cognome) { err.textContent = 'Nome e cognome sono obbligatori.'; return; }
        const btn = $(root, '#save');
        btn.disabled = true;
        try {
          if (isNew) await createPlayer(f, nome, cognome, season);
          else await updatePlayer(f, p, nome, cognome);
          toast('Giocatore salvato');
          go('/gestione');
        } catch (e2) {
          console.error(e2);
          err.textContent = e2.userMessage || (e2.code === 'auth/email-already-in-use'
            ? 'Questa tessera ha già un account. Se serve, usa il reset PIN dalla sua scheda.'
            : 'Salvataggio non riuscito.');
          btn.disabled = false;
        }
      });

      $(root, '#repair')?.addEventListener('click', async (e) => {
        if (!confirm('Ricreare il collegamento tra questo giocatore e il suo account di accesso?')) return;
        e.target.disabled = true;
        try {
          await setAccount(p.uid, { playerId: p.id, ruolo: p.ruolo });
          toast('Collegamento ripristinato: riprova ad accedere');
        } catch (err) { console.error(err); toast('Operazione non riuscita'); }
        e.target.disabled = false;
      });
      $(root, '#pinshow')?.addEventListener('click', (e) => {
        const v = $(root, '#pinval');
        const hidden = v.textContent === '••••';
        v.textContent = hidden ? v.dataset.pin : '••••';
        e.currentTarget.textContent = hidden ? 'Nascondi' : 'Mostra';
      });
      $(root, '#regpin')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const val = e.target.pin.value.trim();
        const rerr = $(root, '#regerr');
        if (!PIN_RE.test(val)) { rerr.textContent = 'Il PIN è di 4 cifre.'; return; }
        try {
          if (!(await verifyPin(p.tessera, p.authVersion || 0, val))) { rerr.textContent = 'Questo non è il PIN attuale.'; return; }
          await setPin(p.id, val);
          toast('PIN registrato');
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        } catch (e2) { console.error(e2); rerr.textContent = 'Salvataggio non riuscito. Controlla che le regole Firestore siano aggiornate.'; }
      });

      $(root, '#reset')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pin = e.target.pin.value.trim();
        const rerr = $(root, '#rerr');
        if (!PIN_RE.test(pin)) { rerr.textContent = 'Il PIN è di 4 cifre.'; return; }
        if (isSelf) { rerr.textContent = 'Per il tuo PIN usa "Cambia PIN" dal tuo profilo.'; return; }
        if (!confirm(`Impostare il nuovo PIN per ${p.nome} ${p.cognome}?`)) return;
        try {
          const version = (p.authVersion || 0) + 1;
          if (version >= MAX_VERSIONS) { rerr.textContent = 'Limite di reset raggiunto per questa tessera.'; return; }
          const uid = await createAccount(p.tessera, pin, version);
          await setAccount(uid, { playerId: p.id, ruolo: p.ruolo });
          await savePlayer(p.id, { uid, authVersion: version });
          if (p.uid) await delAccount(p.uid);
          await setPin(p.id, pin).catch((err) => console.warn('PIN non salvato', err));
          toast('PIN aggiornato');
          go('/gestione');
        } catch (e2) {
          console.error(e2);
          rerr.textContent = e2.code === 'auth/email-already-in-use'
            ? 'Reset già usato troppe volte per questa tessera.' : 'Reset non riuscito.';
        }
      });
    },
  };
}

async function createPlayer(f, nome, cognome, season) {
  const tessera = normalizeTessera(f.tessera.value);
  const pin = f.pin.value.trim();
  const fail = (msg) => Object.assign(new Error(msg), { userMessage: msg });
  if (!TESSERA_RE.test(tessera)) throw fail('Tessera non valida: usa il formato 08/4272.');
  if (!PIN_RE.test(pin)) throw fail('Il PIN è di 4 cifre.');
  const id = playerIdOf(tessera);
  if (await getPlayer(id)) throw fail('Esiste già un giocatore con questa tessera.');

  const ruolo = f.ruolo.value;
  const uid = await createAccount(tessera, pin, 0);
  await setAccount(uid, { playerId: id, ruolo });
  await savePlayer(id, { tessera, nome, cognome, ruolo, attivo: true, uid, authVersion: 0 });
  await setPin(id, pin).catch((err) => console.warn('PIN non salvato', err));
  if (season && f.roster?.checked && !season.playerIds?.includes(id)) {
    await saveSeason(season.id, { playerIds: [...(season.playerIds || []), id] });
  }
}

async function updatePlayer(f, p, nome, cognome) {
  const data = { nome, cognome };
  if (!f.ruolo.disabled) data.ruolo = f.ruolo.value;
  if (!f.attivo.disabled) data.attivo = f.attivo.checked;
  await savePlayer(p.id, data);
  if (data.ruolo && data.ruolo !== p.ruolo && p.uid) await setAccount(p.uid, { playerId: p.id, ruolo: data.ruolo });
}
