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

// ---------- incontri (sfide singole e doppie), quando il campionato li ha ----------
/** Sfide vinte dalla casa e dall'ospite in un incontro (una sfida si vince con 2 set). */
export function risultatoIncontro(inc) {
  return inc.giochi.reduce(([c, o], g) => (g.set[0] > g.set[1] ? [c + 1, o] : [c, o + 1]), [0, 0]);
}

/** Bilancio di un giocatore negli incontri: singoli e doppi giocati e vinti, set vinti e persi. Null se non ci sono incontri. */
export function bilancio(camp, nome) {
  if (!camp?.incontri?.length) return null;
  const b = { sg: 0, sv: 0, dg: 0, dv: 0, setV: 0, setP: 0 };
  for (const inc of camp.incontri) {
    for (const g of inc.giochi) {
      const lato = g.casa.includes(nome) ? 0 : g.ospite.includes(nome) ? 1 : -1;
      if (lato < 0) continue;
      const doppio = g.casa.length > 1;
      const vinto = g.set[lato] > g.set[1 - lato];
      b[doppio ? 'dg' : 'sg'] += 1;
      if (vinto) b[doppio ? 'dv' : 'sv'] += 1;
      b.setV += g.set[lato];
      b.setP += g.set[1 - lato];
    }
  }
  return b.sg + b.dg ? b : null;
}
export const fmtBilancio = (b) => (b ? `singoli ${b.sv}/${b.sg} · doppi ${b.dv}/${b.dg}` : '');
