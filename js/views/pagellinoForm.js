import { html, $, $$, toast, go, icon, fullName } from '../util.js';
import { getMatch, getPlayer, getCard, saveCard, deleteCard, setMvp } from '../db.js';
import { topbar, emptyState } from '../ui.js';
import { MAX_SINGOLI, MAX_DOPPI } from '../stats.js';

const stepper = (key, label, value) => html`
  <div class="stepper-row">
    <span>${label}</span>
    <div class="stepper">
      <button type="button" data-k="${key}" data-d="-1" aria-label="${label}: meno">${icon('minus')}</button>
      <b id="v-${key}" aria-live="polite">${value}</b>
      <button type="button" data-k="${key}" data-d="1" aria-label="${label}: più">${icon('plus')}</button>
    </div>
  </div>`;

export default async function view([matchId, playerId]) {
  const back = `/partita/${matchId}`;
  const [match, player, card] = await Promise.all([getMatch(matchId), getPlayer(playerId), getCard(matchId, playerId)]);
  if (!match || !player) return { html: html`${topbar('Pagellino', { back })}${emptyState('Dati non trovati', 'Torna indietro e riprova.')}` };
  const otherMvp = match.mvpPlayerId && match.mvpPlayerId !== playerId ? await getPlayer(match.mvpPlayerId) : null;

  let voto = card?.voto ?? null;
  const v = {
    singoliGiocati: card?.singoliGiocati ?? MAX_SINGOLI,
    singoliVinti: card?.singoliVinti ?? 0,
    doppiGiocati: card?.doppiGiocati ?? MAX_DOPPI,
    doppiVinti: card?.doppiVinti ?? 0,
  };

  return {
    html: html`
      ${topbar(fullName(player), { back: card ? `/pagellino/${matchId}/${playerId}` : back })}
      <p class="muted small">vs ${match.avversario} · ${match.puntiNoi} – ${match.puntiLoro}</p>
      <form id="f" class="form" novalidate>
        <div class="field">Voto
          <div class="chips" id="chips" role="radiogroup" aria-label="Voto">
            ${Array.from({ length: 10 }, (_, i) => i + 1).map((n) =>
              html`<button type="button" role="radio" data-v="${n}" aria-checked="${n === voto}" class="${n === voto ? 'sel' : ''}">${n}</button>`)}
          </div>
        </div>
        <div class="field">Singoli (massimo ${MAX_SINGOLI})
          <div class="card steppers">
            ${stepper('singoliGiocati', 'Giocati', v.singoliGiocati)}
            ${stepper('singoliVinti', 'Vinti', v.singoliVinti)}
          </div>
        </div>
        <div class="field">Doppi (massimo ${MAX_DOPPI})
          <div class="card steppers">
            ${stepper('doppiGiocati', 'Giocati', v.doppiGiocati)}
            ${stepper('doppiVinti', 'Vinti', v.doppiVinti)}
          </div>
          <small class="muted">Un doppio vinto vale una partita per ciascun compagno.</small>
        </div>
        <label class="field">Commento
          <textarea name="testo" rows="5" maxlength="600" placeholder="Come è andata stasera?">${card?.testo || ''}</textarea>
        </label>
        <label class="switch">
          <span class="grow">${icon('star', 18)} MVP della serata
            ${otherMvp ? html`<small class="muted block">Oggi è assegnato a ${fullName(otherMvp)}: attivandolo lo sostituisci.</small>` : ''}
          </span>
          <input type="checkbox" name="mvp" ${match.mvpPlayerId === playerId ? 'checked' : ''}>
          <span class="knob" aria-hidden="true"></span>
        </label>
        <p class="error" id="err" role="alert"></p>
        <button class="btn primary" id="save">Salva pagellino</button>
        ${card ? html`<button type="button" class="btn danger" id="del">${icon('trash', 18)} Elimina pagellino</button>` : ''}
      </form>`,
    mount(root) {
      const err = $(root, '#err');
      const show = () => Object.entries(v).forEach(([k, val]) => { $(root, `#v-${k}`).textContent = val; });

      $(root, '#chips').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-v]');
        if (!b) return;
        voto = parseInt(b.dataset.v, 10);
        $$(root, '#chips button').forEach((x) => {
          const on = x === b;
          x.classList.toggle('sel', on);
          x.setAttribute('aria-checked', on);
        });
      });

      // Le vittorie non possono superare le partite giocate; i giocati non superano il massimo.
      $(root, '#f').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-k]');
        if (!b) return;
        const k = b.dataset.k;
        const d = parseInt(b.dataset.d, 10);
        const single = k.startsWith('singoli');
        const max = single ? MAX_SINGOLI : MAX_DOPPI;
        const playedKey = single ? 'singoliGiocati' : 'doppiGiocati';
        const wonKey = single ? 'singoliVinti' : 'doppiVinti';
        if (k === playedKey) {
          v[k] = Math.max(0, Math.min(max, v[k] + d));
          v[wonKey] = Math.min(v[wonKey], v[playedKey]);
        } else {
          v[k] = Math.max(0, Math.min(v[playedKey], v[k] + d));
        }
        show();
      });

      $(root, '#f').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!voto) { err.textContent = 'Scegli un voto da 1 a 10.'; return; }
        const f = e.target;
        const btn = $(root, '#save');
        btn.disabled = true;
        try {
          await saveCard({
            matchId, playerId, seasonId: match.seasonId,
            voto, ...v, testo: f.testo.value.trim(),
            pubblicata: !!match.pubblicata,
          });
          const wantsMvp = f.mvp.checked;
          if (wantsMvp && match.mvpPlayerId !== playerId) await setMvp(matchId, playerId);
          if (!wantsMvp && match.mvpPlayerId === playerId) await setMvp(matchId, null);
          toast('Pagellino salvato');
          go(back);
        } catch (e2) { console.error(e2); err.textContent = 'Salvataggio non riuscito.'; btn.disabled = false; }
      });

      $(root, '#del')?.addEventListener('click', async () => {
        if (!confirm('Eliminare questo pagellino?')) return;
        try {
          await deleteCard(matchId, playerId);
          if (match.mvpPlayerId === playerId) await setMvp(matchId, null);
          toast('Pagellino eliminato');
          go(back);
        } catch (e2) { console.error(e2); toast('Eliminazione non riuscita'); }
      });
    },
  };
}
