import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIPI, numeroOf, faseOf, sessionInfo, legsToWin, signatureOf, isCheckpoint,
} from '../js/training/catalogo.js';
import {
  scoringResult, doppieResult, checkoutResult, pressioneResult, metricOf, compareWith,
  nextK, progress, weekStart, sessionsThisWeek, comparable, fmtTimer,
} from '../js/training/calc.js';

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
