import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  visitaValida, chiudibileIn, frecceChiusura, applicaVisita, restoDi, vincitore,
  riepilogoLeg, statistichePartita, prossimoTurno, LEG_START,
} from '../js/training/scorer.js';
import { visitaBot, livelloBot, BOT_LIVELLI } from '../js/training/bot.js';

const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

test('punteggi possibili con tre frecce', () => {
  for (const s of [0, 26, 60, 100, 171 - 1, 180]) assert.ok(visitaValida(s), `${s}`);
  for (const s of [163, 166, 169, 172, 173, 175, 176, 178, 179, 181, -1, 12.5]) assert.ok(!visitaValida(s), `${s}`);
});

test('chiusure in doppia: quante frecce servono', () => {
  assert.deepEqual(frecceChiusura(40), [1, 2, 3]); // D20
  assert.deepEqual(frecceChiusura(50), [1, 2, 3]); // bull
  assert.deepEqual(frecceChiusura(41), [2, 3]); // S1 + D20
  assert.deepEqual(frecceChiusura(100), [2, 3]); // T20 + D20
  assert.deepEqual(frecceChiusura(170), [3]); // T20 T20 bull
  assert.deepEqual(frecceChiusura(110), [2, 3]); // T20 + bull
  assert.deepEqual(frecceChiusura(169), []);
  assert.deepEqual(frecceChiusura(159), []);
  assert.deepEqual(frecceChiusura(171), []);
  assert.ok(chiudibileIn(2, 1) && !chiudibileIn(3, 1) && chiudibileIn(3, 2));
});

test('sballo: superi, lasci 1 o chiudi senza poter fare doppia', () => {
  assert.deepEqual(applicaVisita(501, 60), { esito: 'ok', resto: 441 });
  assert.equal(applicaVisita(40, 41).esito, 'sballo');
  assert.equal(applicaVisita(40, 39).esito, 'sballo'); // lascia 1
  assert.deepEqual(applicaVisita(40, 38), { esito: 'ok', resto: 2 });
  assert.deepEqual(applicaVisita(40, 40), { esito: 'chiuso', resto: 0 });
  assert.equal(applicaVisita(169, 169).esito, 'sballo');
  assert.deepEqual(applicaVisita(170, 170), { esito: 'chiuso', resto: 0 });
  assert.equal(applicaVisita(2, 2).esito, 'chiuso');
});

const ev = (w, s, d, r, esito = 'ok') => ({ w, s, d, r, esito });

test('resto e vincitore dal registro del leg', () => {
  const leg = [ev('i', 100, 3, 501), ev('b', 60, 3, 501), ev('i', 0, 3, 401, 'sballo'), ev('b', 45, 3, 441)];
  assert.equal(restoDi(leg, 'i'), 401);
  assert.equal(restoDi(leg, 'b'), 501 - 105);
  assert.equal(vincitore(leg), null);
  assert.equal(vincitore([...leg, ev('i', 40, 2, 40, 'chiuso')]), 'i');
  assert.equal(prossimoTurno([], 'i', 'b'), 'i');
  assert.equal(prossimoTurno([ev('i', 1, 3, 501)], 'i', 'b'), 'b');
  assert.equal(LEG_START, 501);
});

test('statistiche della partita: media, first 9, visite alte, miglior chiusura e leg', () => {
  const leg1 = {
    vinse: 'i', starter: 'i',
    ev: [ev('i', 60, 3, 501), ev('i', 100, 3, 441), ev('i', 140, 3, 341), ev('i', 180, 3, 201), ev('i', 0, 3, 21, 'sballo'), ev('i', 121, 3, 201), ev('i', 80, 2, 80, 'chiuso')],
  };
  const leg2 = { vinse: 'b', starter: 'b', ev: [ev('i', 45, 3, 501), ev('i', 45, 3, 456), ev('i', 45, 3, 411)] };
  const st = statistichePartita([leg1, leg2]);
  // punti: 60+100+140+180+0+121+80 + 135 = 816 ; frecce: 3*6+2 + 9 = 29
  assert.equal(st.media, Math.round((816 / 29) * 3 * 10) / 10);
  assert.equal(st.first9, Math.round(((300 / 9) * 3 + (135 / 9) * 3) / 2 * 10) / 10);
  assert.equal(st.bestCheckout, 80);
  assert.equal(st.bestLeg, 20);
  assert.equal(st.v100, 2); // 100 e 121
  assert.equal(st.v140, 1);
  assert.equal(st.v180, 1);
  const r = riepilogoLeg(leg1);
  assert.equal(r.vinto, true);
  assert.equal(r.frecce, 20);
  assert.equal(riepilogoLeg(leg2).vinto, false);
});

test('leg perso a mano: non conta come miglior leg', () => {
  const persa = { vinse: 'b', manuale: true, starter: 'i', ev: [ev('i', 60, 3, 501)] };
  const st = statistichePartita([persa]);
  assert.equal(st.bestLeg, null);
  assert.equal(st.media, 60);
  assert.equal(statistichePartita([]).media, null);
});

test('bot: un leg termina sempre e non sballa mai', () => {
  for (const liv of BOT_LIVELLI) {
    const rng = mulberry32(liv.media);
    for (let leg = 0; leg < 60; leg++) {
      let resto = 501;
      let visite = 0;
      while (resto > 0 && visite < 80) {
        const v = visitaBot(resto, liv.media, rng);
        const r = applicaVisita(resto, v.s);
        if (v.esito === 'chiuso') { assert.equal(r.esito, 'chiuso'); assert.ok(frecceChiusura(resto).includes(v.d)); resto = 0; }
        else { assert.notEqual(r.esito, 'sballo', `resto ${resto} s ${v.s}`); assert.ok(r.resto >= 2); resto = r.resto; }
        visite++;
      }
      assert.equal(resto, 0, `livello ${liv.id}: leg non finito`);
    }
  }
});

test('bot: la media segue il livello e i livelli sono ordinati', () => {
  const mediaDi = (livello) => {
    const rng = mulberry32(7);
    let punti = 0;
    let frecce = 0;
    for (let leg = 0; leg < 300; leg++) {
      let resto = 501;
      while (resto > 0) {
        const v = visitaBot(resto, livello.media, rng);
        punti += v.s;
        frecce += v.d;
        resto = v.esito === 'chiuso' ? 0 : resto - v.s;
      }
    }
    return (punti / frecce) * 3;
  };
  const medie = BOT_LIVELLI.map(mediaDi);
  for (let i = 1; i < medie.length; i++) assert.ok(medie[i] > medie[i - 1], medie.join(', '));
  BOT_LIVELLI.forEach((l, i) => assert.ok(Math.abs(medie[i] - l.media) < l.media * 0.3, `${l.id}: ${medie[i]}`));
  assert.equal(livelloBot('esperto').media, 60);
  assert.equal(livelloBot('boh').id, 'medio');
});
