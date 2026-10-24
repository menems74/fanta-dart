// Lettura del PDF delle statistiche dei campionati softdart.it (generato da JasperReports).
// Ogni pagina ha una o piu' squadre, una sotto l'altra: intestazione con il nome della squadra, poi per ogni giocatore
// una riga con nome, tessera, set, punti e media e, appena sotto, 20 numeri: set e punti di ogni giornata (1-10).
// Funziona sia in Node sia nel browser: `inflate` decomprime gli stream del PDF (zlib).

const TESSERA = /^\d{2}\/\d{1,5}$/;
const numero = (t) => Number(String(t).replace(',', '.'));

/** Testi della pagina con posizione: { x, y, size, testo }. */
function testiDi(stream) {
  const s = typeof stream === 'string' ? stream : new TextDecoder('latin1').decode(stream);
  const out = [];
  for (const bt of s.matchAll(/BT([\s\S]*?)ET/g)) {
    const blk = bt[1];
    const tm = /([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) Tm/.exec(blk);
    const tf = /\/\w+ ([\d.]+) Tf/.exec(blk);
    const testo = [...blk.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)].map((m) => m[1].replace(/\\(.)/g, '$1')).join('').trim();
    if (testo && tm) out.push({ x: Number(tm[5]), y: Number(tm[6]), size: tf ? Number(tf[1]) : 0, testo });
  }
  return out;
}

/** Gli stream di contenuto del PDF, decompressi. */
function streamsDi(pdf, inflate) {
  const bytes = pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf);
  const latin = new TextDecoder('latin1').decode(bytes);
  const out = [];
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(latin))) {
    const inizio = m.index + m[0].length;
    const fine = latin.indexOf('endstream', inizio);
    if (fine < 0) break;
    let dati = bytes.subarray(inizio, fine);
    while (dati.length && (dati[dati.length - 1] === 10 || dati[dati.length - 1] === 13)) dati = dati.subarray(0, dati.length - 1);
    try {
      const testo = new TextDecoder('latin1').decode(inflate(dati));
      if (testo.includes('Tj')) out.push(testo);
    } catch { /* immagini o stream non compressi: non servono */ }
    re.lastIndex = fine + 9;
  }
  return out;
}

/** Squadre e giocatori: [{ nome, giocatori: [{ nome, tessera, set, punti, media, giornate: [[set, punti] x 10] }] }]. */
export function analizzaPdf(pdf, inflate) {
  const squadre = [];
  for (const stream of streamsDi(pdf, inflate)) {
    const testi = testiDi(stream);
    // righe: testi con la stessa y (arrotondata)
    const righe = new Map();
    for (const t of testi) {
      const y = Math.round(t.y);
      if (!righe.has(y)) righe.set(y, []);
      righe.get(y).push(t);
    }
    const ys = [...righe.keys()].sort((a, b) => b - a); // dall'alto in basso
    let squadra = null;
    for (const y of ys) {
      const riga = righe.get(y).sort((a, b) => a.x - b.x);
      // intestazione della squadra: un solo testo grande (corpo 10) a sinistra
      if (riga.length === 1 && riga[0].size >= 10 && riga[0].x < 300 && riga[0].testo) {
        squadra = { nome: riga[0].testo, giocatori: [] };
        squadre.push(squadra);
        continue;
      }
      const it = riga.findIndex((t) => TESSERA.test(t.testo));
      if (it < 1 || !squadra) continue;
      const nome = riga.slice(0, it).map((t) => t.testo).join(' ');
      const [set, punti, media] = riga.slice(it + 1, it + 4).map((t) => numero(t.testo));
      // la riga delle giornate e' subito sotto (y - 1 circa): 20 numeri
      const sotto = ys.filter((yy) => yy < y && y - yy <= 3).map((yy) => righe.get(yy)).find((r) => r.length >= 20 && r.every((t) => /^\d+$/.test(t.testo)));
      const valori = sotto ? sotto.sort((a, b) => a.x - b.x).map((t) => Number(t.testo)) : [];
      const giornate = Array.from({ length: Math.floor(valori.length / 2) }, (_, i) => [valori[2 * i], valori[2 * i + 1]]);
      squadra.giocatori.push({ nome, tessera: riga[it].testo, set, punti, media, giornate });
    }
  }
  return squadre.filter((s) => s.giocatori.length);
}
