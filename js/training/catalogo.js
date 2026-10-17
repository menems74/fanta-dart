/**
 * Catalogo del percorso di allenamento: 100 sessioni, 20 per tipo.
 * Le sessioni seguono sempre il ciclo scoring, doppie, checkout, pressione, partita:
 * la sessione n e' del tipo (n - 1) % 5. Ogni giocatore avanza per tipo: la sessione "k" di un tipo
 * corrisponde al numero n = 5 * (k - 1) + posizione del tipo.
 */
export const TIPI = ['scoring', 'doppie', 'checkout', 'pressione', 'partita'];
export const SESSIONI_PER_TIPO = 20;
export const TOTALE_SESSIONI = 100;

export const TIPO_INFO = {
  scoring: { label: 'Scoring', desc: '100 frecce al 20', icon: 'target' },
  doppie: { label: 'Doppie', desc: '4 doppie da 20 frecce', icon: 'crosshair' },
  checkout: { label: 'Checkout', desc: '16 chiusure da 40 a 100', icon: 'flag' },
  pressione: { label: 'Pressione', desc: '12 visite, un bersaglio alla volta', icon: 'flame' },
  partita: { label: 'Partita', desc: 'Un match 501 con le statistiche', icon: 'trophy' },
};

export const FASI = [
  { id: 'fondamenta', nome: 'Fondamenta', breve: 'Fondamenta', da: 1, a: 25 },
  { id: 'costanza', nome: 'Costanza', breve: 'Costanza', da: 26, a: 50 },
  { id: 'pressione', nome: 'Pressione', breve: 'Pressione', da: 51, a: 75 },
  { id: 'pronto', nome: 'Pronto per la partita', breve: 'Pronto', da: 76, a: 100 },
];

export const DOPPIE_BERSAGLI = ['D20', 'D16', 'D10', 'D8'];
export const CHECKOUT_OUTS = Array.from({ length: 16 }, (_, i) => 40 + 4 * i);
export const SERIE_SCORING = 10;
export const VISITE_PRESSIONE = 12;

export const numeroOf = (tipo, k) => 5 * (k - 1) + TIPI.indexOf(tipo) + 1;
export const faseOf = (n) => FASI.find((f) => n >= f.da && n <= f.a) || FASI[FASI.length - 1];
export const isCheckpoint = (n) => n % 10 === 0;

// Bersagli della pressione per numero di sessione (3 bersagli ripetuti 4 volte).
// Le sessioni 29 e 49 non erano nelle pagine ricevute: bersagli scelti seguendo la rotazione.
const PRESSIONE = {
  4: ['S20', 'S19', 'S18'], 9: ['D20', 'D16', 'D10'], 14: ['T20', 'T19', 'T18'],
  19: ['D20', 'D10', 'D5'], 24: ['D16', 'D8', 'D4'], 29: ['D20', 'D16', 'D10'],
  34: ['D20', 'D16', 'D8'], 39: ['T20', 'T19', 'T18'], 44: ['D12', 'D6', 'D3'],
  49: ['D16', 'D8', 'D4'], 54: ['S20', 'S19', 'S18'], 59: ['D20', 'D16', 'D10'],
  64: ['T20', 'T19', 'T18'], 69: ['D14', 'D7', 'D8'], 74: ['D20', 'D16', 'B50'],
  79: ['D20', 'D16', 'D8'], 84: ['T20', 'T19', 'T18'], 89: ['D10', 'D8', 'D4'],
  94: ['D20', 'D16', 'B50'], 99: ['D20', 'D16', 'D8'],
};
// Colpi minimi su 3 frecce perche' una visita riesca (1 se non indicato).
const SOGLIA = { 54: 3, 79: 2, 89: 2, 99: 2 };

/** Leg da vincere in una partita: meglio di 3, 5, 7 o 9 a seconda della fase. */
export const legsToWin = (n) => (n <= 25 ? 2 : n <= 50 ? 3 : n <= 75 ? 4 : 5);

export function sessionInfo(tipo, k) {
  const n = numeroOf(tipo, k);
  const info = { tipo, k, n, fase: faseOf(n) };
  if (tipo === 'pressione') {
    const base = PRESSIONE[n];
    info.base = base;
    info.bersagli = Array.from({ length: VISITE_PRESSIONE }, (_, i) => base[i % 3]);
    info.soglia = SOGLIA[n] || 1;
  }
  if (tipo === 'partita') info.legsToWin = legsToWin(n);
  return info;
}

/** Due sessioni sono confrontabili solo se hanno le stesse regole (la pressione cambia bersagli e soglia). */
export const signatureOf = (t) =>
  t.tipo === 'pressione' && t.dati?.bersagli
    ? `${t.dati.bersagli.slice(0, 3).join('-')}|${t.dati.soglia}`
    : t.tipo;
