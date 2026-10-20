// Regole dei giochi di allenamento. Nessuna dipendenza dal browser: si prova con node --test.
// Ogni gioco e' un "motore": crea(opzioni) da' lo stato iniziale, passo(stato, evento) quello successivo.
// Gli eventi sono { t: 'd', id } per una freccia (id del settore, 'X' = fuori) o eventi rapidi del gioco
// (somma del turno, colpi del turno, esito di un checkout). Lo stato si ricostruisce rigiocando gli eventi:
// cosi' "Annulla" toglie l'ultimo evento e la bozza salva solo opzioni ed eventi.
import { segmento } from '../dartboard.js';
import { visitaValida, applicaVisita, elaboraTurno } from './scorer.js';

const somma = (a) => a.reduce((t, v) => t + v, 0);
const clamp = (v) => Math.max(0, Math.min(100, v));
const lineare = (v, zero, cento) => clamp(((v - zero) / (cento - zero)) * 100);

/** Freccia da id: { id, v (punti), m (moltiplicatore), n (numero, 25 per il bull) }. */
export function dardo(id) {
  const g = id === 'X' ? null : segmento(id);
  return g ? { id, v: g.valore, m: g.moltiplicatore, n: g.n } : { id: 'X', v: 0, m: 0, n: 0 };
}

// Gestione del turno da 3 frecce, comune a tutti i giochi: `turno` sono le frecce in corso,
// `ultimo` quelle dell'ultimo turno chiuso, `fineTurno` e' vero sul passo che ha chiuso un turno.
function aggiungi(s, id, chiudi = false) {
  s.turno.push(id);
  s.frecce += 1;
  s.fineTurno = chiudi || s.turno.length >= 3;
  if (s.fineTurno) { s.ultimo = s.turno; s.turno = []; }
}
const base = () => ({ turno: [], ultimo: [], fineTurno: false, frecce: 0, finito: false });

// ---------------------------------------------------------------- 501
const x501 = {
  id: 'x501', nome: '501', desc: 'Un leg da solo, double out', unit: 'frecce', basso: true,
  voto: (v) => lineare(v, 45, 12),
  crea: () => ({ ...base(), resto: 501, visite: [], max: 0 }),
  passo(s, ev) {
    if (ev.t === 'd') {
      const ids = [...s.turno, ev.id];
      const res = elaboraTurno(s.resto, ids.map(dardo));
      s.turno.push(ev.id);
      s.frecce += 1;
      s.fineTurno = res.fine;
      if (res.fine && res.esito === 'sballo') s.frecce += 3 - ids.length; // lo sballo conta sempre 3 frecce
      if (res.fine) {
        s.ultimo = s.turno; s.turno = [];
        chiudiVisita(s, res.s, res.esito);
      }
    } else if (ev.t === 'turno') {
      // somma del turno dal tastierino; d = frecce usate se chiude (0 = non in doppia: sballo)
      const r = applicaVisita(s.resto, ev.s);
      const chiuso = r.esito === 'chiuso' && ev.d > 0;
      s.frecce += chiuso ? ev.d : 3;
      s.ultimo = []; s.fineTurno = true;
      chiudiVisita(s, chiuso || r.esito === 'ok' ? ev.s : 0, chiuso ? 'chiuso' : r.esito === 'ok' ? 'ok' : 'sballo');
    }
    return s;
  },
  valore: (s) => s.frecce,
  dati: (s) => ({ media: s.frecce ? Math.round((501 / s.frecce) * 3 * 10) / 10 : 0, maxTurno: s.max, visite: s.visite }),
  bersagli: () => [],
};
function chiudiVisita(s, punti, esito) {
  s.visite.push(esito === 'sballo' ? 0 : punti);
  if (esito !== 'sballo') { s.resto -= punti; s.max = Math.max(s.max, punti); }
  if (esito === 'chiuso') { s.resto = 0; s.finito = true; }
}
export const restoProvvisorio = (s) => (s.turno.length ? elaboraTurno(s.resto, s.turno.map(dardo)).resto : s.resto);

