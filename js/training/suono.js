// Suoni della partita: un breve bip per ogni freccia (piu' acuto per triplo, doppio e bull, grave per la freccia fuori).
let ctx = null;
let attivo = true;
try { attivo = localStorage.getItem('fd.suono') !== '0'; } catch { /* senza memoria locale resta acceso */ }

export const suonoAttivo = () => attivo;
export function impostaSuono(on) {
  attivo = on;
  try { localStorage.setItem('fd.suono', on ? '1' : '0'); } catch { /* ignora */ }
}

/** Da chiamare dopo un tocco: il browser permette l'audio solo dopo un gesto dell'utente. */
export function sbloccaAudio() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* nessun audio disponibile */ }
}

function nota(freq, inizio, durata) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, ctx.currentTime + inizio);
  g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + inizio + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inizio + durata);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + inizio);
  o.stop(ctx.currentTime + inizio + durata + 0.02);
}

/** tipo: 'fuori' | 'singolo' | 'speciale' (triplo, doppio, bull) | 'fine' (turno chiuso). */
export function suona(tipo) {
  if (!attivo || !ctx) return;
  try {
    if (tipo === 'fuori') nota(180, 0, 0.18);
    else if (tipo === 'speciale') { nota(880, 0, 0.1); nota(1320, 0.1, 0.16); }
    else if (tipo === 'fine') { nota(660, 0, 0.12); nota(440, 0.14, 0.2); }
    else nota(660, 0, 0.12);
  } catch { /* ignora */ }
}
