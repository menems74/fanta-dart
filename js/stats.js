/** Calcoli puri su partite e pagellini (usare solo dati pubblicati). */

// A serata ogni giocatore gioca al massimo 4 singoli e 2 doppi. Un doppio vale 1 partita per ciascun compagno.
// Le partite di una serata sono sempre 20 in totale (nostre + avversarie).
export const MAX_SINGOLI = 4;
export const MAX_DOPPI = 2;
export const TOTALE_PARTITE = 20;

/** Il risultato è facoltativo: una partita futura o ancora da completare non ha punteggio. */
export const hasResult = (m) => Number.isInteger(m.puntiNoi) && Number.isInteger(m.puntiLoro);
export const scoreText = (m) => (hasResult(m) ? `${m.puntiNoi} – ${m.puntiLoro}` : '');
/** today: data odierna in formato AAAA-MM-GG. */
export const isUpcoming = (m, today) => !hasResult(m) && m.data >= today;

export function esito(m) {
  if (!hasResult(m)) return { key: 'n', label: 'Senza risultato' };
  if (m.puntiNoi > m.puntiLoro) return { key: 'w', label: 'Vinta' };
  if (m.puntiNoi < m.puntiLoro) return { key: 'l', label: 'Persa' };
  return { key: 'd', label: 'Pari' };
}

/** Stato mostrato nelle liste: esito se c'è il risultato, altrimenti se è in programma o da completare. */
export function matchStatus(m, today) {
  if (hasResult(m)) return esito(m);
  return { key: 'n', label: isUpcoming(m, today) ? 'In programma' : 'Da completare' };
}

export function recordStagione(matches) {
  const r = { w: 0, l: 0, d: 0 };
  for (const m of matches) if (hasResult(m)) r[esito(m).key]++;
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

/** Ordine: media voto, poi percentuale di vittorie, poi vittorie, poi serate, infine cognome. L'MVP è solo un badge e non conta. */
export function ranking(players, matches, cards) {
  const perc = (r) => (r.giocate ? r.vinte / r.giocate : 0);
  return players
    .map((p) => ({ player: p, ...playerStats(p.id, matches, cards) }))
    .sort((a, b) =>
      (b.media ?? -1) - (a.media ?? -1) ||
      perc(b) - perc(a) ||
      b.vinte - a.vinte ||
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
  if (t.dg % 2) {
    return { warn: `Doppi giocati inseriti: ${t.dg}. Ogni doppio coinvolge due giocatori, quindi il totale deve essere pari: controlla i pagellini.` };
  }
  if (t.dv % 2) {
    return { warn: `Doppi vinti inseriti: ${t.dv}. Ogni doppio vinto vale per entrambi i compagni, quindi il totale deve essere pari: controlla i doppi vinti nei pagellini.` };
  }
  const totale = t.sg + t.dg / 2;
  if (totale !== TOTALE_PARTITE) {
    return { warn: `Pagellini inseriti: ${totale} partite su ${TOTALE_PARTITE}. Il risultato verrà proposto appena i dati sono completi.` };
  }
  const noi = t.sv + t.dv / 2;
  return { noi, loro: totale - noi };
}

export const fmtMedia = (m) => (m == null ? '—' : m.toFixed(1).replace('.', ','));
export const fmtPerc = (v, g) => (g ? `${Math.round((v / g) * 100)}%` : '—');