// ---------------------------------------------------------------- Target 20 / Target Bull
const SERIE = 10;
const PER_SERIE = 9;
function target({ id, nome, desc, punti, quick, bersagli, cento }) {
  return {
    id, nome, desc, unit: '/ 270', SERIE, PER_SERIE, quick,
    voto: (v) => lineare(v, 0, cento),
    crea: () => ({ ...base(), punti: [] }),
    passo(s, ev) {
      if (ev.t !== 'd') return s;
      s.punti.push(punti(ev.id));
      aggiungi(s, ev.id);
      s.finito = s.punti.length >= SERIE * PER_SERIE;
      return s;
    },
    valore: (s) => somma(s.punti),
    dati: (s) => ({ serie: Array.from({ length: SERIE }, (_, i) => somma(s.punti.slice(i * PER_SERIE, (i + 1) * PER_SERIE))) }),
    bersagli: () => bersagli,
  };
}
const target20 = target({
  id: 'target20', nome: 'Target 20', desc: '10 serie da 9 frecce al 20', cento: 180,
  punti: (id) => ({ S20i: 1, S20o: 1, D20: 2, T20: 3 }[id] || 0),
  quick: [['X', 'Mancato', 0], ['S20o', 'Singolo', 1], ['D20', 'Doppio', 2], ['T20', 'Triplo', 3]],
  bersagli: ['S20i', 'S20o', 'D20', 'T20'],
});
const targetbull = target({
  id: 'targetbull', nome: 'Target Bull', desc: '10 serie da 9 frecce al centro', cento: 90,
  punti: (id) => ({ B25: 1, B50: 3 }[id] || 0),
  quick: [['X', 'Mancato', 0], ['B25', 'Bull 25', 1], ['B50', 'Bull 50', 3]],
  bersagli: ['B25', 'B50'],
});

// ---------------------------------------------------------------- Scoring
const SCORING_FRECCE = 18;
const scoring = {
  id: 'scoring', nome: 'Scoring', desc: '18 frecce, dove vuoi', unit: 'punti', FRECCE: SCORING_FRECCE,
  voto: (v) => lineare(v, 0, 600),
  crea: () => ({ ...base(), visite: [], parziale: 0 }),
  passo(s, ev) {
    if (ev.t === 'd') {
      s.parziale += dardo(ev.id).v;
      aggiungi(s, ev.id);
      if (s.fineTurno) { s.visite.push(s.parziale); s.parziale = 0; }
    } else if (ev.t === 'turno' && visitaValida(ev.s) && !s.turno.length) {
      s.visite.push(ev.s);
      s.frecce += 3; s.ultimo = []; s.fineTurno = true;
    }
    s.finito = s.frecce >= SCORING_FRECCE;
    return s;
  },
  valore: (s) => somma(s.visite) + s.parziale,
  dati: (s) => ({ visite: s.visite, media: Math.round((somma(s.visite) / Math.max(1, s.visite.length)) * 10) / 10, maxTurno: Math.max(0, ...s.visite) }),
  bersagli: () => [],
};

