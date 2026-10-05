import { html, $, fmtDate, icon, toast, initials, fullName, votoClass } from '../util.js';
import { session } from '../auth.js';
import { getMatch, getSeason, getPlayer, getCard } from '../db.js';
import { topbar, emptyState } from '../ui.js';
import { gamesOf } from '../stats.js';

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
      <article class="pcard ${isMvp ? 'gold' : ''}" id="card">
        <div class="pcard-head">
          <img src="assets/logo-320.png" width="34" height="34" alt="">
          <span class="muted grow">${season?.squadra || 'Fanta Dart'} · ${fmtDate(match.data)}</span>
          ${isMvp ? html`<span class="tag gold">${icon('star', 12)} MVP</span>` : ''}
        </div>
        <div class="pcard-main">
          <span class="avatar xl">${initials(player)}</span>
          <div class="grow">
            <h2>${fullName(player)}</h2>
            <p class="muted">vs ${match.avversario} · ${match.puntiNoi} – ${match.puntiLoro}</p>
          </div>
          <div class="bigvoto ${votoClass(card.voto)}"><b>${card.voto}</b><span>voto</span></div>
        </div>
        <div class="tricolore wide"></div>
        <p class="pcard-text">${card.testo || 'Nessun commento: per stavolta la prestazione parla da sola.'}</p>
        <p class="muted pcard-foot">
          Singoli <b>${g.sv}/${g.sg}</b> · Doppi <b>${g.dv}/${g.dg}</b> · Vinte <b>${g.vinte}/${g.giocate}</b>
        </p>
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
