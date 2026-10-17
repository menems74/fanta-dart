// Badge: si calcolano sempre dai dati, non sono salvati. Cosi' non possono andare fuori sincrono.
import { FASI } from './catalogo.js';
import { doneNumbers, recordsOf, longestWeekStreak, skillScore } from './calc.js';

const best = (trainings, tipo) =>
  trainings.filter((t) => t.tipo === tipo && Number.isFinite(t.metrica)).reduce((m, t) => Math.max(m, t.metrica), -Infinity);
const fasePiena = (id) => (c) => {
  const f = FASI.find((x) => x.id === id);
  for (let n = f.da; n <= f.a; n++) if (!c.done.has(n)) return false;
  return true;
};

export const BADGES = [
  { id: 'prima', nome: 'Si parte', desc: 'Completa la prima sessione', icon: 'play', ok: (c) => c.count >= 1 },
  { id: 's10', nome: 'Dieci sessioni', desc: 'Completa 10 sessioni', icon: 'check', ok: (c) => c.count >= 10 },
  { id: 's50', nome: 'Metà strada', desc: 'Completa 50 sessioni', icon: 'flag', ok: (c) => c.count >= 50 },
  { id: 's100', nome: 'Percorso completo', desc: 'Completa tutte le 100 sessioni', icon: 'trophy', ok: (c) => c.count >= 100 },
  { id: 'f1', nome: 'Fondamenta superate', desc: 'Completa le sessioni 1-25', icon: 'target', ok: fasePiena('fondamenta') },
  { id: 'f2', nome: 'Costanza acquisita', desc: 'Completa le sessioni 26-50', icon: 'calendar', ok: fasePiena('costanza') },
  { id: 'f3', nome: 'Sotto pressione', desc: 'Completa le sessioni 51-75', icon: 'flame', ok: fasePiena('pressione') },
  { id: 'f4', nome: 'Pronto per la partita', desc: 'Completa le sessioni 76-100', icon: 'trophy', ok: fasePiena('pronto') },
  { id: 'rec1', nome: 'Primo record', desc: 'Batti un tuo risultato precedente', icon: 'star', ok: (c) => c.records >= 1 },
  { id: 'rec5', nome: 'Cacciatore di record', desc: 'Batti i tuoi record 5 volte', icon: 'star', ok: (c) => c.records >= 5 },
  { id: 'sc200', nome: 'Mira stabile', desc: 'Scoring: almeno 200 su 300', icon: 'target', ok: (c) => best(c.trainings, 'scoring') >= 200 },
  { id: 'db40', nome: 'Doppie solide', desc: 'Doppie: almeno 40 colpi su 80', icon: 'crosshair', ok: (c) => best(c.trainings, 'doppie') >= 40 },
  { id: 'co10', nome: 'Chiusure sicure', desc: 'Checkout: almeno 10 su 16', icon: 'flag', ok: (c) => best(c.trainings, 'checkout') >= 10 },
  { id: 'pr12', nome: 'Pressione perfetta', desc: 'Pressione: 12 visite su 12', icon: 'flame', ok: (c) => best(c.trainings, 'pressione') >= 12 },
  { id: 'pa50', nome: 'Media 50', desc: 'Partita: media di almeno 50', icon: 'trophy', ok: (c) => best(c.trainings, 'partita') >= 50 },
  { id: 'sett4', nome: 'Quattro settimane', desc: '4 settimane di fila con 2 sessioni', icon: 'calendar', ok: (c) => c.streak >= 4 },
  { id: 'test', nome: 'Punto di partenza', desc: 'Completa lo Skill test', icon: 'check', ok: (c) => c.tests.length >= 1 },
  { id: 'skill10', nome: 'Skill +10', desc: 'Migliora lo Skill Score di 10 punti', icon: 'star', ok: (c) => {
    if (c.tests.length < 2) return false;
    const crono = [...c.tests].sort((a, b) => (a.creataIl || 0) - (b.creataIl || 0));
    return skillScore(crono.at(-1)) - skillScore(crono[0]) >= 10;
  } },
];

export function earnedBadges(trainings, tests = []) {
  const c = {
    trainings, tests,
    done: doneNumbers(trainings),
    count: doneNumbers(trainings).size,
    records: recordsOf(trainings),
    streak: longestWeekStreak(trainings),
  };
  return new Set(BADGES.filter((b) => b.ok(c)).map((b) => b.id));
}

/** Badge ottenuti grazie a una sessione o a un test: quelli che prima non c'erano. */
export function newBadges(trainings, tests, { sessionId = null, testId = null } = {}) {
  const prima = earnedBadges(
    trainings.filter((t) => t.id !== sessionId),
    tests.filter((t) => t.id !== testId),
  );
  const ora = earnedBadges(trainings, tests);
  return BADGES.filter((b) => ora.has(b.id) && !prima.has(b.id));
}
