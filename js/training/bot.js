/** Avversario simulato: tira visite casuali attorno alla sua media e prova a chiudere quando e' vicino. */
import { IMPOSSIBILI, chiudibileIn, frecceChiusura } from './scorer.js';

export const BOT_LIVELLI = [
  { id: 'facile', nome: 'Facile', media: 30 },
  { id: 'medio', nome: 'Medio', media: 40 },
  { id: 'difficile', nome: 'Difficile', media: 50 },
  { id: 'esperto', nome: 'Esperto', media: 60 },
];
export const livelloBot = (id) => BOT_LIVELLI.find((l) => l.id === id) || BOT_LIVELLI[1];

const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

/** Una visita del bot da `resto`: { s, d, esito }. `rng` restituisce numeri in [0, 1). */
export function visitaBot(resto, media, rng = Math.random) {
  const q = Math.min(1.6, Math.max(0.5, media / 45));

  // Zona di chiusura: piu' e' facile il finale, piu' e' probabile che il bot chiuda.
  if (resto <= 170 && chiudibileIn(resto, 3)) {
    const uno = chiudibileIn(resto, 1);
    const base = uno ? 0.38 : resto <= 100 ? 0.16 : 0.05;
    if (rng() < Math.min(0.9, base * q * q)) {
      const possibili = frecceChiusura(resto);
      const pesi = { 1: 0.5, 2: 0.3, 3: 0.2 };
      const tot = possibili.reduce((t, n) => t + pesi[n], 0);
      let x = rng() * tot;
      let d = possibili[possibili.length - 1];
      for (const n of possibili) { x -= pesi[n]; if (x <= 0) { d = n; break; } }
      return { s: resto, d, esito: 'chiuso' };
    }
  }

  let s = Math.round(media + gauss(rng) * media * 0.45);
  s = Math.max(0, Math.min(180, s));
  // Vicino al finale non vuole sballare: lascia almeno 2 (o sbaglia la visita).
  if (resto - s < 2) s = rng() < 0.35 ? 0 : Math.max(0, Math.min(s, resto - 2));
  while (IMPOSSIBILI.has(s)) s--;
  return { s, d: 3, esito: 'ok' };
}
