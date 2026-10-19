// Squadra: la sfida del sabato e la lista dei giocatori con Skill e pollice. Toccando un nome si vedono i suoi progressi.
import { html, fmtDate, todayIso, fullName, initials } from '../util.js';
import { session } from '../auth.js';
import { listPlayers, listTutteSessioni } from '../db.js';
import { gioco, skill, trendGiocatore, prossimoSabato, sfidaDel, classificaSfida, settimana } from './giochi.js';
import { barra, pollice } from './grafica.js';

const sabatoScorso = (oggi) => {
  const d = new Date(`${prossimoSabato(oggi)}T12:00:00`);
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
};

export default async function squadraView() {
  const me = session.account.playerId;
  const oggi = todayIso();
  const [players, tutte] = await Promise.all([listPlayers(), listTutteSessioni()]);
  const byId = new Map(players.map((p) => [p.id, p]));

  const sabato = prossimoSabato(oggi);
  const inCorso = sabato === oggi;
  const mostrato = inCorso ? sabato : sabatoScorso(oggi);
  const gMostrato = gioco(sfidaDel(mostrato));
  const gProssimo = gioco(sfidaDel(sabato));
  const classifica = classificaSfida(tutte, mostrato);

  const righe = players.map((p) => {
    const sue = tutte.filter((x) => x.playerId === p.id);
    return { p, sk: skill(sue), t: trendGiocatore(sue), n: sue.length, sett: settimana(sue, oggi) };
  }).filter((r) => r.n > 0 || r.p.id === me)
    .sort((a, b) => (b.sk ?? -1) - (a.sk ?? -1));

  return {
    html: html`
      ${barra('Squadra', { back: '/' })}
      <div class="page squadra">
        <section class="card sfidabox ${inCorso ? 'oggi' : ''}">
          <h2>Sfida del sabato · ${gProssimo.nome}${inCorso ? ' · oggi!' : ''}</h2>
          <p class="mu">${fmtDate(sabato, true)} · ${gProssimo.desc}. Conta il miglior risultato fatto quel giorno: puoi sfidare la squadra o solo te stesso.</p>
          ${inCorso ? html`<a class="btn pri" href="#/gioco/${gProssimo.id}">Gioca la sfida</a>` : ''}
          <h3>${inCorso ? 'Classifica di oggi' : `Sabato scorso · ${gMostrato.nome}`}</h3>
          ${classifica.length ? html`<ol class="classifica">${classifica.map((r, i) => html`<li class="${r.playerId === me ? 'me' : ''}">
            <span class="pos">${i + 1}</span><span>${byId.get(r.playerId) ? fullName(byId.get(r.playerId)) : 'Giocatore'}</span><b>${r.valore} ${gMostrato.unit}</b></li>`)}</ol>`
            : html`<p class="mu sm">Nessun risultato${inCorso ? ' per ora: inizia tu!' : '.'}</p>`}
        </section>
        <h2 class="sezione">Giocatori</h2>
        <div class="team">${righe.map((r) => html`<a class="card player ${r.p.id === me ? 'me' : ''}" href="#/progressi${r.p.id === me ? '' : `/${r.p.id}`}">
          <span class="av">${initials(r.p)}</span>
          <span><b>${fullName(r.p)}${r.p.id === me ? ' (tu)' : ''}</b><br><span class="mu sm">${r.n} ${r.n === 1 ? 'sessione' : 'sessioni'} · ${r.sett} questa settimana</span></span>
          <span class="sk">${r.sk ?? '–'}</span>${pollice(r.t, true)}</a>`)}</div>
      </div>`,
  };
}
