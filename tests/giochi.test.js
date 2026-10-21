import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GIOCHI, gioco, rigioca, numeriCheckout, dopoTurno, bersagliRotation, votoGioco, skill, trend, record,
  badgePresi, prossimoSabato, sfidaDel, classificaSfida, settimana, restoProvvisorio,
} from '../js/training/giochi.js';

const d = (...ids) => ids.map((id) => ({ t: 'd', id }));
const gioca = (id, eventi, opzioni = {}) => rigioca(gioco(id), opzioni, eventi);

test('7 giochi con id unici e i campi necessari', () => {
  assert.equal(GIOCHI.length, 7);
  assert.equal(new Set(GIOCHI.map((g) => g.id)).size, 7);
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

test('Target al 20 e al bull: punti, 90 frecce, turni da 3', () => {
  const g = gioco('target');
  let s = gioca('target', d('S20i', 'S20o', 'D20', 'T20', 'S1o', 'X'), { mira: '20' });
  assert.equal(g.valore(s), 7);
  assert.equal(s.fineTurno, true);
  s = gioca('target', d(...Array(90).fill('T20')), { mira: '20', serie: 10 });
  assert.equal(s.finito, true);
  assert.equal(g.valore(s), 270);
  assert.equal(g.dati(s).serie.length, 10);
  assert.equal(g.valore(gioca('target', d('B25', 'B50', 'S20o', 'X'), { mira: 'bull' })), 4);
});

test('Target con le combinazioni: la terza freccia del turno al 19 o al bull', () => {
  const g = gioco('target');
  let s = gioca('target', [], { mira: '20-20-19' });
  assert.equal(g.prossimo(s), 20);
  s = gioca('target', d('T20', 'S20o'), { mira: '20-20-19' });
  assert.equal(g.prossimo(s), 19);
  assert.deepEqual(g.bersagli(s), ['S19i', 'S19o', 'D19', 'T19']);
  assert.equal(g.quick(s)[3][0], 'T19');
  s = gioca('target', d('T20', 'S20o', 'T19', 'T19', 'T20', 'S20i'), { mira: '20-20-19' });
  assert.equal(g.valore(s), 3 + 1 + 3 + 0 + 3 + 0); // T19 al primo tiro del turno vale 0: li' si mira al 20
  s = gioca('target', d('S20o', 'S20o', 'B50'), { mira: '20-20-bull' });
  assert.equal(g.valore(s), 5);
  assert.deepEqual(g.bersagli(s), ['S20i', 'S20o', 'D20', 'T20']);
  assert.deepEqual(g.quick(gioca('target', d('X', 'X'), { mira: '20-20-bull' })).map((q) => q[0]), ['X', 'B25', 'B50']);
});

test('vecchie sessioni Target 20 e Target Bull diventano Target', () => {
  assert.deepEqual(normalizzaSessione({ gioco: 'target20', valore: 100, opzioni: {} }).opzioni, { mira: '20' });
  assert.equal(normalizzaSessione({ gioco: 'targetbull', valore: 30 }).gioco, 'target');
  assert.equal(normalizzaSessione({ gioco: 'targetbull', valore: 30 }).opzioni.mira, 'bull');
  assert.equal(normalizzaSessione({ gioco: 'doppie', valore: 3 }).gioco, 'doppie');
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
  const tutte = [...sess('target', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 100, 100]), ...sess('doppie', [50])];
  assert.equal(votoGioco(tutte, 'target'), 72); // ultime 10: da 30 a 100
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

import { REGOLE } from '../js/training/giochi.js';
test('ogni gioco ha le sue regole', () => {
  for (const g of GIOCHI) assert.ok(REGOLE[g.id]?.length >= 3, g.id);
});

import { partita501, normalizzaSessione } from '../js/training/giochi.js';
test('501 in due: turni alternati, vincitore e chi continua da solo', () => {
  const t = (p, s) => ({ p, t: 'turno', s });
  let r = partita501(2, [t(0, 60), t(1, 45)]);
  assert.equal(r.cur, 0);
  assert.equal(r.stati[0].resto, 441);
  assert.equal(r.stati[1].resto, 456);
  r = partita501(2, [{ p: 0, t: 'd', id: 'T20' }]);
  assert.equal(r.cur, 0); // turno a meta': tocca ancora a me
  const nove = [t(0, 180), t(1, 100), t(0, 180), t(1, 100), { p: 0, t: 'turno', s: 141, d: 3 }];
  r = partita501(2, nove);
  assert.equal(r.vincitore, 0);
  assert.equal(r.cur, 1); // l'altro puo' continuare da solo
  r = partita501(2, [...nove, t(1, 100), t(1, 100)]);
  assert.equal(r.cur, 1);
  assert.equal(r.stati[1].resto, 101);
  assert.equal(r.tuttiChiusi, false);
  r = partita501(1, [t(0, 60), t(0, 60)]);
  assert.equal(r.cur, 0);
  assert.equal(r.stati[0].resto, 381);
});

import { varianteDi, nomeVariante } from '../js/training/giochi.js';
test('Target su 5 o 10 serie: fine, voto sulla media a serie, record e sfida', () => {
  const g = gioco('target');
  let s = gioca('target', d(...Array(45).fill('S20o')), { mira: '20', serie: 5 });
  assert.equal(s.finito, true);
  assert.equal(g.valore(s), 45);
  assert.equal(g.dati(s).serie.length, 5);
  assert.equal(gioca('target', d(...Array(45).fill('S20o')), {}).finito, false); // senza scelta: 10 serie al 20
  assert.equal(g.voto(90, { mira: '20', serie: 5 }), g.voto(180, { mira: '20', serie: 10 }));
  assert.equal(g.voto(180, {}), 100);
  assert.equal(g.voto(90, { mira: 'bull' }), 100); // il bull ha una scala sua
  assert.equal(varianteDi(g, {}), '20|10');
  assert.equal(varianteDi(g, { mira: 'bull', serie: 5 }), 'bull|5');
  assert.equal(nomeVariante(g, '20-20-19|5'), '20 · 20 · 19 · 5 serie');
  assert.equal(g.grafico({ valore: 50, opzioni: { serie: 5 } }), 10);
  const sess = [
    { gioco: 'target', valore: 120, opzioni: { mira: '20' } },
    { gioco: 'target', valore: 70, opzioni: { mira: '20', serie: 5 } },
    { gioco: 'target', valore: 40, opzioni: { mira: 'bull', serie: 10 } },
  ];
  assert.equal(record(sess, 'target', '20|10'), 120);
  assert.equal(record(sess, 'target', '20|5'), 70);
  assert.equal(record(sess, 'target', 'bull|10'), 40);
  assert.equal(varianteDi(gioco('rotation'), { modo: 'T' }), 'T');
  // la sfida del Target vale al 20 su 10 serie
  const sab = ['2026-10-24', '2026-10-31', '2026-11-07', '2026-11-14', '2026-11-21'].find((x) => sfidaDel(x) === 'target');
  const cl = classificaSfida([
    { playerId: 'a', gioco: 'target', valore: 100, data: sab, opzioni: { mira: '20', serie: 10 } },
    { playerId: 'b', gioco: 'target', valore: 90, data: sab, opzioni: { mira: '20', serie: 5 } },
    { playerId: 'c', gioco: 'target', valore: 150, data: sab, opzioni: { mira: 'bull', serie: 10 } },
  ], sab);
  assert.deepEqual(cl, [{ playerId: 'a', valore: 100 }]);
});
