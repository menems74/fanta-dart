import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GIOCHI, gioco, rigioca, numeriCheckout, dopoTurno, bersagliRotation, votoGioco, skill, trend, record,
  badgePresi, prossimoSabato, sfidaDel, classificaSfida, settimana, restoProvvisorio,
} from '../js/training/giochi.js';

const d = (...ids) => ids.map((id) => ({ t: 'd', id }));
const gioca = (id, eventi, opzioni = {}) => rigioca(gioco(id), opzioni, eventi);

test('8 giochi con id unici e i campi necessari', () => {
  assert.equal(GIOCHI.length, 8);
  assert.equal(new Set(GIOCHI.map((g) => g.id)).size, 8);
  for (const g of GIOCHI) for (const k of ['nome', 'desc', 'unit', 'voto', 'crea', 'passo', 'valore', 'dati', 'bersagli']) assert.ok(g[k] != null, `${g.id}.${k}`);
});

test('501 freccia per freccia: turni, sballo e chiusura in doppia', () => {
  let s = gioca('x501', d('T20', 'T20', 'T20'));
  assert.equal(s.resto, 321);
  assert.equal(s.fineTurno, true);
  assert.deepEqual(s.ultimo, ['T20', 'T20', 'T20']);
  s = gioca('x501', d('T20', 'T20'));
  assert.equal(restoProvvisorio(s), 381);
  assert.equal(s.resto, 501);
  // 501 in 9 frecce: 180, 180, T20 T19 D12
  s = gioca('x501', d('T20', 'T20', 'T20', 'T20', 'T20', 'T20', 'T20', 'T19', 'D12'));
  assert.equal(s.finito, true);
  assert.equal(gioco('x501').valore(s), 9);
  assert.equal(gioco('x501').dati(s).maxTurno, 180);
  // a 40 tiro 20 e 20: sballo, resto 40 e 3 frecce contate
  const base = [{ t: 'turno', s: 180 }, { t: 'turno', s: 180 }, { t: 'turno', s: 101 }];
  s = gioca('x501', [...base, ...d('S20o', 'S20o')]);
  assert.equal(s.resto, 40);
  assert.equal(s.frecce, 12);
  s = gioca('x501', [...base, ...d('D20')]);
  assert.equal(s.finito, true);
  assert.equal(s.frecce, 10);
});

test('501 dal tastierino: chiusura con la freccia scelta, "non in doppia" e sballo', () => {
  const base = [{ t: 'turno', s: 180 }, { t: 'turno', s: 180 }, { t: 'turno', s: 101 }];
  let s = gioca('x501', [...base, { t: 'turno', s: 40, d: 2 }]);
  assert.equal(s.finito, true);
  assert.equal(s.frecce, 11);
  s = gioca('x501', [...base, { t: 'turno', s: 40, d: 0 }]);
  assert.equal(s.finito, false);
  assert.equal(s.resto, 40);
  s = gioca('x501', [...base, { t: 'turno', s: 60 }]);
  assert.equal(s.resto, 40);
  assert.equal(s.visite.at(-1), 0);
});

test('Target 20 e Target Bull: punti, 90 frecce, turni da 3', () => {
  const g = gioco('target20');
  let s = gioca('target20', d('S20i', 'S20o', 'D20', 'T20', 'S1o', 'X'));
  assert.equal(g.valore(s), 7);
  assert.equal(s.fineTurno, true);
  s = gioca('target20', d(...Array(90).fill('T20')));
  assert.equal(s.finito, true);
  assert.equal(g.valore(s), 270);
  assert.equal(g.dati(s).serie.length, 10);
  const b = gioco('targetbull');
  assert.equal(b.valore(gioca('targetbull', d('B25', 'B50', 'S20o', 'X'))), 4);
});

test('Scoring: 18 frecce, a mano o freccia per freccia', () => {
  const g = gioco('scoring');
  let s = gioca('scoring', [{ t: 'turno', s: 100 }, ...d('T20', 'S5o')]);
  assert.equal(g.valore(s), 165);
  assert.equal(s.frecce, 5);
  s = gioca('scoring', Array(6).fill({ t: 'turno', s: 60 }));
  assert.equal(s.finito, true);
  assert.equal(g.valore(s), 360);
  assert.equal(gioca('scoring', [{ t: 'turno', s: 179 }]).frecce, 0); // impossibile: ignorato
});

test('Checkout: numeri diversi, 10 sotto il 70 e 6 sopra', () => {
  for (let k = 0; k < 50; k++) {
    const n = numeriCheckout();
    assert.equal(n.length, 16);
    assert.equal(new Set(n).size, 16);
    assert.equal(n.filter((x) => x >= 40 && x < 70).length, 10);
    assert.equal(n.filter((x) => x >= 70 && x <= 100).length, 6);
  }
});

test('Checkout: chiusura, sballo, 3 frecce senza chiudere e pulsanti', () => {
  const numeri = [40, 50, 61, ...Array(13).fill(41)];
  const g = gioco('checkout');
  let s = gioca('checkout', d('D20'), { numeri });
  assert.deepEqual(s.esiti, [true]);
  assert.equal(s.resto, 50);
  s = gioca('checkout', [...d('D20'), ...d('B50')], { numeri });
  assert.deepEqual(s.esiti, [true, true]);
  s = gioca('checkout', [...d('D20', 'B50', 'S20o', 'S20o'), ...d('X')], { numeri });
  assert.deepEqual(s.esiti, [true, true, false]); // 61: 20, 20 resta 21... no: 61-20-20=21, poi X: 3 frecce, non chiuso
  s = gioca('checkout', d('S20o', 'S20o'), { numeri });
  assert.deepEqual(s.esiti, [false]); // 40 a zero senza doppia
  s = gioca('checkout', [{ t: 'esito', ok: true }, { t: 'esito', ok: false }], { numeri });
  assert.equal(g.valore(s), 1);
  assert.equal(s.idx, 2);
});

