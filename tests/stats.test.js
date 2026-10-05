import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esito, recordStagione, playerStats, ranking, fmtMedia } from '../js/stats.js';

const m = (id, noi, loro, mvp = null) => ({ id, puntiNoi: noi, puntiLoro: loro, mvpPlayerId: mvp });
const c = (matchId, playerId, voto, partiteVinte = 0) => ({ matchId, playerId, voto, partiteVinte });
const P = (id, cognome) => ({ id, nome: 'X', cognome });

test('esito della partita', () => {
  assert.equal(esito(m('a', 6, 4)).key, 'w');
  assert.equal(esito(m('a', 3, 7)).key, 'l');
  assert.equal(esito(m('a', 5, 5)).key, 'd');
});

test('record di stagione', () => {
  assert.deepEqual(recordStagione([m('1', 6, 4), m('2', 1, 9), m('3', 5, 5), m('4', 7, 0)]), { w: 2, l: 1, d: 1 });
});

test('statistiche giocatore: media, vinte, MVP', () => {
  const matches = [m('1', 6, 4, 'p1'), m('2', 3, 7, 'p2'), m('3', 5, 5, 'p1')];
  const cards = [c('1', 'p1', 9, 3), c('2', 'p1', 6, 1), c('3', 'p1', 6, 2), c('1', 'p2', 4)];
  const s = playerStats('p1', matches, cards);
  assert.equal(s.partite, 3);
  assert.equal(s.media, 7);
  assert.equal(s.vinte, 6);
  assert.equal(s.mvp, 2);
});

test('giocatore senza pagellini: media nulla', () => {
  const s = playerStats('zz', [], []);
  assert.equal(s.media, null);
  assert.equal(fmtMedia(s.media), '—');
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
