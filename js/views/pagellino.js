import { html, $, fmtDate, icon, toast, initials, fullName, votoClass } from '../util.js';
import { session } from '../auth.js';
import { getMatch, getSeason, getPlayer, getCard } from '../db.js';
import { topbar, emptyState } from '../ui.js';
import { gamesOf, hasResult, scoreText } from '../stats.js';

const HTML_TO_IMAGE = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/+esm';

export default async function view([matchId, playerId]) {
  const back = `/partita/${matchId}`;
  const [match, player, card] = await Promise.all([getMatch(matchId), getPlayer(playerId), getCard(matchId, playerId)]);
  if (!match || !player || !card || (!card.pubblicata && !session.isAdmin)) {
    return { html: html`${topbar('Pagellino', { back })}${emptyState('Pagellino non trovato', 'Potrebbe non essere ancora pubblicato.')}` };
  }
  const season = await getSeason(match.seasonId);
  const isMvp = match.mvpPlayerId === playerId;
  const g = gamesOf(card);

  return {
    html: html`
      ${topbar('Pagellino', {
        back,
        right: session.isAdmin ? html`<a class="iconbtn" href="#/pagellino/${matchId}/${playerId}/modifica" aria-label="Modifica pagellino">${icon('edit')}</a>` : '',
      })}
      ${card.pubblicata ? '' : html`<p class="notice">Bozza: i giocatori non lo vedono ancora.</p>`}
      <article class="fig ${isMvp ? 'gold' : ''}" id="card">
        <div class="fig-top">
          <img src="assets/logo-320.png" width="38" height="38" alt="">
          <div class="grow"><b>${season?.squadra || 'Fanta Dart'}</b><span>${fmtDate(match.data)}</span></div>
          ${isMvp ? html`<span class="fig-mvp">${icon('star', 13)} MVP</span>` : ''}
        </div>
        <div class="fig-hero">
          <span class="fig-avatar">${initials(player)}</span>
          <div class="fig-voto ${votoClass(card.voto)}"><b>${card.voto}</b><span>voto</span></div>
        </div>
        <h2 class="fig-name">${fullName(player)}</h2>
        <p class="fig-match">vs ${match.avversario}${hasResult(match) ? ` · ${scoreText(match)}` : ''}</p>
        <div class="tricolore wide"></div>
        <p class="fig-text">${card.testo || 'Nessun commento: per stavolta la prestazione parla da sola.'}</p>
        <div class="fig-stats">
          <div><b>${g.sv}/${g.sg}</b><span>Singoli</span></div>
          <div><b>${g.dv}/${g.dg}</b><span>Doppio</span></div>
          <div><b>${g.vinte}/${g.giocate}</b><span>Vinte</span></div>
        </div>
        <p class="fig-foot">FANTA DART</p>
      </article>
      <div class="actions">
        <button class="btn primary" id="share">${icon('share', 18)} Condividi su WhatsApp</button>
        <button class="btn sec" id="save">${icon('download', 18)} Salva immagine</button>
      </div>`,
    mount(root) {
      const fileName = `pagellino-${player.cognome}-${match.data}.png`.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');

      async function makeBlob(btn) {
        btn.disabled = true;
        try {
          const { toBlob } = await import(HTML_TO_IMAGE);
          const blob = await toBlob($(root, '#card'), { pixelRatio: 2, backgroundColor: '#07142b', cacheBust: true });
          if (!blob) throw new Error('blob vuoto');
          return blob;
        } catch (e) {
          console.error(e);
          toast('Impossibile creare l\'immagine (serve la connessione)');
          return null;
        } finally { btn.disabled = false; }
      }
      function download(blob) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }

      $(root, '#save').addEventListener('click', async (e) => {
        const blob = await makeBlob(e.currentTarget);
        if (blob) download(blob);
      });
      $(root, '#share').addEventListener('click', async (e) => {
        const blob = await makeBlob(e.currentTarget);
        if (!blob) return;
        const file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          try { await navigator.share({ files: [file], title: 'Pagellino Fanta Dart' }); }
          catch (err) { if (err.name !== 'AbortError') { console.error(err); download(blob); } }
        } else {
          download(blob);
          toast('Immagine salvata: allegala in WhatsApp');
        }
      });
    },
  };
}
