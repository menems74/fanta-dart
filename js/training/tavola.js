// Collegamento al Granboard 132 con Web Bluetooth (Chrome su Android, in HTTPS).
// La connessione resta aperta mentre la pagina Allenamenti e' aperta: si collega una volta sola.
// Ogni freccia arriva come testo ("3.4@") e viene tradotta nel settore colpito con la tabella di granboard-map.js.
import { dardoDaTesto } from '../granboard-map.js';

const SERVICE = '442f1570-8a00-9a28-cbe1-e1d4212d53eb';
const NOTIFY = '442f1571-8a00-9a28-cbe1-e1d4212d53eb';

let device = null;
let stato = 'scollegata'; // scollegata | collego | collegata
const dardiCb = new Set();
const statoCb = new Set();
const imposta = (s) => { stato = s; statoCb.forEach((cb) => cb(s)); };

export const tavolaDisponibile = () => 'bluetooth' in navigator;
export const tavolaStato = () => stato;
export const onDardo = (cb) => { dardiCb.add(cb); return () => dardiCb.delete(cb); };
export const onStato = (cb) => { statoCb.add(cb); return () => statoCb.delete(cb); };

/** Passa un messaggio della tavola ai listener. Gli altri messaggi (come "GB8;102") vengono ignorati. */
function ricevi(testo) {
  const dardo = dardoDaTesto(testo);
  if (dardo) dardiCb.forEach((cb) => cb(dardo));
}

export async function collega() {
  if (!tavolaDisponibile()) throw new Error('Questo browser non supporta il Bluetooth: usa Chrome su Android.');
  try {
    device = await navigator.bluetooth.requestDevice({ filters: [{ namePrefix: 'GRAN' }], optionalServices: [SERVICE] });
  } catch (e) {
    if (e.name === 'NotFoundError') return false; // finestra chiusa senza scegliere
    throw e;
  }
  imposta('collego');
  try {
    device.addEventListener('gattserverdisconnected', () => imposta('scollegata'));
    const server = await device.gatt.connect();
    const char = await (await server.getPrimaryService(SERVICE)).getCharacteristic(NOTIFY);
    char.addEventListener('characteristicvaluechanged', (ev) => ricevi(new TextDecoder().decode(ev.target.value)));
    await char.startNotifications();
    imposta('collegata');
    return true;
  } catch (e) {
    imposta('scollegata');
    throw e;
  }
}

export const scollega = () => device?.gatt?.disconnect();

// Solo per le prove senza la tavola.
export const simula = ricevi;
export const simulaCollegamento = () => imposta('collegata');
