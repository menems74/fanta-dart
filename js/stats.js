/** Calcoli puri su partite e pagellini (usare solo dati pubblicati). */

// A serata ogni giocatore gioca al massimo 4 singoli e 2 doppi. Un doppio vale 1 partita per ciascun compagno.
// Le partite di una serata sono sempre 20 in totale (nostre + avversarie).
export const MAX_SINGOLI = 4;
export const MAX_DOPPI = 2;
export const TOTALE_PARTITE = 20;

export function esito(m) {
  if (m.puntiNoi > m.puntiLoro) return { key: 'w', label: 'Vinta' };
  if (m.puntiNoi < m.puntiLoro) return { key: 'l', label: 'Persa' };
  return { key: 'd', label: 'Pari' };
}

export function recordStagione(matches) {
  const r = { w: 0, l: 0, d: 0 };
  for (const m of matches) r[esito(m).key]++;
  return r;
}

const n = (v) => (Number.isFinite(v) ? v : 0);

/** Partite vinte e giocate di un pagellino. */
export function gamesOf(c) {
  const sg = n(c.singoliGiocati), sv = n(c.singoliVinti);
  const dg = n(c.doppiGiocati), dv = n(c.doppiVinti);
  return { sg, sv, dg, dv, giocate: sg + dg, vinte: sv + dv };
}

export function playerStats(playerId, matches, cards) {
  const mine = cards.filter((c) => c.playerId === playerId);
  const serate = mine.length;
  const media = serate ? mine.reduce((s, c) => s + c.voto, 0) / serate : null;
  const t = { sg: 0, sv: 0, dg: 0, dv: 0 };
  for (const c of mine) {
    const g = gamesOf(c);
    t.sg += g.sg; t.sv += g.sv; t.dg += g.dg; t.dv += g.dv;
  }
  const mvp = matches.filter((m) => m.mvpPlayerId === playerId).length;
  return { serate, media, ...t, giocate: t.sg + t.dg, vinte: t.sv + t.dv, mvp };
}

export function ranking(players, matches, cards) {
  return players
    .map((p) => ({ player: p, ...playerStats(p.id, matches, cards) }))
    .sort((a, b) =>
      (b.media ?? -1) - (a.media ?? -1) ||
      b.mvp - a.mvp ||
      b.serate - a.serate ||
      a.player.cognome.localeCompare(b.player.cognome, 'it'));
}

/**
 * Punteggio della serata ricavato dai pagellini: i singoli contano uno a testa,
 * ogni doppio conta una volta sola (vale per entrambi i compagni, quindi si divide per 2).
 * Restituisce { warn } se i doppi non quadrano (somma dispari).
 */
export function suggestedScore(cards) {
  const t = { sg: 0, sv: 0, dg: 0, dv: 0 };
  for (const c of cards) {
    const g = gamesOf(c);
    t.sg += g.sg; t.sv += g.sv; t.dg += g.dg; t.dv += g.dv;
  }
  if (t.dg % 2 || t.dv % 2) {
    return { warn: 'I doppi non quadrano: ogni doppio coinvolge due giocatori, controlla i pagellini.' };
  }
  const totale = t.sg + t.dg / 2;
  if (totale !== TOTALE_PARTITE) {
    return { warn: `I pagellini coprono ${totale} partite su ${TOTALE_PARTITE}: controlla che ci siano tutti i giocatori e i dati inseriti.` };
  }
  const noi = t.sv + t.dv / 2;
  return { noi, loro: totale - noi };
}

export const fmtMedia = (m) => (m == null ? '—' : m.toFixed(1).replace('.', ','));
export const fmtPerc = (v, g) => (g ? `${Math.round((v / g) * 100)}%` : '—');
