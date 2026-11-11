// Chiusure consigliate (double out). Strade standard delle freccette, riscritte come dati nostri.
// TRE: con 3 frecce sopra 100 · DUE: con 2 frecce · IN_MANO: sotto 100 con 3 frecce (doppia migliore o
// strada che resta buona se sbagli la prima). Etichette: T20, D16, 20 (singolo), 25 (bull esterno), Bull (50).
const tab = (s) => Object.fromEntries(s.trim().split(/\s*;\s*/).map((r) => {
  const [n, ...strada] = r.split(/\s+/);
  return [Number(n), strada];
}));

const TRE = tab(`
170 T20 T20 Bull; 167 T20 T19 Bull; 164 T20 T18 Bull; 161 T20 T17 Bull; 160 T20 T20 D20; 158 T20 T20 D19;
157 T20 T19 D20; 156 T20 T20 D18; 155 T20 T19 D19; 154 T20 T18 D20; 153 T20 T19 D18; 152 T20 T20 D16;
151 T20 T17 D20; 150 T20 T18 D18; 149 T20 T19 D16; 148 T20 T16 D20; 147 T20 T17 D18; 146 T20 T18 D16;
145 T20 T15 D20; 144 T20 T20 D12; 143 T20 T17 D16; 142 T20 T14 D20; 141 T20 T15 D18; 140 T20 T20 D10;
139 T20 T19 D11; 138 T20 T18 D12; 137 T20 T19 D10; 136 T20 T20 D8; 135 Bull T15 D20; 134 T20 T14 D16;
133 T20 T19 D8; 132 Bull T14 D20; 131 T20 T13 D16; 130 T20 20 Bull; 129 T19 T16 D12; 128 T18 T18 D10;
127 T20 T17 D8; 126 T19 19 Bull; 125 Bull 25 Bull; 124 T20 T14 D11; 123 T19 T16 D9; 122 T18 T18 D7;
121 T20 T11 D14; 120 T20 20 D20; 119 T19 T12 D13; 118 T20 18 D20; 117 T20 17 D20; 116 T20 16 D20;
115 T20 15 D20; 114 T18 20 D20; 113 T19 16 D20; 112 T20 12 D20; 111 T20 11 D20; 110 T20 10 D20;
109 T20 9 D20; 108 T18 14 D20; 107 T19 10 D20; 106 T20 14 D16; 105 T20 13 D16; 104 T19 15 D16;
103 T19 10 D18; 102 T20 10 D16; 101 T20 9 D16`);

const DUE = tab(`
110 T20 Bull; 107 T19 Bull; 104 T18 Bull; 101 T17 Bull; 100 T20 D20; 98 T20 D19; 97 T19 D20; 96 T20 D18;
95 T19 D19; 94 T18 D20; 93 T19 D18; 92 T20 D16; 91 T17 D20; 90 T18 D18; 89 T19 D16; 88 T20 D14; 87 T17 D18;
86 T18 D16; 85 T15 D20; 84 T20 D12; 83 T17 D16; 82 T14 D20; 81 T15 D18; 80 T20 D10; 79 T19 D11; 78 T18 D12;
77 T19 D10; 76 T20 D8; 75 T17 D12; 74 T14 D16; 73 T19 D8; 72 T16 D12; 71 T13 D16; 70 T20 D5; 69 T19 D6;
68 T18 D7; 67 T17 D8; 66 T16 D9; 65 T15 D10; 64 T14 D11; 63 T13 D12; 62 T12 D13; 61 T11 D14; 60 20 D20;
59 19 D20; 58 18 D20; 57 17 D20; 56 16 D20; 55 15 D20; 54 14 D20; 53 13 D20; 52 12 D20; 51 11 D20; 50 10 D20;
49 9 D20; 48 8 D20; 47 15 D16; 46 10 D18; 45 13 D16; 44 12 D16; 43 11 D16; 42 10 D16; 41 9 D16`);

