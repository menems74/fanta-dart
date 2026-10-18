/**
 * Tabella del Granboard 132: il codice inviato a ogni freccia (testo "3.4@") e il settore colpito.
 * Costruita con la taratura guidata di granboard.html. Id dei settori: S20i (singolo interno), S20o (singolo esterno),
 * T20 (triplo), D20 (doppio), B25 (bull esterno), B50 (bull interno).
 */
import { segmento } from './dartboard.js';

export const TABELLA = {
  '3.3': 'S20i',
  '3.4': 'T20',
  '3.5': 'S20o',
  '3.6': 'D20',
  '2.3': 'S1i',
  '2.4': 'T1',
  '2.5': 'S1o',
  '2.6': 'D1',
  '1.2': 'S18i',
  '1.4': 'T18',
  '1.5': 'S18o',
  '1.6': 'D18',
  '0.1': 'S4i',
  '0.3': 'T4',
  '0.5': 'S4o',
  '0.6': 'D4',
  '0.0': 'S13i',
  '0.2': 'T13',
  '0.4': 'S13o',
  '4.5': 'D13',
  '1.0': 'S6i',
  '1.1': 'T6',
  '1.3': 'S6o',
  '4.4': 'D6',
  '2.0': 'S10i',
  '2.1': 'T10',
  '2.2': 'S10o',
  '4.3': 'D10',
  '3.0': 'S15i',
  '3.1': 'T15',
  '3.2': 'S15o',
  '4.2': 'D15',
  '9.1': 'S2i',
  '9.0': 'T2',
  '9.2': 'S2o',
  '8.2': 'D2',
  '10.1': 'S17i',
  '10.0': 'T17',
  '10.2': 'S17o',
  '8.3': 'D17',
  '7.1': 'S3i',
  '7.0': 'T3',
  '7.2': 'S3o',
  '8.4': 'D3',
  '6.1': 'S19i',
  '6.0': 'T19',
  '6.3': 'S19o',
  '8.5': 'D19',
  '11.1': 'S7i',
  '11.2': 'T7',
  '11.4': 'S7o',
  '8.6': 'D7',
  '11.0': 'S16i',
  '11.3': 'T16',
  '11.5': 'S16o',
  '11.6': 'D16',
  '6.2': 'S8i',
  '6.4': 'T8',
  '6.5': 'S8o',
  '6.6': 'D8',
  '7.3': 'S11i',
  '7.4': 'T11',
  '7.5': 'S11o',
  '7.6': 'D11',
  '10.3': 'S14i',
  '10.4': 'T14',
  '10.5': 'S14o',
  '10.6': 'D14',
  '9.3': 'S9i',
  '9.4': 'T9',
  '9.5': 'S9o',
  '9.6': 'D9',
  '5.0': 'S12i',
  '5.3': 'T12',
  '5.5': 'S12o',
  '5.6': 'D12',
  '5.1': 'S5i',
  '5.2': 'T5',
  '5.4': 'S5o',
  '4.6': 'D5',
  '8.0': 'B25',
  '4.0': 'B50',
};

/** Estrae il codice ("3.4") da un messaggio della tavola ("3.4@"). Null per gli altri messaggi, come "GB8;102". */
export const codiceDaTesto = (testo) => {
  const m = /^(\d+\.\d+)@$/.exec(String(testo).trim());
  return m ? m[1] : null;
};

/** La freccia descritta da un messaggio della tavola: { id, valore, moltiplicatore, nome } oppure null. */
export function dardoDaTesto(testo) {
  const id = TABELLA[codiceDaTesto(testo)];
  const s = id && segmento(id);
  return s ? { id, valore: s.valore, moltiplicatore: s.moltiplicatore, nome: s.nome } : null;
}
