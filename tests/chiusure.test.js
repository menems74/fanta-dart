import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TABELLE, chiusura, suggerimento, puntiEtichetta, etichettaId } from '../js/training/chiusure.js';
import { chiudibileIn } from '../js/training/scorer.js';

const finale = (e) => e === 'Bull' || /^D\d+$/.test(e);
const somma = (s) => s.reduce((t, e) => t + puntiEtichetta(e), 0);

for (const [nome, t, max] of [['TRE', TABELLE.TRE, 3], ['DUE', TABELLE.DUE, 2], ['IN_MANO', TABELLE.IN_MANO, 3]]) {
  test(`tabella ${nome}: ogni strada fa il punteggio e chiude in doppia`, () => {
    for (const [r, s] of Object.entries(t)) {
      assert.equal(somma(s), Number(r), `${nome} ${r}: ${s.join(' ')}`);
      assert.ok(finale(s.at(-1)), `${nome} ${r} non chiude in doppia`);
      assert.ok(s.length <= max, `${nome} ${r} troppe frecce`);
    }
  });
}

test('con 3 frecce: c\'e\' una strada per ogni punteggio chiudibile da 2 a 170', () => {
  for (let r = 2; r <= 170; r++) {
    const s = chiusura(r, 3);
    assert.equal(!!s, chiudibileIn(r, 3), `resto ${r}`);
  }
});

test('con 2 e 1 freccia: strada solo se chiudibile', () => {
  for (let r = 2; r <= 170; r++) {
    assert.equal(!!chiusura(r, 2), chiudibileIn(r, 2), `2 frecce, resto ${r}`);
    assert.equal(!!chiusura(r, 1), chiudibileIn(r, 1), `1 freccia, resto ${r}`);
    for (const n of [1, 2]) { const s = chiusura(r, n); if (s) { assert.equal(somma(s), r); assert.ok(s.length <= n); } }
  }
});

test('esempi', () => {
  assert.deepEqual(chiusura(170), ['T20', 'T20', 'Bull']);
  assert.deepEqual(chiusura(121), ['T20', 'T11', 'D14']);
  assert.deepEqual(chiusura(71), ['T13', 'D16']);
  assert.deepEqual(chiusura(95, 3), ['Bull', '13', 'D16']);
  assert.deepEqual(chiusura(95, 2), ['T19', 'D19']);
  assert.equal(chiusura(169), null);
  assert.equal(chiusura(1), null);
  assert.equal(chiusura(99, 2), null);
});

test('etichette delle frecce', () => {
  assert.equal(etichettaId('T20'), 'T20');
  assert.equal(etichettaId('S7i'), '7');
  assert.equal(etichettaId('S7o'), '7');
  assert.equal(etichettaId('B50'), 'Bull');
  assert.equal(etichettaId('B25'), '25');
  assert.equal(etichettaId('X'), null);
});

test('suggerimento durante il turno', () => {
  assert.deepEqual(suggerimento(121, []), { strada: ['T20', 'T11', 'D14'], fatte: 0, frecce: 3 });
  // segue la strada: T20 barrata, ora il T11
  assert.deepEqual(suggerimento(121, ['T20']), { strada: ['T20', 'T11', 'D14'], fatte: 1, frecce: 2 });
  // prende il 20 singolo: 101 con 2 frecce -> T17 Bull
  assert.deepEqual(suggerimento(121, ['S20o']), { strada: ['T17', 'Bull'], fatte: 0, frecce: 2 });
  // freccia fuori: 121 con 2 frecce non si chiude
  assert.equal(suggerimento(121, ['X']), null);
  assert.equal(suggerimento(40, ['S20i', 'X', 'X']), null);
  assert.deepEqual(suggerimento(40, ['S20i', 'X']), { strada: ['D10'], fatte: 0, frecce: 1 });
});
