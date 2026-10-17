/** Calcoli puri sulle sessioni di allenamento (nessuna dipendenza dal browser). */
import { TIPI, SESSIONI_PER_TIPO, TOTALE_SESSIONI, faseOf, signatureOf, DOPPIE_BERSAGLI } from './catalogo.js';

const num = (v) => (Number.isFinite(v) ? v : 0);
export const sum = (a) => a.reduce((s, v) => s + num(v), 0);
export const pct = (v, max) => (max ? Math.round((v / max) * 100) : 0);

export function scoringResult(d) {
  const total = sum(d.serie);
  return { total, max: 300, pct: pct(total, 300), t20: Number.isFinite(d.t20) ? d.t20 : null };
}

export function doppieResult(d) {
  const per = d.bersagli.map((b, i) => ({ b, hit: num(d.hit[i]), pct: pct(num(d.hit[i]), 20) }));
  const hit = sum(d.hit);
  const ord = [...per].sort((x, y) => y.hit - x.hit);
  return { hit, max: 80, pct: pct(hit, 80), per, best: ord[0], worst: ord[ord.length - 1] };
}

/** frecce[i]: 0 = fallito, 1-3 = freccia alla quale hai chiuso. */
export function checkoutResult(d) {
  const chiusi = d.frecce.filter((v) => v > 0);
  return {
    riusciti: chiusi.length,
    max: d.frecce.length,
    pct: pct(chiusi.length, d.frecce.length),
    mediaFrecce: chiusi.length ? sum(chiusi) / chiusi.length : null,
  };
}

export function pressioneResult(d) {
  const esiti = d.hit.map((h) => (num(h) >= d.soglia ? 1 : 0));
  let best = 0;
  let cur = 0;
  for (const e of esiti) { cur = e ? cur + 1 : 0; best = Math.max(best, cur); }
  return { riuscite: sum(esiti), max: d.hit.length, esiti, best };
}

/** Numero principale di una sessione, usato per record e confronti (piu' alto = meglio). */
export function metricOf(tipo, d) {
  switch (tipo) {
    case 'scoring': return scoringResult(d).total;
    case 'doppie': return doppieResult(d).hit;
    case 'checkout': return checkoutResult(d).riusciti;
    case 'pressione': return pressioneResult(d).riuscite;
    case 'partita': return Number.isFinite(d.average) ? d.average : null;
    default: return null;
  }
}

/** Valore grande, unita' e riga di contorno da mostrare nel riepilogo di una sessione. */
export function headline(t) {
  const d = t.dati;
  switch (t.tipo) {
    case 'scoring': { const r = scoringResult(d); return { big: String(r.total), unit: '/ 300', sub: `${r.pct}% del massimo` }; }
    case 'doppie': { const r = doppieResult(d); return { big: String(r.hit), unit: '/ 80', sub: `${r.pct}% di doppie colpite` }; }
    case 'checkout': { const r = checkoutResult(d); return { big: String(r.riusciti), unit: '/ 16', sub: `${r.pct}% di chiusure` }; }
    case 'pressione': { const r = pressioneResult(d); return { big: String(r.riuscite), unit: '/ 12', sub: `miglior serie: ${r.best}` }; }
    default: {
      const res = Number.isFinite(d.io) && Number.isFinite(d.avv) ? `${d.io} – ${d.avv}` : '—';
      return { big: res, unit: '', sub: Number.isFinite(d.average) ? `media ${String(d.average).replace('.', ',')}` : 'leg vinti' };
    }
  }
}

/** previous: sessioni confrontabili dello stesso tipo, dalla piu' recente. */
export function compareWith(current, previous) {
  const m = current.metrica;
  if (!Number.isFinite(m)) return { kind: 'none' };
  const vals = previous.map((p) => p.metrica).filter(Number.isFinite);
  if (!vals.length) return { kind: 'first' };
  const last = vals[0];
  const best = Math.max(...vals);
  if (m > best) return { kind: 'pb', delta: m - last, last, best };
  return { kind: m > last ? 'up' : m === last ? 'same' : 'down', delta: m - last, last, best };
}

export const comparable = (a, b) => a.tipo === b.tipo && signatureOf(a) === signatureOf(b);

/** Prima sessione "k" libera per un tipo (consente di eliminare una sessione senza perdere la numerazione). */
export function nextK(trainings, tipo) {
  const done = new Set(trainings.filter((t) => t.tipo === tipo).map((t) => t.k));
  for (let k = 1; k <= SESSIONI_PER_TIPO; k++) if (!done.has(k)) return k;
  return null;
}

export const doneNumbers = (trainings) => new Set(trainings.map((t) => t.numero));

export function progress(trainings) {
  const done = doneNumbers(trainings).size;
  return { done, total: TOTALE_SESSIONI, fase: faseOf(Math.min(TOTALE_SESSIONI, done + 1)) };
}

