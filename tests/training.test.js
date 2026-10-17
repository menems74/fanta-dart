import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIPI, numeroOf, faseOf, sessionInfo, legsToWin, signatureOf, isCheckpoint,
} from '../js/training/catalogo.js';
import {
  scoringResult, doppieResult, checkoutResult, pressioneResult, metricOf, compareWith,
  nextK, progress, weekStart, sessionsThisWeek, comparable, fmtTimer,
  weeklyStreak, longestWeekStreak, recordsOf, pairsOf, doppieMedie, checkoutFails,
  skillScore, skillQuotas, testDue, testTipoFor,
} from '../js/training/calc.js';
import { BADGES, earnedBadges, newBadges } from '../js/training/badges.js';

test('numerazione: ogni tipo ha 20 sessioni e le 100 sono tutte diverse', () => {
  const tutti = new Set();
  for (const tipo of TIPI) for (let k = 1; k <= 20; k++) tutti.add(numeroOf(tipo, k));
  assert.equal(tutti.size, 100);
  assert.equal(numeroOf('scoring', 1), 1);
  assert.equal(numeroOf('doppie', 1), 2);
  assert.equal(numeroOf('partita', 1), 5);
  assert.equal(numeroOf('scoring', 5), 21);
  assert.equal(numeroOf('partita', 20), 100);
});

test('fasi e checkpoint', () => {
  assert.equal(faseOf(1).id, 'fondamenta');
  assert.equal(faseOf(25).id, 'fondamenta');
  assert.equal(faseOf(26).id, 'costanza');
  assert.equal(faseOf(51).id, 'pressione');
  assert.equal(faseOf(100).id, 'pronto');
  assert.ok(isCheckpoint(10) && isCheckpoint(100) && !isCheckpoint(15));
});

test('pressione: bersagli e soglia dal catalogo, tutte le 20 sessioni definite', () => {
  for (let k = 1; k <= 20; k++) {
    const i = sessionInfo('pressione', k);
    assert.equal(i.bersagli.length, 12, `sessione ${i.n}`);
    assert.ok(i.soglia >= 1 && i.soglia <= 3);
  }
  const s54 = sessionInfo('pressione', 11);
  assert.equal(s54.n, 54);
  assert.equal(s54.soglia, 3);
  assert.deepEqual(s54.bersagli.slice(0, 4), ['S20', 'S19', 'S18', 'S20']);
  assert.equal(sessionInfo('pressione', 1).soglia, 1);
});

test('partita: formato in base alla fase', () => {
  assert.equal(legsToWin(5), 2);
  assert.equal(legsToWin(30), 3);
  assert.equal(legsToWin(65), 4);
  assert.equal(legsToWin(95), 5);
  assert.equal(sessionInfo('partita', 6).legsToWin, 3);
});

test('scoring e doppie', () => {
  const s = scoringResult({ serie: [20, 18, 25, 30, 12, 15, 22, 19, 21, 17], t20: 31 });
  assert.equal(s.total, 199);
  assert.equal(s.t20, 31);
  const d = doppieResult({ bersagli: ['D20', 'D16', 'D10', 'D8'], hit: [4, 7, 3, 6] });
  assert.equal(d.hit, 20);
  assert.equal(d.pct, 25);
  assert.equal(d.best.b, 'D16');
  assert.equal(d.worst.b, 'D10');
});

test('checkout: chiusure e media frecce', () => {
  const frecce = [0, 3, 2, 0, 1, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0];
  const r = checkoutResult({ frecce });
  assert.equal(r.riusciti, 4);
  assert.equal(r.pct, 25);
  assert.equal(r.mediaFrecce, 2.25);
});

test('pressione: riuscite e miglior serie rispettano la soglia', () => {
  const d = { soglia: 2, hit: [2, 3, 1, 2, 2, 2, 0, 3, 2, 1, 0, 2] };
  const r = pressioneResult(d);
  assert.equal(r.riuscite, 8);
  assert.equal(r.best, 3);
  assert.equal(pressioneResult({ soglia: 1, hit: [1, 1, 0] }).riuscite, 2);
});

test('metrica principale per tipo', () => {
  assert.equal(metricOf('scoring', { serie: [10, 10] }), 20);
  assert.equal(metricOf('partita', { average: 52.4 }), 52.4);
  assert.equal(metricOf('partita', { average: null }), null);
});

test('confronto: primo risultato, record, miglioramento e calo', () => {
  assert.equal(compareWith({ metrica: 100 }, []).kind, 'first');
  assert.equal(compareWith({ metrica: null }, [{ metrica: 90 }]).kind, 'none');
  const pb = compareWith({ metrica: 210 }, [{ metrica: 190 }, { metrica: 200 }]);
  assert.equal(pb.kind, 'pb');
  assert.equal(pb.delta, 20);
  const up = compareWith({ metrica: 195 }, [{ metrica: 190 }, { metrica: 200 }]);
  assert.equal(up.kind, 'up');
  assert.equal(up.best, 200);
  assert.equal(compareWith({ metrica: 190 }, [{ metrica: 190 }, { metrica: 200 }]).kind, 'same');
  assert.equal(compareWith({ metrica: 150 }, [{ metrica: 190 }, { metrica: 200 }]).kind, 'down');
});

