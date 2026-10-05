import { html, $, $$, icon, fullName } from '../util.js';
import { listPlayers, listCards, listMatches, listSeasons } from '../db.js';
import { ranking, fmtMedia } from '../stats.js';
import { topbar, avatar, emptyState } from '../ui.js';
import { getSelectedSeason } from '../season.js';

export default async function view() {
  const [seasons, players, cards, matches] = await Promise.all([
    listSeasons(),
    listPlayers(),
    listCards({}, { onlyPublished: true }),
    listMatches(null, { onlyPublished: true }),
  ]);
  if (!seasons.length) return { html: html`${topbar('Classifica')}${emptyState('Nessuna stagione', 'La classifica comparirà dopo le prime serate.')}` };
  const season = getSelectedSeason(seasons);
  let scope = 'stagione';

  const draw = (root) => {
    const inScope = (x) => scope === 'carriera' || x.seasonId === season.id;
    const pool = scope === 'carriera' ? players : players.filter((p) => season.playerIds?.includes(p.id));
    const rows = ranking(pool, matches.filter(inScope), cards.filter(inScope))
      .filter((r) => scope === 'stagione' || r.serate > 0);
    $(root, '#rows').innerHTML = rows.length
      ? rows.map((r, i) => html`
        <li><a class="card row rank" href="#/profilo/${r.player.id}">
          <span class="pos">${i + 1}</span>
          ${avatar(r.player)}
          <div class="grow"><strong>${fullName(r.player)}</strong>
            <span class="muted small">${r.serate} serate · ${r.vinte}/${r.giocate} vinte</span></div>
          <span class="mvpcount" title="MVP">${icon('star', 14)} ${r.mvp}</span>
          <b class="media">${fmtMedia(r.media)}</b>
        </a></li>`.s).join('')
      : '<li class="muted">Nessun dato ancora.</li>';
    $$(root, '.seg button').forEach((b) => b.classList.toggle('sel', b.dataset.s === scope));
  };

  return {
    html: html`
      ${topbar('Classifica')}
      <div class="seg" role="tablist">
        <button data-s="stagione" role="tab">${season.nome}</button>
        <button data-s="carriera" role="tab">Carriera</button>
      </div>
      <p class="muted small record">Ordinata per media voto, poi MVP. Contano solo le serate pubblicate.</p>
      <ul class="list" id="rows"></ul>`,
    mount(root) {
      draw(root);
      $(root, '.seg').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-s]');
        if (!b) return;
        scope = b.dataset.s;
        draw(root);
      });
    },
  };
}
