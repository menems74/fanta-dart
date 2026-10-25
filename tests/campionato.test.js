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

test('campionati salvati: indice e classifica finale del Nazionale 2026', () => {
  const indice = JSON.parse(readFileSync(new URL('../dati/campionati/indice.json', import.meta.url), 'utf8'));
  assert.deepEqual(indice.map((c) => c.id), ['2026bis-lombardia-as4', '2026-lombardia-a09']);
  const naz = JSON.parse(readFileSync(new URL('../dati/campionati/2026-lombardia-a09.json', import.meta.url), 'utf8'));
  assert.equal(naz.chiuso, true);
  const tutti = naz.squadre.flatMap((s) => s.giocatori);
  assert.equal(tutti.length, 44);
  for (const g of tutti) if (g.set) assert.ok(Math.abs(g.punti / g.set - g.media) < 0.006, g.nome);
  assert.equal(nostraSquadra(naz, ['08/4272', '08/4149']), 'Glintelligenti');
  assert.equal(giornateGiocate(tutti[0]), null); // niente dettaglio per giornata
});

import { bilancio, risultatoIncontro } from '../js/campionato.js';
test('incontri del Nazionale 2026: risultati e bilanci', () => {
  const naz = JSON.parse(readFileSync(new URL('../dati/campionati/2026-lombardia-a09.json', import.meta.url), 'utf8'));
  assert.equal(naz.incontri.length, 8);
  assert.deepEqual(risultatoIncontro(naz.incontri[0]), [5, 15]); // Glintelligenti - Bar Da Poldo
  const b = bilancio(naz, 'Ceni Remolo Rossano');
  // le sfide trascritte coincidono con il "Set" ufficiale per tutta la squadra
  for (const g of naz.squadre.find((s) => s.nome === 'Glintelligenti').giocatori) {
    const x = bilancio(naz, g.nome);
    assert.equal(x ? x.sg + x.dg : 0, g.set, g.nome);
  }
  assert.equal(b.sg + b.dg, 45);
  assert.equal(bilancio(naz, 'Nessuno'), null);
  assert.equal(bilancio({ squadre: [] }, 'Ceni Remolo Rossano'), null);
});

test('punti ufficiali: 3 per 2-0, 2 per 2-1, 1 per 1-2, 0 per 0-2', () => {
  const naz = JSON.parse(readFileSync(new URL('../dati/campionati/2026-lombardia-a09.json', import.meta.url), 'utf8'));
  const punti = { '2-0': 3, '2-1': 2, '1-2': 1, '0-2': 0 };
  for (const g of naz.squadre.find((s) => s.nome === 'Glintelligenti').giocatori) {
    let tot = 0;
    for (const inc of naz.incontri) {
      for (const s of inc.giochi) {
        const l = s.casa.includes(g.nome) ? 0 : s.ospite.includes(g.nome) ? 1 : -1;
        if (l >= 0) tot += punti[`${s.set[l]}-${s.set[1 - l]}`];
      }
    }
    assert.equal(tot, g.punti, g.nome);
  }
});

import { dettaglioSfide, classificaBilanci } from '../js/campionato.js';
test('dettaglio delle sfide: risultati, avversari e compagni', () => {
  const naz = JSON.parse(readFileSync(new URL('../dati/campionati/2026-lombardia-a09.json', import.meta.url), 'utf8'));
  const g = naz.squadre.find((s) => s.nome === 'Glintelligenti').giocatori.find((x) => x.tessera === '08/4272');
  const d = dettaglioSfide([{ camp: naz, g }]);
  assert.equal(d.sfide, 45);
  assert.deepEqual(d.risultati, { '2-0': 18, '2-1': 6, '1-2': 9, '0-2': 12 });
  assert.equal([...d.avversari.values()].reduce((t, x) => t + x.g, 0), 30); // singoli
  assert.equal([...d.compagni.values()].reduce((t, x) => t + x.g, 0), 15); // doppi
  const best = classificaBilanci(d.avversari);
  assert.ok(best.length <= 3 && best.every((r) => r.g >= 2));
  assert.ok(best[0].p >= best.at(-1).p);
  const peggio = classificaBilanci(d.avversari, { peggiori: true });
  assert.ok(peggio[0].p <= peggio.at(-1).p);
});

test('incontri dell\'Invernale 2026: sfide e punti coincidono con le giornate ufficiali', () => {
  const inv = JSON.parse(readFileSync(new URL('../dati/campionati/2026bis-lombardia-as4.json', import.meta.url), 'utf8'));
  const punti = { '2-0': 3, '2-1': 2, '1-2': 1, '0-2': 0 };
  assert.equal(inv.incontri.length, 4);
  inv.incontri.forEach((inc, i) => {
    assert.equal(inc.giochi.length, 20);
    for (const sq of inv.squadre.filter((s) => s.nome === inc.casa || s.nome === inc.ospite)) {
      for (const g of sq.giocatori) {
        let set = 0, tot = 0;
        for (const s of inc.giochi) {
          const l = s.casa.includes(g.nome) ? 0 : s.ospite.includes(g.nome) ? 1 : -1;
          if (l >= 0) { set += 1; tot += punti[`${s.set[l]}-${s.set[1 - l]}`]; }
        }
        assert.deepEqual([set, tot], g.giornate[i], `giornata ${i + 1}, ${g.nome}`);
      }
    }
  });
});
