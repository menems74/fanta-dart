/** Calcoli puri su partite e pagellini (usare solo dati pubblicati). */

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

export function playerStats(playerId, matches, cards) {
  const mine = cards.filter((c) => c.playerId === playerId);
  const partite = mine.length;
  const media = partite ? mine.reduce((s, c) => s + c.voto, 0) / partite : null;
  const vinte = mine.reduce((s, c) => s + (c.partiteVinte || 0), 0);
  const mvp = matches.filter((m) => m.mvpPlayerId === playerId).length;
  return { partite, media, vinte, mvp };
}

export function ranking(players, matches, cards) {
  return players
    .map((p) => ({ player: p, ...playerStats(p.id, matches, cards) }))
    .sort((a, b) =>
      (b.media ?? -1) - (a.media ?? -1) ||
      b.mvp - a.mvp ||
      b.partite - a.partite ||
      a.player.cognome.localeCompare(b.player.cognome, 'it'));
}

export const fmtMedia = (m) => (m == null ? '—' : m.toFixed(1).replace('.', ','));
