import { html, $, toast, go, randomPin } from '../util.js';
import { session, createAccount, normalizeTessera, playerIdOf, TESSERA_RE, PIN_RE, MAX_VERSIONS } from '../auth.js';
import { getPlayer, savePlayer, setAccount, delAccount, listSeasons, saveSeason } from '../db.js';
import { topbar } from '../ui.js';
import { getSelectedSeason } from '../season.js';

export default async function view([param]) {
  const isNew = param === 'nuovo';
  const p = isNew ? null : await getPlayer(param);
  if (!isNew && !p) return { html: html`${topbar('Giocatore', { back: '/gestione' })}<p class="muted">Giocatore non trovato.</p>` };
  const seasons = await listSeasons();
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
          <input name="tessera" value="${p?.tessera || ''}" placeholder="08/4272" inputmode="numeric" ${isNew ? '' : 'disabled'} required>
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
