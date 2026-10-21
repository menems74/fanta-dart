// Collegamento al Granboard 132 con Web Bluetooth (Chrome su Android, in HTTPS).
// La connessione resta aperta mentre la pagina Allenamenti e' aperta: si collega una volta sola.
// Ogni freccia arriva come testo ("3.4@") e viene tradotta nel settore colpito con la tabella di granboard-map.js.
import { dardoDaTesto } from '../granboard-map.js';

const SERVICE = '442f1570-8a00-9a28-cbe1-e1d4212d53eb';
const NOTIFY = '442f1571-8a00-9a28-cbe1-e1d4212d53eb';
const WRITE = '442f1572-8a00-9a28-cbe1-e1d4212d53eb';

let device = null;
let scrittura = null;
let coda = Promise.resolve();
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
    const servizio = await server.getPrimaryService(SERVICE);
    const char = await servizio.getCharacteristic(NOTIFY);
    scrittura = await servizio.getCharacteristic(WRITE).catch(() => null);
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

/** Manda un comando alla tavola (led). In coda, perche' il Bluetooth accetta una scrittura alla volta. Senza tavola non fa nulla. */
export function scrivi(bytes) {
  if (!bytes || stato !== 'collegata' || !scrittura) return;
  coda = coda.then(() => (scrittura.properties.writeWithoutResponse ? scrittura.writeValueWithoutResponse(bytes) : scrittura.writeValue(bytes)))
    .catch((e) => console.warn('Comando ai led non riuscito', e));
}

// Solo per le prove senza la tavola.
export const simula = ricevi;
/** Solo per le prove: finge il collegamento; se passi un array, ci finiscono i comandi ai led (in esadecimale). */
export const simulaCollegamento = (registro = null) => {
  if (registro) {
    const salva = async (b) => { registro.push([...b].map((x) => x.toString(16).padStart(2, '0')).join('')); };
    scrittura = { properties: { writeWithoutResponse: true }, writeValueWithoutResponse: salva, writeValue: salva };
  }
  imposta('collegata');
};
