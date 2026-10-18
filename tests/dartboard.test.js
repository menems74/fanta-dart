import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SETTORI, SEGMENTI, segmento, ordineTaratura, disegnoBersaglio } from '../js/dartboard.js';

test('il bersaglio ha 82 settori con id unici', () => {
  assert.equal(SETTORI.length, 20);
  assert.equal(new Set(SETTORI).size, 20);
  assert.equal(SEGMENTI.length, 82);
  assert.equal(new Set(SEGMENTI.map((s) => s.id)).size, 82);
});

test('valori dei settori: singolo, doppio, triplo e bull', () => {
  assert.equal(segmento('T20').valore, 60);
  assert.equal(segmento('D16').valore, 32);
  assert.equal(segmento('S19i').valore, 19);
  assert.equal(segmento('S19o').valore, 19);
  assert.equal(segmento('B25').valore, 25);
  assert.equal(segmento('B50').valore, 50);
  assert.equal(segmento('B50').moltiplicatore, 2); // il bull interno chiude come un doppio
  assert.equal(segmento('D20').moltiplicatore, 2);
  assert.equal(segmento('XX'), undefined);
});

test('ordine della taratura: tutti i settori una sola volta', () => {
  const o = ordineTaratura();
  assert.equal(o.length, 82);
  assert.equal(new Set(o).size, 82);
  assert.deepEqual(o.slice(0, 5), ['S20i', 'T20', 'S20o', 'D20', 'S1i']);
  assert.deepEqual(o.slice(-2), ['B25', 'B50']);
  assert.ok(o.every((id) => segmento(id)));
});

test('disegno SVG: un percorso per ogni settore, evidenziati corrente e fatti', () => {
  const svg = disegnoBersaglio({ done: new Set(['T20', 'D20']), current: 'S1i' });
  assert.equal((svg.match(/<path /g) || []).length, 82);
  assert.equal((svg.match(/ cur"/g) || []).length, 1);
  assert.equal((svg.match(/ done/g) || []).length, 2);
  assert.ok(!svg.includes('NaN'));
  assert.equal((svg.match(/<text /g) || []).length, 20);
});