test('la pressione si confronta solo con gli stessi bersagli e la stessa soglia', () => {
  const a = { tipo: 'pressione', dati: { bersagli: ['D20', 'D16', 'D10', 'D20'], soglia: 1 } };
  const b = { tipo: 'pressione', dati: { bersagli: ['D20', 'D16', 'D10', 'D20'], soglia: 1 } };
  const c = { tipo: 'pressione', dati: { bersagli: ['T20', 'T19', 'T18', 'T20'], soglia: 1 } };
  const d = { tipo: 'pressione', dati: { bersagli: ['D20', 'D16', 'D10', 'D20'], soglia: 2 } };
  assert.ok(comparable(a, b));
  assert.ok(!comparable(a, c));
  assert.ok(!comparable(a, d));
  assert.ok(comparable({ tipo: 'scoring' }, { tipo: 'scoring' }));
  assert.ok(!comparable({ tipo: 'scoring' }, { tipo: 'doppie' }));
  assert.equal(signatureOf({ tipo: 'scoring' }), 'scoring');
});

test('prossima sessione libera di un tipo, anche dopo un\'eliminazione', () => {
  assert.equal(nextK([], 'scoring'), 1);
  const t = [{ tipo: 'scoring', k: 1 }, { tipo: 'scoring', k: 2 }, { tipo: 'doppie', k: 1 }];
  assert.equal(nextK(t, 'scoring'), 3);
  assert.equal(nextK(t, 'doppie'), 2);
  assert.equal(nextK([{ tipo: 'scoring', k: 1 }, { tipo: 'scoring', k: 3 }], 'scoring'), 2);
  const full = Array.from({ length: 20 }, (_, i) => ({ tipo: 'checkout', k: i + 1 }));
  assert.equal(nextK(full, 'checkout'), null);
});

test('avanzamento complessivo e fase', () => {
  assert.equal(progress([]).fase.id, 'fondamenta');
  const venticinque = Array.from({ length: 25 }, (_, i) => ({ numero: i + 1 }));
  assert.equal(progress(venticinque).done, 25);
  assert.equal(progress(venticinque).fase.id, 'costanza');
});

test('settimana da lunedi a domenica', () => {
  assert.equal(weekStart('2026-10-17'), '2026-10-12'); // sabato
  assert.equal(weekStart('2026-10-12'), '2026-10-12'); // lunedi
  assert.equal(weekStart('2026-10-18'), '2026-10-12'); // domenica
  const t = [{ data: '2026-10-11' }, { data: '2026-10-12' }, { data: '2026-10-18' }, { data: '2026-10-19' }];
  assert.equal(sessionsThisWeek(t, '2026-10-17'), 2);
});

test('timer', () => {
  assert.equal(fmtTimer(0), '00:00');
  assert.equal(fmtTimer(65_000), '01:05');
  assert.equal(fmtTimer(3_600_000), '60:00');
});

const T = (tipo, k, metrica, data = '2026-10-01', extra = {}) =>
  ({ id: `${tipo}${k}`, tipo, k, numero: numeroOf(tipo, k), metrica, data, creataIl: k * 1000 + (extra.off || 0), dati: extra.dati || {} });

test('serie di settimane: la settimana in corso non spezza la serie', () => {
  const ses = (data) => ({ data });
  // lunedi 05/10 e 12/10, settimana 19/10 ancora in corso
  const t = [ses('2026-09-28'), ses('2026-09-29'), ses('2026-10-05'), ses('2026-10-06'), ses('2026-10-12'), ses('2026-10-13')];
  assert.equal(weeklyStreak(t, '2026-10-20'), 3);
  assert.equal(weeklyStreak(t, '2026-10-14'), 3);
  assert.equal(weeklyStreak([ses('2026-10-06')], '2026-10-20'), 0);
  assert.equal(longestWeekStreak(t), 3);
  assert.equal(longestWeekStreak([...t, ses('2026-10-26'), ses('2026-10-27')]), 3);
  assert.equal(longestWeekStreak([]), 0);
});

test('record personali: il primo risultato non conta', () => {
  const t = [T('scoring', 1, 150), T('scoring', 2, 140), T('scoring', 3, 170), T('doppie', 1, 30)];
  assert.equal(recordsOf(t), 1);
  assert.equal(recordsOf([T('scoring', 1, 150)]), 0);
});

