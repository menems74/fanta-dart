import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TABELLA, dardoDaTesto } from '../js/granboard-map.js';
import { elaboraTurno } from '../js/training/scorer.js';

test('mappa Granboard: 82 codici verso 82 settori diversi', () => {
  assert.equal(Object.keys(TABELLA).length, 82);
  assert.equal(new Set(Object.values(TABELLA)).size, 82);
  assert.equal(TABELLA['3.4'], 'T20');
  assert.equal(TABELLA['11.6'], 'D16');
  assert.equal(TABELLA['8.0'], 'B25');
  assert.equal(TABELLA['4.0'], 'B50');
  assert.equal(dardoDaTesto('3.4@').valore, 60);
  assert.equal(dardoDaTesto('GB8;102'), null);
});

const d = (v, m = 1) => ({ v, m });
test('turno: continua, finisce a tre frecce, sballo e chiusura in doppia', () => {
  assert.deepEqual(elaboraTurno(501, [d(20)]), { fine: false, resto: 481 });
  assert.deepEqual(elaboraTurno(501, [d(60, 3), d(60, 3), d(60, 3)]), { fine: true, esito: 'ok', s: 180, d: 3, resto: 321 });
  assert.deepEqual(elaboraTurno(40, [d(40, 2)]), { fine: true, esito: 'chiuso', s: 40, d: 1, resto: 0 });
  assert.deepEqual(elaboraTurno(40, [d(20), d(20)]), { fine: true, esito: 'sballo', s: 0, d: 3, resto: 40 });
  assert.equal(elaboraTurno(40, [d(39)]).esito, 'sballo'); // resta 1
  assert.equal(elaboraTurno(32, [d(40)]).esito, 'sballo'); // supera
  assert.equal(elaboraTurno(50, [d(50, 2)]).esito, 'chiuso'); // bull interno
  assert.equal(elaboraTurno(40, [d(10), d(30)]).esito, 'sballo'); // 0 senza doppia
});
