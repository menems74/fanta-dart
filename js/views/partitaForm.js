import { html, $, toast, go, todayIso } from '../util.js';
import { getMatch, listSeasons, saveMatch } from '../db.js';
import { topbar } from '../ui.js';
import { getSelectedSeason } from '../season.js';

export default async function view([id]) {
  const seasons = await listSeasons();
  const m = id ? await getMatch(id) : null;
  if (id && !m) return { html: html`${topbar('Partita', { back: '/partite' })}<p class="muted">Partita non trovata.</p>` };
  if (!seasons.length) return { html: html`${topbar('Nuova partita', { back: '/partite' })}<p class="muted">Crea prima una stagione.</p>` };

  const seasonId = m?.seasonId || getSelectedSeason(seasons).id;
  const back = id ? `/partita/${id}` : '/partite';

  return {
    html: html`
      ${topbar(id ? 'Modifica partita' : 'Nuova partita', { back })}
      <form id="f" class="form" novalidate>
        <label class="field">Stagione
          <select name="seasonId">
            ${seasons.map((s) => html`<option value="${s.id}" ${s.id === seasonId ? 'selected' : ''}>${s.nome} · ${s.squadra}</option>`)}
          </select>
        </label>
        <label class="field">Data
          <input type="date" name="data" value="${m?.data || todayIso()}" required>
        </label>
        <label class="field">Squadra avversaria
          <input name="avversario" value="${m?.avversario || ''}" maxlength="60" placeholder="Tripla 20" required>
        </label>
        <label class="field">Luogo
          <input name="luogo" value="${m?.luogo || ''}" maxlength="80" placeholder="Pub Il Bersaglio">
        </label>
        <div class="two">
          <label class="field">Punti nostri
            <input type="number" name="puntiNoi" min="0" max="99" inputmode="numeric" value="${m?.puntiNoi ?? 0}" required>
          </label>
          <label class="field">Punti loro
            <input type="number" name="puntiLoro" min="0" max="99" inputmode="numeric" value="${m?.puntiLoro ?? 0}" required>
          </label>
        </div>
        <p class="error" id="err" role="alert"></p>
        <button class="btn primary">Salva</button>
      </form>`,
    mount(root) {
      const f = $(root, '#f');
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = $(root, '#err');
        const data = {
          seasonId: f.seasonId.value,
          data: f.data.value,
          avversario: f.avversario.value.trim(),
          luogo: f.luogo.value.trim(),
          puntiNoi: parseInt(f.puntiNoi.value, 10),
          puntiLoro: parseInt(f.puntiLoro.value, 10),
        };
        if (!data.data || !data.avversario) { err.textContent = 'Data e squadra avversaria sono obbligatorie.'; return; }
        if (!Number.isInteger(data.puntiNoi) || !Number.isInteger(data.puntiLoro) || data.puntiNoi < 0 || data.puntiLoro < 0) {
          err.textContent = 'I punti devono essere numeri interi.'; return;
        }
        const btn = $(root, '.btn.primary');
        btn.disabled = true;
        try {
          const newId = await saveMatch(id, data);
          toast('Partita salvata');
          go(`/partita/${newId}`);
        } catch (e2) { console.error(e2); err.textContent = 'Salvataggio non riuscito.'; btn.disabled = false; }
      });
    },
  };
}
