// Home degli allenamenti: figurina con la Skill, menu (progressi, squadra, sfida) e griglia dei giochi.
import { html, fmtDate, todayIso } from '../util.js';
import { session } from '../auth.js';
import { listTutteSessioni } from '../db.js';
import { tavolaDisponibile, tavolaStato } from './tavola.js';
import {
  GIOCHI, gioco, varianteDi, votoGioco, skill, trendGioco, record, settimana, prossimoSabato, sfidaDel, classificaSfida, badgePresi, BADGES,
} from './giochi.js';
import { barra, pollice, linea, COLORE, nomeGiocatore } from './grafica.js';

export default async function homeView() {
  const pid = session.account.playerId;
  const tutte = await listTutteSessioni();
  const mie = tutte.filter((x) => x.playerId === pid);
  const oggi = todayIso();
  const sk = skill(mie);
  const sabato = prossimoSabato(oggi);
  const sfida = gioco(sfidaDel(sabato));
  const classifica = classificaSfida(tutte, sabato);
  const recSfida = record(mie, sfida.id);
  const collega = tavolaDisponibile() && tavolaStato() !== 'collegata';

  return {
    html: html`
      ${barra('Allenamenti', { home: true })}
      <div class="page home">
        <aside class="side">
          <section class="figurina">
            <div class="head"><div class="voto">${sk ?? '–'}</div>
              <div><p class="lbl">Skill giocatore</p><p class="nome">${nomeGiocatore()}</p></div></div>
            <div class="attr">${GIOCHI.map((g) => html`<div><span>${g.nome}</span><b>${votoGioco(mie, g.id) ?? '–'}</b></div>`)}</div>
          </section>
          <nav class="menu">
            <a href="#/progressi"><b>I miei progressi</b><span>${mie.length} ${mie.length === 1 ? 'sessione' : 'sessioni'} · ${settimana(mie, oggi)} questa settimana · ${badgePresi(mie).size}/${BADGES.length} badge</span></a>
            <a href="#/squadra"><b>Squadra</b><span>Skill e progressi di tutti</span></a>
            <a class="sfida ${sabato === oggi ? 'oggi' : ''}" href="${sabato === oggi ? `#/gioco/${sfida.id}` : '#/squadra'}">
              <b>Sfida del sabato · ${sfida.nomeSfida || sfida.nome}${sabato === oggi ? ' · oggi!' : ''}</b>
              <span>${fmtDate(sabato)}${recSfida != null ? ` · il tuo record ${recSfida}` : ''}${classifica.length ? ` · in testa con ${classifica[0].valore}` : ''}</span></a>
          </nav>
          <p class="firma">Powered by <b>Cleopatra</b></p>
        </aside>
        <section class="giochi">
          ${collega ? html`<div class="card collega"><div><b>Hai il Granboard?</b><p class="mu sm">Collegalo ora: resta attivo in tutti i giochi e segna le frecce da solo. Senza, inserisci a mano.</p></div>
            <button type="button" class="btn pri" data-act="tavola">Collega</button></div>` : ''}
          ${GIOCHI.map((g) => {
            const t = trendGioco(mie, g.id);
            const lista = mie.filter((x) => x.gioco === g.id);
            const ultima = lista.at(-1);
            const v = votoGioco(mie, g.id);
            return html`<a class="gioco" href="#/gioco/${g.id}">
              ${pollice(t)}
              <h3>${g.nome}</h3><p class="desc">${g.desc}</p>
              ${lista.length >= 2 ? linea(lista.slice(-10).map((x) => x.voto), { w: 200, h: 38, colore: COLORE[t], cls: 'spark' }) : html`<p class="mu sm">${lista.length ? '1 sessione' : 'Mai giocato'}</p>`}
              <div class="nums"><div><small>Record</small><b>${record(mie, g.id, ultima ? varianteDi(g, ultima.opzioni) : null) ?? '–'}</b></div>
                <div><small>Ultima</small><b>${ultima ? ultima.valore : '–'}</b></div>
                <div><small>Voto</small><b>${v ?? '–'}</b></div></div>
            </a>`;
          })}
        </section>
      </div>`,
  };
}
