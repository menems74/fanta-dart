// Sfida del sabato: chi la sta giocando, quante partite ha fatto e il suo miglior risultato.
// La classifica si vede nella pagina Squadra e, il sabato, anche dentro al gioco della sfida.
import { html, todayIso, fullName } from '../util.js';
import { listTutteSessioni, listPlayers } from '../db.js';
import { gioco, prossimoSabato, sfidaDel, classificaSfida, valeSfida } from './giochi.js';

const nome = (byId, playerId) => (byId.get(playerId) ? fullName(byId.get(playerId)) : 'Giocatore');
const partite = (n) => `${n} ${n === 1 ? 'partita' : 'partite'}`;

/** Giocatori e partite totali della classifica: "4 giocatori · 9 partite". */
export const riepilogoSfida = (cl) => {
  const n = cl.reduce((t, r) => t + r.partite, 0);
  return `${cl.length} ${cl.length === 1 ? 'giocatore' : 'giocatori'} · ${partite(n)}`;
};

/**
 * Righe della classifica: posizione, nome con le partite fatte e miglior risultato.
 * max: quante righe al massimo; se il giocatore e' piu' giu' si aggiunge comunque la sua.
 */
export function righeSfida(cl, g, me, byId, { max = Infinity } = {}) {
  const viste = cl.map((r, i) => ({ ...r, pos: i + 1 })).filter((r, i) => i < max || r.playerId === me);
  return html`<ol class="classifica">${viste.map((r) => html`<li class="${r.playerId === me ? 'me' : ''}">
    <span class="pos">${r.valore == null ? '–' : r.pos}</span>
    <span class="cn">${nome(byId, r.playerId)}${r.playerId === me ? ' (tu)' : ''}<small>${partite(r.partite)}</small></span>
    <b>${r.valore == null ? 'non chiusa' : `${r.valore} ${g.unit}`}</b></li>`)}</ol>`;
}

/** Il sabato della sfida, se oggi e' sabato e la sfida e' proprio questo gioco; altrimenti null. */
export function sfidaOggi(id) {
  const oggi = todayIso();
  return prossimoSabato(oggi) === oggi && sfidaDel(oggi) === id ? oggi : null;
}

/** Dati per la classifica dentro al gioco (solo il sabato, nel gioco della sfida). Senza rete: null. */
export async function caricaSfida(id, players = null) {
  const sabato = sfidaOggi(id);
  if (!sabato) return null;
  try {
    const [tutte, pl] = await Promise.all([listTutteSessioni(), players ? Promise.resolve(players) : listPlayers()]);
    return { sabato, g: gioco(id), tutte, byId: new Map(pl.map((p) => [p.id, p])) };
  } catch (e) {
    console.error(e);
    return null;
  }
}

/** Riquadro compatto nel pannello di gioco: riepilogo e i primi 3 (piu' la tua riga). */
export function boxSfida(sf, me, opzioni = {}) {
  if (!sf) return '';
  if (!valeSfida(sf.g, opzioni)) {
    return html`<section class="sfidagioco"><b>Sfida del sabato</b>
      <p class="mu sm">Questa partita non conta: la sfida è ${sf.g.nomeSfida || sf.g.nome}.</p></section>`;
  }
  const cl = classificaSfida(sf.tutte, sf.sabato);
  return html`<section class="sfidagioco"><header><b>Sfida del sabato</b><span class="mu sm">${cl.length ? riepilogoSfida(cl) : 'nessuno ancora'}</span></header>
    ${cl.length ? righeSfida(cl, sf.g, me, sf.byId, { max: 3 }) : html`<p class="mu sm">Sei il primo: chiudi una partita e sei in testa.</p>`}</section>`;
}

/** A fine partita: aggiunge le sessioni appena giocate e dice la tua posizione. */
export function esitoSfida(sf, me, nuove) {
  if (!sf) return '';
  sf.tutte.push(...nuove);
  if (!nuove.some((x) => x.playerId === me && valeSfida(sf.g, x.opzioni))) return '';
  const cl = classificaSfida(sf.tutte, sf.sabato);
  const i = cl.findIndex((r) => r.playerId === me);
  const mio = cl[i];
  const testa = cl[0];
  const pos = mio.valore == null ? 'nessuna partita chiusa per ora'
    : i === 0 ? `sei in testa con ${mio.valore} ${sf.g.unit}`
      : `sei ${i + 1}° su ${cl.length} · in testa ${nome(sf.byId, testa.playerId)} con ${testa.valore} ${sf.g.unit}`;
  return html`<p class="sfidaesito">Sfida del sabato: ${pos} · ${partite(mio.partite)} oggi</p>`;
}
