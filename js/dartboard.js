/** Geometria del bersaglio: i suoi 82 settori e un disegno SVG. Nessuna dipendenza dal browser. */
export const SETTORI = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]; // dall'alto, in senso orario

// Raggi in unita' del disegno (il bordo esterno del doppio vale 100): proporzioni di un bersaglio regolamentare.
const R = { bullIn: 3.7, bullOut: 9.35, triIn: 58.2, triOut: 62.9, dblIn: 95.3, dblOut: 100 };
const ANELLI = [
  ['i', R.bullOut, R.triIn, 'Singolo interno'],
  ['t', R.triIn, R.triOut, 'Triplo'],
  ['o', R.triOut, R.dblIn, 'Singolo esterno'],
  ['d', R.dblIn, R.dblOut, 'Doppio'],
];
const r2 = (v) => Math.round(v * 100) / 100;
const pt = (r, deg) => { const a = (deg * Math.PI) / 180; return `${r2(r * Math.sin(a))} ${r2(-r * Math.cos(a))}`; };

const cerchio = (r) => `M ${-r} 0 A ${r} ${r} 0 1 0 ${r} 0 A ${r} ${r} 0 1 0 ${-r} 0 Z`;

function spicchio(r1, r2_, a0, a1) {
  return `M ${pt(r1, a0)} L ${pt(r2_, a0)} A ${r2_} ${r2_} 0 0 1 ${pt(r2_, a1)} L ${pt(r1, a1)} A ${r1} ${r1} 0 0 0 ${pt(r1, a0)} Z`;
}

/** Tutti i settori: { id, nome, descr, n, valore, anello, path }. Id: T20, D20, S20i (interno), S20o (esterno), B25, B50. */
export function segmenti() {
  const out = [];
  SETTORI.forEach((n, i) => {
    const a0 = i * 18 - 9;
    for (const [codice, ra, rb, nome] of ANELLI) {
      const m = codice === 't' ? 3 : codice === 'd' ? 2 : 1;
      out.push({
        id: codice === 't' ? `T${n}` : codice === 'd' ? `D${n}` : `S${n}${codice}`,
        nome: `${n} · ${nome}`, descr: nome, n, valore: n * m, moltiplicatore: m, anello: codice, pari: i % 2 === 0,
        path: spicchio(ra, rb, a0, a0 + 18),
      });
    }
  });
  out.push({ id: 'B25', nome: 'Bull esterno (25)', descr: 'Anello verde attorno al centro', n: 25, valore: 25, moltiplicatore: 1, anello: 'b', path: `${cerchio(R.bullOut)} ${cerchio(R.bullIn)}`, evenodd: true });
  out.push({ id: 'B50', nome: 'Bull interno (50)', descr: 'Il centro', n: 25, valore: 50, moltiplicatore: 2, anello: 'b', path: cerchio(R.bullIn) });
  return out;
}

export const SEGMENTI = segmenti();
export const segmento = (id) => SEGMENTI.find((s) => s.id === id);

/** Ordine della taratura: settore per settore (interno, triplo, esterno, doppio) e infine i due bull. */
export const ordineTaratura = () => [
  ...SETTORI.flatMap((n) => [`S${n}i`, `T${n}`, `S${n}o`, `D${n}`]),
  'B25', 'B50',
];

/** Disegno SVG del bersaglio. done: id gia' tarati (verdi), current: id da colpire (oro). */
export function disegnoBersaglio({ done = new Set(), current = null } = {}) {
  const paths = SEGMENTI.map((s) => {
    const cls = ['seg', s.pari ? 'alt' : '', done.has(s.id) ? 'done' : '', s.id === current ? 'cur' : ''].filter(Boolean).join(' ');
    return `<path class="${cls}" d="${s.path}"${s.evenodd ? ' fill-rule="evenodd"' : ''}/>`;
  }).join('');
  const numeri = SETTORI.map((n, i) => {
    const [x, y] = pt(108, i * 18).split(' ');
    return `<text x="${x}" y="${y}">${n}</text>`;
  }).join('');
  return `<svg class="dboard" viewBox="-116 -116 232 232" role="img" aria-label="Bersaglio">${paths}${numeri}</svg>`;
}

/** Come si mostra una freccia: 20 (singolo), T20, D16, 25, Bull. 'X' e' una freccia fuori dal bersaglio. */
export function etichettaDardo(id) {
  if (id === 'X') return '0';
  if (id === 'B25') return '25';
  if (id === 'B50') return 'Bull';
  const m = /^([STD])(\d+)/.exec(id);
  return m[1] === 'S' ? m[2] : `${m[1]}${m[2]}`;
}