test('confronto primo e secondo giro dello stesso tipo', () => {
  const t = [T('scoring', 1, 150), T('scoring', 2, 170), T('scoring', 3, 160), T('doppie', 1, 30), T('doppie', 2, 28)];
  const p = pairsOf(t);
  assert.equal(p.length, 2);
  const sc = p.find((x) => x.tipo === 'scoring');
  assert.equal(sc.delta, 20);
  assert.equal(p.find((x) => x.tipo === 'doppie').delta, -2);
});

test('punti da lavorare: doppia piu debole e checkout che sbaglio piu spesso', () => {
  const d = (hit) => ({ tipo: 'doppie', dati: { bersagli: ['D20', 'D16', 'D10', 'D8'], hit } });
  const m = doppieMedie([d([10, 12, 8, 2]), d([12, 10, 6, 4])]);
  assert.equal(m[0].b, 'D8');
  assert.equal(m[0].pct, 15);
  assert.equal(doppieMedie([]), null);
  const c = (frecce) => ({ tipo: 'checkout', dati: { outs: [40, 44, 48, 52], frecce } });
  const f = checkoutFails([c([1, 0, 0, 0]), c([3, 0, 1, 0])]);
  assert.deepEqual(f.map((x) => x.out), [44, 52]);
  assert.equal(f[0].rate, 0);
});

test('Skill Score: quattro quote da 25, una cifra decimale', () => {
  assert.equal(skillScore({ scoring: 90, doppie: 20, bull: 40, checkout: 7 }), 100);
  assert.equal(skillScore({ scoring: 0, doppie: 0, bull: 0, checkout: 0 }), 0);
  assert.equal(skillScore({ scoring: 45, doppie: 10, bull: 20, checkout: 3 }), 48.2);
  assert.equal(skillQuotas({ scoring: 45, doppie: 10, bull: 20, checkout: 7 }).checkout, 25);
});

test('quando proporre lo Skill test', () => {
  assert.equal(testDue([], 0), 'iniziale');
  assert.equal(testDue([{ tipo: 'iniziale', sessioniFatte: 0 }], 10), null);
  assert.equal(testDue([{ tipo: 'iniziale', sessioniFatte: 0 }], 25), 'intermedio');
  assert.equal(testDue([{ tipo: 'intermedio', sessioniFatte: 25 }], 49), null);
  assert.equal(testDue([{ tipo: 'intermedio', sessioniFatte: 75 }], 100), 'finale');
  assert.equal(testDue([{ tipo: 'finale', sessioniFatte: 100 }], 100), null);
  assert.equal(testTipoFor([], 0), 'iniziale');
  assert.equal(testTipoFor([{}], 30), 'intermedio');
  assert.equal(testTipoFor([{}], 100), 'finale');
});

test('badge: id unici e ottenuti in base ai dati', () => {
  assert.equal(new Set(BADGES.map((b) => b.id)).size, BADGES.length);
  assert.equal(earnedBadges([], []).size, 0);
  const uno = earnedBadges([T('scoring', 1, 210, '2026-10-01', { dati: {} })], []);
  assert.ok(uno.has('prima') && uno.has('sc200') && !uno.has('s10'));
  const dieci = Array.from({ length: 10 }, (_, i) => T('scoring', i + 1, 100 + i));
  assert.ok(earnedBadges(dieci, []).has('s10'));
  assert.ok(earnedBadges(dieci, []).has('rec5'));
  assert.ok(earnedBadges([], [{ creataIl: 1 }]).has('test'));
  const crono = [{ creataIl: 1, scoring: 30, doppie: 5, bull: 10, checkout: 1 }, { creataIl: 2, scoring: 80, doppie: 15, bull: 30, checkout: 5 }];
  assert.ok(earnedBadges([], crono).has('skill10'));
});

test('fase completata sblocca il badge solo con tutte le 25 sessioni', () => {
  const quasi = [];
  for (let n = 1; n <= 24; n++) quasi.push({ id: `a${n}`, numero: n, tipo: 'scoring', k: n, metrica: 1 });
  assert.ok(!earnedBadges(quasi, []).has('f1'));
  const tutte = [...quasi, { id: 'a25', numero: 25, tipo: 'partita', k: 5, metrica: null }];
  assert.ok(earnedBadges(tutte, []).has('f1'));
});

test('nuovi badge: solo quelli ottenuti con l ultima sessione', () => {
  const prima = Array.from({ length: 9 }, (_, i) => ({ id: `x${i}`, numero: i + 1, tipo: 'scoring', k: i + 1, metrica: 100, data: '2026-10-01', creataIl: i }));
  const decima = { id: 'x9', numero: 10, tipo: 'doppie', k: 2, metrica: 20, data: '2026-10-02', creataIl: 99 };
  const nuovi = newBadges([...prima, decima], [], { sessionId: 'x9' }).map((b) => b.id);
  assert.ok(nuovi.includes('s10'));
  assert.ok(!nuovi.includes('prima'));
});
