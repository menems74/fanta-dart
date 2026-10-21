import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codiceLed, comandoColpo, effettoTurno, EFFETTI } from '../js/training/led.js';
import { dardoDaTesto } from '../js/granboard-map.js';

const hex = (u) => [...u].map((b) => b.toString(16).padStart(2, '0')).join('');

test('codice dei led: i numeri visti nel traffico dell\'app ufficiale', () => {
  const visti = { 1: 0x1c, 5: 0x16, 12: 0x13, 9: 0x10, 18: 0x1f, 6: 0x28, 19: 0x3a, 3: 0x37, 20: 0x19 };
  for (const [n, v] of Object.entries(visti)) assert.equal(codiceLed(Number(n)), v, `numero ${n}`);
  const tutti = Array.from({ length: 20 }, (_, i) => codiceLed(i + 1));
  assert.equal(new Set(tutti).size, 20);
});

test('comandi dei colpi uguali a quelli dell\'app ufficiale', () => {
  assert.equal(hex(comandoColpo('S1o')), '017d00007d00000000001c0014000000');
  assert.equal(hex(comandoColpo('S20i')), '017d00007d0000000000190014000000');
  assert.equal(hex(comandoColpo('D3')), '027d00007d0000000000370014000000');
  assert.equal(hex(comandoColpo('T19')), '037d00007d00007d00003a0014000000');
  assert.equal(comandoColpo('X'), EFFETTI.fuori);
  assert.equal(comandoColpo('B50'), EFFETTI.bull);
  assert.equal(hex(comandoColpo('B25')), '187d00007d00007d0000000014000000');
  assert.equal(comandoColpo('S20o').length, 16);
});

test('effetti di fine turno: 180, tre tripli uguali, 100 o piu\'', () => {
  assert.equal(effettoTurno(['T20', 'T20', 'T20']), EFFETTI.max);
  assert.equal(effettoTurno(['T1', 'T1', 'T1']), EFFETTI.treTripli);
  assert.equal(effettoTurno(['T20', 'T19', 'T18']), EFFETTI.ton);
  assert.equal(effettoTurno(['B50', 'B50', 'S1o']), EFFETTI.ton);
  assert.equal(effettoTurno(['B25', 'B25', 'B50']), EFFETTI.treTripli); // visto nel log: tre bull, anche se fa 100
  assert.equal(effettoTurno(['B50', 'B50', 'B50']), EFFETTI.treTripli);
  assert.equal(effettoTurno(['S20o', 'S20i', 'S20o']), null);
  assert.equal(effettoTurno(['T20', 'T20']), null);
});

test('freccia fuori dal bersaglio: la tavola manda OUT@', () => {
  const d = dardoDaTesto('OUT@');
  assert.equal(d.id, 'X');
  assert.equal(d.valore, 0);
});

import { comandoNumeri } from '../js/training/led.js';
test('luce fissa sui numeri: uguale al Cricket dell\'app ufficiale', () => {
  assert.equal(hex(comandoNumeri([15, 16, 17, 18, 19, 20])), '0000000000000000000000000000040404040404');
  assert.equal(hex(comandoNumeri([15, 18, 20])), '0000000000000000000000000000040000040004');
  assert.equal(hex(comandoNumeri([1])), '0400000000000000000000000000000000000000');
  assert.equal(comandoNumeri([]).length, 20);
  assert.equal(hex(EFFETTI.lampeggio), '177d000000000000000000000b010000');
});
