/** Calcoli puri sulle sessioni di allenamento (nessuna dipendenza dal browser). */
import { SESSIONI_PER_TIPO, TOTALE_SESSIONI, faseOf, signatureOf } from './catalogo.js';

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
