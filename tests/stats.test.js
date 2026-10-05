import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esito, recordStagione, playerStats, ranking, fmtMedia, fmtPerc, suggestedScore } from '../js/stats.js';

const m = (id, noi, loro, mvp = null) => ({ id, puntiNoi: noi, puntiLoro: loro, mvpPlayerId: mvp });
// c(matchId, playerId, voto, singoli vinti/giocati, doppi vinti/giocati)
const c = (matchId, playerId, voto, sv = 0, dv = 0, sg = 4, dg = 2) =>
  ({ matchId, playerId, voto, singoliVinti: sv, singoliGiocati: sg, doppiVinti: dv, doppiGiocati: dg });
const P = (id, cognome) => ({ id, nome: 'X', cognome });

test('esito della partita', () => {
  assert.equal(esito(m('a', 6, 4)).key, 'w');
  assert.equal(esito(m('a', 3, 7)).key, 'l');
  assert.equal(esito(m('a', 5, 5)).key, 'd');
});

test('record di stagione', () => {
  assert.deepEqual(recordStagione([m('1', 6, 4), m('2', 1, 9), m('3', 5, 5), m('4', 7, 0)]), { w: 2, l: 1, d: 1 });
});

test('statistiche giocatore: esempio 3/4 singoli e 1/2 doppi', () => {
  const matches = [m('1', 6, 4, 'p1'), m('2', 3, 7, 'p2'), m('3', 5, 5, 'p1')];
  const cards = [c('1', 'p1', 9, 3, 1), c('2', 'p1', 6, 1, 0), c('3', 'p1', 6, 2, 2), c('1', 'p2', 4)];
  const s = playerStats('p1', matches, cards);
  assert.equal(s.serate, 3);
  assert.equal(s.media, 7);
  assert.equal(s.vinte, 4 + 1 + 4);
  assert.equal(s.giocate, 18);
  assert.equal(s.sv, 6);
  assert.equal(s.dv, 3);
  assert.equal(s.mvp, 2);
});

test('con cambio in squadra: meno partite giocate', () => {
  const cards = [c('1', 'p1', 7, 1, 1, 2, 1)];
  const s = playerStats('p1', [], cards);
  assert.equal(s.giocate, 3);
  assert.equal(s.vinte, 2);
  assert.equal(fmtPerc(s.vinte, s.giocate), '67%');
});

test('giocatore senza pagellini: media nulla', () => {
  const s = playerStats('zz', [], []);
  assert.equal(s.media, null);
  assert.equal(fmtMedia(s.media), '—');
  assert.equal(fmtPerc(0, 0), '—');
});

test('classifica: media, poi MVP, poi chi non ha giocato in fondo', () => {
  const players = [P('a', 'Verdi'), P('b', 'Rossi'), P('c', 'Bianchi')];
  const matches = [m('1', 6, 4, 'b')];
  const cards = [c('1', 'a', 8), c('1', 'b', 8)];
  const r = ranking(players, matches, cards).map((x) => x.player.id);
  assert.deepEqual(r, ['b', 'a', 'c']);
});

test('formato media con la virgola', () => {
  assert.equal(fmtMedia(7.5), '7,5');
  assert.equal(fmtMedia(8), '8,0');
});

test('punteggio suggerito: i doppi contano una volta sola', () => {
  // 4 giocatori: singoli vinti 3+2+1+2 = 8 su 16; doppi vinti 1+1+0+0 = 2 su 8 (4 doppi): totale 20 partite
  const cards = [c('1', 'a', 8, 3, 1), c('1', 'b', 7, 2, 1), c('1', 'c', 6, 1, 0), c('1', 'd', 6, 2, 0)];
  assert.deepEqual(suggestedScore(cards), { noi: 9, loro: 11 });
});

test('punteggio suggerito: avvisa se i doppi non quadrano', () => {
  const cards = [c('1', 'a', 8, 3, 1), c('1', 'b', 7, 2, 0)];
  assert.ok(suggestedScore(cards).warn);
});

test('punteggio suggerito: avvisa se le partite non sono 20', () => {
  // un solo giocatore: 4 singoli + 1 doppio = 5 partite su 20 (doppi pari ma non completi)
  const r = suggestedScore([c('1', 'a', 8, 3, 2), c('1', 'b', 7, 1, 0)]);
  assert.match(r.warn, /su 20/);
});

test('punteggio suggerito: con un cambio il totale resta 20', () => {
  // d gioca solo 2 singoli e 1 doppio, un sostituto e gioca gli altri 2 singoli e 1 doppio
  const cards = [c('1', 'a', 8, 3, 1), c('1', 'b', 7, 2, 1), c('1', 'c', 6, 1, 0), c('1', 'd', 6, 1, 1, 2, 1), c('1', 'e', 6, 1, 1, 2, 1)];
  assert.ok(!suggestedScore(cards).warn);
});
