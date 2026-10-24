import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { analizzaPdf } from '../js/campionato-pdf.js';
import { nostraSquadra, ordina, giornateGiocate } from '../js/campionato.js';

const pdf = new Uint8Array(readFileSync(new URL('./dati/as4-esempio.pdf', import.meta.url)));
const squadre = analizzaPdf(pdf, (b) => inflateSync(b));

test('PDF del campionato: squadre e giocatori', () => {
  assert.equal(squadre.length, 6);
  assert.deepEqual(squadre.map((s) => s.nome), ['Bar Da Poldo', 'La Piazzetta', 'New Team', 'New Smile', 'Binario 8', 'Hammers']);
  assert.equal(squadre.reduce((n, s) => n + s.giocatori.length, 0), 39);
  const ceni = squadre[1].giocatori.find((g) => g.tessera === '08/4272');
  assert.deepEqual([ceni.nome, ceni.set, ceni.punti, ceni.media], ['Ceni Remolo Rossano', 24, 42, 1.75]);
  assert.deepEqual(ceni.giornate.slice(0, 5), [[6, 6], [6, 12], [6, 12], [6, 12], [0, 0]]);
});

test('i totali tornano con le giornate', () => {
  for (const s of squadre) {
    for (const g of s.giocatori) {
      assert.equal(g.giornate.length, 10, g.nome);
      assert.equal(g.giornate.reduce((t, [set]) => t + set, 0), g.set, `set di ${g.nome}`);
      assert.equal(g.giornate.reduce((t, [, p]) => t + p, 0), g.punti, `punti di ${g.nome}`);
    }
  }
});

test('nostra squadra, ordine e giornate giocate', () => {
  const camp = { squadre };
  assert.equal(nostraSquadra(camp, ['08/4272', '08/4270', '08/9999']), 'La Piazzetta');
  const o = ordina(squadre[1].giocatori, 'media');
  assert.equal(o[0].tessera, '08/4272');
  assert.equal(o.at(-1).set, 0); // chi non ha giocato in fondo
  assert.equal(giornateGiocate(squadre[1].giocatori[0]), 4);
});