test('Doppie: 15 frecce per doppia, conta solo la doppia giusta', () => {
  const g = gioco('doppie');
  let s = gioca('doppie', d('D20', 'D20', 'S20o', 'D16'));
  assert.equal(g.valore(s), 2);
  assert.deepEqual(g.bersagli(s), ['D20']);
  s = gioca('doppie', d(...Array(15).fill('X'), 'D16'));
  assert.equal(s.idx, 1);
  assert.equal(g.valore(s), 1);
  s = gioca('doppie', d(...Array(105).fill('X')));
  assert.equal(s.finito, true);
});

test('Rotation: settori validi per modalita\' e conteggio frecce', () => {
  assert.deepEqual(bersagliRotation('S', 5), ['S5i', 'S5o']);
  assert.deepEqual(bersagliRotation('D', 5), ['D5']);
  assert.deepEqual(bersagliRotation('T', 25), ['B25', 'B50']);
  assert.deepEqual(bersagliRotation('D', 25), ['B50']);
  const g = gioco('rotation');
  let s = gioca('rotation', d('T1', 'S1o', 'X', 'S2i'), { modo: 'S' });
  assert.equal(s.idx, 2); // il triplo non conta nel singolo
  const tutti = [...Array.from({ length: 20 }, (_, i) => `D${i + 1}`), 'B25', 'B50'];
  s = gioca('rotation', d(...tutti), { modo: 'D' });
  assert.equal(s.finito, true);
  assert.equal(g.valore(s), 22); // il bull 25 non chiude nel doppio
  assert.ok(g.voto(22, { modo: 'D' }) === 100);
});

test('Cricket Train: avanti, resti, indietro e bull', () => {
  assert.equal(dopoTurno(0, 3), 1);
  assert.equal(dopoTurno(0, 1), 0); // sul 20 resti
  assert.equal(dopoTurno(2, 2), 2);
  assert.equal(dopoTurno(2, 1), 1);
  assert.equal(dopoTurno(2, 0), 1);
  assert.equal(dopoTurno(6, 0), 5); // bull mancato: torni al 15
  assert.equal(dopoTurno(6, 1), 7); // finito
  const g = gioco('cricket');
  let s = gioca('cricket', d('T20', 'S20o', 'D20'));
  assert.equal(s.pos, 1); // il triplo vale un colpo, ma sono 3 colpi
  s = gioca('cricket', [3, 3, 3, 3, 3, 3].map((n) => ({ t: 'colpi', n })));
  assert.equal(s.pos, 6);
  s = g.passo(s, { t: 'd', id: 'B25' }); // il bull chiude subito il turno
  assert.equal(s.finito, true);
  assert.equal(g.valore(s), 7);
});

test('Skill, voti e pollici', () => {
  const sess = (gioco_, voti) => voti.map((voto, i) => ({ gioco: gioco_, voto, valore: voto, ts: i, data: '2026-10-19' }));
  const tutte = [...sess('target20', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 100, 100]), ...sess('doppie', [50])];
  assert.equal(votoGioco(tutte, 'target20'), 72); // ultime 10: da 30 a 100
  assert.equal(skill(tutte), 61);
  assert.equal(skill([]), null);
  assert.equal(trend([50, 50, 50]), 'nuovo');
  assert.equal(trend([40, 40, 40, 60, 60, 60]), 'su');
  assert.equal(trend([60, 60, 60, 40, 40, 40]), 'giu');
  assert.equal(trend([50, 50, 50, 50, 51, 50]), 'pari');
  assert.equal(record([{ gioco: 'x501', valore: 30 }, { gioco: 'x501', valore: 24 }], 'x501'), 24);
  assert.equal(record([{ gioco: 'rotation', valore: 30, opzioni: { modo: 'S' } }, { gioco: 'rotation', valore: 90, opzioni: { modo: 'T' } }], 'rotation', 'T'), 90);
});

test('badge, settimana e sfida del sabato', () => {
  const s = [{ gioco: 'x501', valore: 28, dati: { maxTurno: 180 }, data: '2026-10-19' }, { gioco: 'cricket', valore: 12, data: '2026-10-20' }];
  const b = badgePresi(s);
  assert.ok(b.has('primo') && b.has('max') && b.has('ton') && b.has('rapido') && b.has('treno'));
  assert.ok(!b.has('tutti'));
  assert.equal(settimana(s, '2026-10-25'), 2); // domenica: stessa settimana
  assert.equal(settimana(s, '2026-10-26'), 0);
  assert.equal(prossimoSabato('2026-10-19'), '2026-10-24');
  assert.equal(prossimoSabato('2026-10-24'), '2026-10-24');
  const giri = ['2026-10-24', '2026-10-31', '2026-11-07', '2026-11-14', '2026-11-21'].map(sfidaDel);
  assert.equal(new Set(giri).size, 5);
  assert.equal(sfidaDel('2026-11-28'), giri[0]);
  const id = sfidaDel('2026-10-24');
  const cl = classificaSfida([
    { playerId: 'a', gioco: id, valore: 10, data: '2026-10-24' }, { playerId: 'a', gioco: id, valore: 12, data: '2026-10-24' },
    { playerId: 'b', gioco: id, valore: 11, data: '2026-10-24' }, { playerId: 'c', gioco: id, valore: 99, data: '2026-10-23' },
  ], '2026-10-24');
  assert.equal(cl.length, 2);
  assert.deepEqual(cl[0], gioco(id).basso ? { playerId: 'a', valore: 10 } : { playerId: 'a', valore: 12 });
});
