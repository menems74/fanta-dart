// Led del Granboard: comandi da 16 byte ricavati dal traffico dell'app ufficiale (vedi README).
// Byte 0: effetto. Per i colpi: 01 singolo, 02 doppio, 03 triplo; byte 1-3, 4-6 (e 7-9 nel triplo) colore RGB;
// byte 10: settore da accendere, con il codice dell'anello di 60 led: (25 + 3 * posizione) mod 60,
// posizione in senso orario dal 20. Nessuna dipendenza dal browser.
import { SETTORI } from '../dartboard.js';

export const ROSSO = [0x7d, 0, 0];
export const VERDE = [0, 0x7d, 0];

const hex = (s) => Uint8Array.from(s.match(/../g).map((b) => parseInt(b, 16)));
export const EFFETTI = {
  attesa: hex('1600000000000000000000006e000000'),
  inizio: hex('0d7d0000000000000000000205020000'),
  fine: hex('147d00007d0000000000000205010000'),
  cambioTurno: hex('117d00007d0000000000100005000000'),
  ton: hex('12ff6600000000000000370105050000'), // turno da 100 o piu'
  treTripli: hex('0c000000000000000000000010000000'), // tre tripli uguali
  max: hex('0f000000000000000000030005100000'), // 180
  fuori: hex('174b007d00000000000000000b010000'),
  bull: hex('1f4b007d4b007d00487d000023010000'),
  spento: hex('01000000000000000000000000000000'),
};

/** Codice del led per il numero n (1-20). */
export const codiceLed = (n) => (25 + 3 * SETTORI.indexOf(n)) % 60;

/** Comando per accendere il settore colpito: id come 'S20o', 'D16', 'T19', 'B50' o 'X' (fuori). */
export function comandoColpo(id, colore = ROSSO) {
  if (id === 'X') return EFFETTI.fuori;
  if (id === 'B25' || id === 'B50') return EFFETTI.bull;
  const m = /^([SDT])(\d+)/.exec(id);
  if (!m) return null;
  const anello = { S: 1, D: 2, T: 3 }[m[1]];
  return Uint8Array.from([anello, ...colore, ...colore, ...(anello === 3 ? colore : [0, 0, 0]), codiceLed(Number(m[2])), 0, 0x14, 0, 0, 0]);
}

const punti = (id) => {
  if (id === 'B50') return 50;
  if (id === 'B25') return 25;
  const m = /^([SDT])(\d+)/.exec(id);
  return m ? Number(m[2]) * { S: 1, D: 2, T: 3 }[m[1]] : 0;
};

/** Effetto speciale a fine turno (3 frecce): 180, tre tripli uguali, 100 o piu'. Null per un turno normale. */
export function effettoTurno(ids) {
  if (ids.length !== 3) return null;
  const tot = ids.reduce((t, id) => t + punti(id), 0);
  if (tot === 180) return EFFETTI.max;
  if (ids[0].startsWith('T') && ids.every((id) => id === ids[0])) return EFFETTI.treTripli;
  if (tot >= 100) return EFFETTI.ton;
  return null;
}
