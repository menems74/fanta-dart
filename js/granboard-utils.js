/** Funzioni pure per la pagina di prova del Granboard (nessuna dipendenza dal browser). */
const bytesOf = (dv) => [...new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength)];

export const hex = (dv) => bytesOf(dv).map((b) => b.toString(16).padStart(2, '0')).join(' ');
export const dec = (dv) => bytesOf(dv).join(' ');
export const ascii = (dv) => bytesOf(dv).map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');

/** UUID a 128 bit di un servizio standard Bluetooth ridotto alle sole 4 cifre. */
export const shortUuid = (u) => u.replace(/^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/, '$1');

/** Legge byte in esadecimale scritti a mano ("01 ff 0a" oppure "01ff0a"). Restituisce null se non sono validi. */
export function parseHexBytes(text) {
  const t = String(text).replace(/0x/gi, '').replace(/[\s,:-]+/g, '');
  if (!t || t.length % 2 || /[^0-9a-f]/i.test(t)) return null;
  return Uint8Array.from(t.match(/../g).map((b) => parseInt(b, 16)));
}

const FULL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Legge un elenco di UUID (separati da spazi, virgole o a capo): 4 cifre (es. ffe0), 8 cifre o 128 bit.
 * Restituisce { ok, ko }: gli UUID validi (senza doppioni, nel formato accettato da Web Bluetooth) e le righe non valide.
 */
export function parseUuids(text) {
  const ok = [];
  const ko = [];
  for (const raw of String(text).split(/[\s,;]+/).filter(Boolean)) {
    const t = raw.toLowerCase().replace(/^0x/, '');
    let v = null;
    if (/^[0-9a-f]{4}$/.test(t) || /^[0-9a-f]{8}$/.test(t)) v = parseInt(t, 16);
    else if (FULL.test(t)) v = t;
    if (v === null) ko.push(raw);
    else if (!ok.includes(v)) ok.push(v);
  }
  return { ok, ko };
}