// ---------------------------------------------------------------- Checkout
/** 16 numeri tutti diversi: 10 da 40 a 69 e 6 da 70 a 100, mescolati. rnd: funzione 0..1 (per i test). */
export function numeriCheckout(rnd = Math.random) {
  const pesca = (da, a, n) => {
    const pool = Array.from({ length: a - da + 1 }, (_, i) => da + i);
    return Array.from({ length: n }, () => pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  };
  const tutti = [...pesca(40, 69, 10), ...pesca(70, 100, 6)];
  for (let i = tutti.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [tutti[i], tutti[j]] = [tutti[j], tutti[i]]; }
  return tutti;
}
const checkout = {
  id: 'checkout', nome: 'Checkout', desc: '16 chiusure da 40 a 100', unit: '/ 16',
  voto: (v) => lineare(v, 0, 12),
  crea: (o) => ({ ...base(), numeri: o.numeri, idx: 0, resto: o.numeri[0], esiti: [] }),
  passo(s, ev) {
    if (s.finito) return s;
    let esito = null;
    if (ev.t === 'd') {
      const res = elaboraTurno(s.numeri[s.idx], [...s.turno, ev.id].map(dardo));
      aggiungi(s, ev.id, res.fine);
      if (res.fine) esito = res.esito === 'chiuso';
      else s.resto = res.resto;
    } else if (ev.t === 'esito' && !s.turno.length) {
      s.frecce += 3; s.ultimo = []; s.fineTurno = true;
      esito = !!ev.ok;
    }
    if (esito !== null) {
      s.esiti.push(esito);
      s.idx += 1;
      s.finito = s.idx >= s.numeri.length;
      s.resto = s.finito ? 0 : s.numeri[s.idx];
    }
    return s;
  },
  valore: (s) => s.esiti.filter(Boolean).length,
  dati: (s) => ({ numeri: s.numeri, esiti: s.esiti }),
  bersagli: () => [],
};

// ---------------------------------------------------------------- Doppie
const DOPPIE = [20, 16, 10, 8, 5, 4, 1];
const PER_DOPPIA = 15;
const doppie = {
  id: 'doppie', nome: 'Doppie', desc: '15 frecce su 7 doppie', unit: '/ 105', DOPPIE, PER_DOPPIA,
  voto: (v) => lineare(v, 0, 50),
  crea: () => ({ ...base(), colpi: DOPPIE.map(() => 0), idx: 0, nella: 0 }),
  passo(s, ev) {
    if (ev.t !== 'd' || s.finito) return s;
    if (ev.id === `D${DOPPIE[s.idx]}`) s.colpi[s.idx] += 1;
    s.nella += 1;
    aggiungi(s, ev.id, s.nella >= PER_DOPPIA);
    if (s.nella >= PER_DOPPIA) { s.idx += 1; s.nella = 0; }
    s.finito = s.idx >= DOPPIE.length;
    return s;
  },
  valore: (s) => somma(s.colpi),
  dati: (s) => ({ colpi: s.colpi }),
  bersagli: (s) => (s.finito ? [] : [`D${DOPPIE[s.idx]}`]),
};

// ---------------------------------------------------------------- Rotation
const ROTATION = [...Array.from({ length: 20 }, (_, i) => i + 1), 25];
const MODI = { S: 'Singolo', D: 'Doppio', T: 'Triplo' };
/** Settori validi per il passo `n` (25 = bull) nella modalita' scelta. */
export function bersagliRotation(modo, n) {
  if (n === 25) return modo === 'D' ? ['B50'] : ['B25', 'B50'];
  return modo === 'S' ? [`S${n}i`, `S${n}o`] : [`${modo}${n}`];
}
const rotation = {
  id: 'rotation', nome: 'Rotation', desc: 'Dall\'1 al 20, poi il bull', unit: 'frecce', basso: true, MODI, ROTATION,
  // il doppio e il triplo sono molto piu' difficili: scala diversa, cosi' il voto resta confrontabile
  voto: (v, o = {}) => (o.modo === 'S' ? lineare(v, 120, 25) : lineare(v, 300, 60)),
  crea: (o) => ({ ...base(), modo: o.modo, idx: 0 }),
  passo(s, ev) {
    if (ev.t !== 'd' || s.finito) return s;
    if (bersagliRotation(s.modo, ROTATION[s.idx]).includes(ev.id)) s.idx += 1;
    s.finito = s.idx >= ROTATION.length;
    aggiungi(s, ev.id, s.finito);
    return s;
  },
  valore: (s) => s.frecce,
  dati: (s) => ({ modo: s.modo, arrivo: s.idx }),
  bersagli: (s) => (s.finito ? [] : bersagliRotation(s.modo, ROTATION[s.idx])),
};

// ---------------------------------------------------------------- Cricket Train
const TRAIN = [20, 19, 18, 17, 16, 15, 25];
const colpisce = (id, n) => (n === 25 ? id === 'B25' || id === 'B50' : dardo(id).n === n && id !== 'X');
/** Dopo un turno: 3 colpi avanti, 2 resti, 1 o 0 indietro (sul 20 resti). Sul bull basta un colpo; senza, torni al 15. */
export function dopoTurno(pos, colpi) {
  if (TRAIN[pos] === 25) return colpi >= 1 ? TRAIN.length : pos - 1;
  if (colpi >= 3) return pos + 1;
  if (colpi === 2) return pos;
  return Math.max(0, pos - 1);
}
const cricket = {
  id: 'cricket', nome: 'Cricket Train', desc: 'Dal 20 al 15, poi il bull', unit: 'turni', basso: true, TRAIN,
  voto: (v) => lineare(v, 40, 8),
  crea: () => ({ ...base(), pos: 0, turni: 0, colpi: 0, storia: [] }),
  passo(s, ev) {
    if (s.finito) return s;
    let fine = null;
    if (ev.t === 'd') {
      if (colpisce(ev.id, TRAIN[s.pos])) s.colpi += 1;
      aggiungi(s, ev.id, TRAIN[s.pos] === 25 && s.colpi > 0);
      if (s.fineTurno) fine = s.colpi;
    } else if (ev.t === 'colpi' && !s.turno.length) {
      s.frecce += 3; s.ultimo = []; s.fineTurno = true;
      fine = ev.n;
    }
    if (fine !== null) {
      s.turni += 1;
      s.storia.push({ n: TRAIN[s.pos], colpi: fine });
      s.pos = dopoTurno(s.pos, fine);
      s.colpi = 0;
      s.finito = s.pos >= TRAIN.length;
    }
    return s;
  },
  valore: (s) => s.turni,
  dati: (s) => ({ storia: s.storia }),
  bersagli: (s) => {
    const n = TRAIN[s.pos];
    if (n == null) return [];
    return n === 25 ? ['B25', 'B50'] : [`S${n}i`, `S${n}o`, `D${n}`, `T${n}`];
  },
};

export const GIOCHI = [x501, target20, targetbull, scoring, checkout, doppie, rotation, cricket];
export const gioco = (id) => GIOCHI.find((g) => g.id === id);

/** Stato dopo tutti gli eventi. */
export function rigioca(g, opzioni, eventi) {
  let s = g.crea(opzioni);
  for (const ev of eventi) s = g.passo(s, ev);
  return s;
}

// ---------------------------------------------------------------- progressi
// Una sessione salvata: { gioco, valore, voto, data, ts, opzioni, dati }.
const media = (a) => (a.length ? somma(a) / a.length : null);
const perData = (a, b) => (a.ts || 0) - (b.ts || 0);

/** Voto del gioco: media dei voti delle ultime 10 sessioni (null se mai giocato). */
export function votoGioco(sessioni, id) {
  const v = sessioni.filter((x) => x.gioco === id).sort(perData).slice(-10).map((x) => x.voto);
  return v.length ? Math.round(media(v)) : null;
}

/** Skill: media dei voti dei giochi fatti almeno una volta, tutti con lo stesso peso. */
export function skill(sessioni) {
  const v = GIOCHI.map((g) => votoGioco(sessioni, g.id)).filter((x) => x != null);
  return v.length ? Math.round(media(v)) : null;
}

/** Pollice: media delle ultime 3 contro le 3 precedenti (sui voti). Sotto 4 valori: 'nuovo'. */
export function trend(voti) {
  if (voti.length < 4) return 'nuovo';
  const ult = media(voti.slice(-3));
  const prima = media(voti.slice(-6, -3));
  const d = prima > 0 ? (ult - prima) / prima : (ult - prima) / 100;
  return d > 0.03 ? 'su' : d < -0.03 ? 'giu' : 'pari';
}
export const trendGioco = (sessioni, id) => trend(sessioni.filter((x) => x.gioco === id).sort(perData).map((x) => x.voto));
export const trendGiocatore = (sessioni) => trend([...sessioni].sort(perData).map((x) => x.voto));

/** Record: il valore migliore (per Rotation, nella stessa modalita'). */
export function record(sessioni, id, modo = null) {
  const g = gioco(id);
  const v = sessioni.filter((x) => x.gioco === id && (!modo || x.opzioni?.modo === modo)).map((x) => x.valore);
  if (!v.length) return null;
  return g.basso ? Math.min(...v) : Math.max(...v);
}
export const migliora = (g, valore, rec) => rec == null || (g.basso ? valore < rec : valore > rec);

// ---------------------------------------------------------------- settimana, badge, sfida
const lunedi = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
export const settimana = (sessioni, oggi) => sessioni.filter((x) => lunedi(x.data) === lunedi(oggi)).length;

const migliore = (sessioni, id, f = () => true) => {
  const v = sessioni.filter((x) => x.gioco === id && f(x)).map((x) => x.valore);
  return v.length ? (gioco(id).basso ? Math.min(...v) : Math.max(...v)) : null;
};
const almeno = (v, n) => v != null && v >= n;
const alPiu = (v, n) => v != null && v <= n;
const maxTurno = (sessioni) => Math.max(0, ...sessioni.filter((x) => x.dati?.maxTurno != null).map((x) => x.dati.maxTurno));
const maxSettimana = (sessioni) => {
  const c = new Map();
  for (const x of sessioni) c.set(lunedi(x.data), (c.get(lunedi(x.data)) || 0) + 1);
  return Math.max(0, ...c.values());
};

export const BADGES = [
  { id: 'primo', nome: 'Si comincia', desc: 'Il primo allenamento', ok: (s) => s.length >= 1 },
  { id: 'tutti', nome: 'Giro completo', desc: 'Almeno una volta ogni gioco', ok: (s) => GIOCHI.every((g) => s.some((x) => x.gioco === g.id)) },
  { id: 'costanza', nome: 'Costanza', desc: '4 allenamenti nella stessa settimana', ok: (s) => maxSettimana(s) >= 4 },
  { id: 'cinquanta', nome: 'Cinquanta', desc: '50 allenamenti in tutto', ok: (s) => s.length >= 50 },
  { id: 'ton', nome: 'Ton', desc: 'Un turno da 100 o più (501 o Scoring)', ok: (s) => maxTurno(s) >= 100 },
  { id: 'max', nome: '180!', desc: 'Il massimo in un turno', ok: (s) => maxTurno(s) >= 180 },
  { id: 'rapido', nome: 'Chiusura rapida', desc: '501 in 30 frecce o meno', ok: (s) => alPiu(migliore(s, 'x501'), 30) },
  { id: 'serie', nome: 'Serie d\'oro', desc: 'Target 20: almeno 130 punti', ok: (s) => almeno(migliore(s, 'target20'), 130) },
  { id: 'bull', nome: 'Occhio di bue', desc: 'Target Bull: almeno 40 punti', ok: (s) => almeno(migliore(s, 'targetbull'), 40) },
  { id: 'doppie', nome: 'Re delle doppie', desc: 'Doppie: almeno 30 colpi', ok: (s) => almeno(migliore(s, 'doppie'), 30) },
  { id: 'checkout', nome: 'Sangue freddo', desc: 'Checkout: almeno 8 chiusure', ok: (s) => almeno(migliore(s, 'checkout'), 8) },
  { id: 'triplo', nome: 'Giro dei tripli', desc: 'Rotation completata in triplo', ok: (s) => s.some((x) => x.gioco === 'rotation' && x.opzioni?.modo === 'T') },
  { id: 'treno', nome: 'Macchinista', desc: 'Cricket Train in 15 turni o meno', ok: (s) => alPiu(migliore(s, 'cricket'), 15) },
];
export const badgePresi = (sessioni) => new Set(BADGES.filter((b) => b.ok(sessioni)).map((b) => b.id));

// Sfida del sabato: un gioco a rotazione, una settimana dopo l'altra.
export const SFIDA = ['target20', 'doppie', 'checkout', 'scoring', 'x501'];
export function prossimoSabato(oggi) {
  const d = new Date(`${oggi}T12:00:00`);
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
}
export function sfidaDel(sabato) {
  const settimane = Math.round((new Date(`${sabato}T12:00:00`) - new Date('2026-01-03T12:00:00')) / (7 * 864e5));
  return SFIDA[((settimane % SFIDA.length) + SFIDA.length) % SFIDA.length];
}
/** Classifica della sfida: il miglior risultato di ognuno in quel sabato, nel gioco della sfida. */
export function classificaSfida(sessioni, sabato) {
  const id = sfidaDel(sabato);
  const g = gioco(id);
  const best = new Map();
  for (const x of sessioni.filter((y) => y.gioco === id && y.data === sabato)) {
    const b = best.get(x.playerId);
    if (b == null || (g.basso ? x.valore < b : x.valore > b)) best.set(x.playerId, x.valore);
  }
  return [...best].map(([playerId, valore]) => ({ playerId, valore })).sort((a, b) => (g.basso ? a.valore - b.valore : b.valore - a.valore));
}

// Regole spiegate nel riquadro "i" di ogni gioco.
export const REGOLE = {
  x501: [
    'Parti da 501 e scendi a zero, da solo o in due (contro un compagno o un ospite). Ogni turno sono 3 frecce.',
    'In due si tira a turno e inizi tu: vince chi chiude per primo, e l\'altro può continuare da solo per chiudere.',
    'Si chiude solo con una doppia (vale anche il Bull 50).',
    'Sballo: se superi lo zero, resti a 1 o arrivi a zero senza doppia, il turno non conta e valgono comunque 3 frecce.',
    'Il risultato è il numero di frecce usate: meno è meglio.',
  ],
  target20: [
    '10 serie da 9 frecce, tutte al 20.',
    'Singolo 1 punto, doppio 2, triplo 3. Gli altri numeri valgono 0.',
    'Massimo 27 punti a serie, 270 in tutto.',
  ],
  targetbull: [
    '10 serie da 9 frecce, tutte al centro.',
    'Bull esterno (25) 1 punto, Bull centrale (50) 3 punti, fuori 0.',
    'Massimo 27 punti a serie, 270 in tutto.',
  ],
  scoring: [
    '18 frecce, cioè 6 turni, mirando dove vuoi.',
    'Si parte da zero e si sommano tutti i punti.',
    'Senza Granboard scrivi la somma di ogni turno.',
  ],
  checkout: [
    '16 numeri da chiudere, diversi a ogni sessione: 10 sotto il 70 e 6 dal 70 al 100.',
    'Per ogni numero hai 3 frecce e devi chiudere in doppia (vale anche il Bull 50).',
    'Se sballi o non chiudi in 3 frecce, quel numero vale 0.',
    'Il risultato è quante chiusure fai su 16.',
  ],
  doppie: [
    '15 frecce per ogni doppia, in quest\'ordine: D20, D16, D10, D8, D5, D4, D1.',
    'Conta solo la doppia giusta, e si tirano sempre tutte le 15 frecce.',
    'Il risultato è il totale dei colpi su 105 frecce.',
  ],
  rotation: [
    'All\'inizio scegli se mirare al singolo, al doppio o al triplo.',
    'Colpisci i numeri dall\'1 al 20 in ordine: passi al numero dopo solo quando lo prendi.',
    'Alla fine il bull: nel doppio serve il Bull 50, nel singolo e nel triplo va bene qualsiasi bull.',
    'Nel singolo conta solo il settore singolo, non il doppio o il triplo.',
    'Il risultato è il numero di frecce: meno è meglio. Nessun limite: puoi abbandonare quando vuoi.',
  ],
  cricket: [
    'Si tira al 20, poi 19, 18, 17, 16, 15 e infine il bull, 3 frecce a turno.',
    '3 colpi sul tuo numero: passi al successivo. 2 colpi: resti. 1 o 0 colpi: torni al numero prima (sul 20 resti).',
    'Doppio e triplo valgono un colpo, come il singolo.',
    'Al bull basta un colpo nelle 3 frecce per finire; se lo manchi torni al 15.',
    'Il risultato è il numero di turni: meno è meglio.',
  ],
};

// ---------------------------------------------------------------- 501 in uno o due
/**
 * Partita a 501 per n giocatori (1 o 2) che tirano a turno, il primo e' sempre chi usa l'app.
 * eventi: { p, ...evento del 501 } con p = indice del giocatore. Chi ha chiuso non tira piu'.
 * Restituisce gli stati di ognuno, a chi tocca (cur) e chi ha chiuso per primo (vincitore).
 */
export function partita501(n, eventi) {
  const g = gioco('x501');
  const stati = Array.from({ length: n }, () => g.crea());
  let cur = 0;
  let vincitore = null;
  for (const { p, ...ev } of eventi) {
    stati[p] = g.passo(stati[p], ev);
    if (stati[p].finito && vincitore === null) vincitore = p;
    if (stati[p].fineTurno || stati[p].finito) {
      const altro = (p + 1) % n;
      cur = !stati[altro].finito ? altro : p;
    }
  }
  return { stati, cur, vincitore, tuttiChiusi: stati.every((s) => s.finito) };
}