const IN_MANO = tab(`
100 T20 D20; 99 T19 10 D16; 98 T20 D19; 97 T19 D20; 96 T20 D18; 95 Bull 13 D16; 94 Bull 12 D16; 93 Bull 11 D16;
92 Bull 10 D16; 91 Bull 9 D16; 90 T20 D15; 89 T19 D16; 88 T20 D14; 87 T17 D18; 86 T18 D16; 85 T15 D20;
84 T20 D12; 83 T17 D16; 82 Bull D16; 81 T15 D18; 80 T20 D10; 79 T19 D11; 78 T18 D12; 77 T19 D10; 76 T20 D8;
75 T17 D12; 74 T14 D16; 73 T19 D8; 72 T12 D18; 71 T13 D16; 70 T18 D8; 69 T19 D6; 68 T20 D4; 67 T17 D8;
66 T10 D18; 65 T11 D16; 64 T16 D8; 63 T13 D12; 62 T10 D16; 61 25 D18; 60 20 D20; 59 19 D20; 58 18 D20;
57 17 D20; 56 16 D20; 55 15 D20; 54 14 D20; 53 13 D20; 52 12 D20; 51 11 D20; 50 10 D20; 49 9 D20; 48 8 D20;
47 15 D16; 46 10 D18; 45 13 D16; 44 12 D16; 43 11 D16; 42 10 D16; 41 9 D16; 40 D20; 39 7 D16; 38 D19;
37 5 D16; 36 D18; 35 3 D16; 34 D17; 33 1 D16; 32 D16; 31 7 D12; 30 D15; 29 5 D12; 28 D14; 27 3 D12; 26 D13;
25 1 D12; 24 D12; 23 7 D8; 22 D11; 21 5 D8; 20 D10; 19 3 D8; 18 D9; 17 9 D4; 16 D8; 15 7 D4; 14 D7; 13 5 D4;
12 D6; 11 3 D4; 10 D5; 9 1 D4; 8 D4; 7 3 D2; 6 D3; 5 1 D2; 4 D2; 3 1 D1; 2 D1`);

export const TABELLE = { TRE, DUE, IN_MANO };

/** Punti di un'etichetta (T20 = 60, D16 = 32, Bull = 50, 25 = 25, 7 = 7). */
export function puntiEtichetta(e) {
  if (e === 'Bull') return 50;
  const m = /^([TD]?)(\d+)$/.exec(e);
  if (!m) return 0;
  return Number(m[2]) * (m[1] === 'T' ? 3 : m[1] === 'D' ? 2 : 1);
}
/** Etichetta di una freccia dal suo id sulla tavola (T20, D16, S20i, S20o, B25, B50, X). */
export function etichettaId(id) {
  if (id === 'B50') return 'Bull';
  if (id === 'B25') return '25';
  const m = /^([SDT])(\d+)/.exec(id || '');
  return m ? (m[1] === 'S' ? m[2] : `${m[1]}${m[2]}`) : null;
}

/** Strada consigliata per chiudere `resto` con `frecce` frecce (1-3), o null se non si chiude. */
export function chiusura(resto, frecce = 3) {
  if (!Number.isInteger(resto) || resto < 2 || frecce < 1) return null;
  if (frecce === 1) return resto === 50 ? ['Bull'] : resto <= 40 && resto % 2 === 0 ? [`D${resto / 2}`] : null;
  if (frecce === 2) return DUE[resto] || (resto <= 40 ? IN_MANO[resto] : null) || null;
  return (resto > 100 ? TRE[resto] : IN_MANO[resto]) || null;
}

/**
 * Suggerimento durante un turno: `inizio` = resto a inizio turno, `turno` = id delle frecce gia' tirate.
 * Se stai seguendo la strada consigliata la tiene (con le frecce fatte barrate), altrimenti la ricalcola.
 * Ritorna { strada, fatte, frecce } oppure null.
 */
export function suggerimento(inizio, turno = []) {
  const k = turno.length;
  if (k >= 3) return null;
  const base = chiusura(inizio, 3);
  const tirate = turno.map(etichettaId);
  if (base && k > 0 && k < base.length && tirate.every((e, i) => e === base[i])) return { strada: base, fatte: k, frecce: 3 - k };
  const ora = inizio - tirate.reduce((t, e) => t + (e ? puntiEtichetta(e) : 0), 0);
  const strada = chiusura(ora, 3 - k);
  return strada ? { strada, fatte: 0, frecce: 3 - k } : null;
}
