// Voce che annuncia i colpi (sintesi vocale del telefono, in italiano, voce femminile se c'e').
// Per ora solo nel 501, per sentire come risulta.
let voce = null;

const FEMMINILI = /female|donna|alice|elsa|federica|paola|isabella|carla|bianca|itb|itd|google italiano/i;
function scegliVoce() {
  const tutte = window.speechSynthesis?.getVoices() || [];
  const it = tutte.filter((v) => v.lang?.toLowerCase().startsWith('it'));
  voce = it.find((v) => FEMMINILI.test(v.name) || FEMMINILI.test(v.voiceURI)) || it[0] || null;
}
if ('speechSynthesis' in window) {
  scegliVoce();
  window.speechSynthesis.addEventListener?.('voiceschanged', scegliVoce);
}

export const voceDisponibile = () => 'speechSynthesis' in window;

/** Il browser fa parlare solo dopo un tocco: una frase vuota al primo tocco sblocca la voce. */
let sbloccata = false;
export function sbloccaVoce() {
  if (sbloccata || !voceDisponibile()) return;
  sbloccata = true;
  const u = new SpeechSynthesisUtterance('');
  window.speechSynthesis.speak(u);
}

export function parla(testo, { interrompi = false } = {}) {
  if (!voceDisponibile() || !testo) return;
  if (interrompi) window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(testo);
  u.lang = 'it-IT';
  if (voce) u.voice = voce;
  u.rate = 1.05;
  u.pitch = 1.1;
  window.speechSynthesis.speak(u);
}

/** Come si annuncia un colpo: "Venti", "Doppio sedici", "Triplo venti", "Bull", "Fuori". */
export function nomeColpo(id) {
  if (id === 'X') return 'Fuori';
  if (id === 'B50') return 'Bull';
  if (id === 'B25') return 'Venticinque';
  const m = /^([SDT])(\d+)/.exec(id);
  if (!m) return '';
  return m[1] === 'S' ? m[2] : `${m[1] === 'D' ? 'Doppio' : 'Triplo'} ${m[2]}`;
}
