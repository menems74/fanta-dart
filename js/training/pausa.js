// Pausa dopo il turno (con il Granboard): il tempo per togliere le freccette.
// Ognuno la sceglie una volta; resta salvata su questo dispositivo, distinta per giocatore.
import { session } from '../auth.js';

export const PAUSE = [0, 3, 4, 5, 6, 8, 10]; // secondi, 0 = nessuna pausa
const PREDEFINITA = 6;
const chiave = () => `fd.pausa.${session.account?.playerId || 'anonimo'}`;

/** Secondi di pausa scelti (6 se non e' mai stata scelta). */
export function pausaSecondi() {
  try {
    const v = Number(localStorage.getItem(chiave()));
    return localStorage.getItem(chiave()) != null && PAUSE.includes(v) ? v : PREDEFINITA;
  } catch { return PREDEFINITA; }
}
export const pausaMs = () => pausaSecondi() * 1000;
export function impostaPausa(secondi) {
  try { localStorage.setItem(chiave(), String(secondi)); } catch { /* senza memoria locale resta quella predefinita */ }
}
export const etichettaPausa = (secondi) => (secondi ? `${secondi} s` : 'Nessuna');

/** Quando parte l'animazione di cambio turno dopo la terza freccia: quando mancano 2 secondi alla fine della pausa. */
export function ritardoCambioTurno() {
  const ms = pausaMs();
  if (!ms) return 1500; // senza pausa: subito dopo il colpo
  return Math.max(0, ms - 2000);
}
