// Campionati ufficiali (statistiche da softdart.it): i dati stanno nella cartella dati/campionati del sito,
// uno per campionato, cosi' quando ne inizia uno nuovo il vecchio resta come storico.
const BASE = 'dati/campionati/';
const KEY = 'fd.campionato';

/** Elenco dei campionati, il piu' recente per primo: [{ id, nome, chiuso, fonte, aggiornato }]. */
export async function listCampionati() {
  try {
    const r = await fetch(`${BASE}indice.json`, { cache: 'no-cache' });
    return r.ok ? await r.json() : [];
  } catch { return []; }
}

const cache = new Map();
/** Dati completi di un campionato: { id, nome, chiuso, aggiornato, squadre: [{ nome, giocatori: [...] }] }. */
export async function getCampionato(id) {
  if (!cache.has(id)) {
    cache.set(id, fetch(`${BASE}${id}.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  }
  return cache.get(id);
}

/** Campionato scelto l'ultima volta su questo dispositivo, oppure il piu' recente. */
export function campionatoScelto(elenco) {
  let id = null;
  try { id = localStorage.getItem(KEY); } catch { /* niente memoria locale */ }
  return elenco.find((c) => c.id === id) || elenco[0] || null;
}
export function scegliCampionato(id) {
  try { localStorage.setItem(KEY, id); } catch { /* niente memoria locale */ }
}

/** Tutti i giocatori del campionato, ognuno con la sua squadra. */
export const giocatoriDi = (camp) => (camp?.squadre || []).flatMap((s) => s.giocatori.map((g) => ({ ...g, squadra: s.nome })));

/** La nostra squadra: quella con piu' tessere in comune con i giocatori dell'app. */
export function nostraSquadra(camp, tessere) {
  const set = new Set(tessere);
  let migliore = null;
  let max = 0;
  for (const s of camp?.squadre || []) {
    const n = s.giocatori.filter((g) => set.has(g.tessera)).length;
    if (n > max) { max = n; migliore = s.nome; }
  }
  return migliore;
}

/** Giornate giocate (con almeno un set); null se il campionato non ha il dettaglio per giornata. */
export const giornateGiocate = (g) => (g.giornate?.length ? g.giornate.filter(([set]) => set > 0).length : null);

/** Ordina per punti (poi media) o per media (poi punti); chi non ha giocato va in fondo. */
export function ordina(giocatori, criterio = 'punti') {
  return [...giocatori].sort((a, b) => (b.set > 0) - (a.set > 0)
    || (criterio === 'media' ? b.media - a.media || b.punti - a.punti : b.punti - a.punti || b.media - a.media)
    || a.nome.localeCompare(b.nome, 'it'));
}

export const fmtMediaCamp = (m) => (Number.isFinite(m) ? m.toFixed(2).replace('.', ',') : '–');
export const fmtAggiornato = (iso) => (iso ? new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
