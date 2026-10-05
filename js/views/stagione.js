import { html, $, $$, toast, go, icon, fullName } from '../util.js';
import { listSeasons, listPlayers, getSeason, saveSeason } from '../db.js';
import { topbar, avatar } from '../ui.js';
import { setSelectedSeason } from '../season.js';

export default async function view([param]) {
  const isNew = param === 'nuova';
  const [seasons, players] = await Promise.all([listSeasons(), listPlayers()]);
  const season = isNew ? null : await getSeason(param);
  if (!isNew && !season) return { html: html`${topbar('Stagione', { back: '/gestione' })}<p class="muted">Stagione non trovata.</p>` };

  // Nuova stagione: il roster parte da quello dell'ultima, da confermare o modificare.
  const initial = new Set(season ? season.playerIds : seasons[0]?.playerIds ?? players.filter((p) => p.attivo !== false).map((p) => p.id));
  const shown = players.filter((p) => p.attivo !== false || initial.has(p.id));

  return {
    html: html`
      ${topbar(isNew ? 'Nuova stagione' : 'Modifica stagione', { back: '/gestione' })}
      <form id="f" class="form" novalidate>
        <label class="field">Nome stagione
          <input name="nome" value="${season?.nome || ''}" maxlength="30" placeholder="2026/27" required>
        </label>
        <label class="field">Nome squadra
          <input name="squadra" value="${season?.squadra || seasons[0]?.squadra || ''}" maxlength="50" placeholder="Dart Club" required>
        </label>
        <div class="row between">
          <span class="lbl">Roster · <b id="count">${initial.size}</b> su ${shown.length}</span>
          ${isNew && seasons[0] ? html`<span class="tag gold">Copiato da ${seasons[0].nome}</span>` : ''}
        </div>
        <ul class="list checks">
          ${shown.map((p) => html`
            <li><label class="card row check">
              <input type="checkbox" name="p" value="${p.id}" ${initial.has(p.id) ? 'checked' : ''}>
              <span class="box" aria-hidden="true">${icon('check', 16)}</span>
              ${avatar(p)}
              <span class="grow">${fullName(p)}</span>
            </label></li>`)}
        </ul>
        <a class="btn sec" href="#/giocatore/nuovo">${icon('plus', 18)} Nuovo giocatore</a>
        <p class="error" id="err" role="alert"></p>
        <button class="btn primary">${isNew ? 'Crea stagione' : 'Salva'}</button>
      </form>`,
    mount(root) {
      const f = $(root, '#f');
      const count = () => { $(root, '#count').textContent = $$(root, 'input[name=p]:checked').length; };
      f.addEventListener('change', count);
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = $(root, '#err');
        const nome = f.nome.value.trim();
        const squadra = f.squadra.value.trim();
        const playerIds = $$(root, 'input[name=p]:checked').map((i) => i.value);
        if (!nome || !squadra) { err.textContent = 'Nome stagione e nome squadra sono obbligatori.'; return; }
        if (!playerIds.length) { err.textContent = 'Seleziona almeno un giocatore nel roster.'; return; }
        const btn = $(root, '.btn.primary');
        btn.disabled = true;
        try {
          const id = await saveSeason(season?.id, { nome, squadra, playerIds });
          if (isNew) setSelectedSeason(id);
          toast('Stagione salvata');
          go('/gestione');
        } catch (e2) { console.error(e2); err.textContent = 'Salvataggio non riuscito.'; btn.disabled = false; }
      });
    },
  };
}
