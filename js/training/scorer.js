/** Contapunti 501 (straight-in, double-out): regole, sballi e statistiche. Nessuna dipendenza dal browser. */
export const LEG_START = 501;

// Punteggi che con 3 frecce non si possono fare.
export const IMPOSSIBILI = new Set([163, 166, 169, 172, 173, 175, 176, 178, 179]);
export const visitaValida = (s) => Number.isInteger(s) && s >= 0 && s <= 180 && !IMPOSSIBILI.has(s);

const SINGOLI = Array.from({ length: 20 }, (_, i) => i + 1);
const PUNTI = new Set([0, ...SINGOLI, ...SINGOLI.map((n) => n * 2), ...SINGOLI.map((n) => n * 3), 25, 50]);
const DOPPI = new Set([...SINGOLI.map((n) => n * 2), 50]);
const somma = (a, b) => new Set([...a].flatMap((x) => [...b].map((y) => x + y)));
const F1 = DOPPI;
const F2 = somma(PUNTI, F1);
const F3 = somma(PUNTI, F2);

/** Si puo' chiudere da `r` con esattamente `n` frecce (l'ultima in doppia, bull incluso)? */
export const chiudibileIn = (r, n) => (n === 1 ? F1 : n === 2 ? F2 : F3).has(r);
export const frecceChiusura = (r) => [1, 2, 3].filter((n) => chiudibileIn(r, n));

/** Esito di una visita da `resto`: sballo se superi, lasci 1 o arrivi a 0 senza poter chiudere in doppia. */
export function applicaVisita(resto, s) {
  if (s > resto || resto - s === 1) return { esito: 'sballo', resto };
  if (s === resto) return chiudibileIn(resto, 3) ? { esito: 'chiuso', resto: 0 } : { esito: 'sballo', resto };
  return { esito: 'ok', resto: resto - s };
}

// ---- un leg e' un elenco di eventi { w: 'i' | 'b', s, d, r, esito } ----
// w: chi ha tirato (io / bot), s: punti validi (0 se sballo), d: frecce usate, r: resto prima della visita.
const sum = (a) => a.reduce((t, v) => t + v, 0);
export const restoDi = (ev, w) => ev.filter((e) => e.w === w).reduce((r, e) => (e.esito === 'sballo' ? r : r - e.s), LEG_START);
export const vincitore = (ev) => ev.find((e) => e.esito === 'chiuso')?.w ?? null;
export const prossimoTurno = (ev, starter, altro) => (ev.length % 2 === 0 ? starter : altro);
const round1 = (v) => Math.round(v * 10) / 10;

/** Riepilogo di un leg dal mio punto di vista. */
export function riepilogoLeg(leg, w = 'i') {
  const mie = leg.ev.filter((e) => e.w === w);
  const frecce = sum(mie.map((e) => e.d));
  const punti = sum(mie.map((e) => e.s));
  return { vinto: leg.vinse === w, frecce, punti, media: frecce ? round1((punti / frecce) * 3) : null, manuale: !!leg.manuale };
}

/** Statistiche della partita (tutti i leg finiti) per il giocatore `w`. */
export function statistichePartita(legs, w = 'i') {
  const mie = legs.flatMap((l) => l.ev.filter((e) => e.w === w));
  const frecce = sum(mie.map((e) => e.d));
  const punti = sum(mie.map((e) => e.s));
  const first9 = legs
    .map((l) => l.ev.filter((e) => e.w === w).slice(0, 3))
    .filter((v) => v.length === 3)
    .map((v) => (sum(v.map((e) => e.s)) / 9) * 3);
  const vinti = legs.filter((l) => l.vinse === w && !l.manuale);
  const chiusure = mie.filter((e) => e.esito === 'chiuso').map((e) => e.r);
  const buone = mie.filter((e) => e.esito !== 'sballo');
  return {
    media: frecce ? round1((punti / frecce) * 3) : null,
    first9: first9.length ? round1(sum(first9) / first9.length) : null,
    bestCheckout: chiusure.length ? Math.max(...chiusure) : null,
    bestLeg: vinti.length ? Math.min(...vinti.map((l) => sum(l.ev.filter((e) => e.w === w).map((e) => e.d)))) : null,
    v100: buone.filter((e) => e.s >= 100 && e.s < 140).length,
    v140: buone.filter((e) => e.s >= 140 && e.s < 180).length,
    v180: buone.filter((e) => e.s === 180).length,
  };
}