// ---- settimana (lunedi' - domenica) ----
const toDate = (iso) => new Date(`${iso}T12:00:00`);
const toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function weekStart(iso) {
  const d = toDate(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toIso(d);
}
export function sessionsThisWeek(trainings, todayIso) {
  const start = weekStart(todayIso);
  const end = toDate(start);
  end.setDate(end.getDate() + 6);
  const endIso = toIso(end);
  return trainings.filter((t) => t.data >= start && t.data <= endIso).length;
}
export const GOAL_SETTIMANALE = 2;

export const fmt1 = (v) => (v == null ? '—' : (Math.round(v * 10) / 10).toString().replace('.', ','));
export const fmtTimer = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// ---- serie di settimane ----
const addDays = (iso, n) => { const d = toDate(iso); d.setDate(d.getDate() + n); return toIso(d); };
const weekCounts = (trainings) => {
  const m = new Map();
  for (const t of trainings) { const w = weekStart(t.data); m.set(w, (m.get(w) || 0) + 1); }
  return m;
};

/** Settimane consecutive (fino a questa) con almeno `goal` sessioni. La settimana in corso non spezza la serie. */
export function weeklyStreak(trainings, todayIso, goal = GOAL_SETTIMANALE) {
  const c = weekCounts(trainings);
  let w = weekStart(todayIso);
  let streak = 0;
  for (let first = true, i = 0; i < 300; i++, first = false) {
    if ((c.get(w) || 0) >= goal) streak++;
    else if (!first) break;
    w = addDays(w, -7);
  }
  return streak;
}

export function longestWeekStreak(trainings, goal = GOAL_SETTIMANALE) {
  const ok = [...weekCounts(trainings)].filter(([, n]) => n >= goal).map(([w]) => w).sort();
  let best = 0;
  let run = 0;
  ok.forEach((w, i) => { run = i > 0 && addDays(ok[i - 1], 7) === w ? run + 1 : 1; best = Math.max(best, run); });
  return best;
}

// ---- record, confronti e punti da lavorare ----
/** Quante volte un risultato ha battuto tutti i precedenti confrontabili (il primo risultato non conta). */
export function recordsOf(trainings) {
  const crono = [...trainings].sort((a, b) => (a.creataIl || 0) - (b.creataIl || 0));
  let n = 0;
  crono.forEach((t, i) => {
    if (!Number.isFinite(t.metrica)) return;
    const prev = crono.slice(0, i).filter((p) => comparable(t, p) && Number.isFinite(p.metrica));
    if (prev.length && t.metrica > Math.max(...prev.map((p) => p.metrica))) n++;
  });
  return n;
}

/** Confronto "primo giro / secondo giro": le sessioni 1-2, 3-4, 5-6... di ogni tipo. */
export function pairsOf(trainings) {
  const by = new Map(trainings.map((t) => [`${t.tipo}:${t.k}`, t]));
  const out = [];
  for (const tipo of TIPI) {
    for (let j = 1; j <= SESSIONI_PER_TIPO / 2; j++) {
      const a = by.get(`${tipo}:${2 * j - 1}`);
      const b = by.get(`${tipo}:${2 * j}`);
      if (a && b && comparable(a, b) && Number.isFinite(a.metrica) && Number.isFinite(b.metrica)) {
        out.push({ tipo, a, b, delta: b.metrica - a.metrica });
      }
    }
  }
  return out.sort((x, y) => (y.b.creataIl || 0) - (x.b.creataIl || 0));
}

/** Percentuale di colpi per ogni doppia, dalla piu' debole. */
export function doppieMedie(trainings) {
  const acc = new Map(DOPPIE_BERSAGLI.map((b) => [b, { hit: 0, tot: 0 }]));
  for (const t of trainings.filter((x) => x.tipo === 'doppie')) {
    t.dati.bersagli.forEach((b, i) => {
      const a = acc.get(b);
      if (a) { a.hit += num(t.dati.hit[i]); a.tot += 20; }
    });
  }
  const rows = [...acc].filter(([, a]) => a.tot).map(([b, a]) => ({ b, pct: pct(a.hit, a.tot) }));
  return rows.length ? rows.sort((x, y) => x.pct - y.pct) : null;
}

/** I valori di checkout che riescono meno della meta' delle volte (massimo 3, dal peggiore). */
export function checkoutFails(trainings) {
  const acc = new Map();
  for (const t of trainings.filter((x) => x.tipo === 'checkout')) {
    t.dati.outs.forEach((o, i) => {
      const a = acc.get(o) || { ok: 0, n: 0 };
      a.n++;
      if (t.dati.frecce[i] > 0) a.ok++;
      acc.set(o, a);
    });
  }
  return [...acc]
    .map(([out, a]) => ({ out, rate: pct(a.ok, a.n), n: a.n }))
    .filter((r) => r.rate < 50)
    .sort((x, y) => x.rate - y.rate || x.out - y.out)
    .slice(0, 3);
}

// ---- Skill test (iniziale, intermedio, finale) ----
export const CHECKOUT_TEST = [40, 52, 61, 72, 81, 90, 100];
export const SKILL_MAX = { scoring: 90, doppie: 20, bull: 40, checkout: 7 };
const round1 = (v) => Math.round(v * 10) / 10;

export function skillQuotas(t) {
  return {
    scoring: (num(t.scoring) / 90) * 25,
    doppie: (num(t.doppie) / 20) * 25,
    bull: (num(t.bull) / 40) * 25,
    checkout: (num(t.checkout) / 7) * 25,
  };
}
/** Somma delle quattro quote senza arrotondarle prima; il totale ha una cifra decimale. */
export function skillScore(t) {
  const q = skillQuotas(t);
  return round1(q.scoring + q.doppie + q.bull + q.checkout);
}
export const testTipoFor = (tests, done) => (!tests.length ? 'iniziale' : done >= TOTALE_SESSIONI ? 'finale' : 'intermedio');
/** tests dal piu' recente. Restituisce il tipo di test da proporre, oppure null. */
export function testDue(tests, done) {
  if (!tests.length) return 'iniziale';
  const last = tests[0];
  if (done >= TOTALE_SESSIONI) return last.tipo === 'finale' ? null : 'finale';
  return done - (last.sessioniFatte || 0) >= 25 ? 'intermedio' : null;
}
