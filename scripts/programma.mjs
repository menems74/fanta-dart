// Esporta le partite ancora da giocare (senza risultato, da oggi in poi) in dati/programma.json,
// cosi' un'app esterna (l'assistente Cleopatra) puo' sapere con chi e quando si gioca.
// Legge Firestore con un account di servizio (variabile FIREBASE_SERVICE_ACCOUNT, il JSON della chiave).
// Se la variabile manca non fa nulla. Esporta solo data, avversario, luogo e se la serata e' ancora una bozza.
import { createSign } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const chiave = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!chiave) { console.log('FIREBASE_SERVICE_ACCOUNT mancante: partite in programma non aggiornate.'); process.exit(0); }
const acc = JSON.parse(chiave);
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

async function gettone() {
  const ora = Math.floor(Date.now() / 1000);
  const corpo = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: acc.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: ora, exp: ora + 3000 })}`;
  const firma = createSign('RSA-SHA256').update(corpo).sign(acc.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${corpo}.${firma}` }) });
  if (!r.ok) throw new Error(`Accesso a Google non riuscito (${r.status})`);
  return (await r.json()).access_token;
}

const valore = (v) => (v == null ? undefined : v.stringValue ?? v.booleanValue ?? (v.integerValue != null ? Number(v.integerValue) : v.doubleValue));
const token = await gettone();
const oggi = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date()); // AAAA-MM-GG
const partite = [];
let pagina = '';
do {
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${acc.project_id}/databases/(default)/documents/matches?pageSize=300${pagina}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Lettura partite non riuscita (${r.status})`);
  const d = await r.json();
  for (const doc of d.documents || []) {
    const f = Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, valore(v)]));
    const senzaRisultato = !(Number.isFinite(f.puntiNoi) && Number.isFinite(f.puntiLoro));
    if (senzaRisultato && f.data >= oggi && f.avversario) partite.push({ data: f.data, avversario: f.avversario, luogo: f.luogo || '', bozza: f.pubblicata !== true });
  }
  pagina = d.nextPageToken ? `&pageToken=${encodeURIComponent(d.nextPageToken)}` : '';
} while (pagina);

partite.sort((a, b) => a.data.localeCompare(b.data));
const file = new URL('../dati/programma.json', import.meta.url);
const testo = `${JSON.stringify(partite, null, 2)}\n`;
let prima = '';
try { prima = await readFile(file, 'utf8'); } catch { /* primo salvataggio */ }
if (prima !== testo) { await mkdir(new URL('../dati/', import.meta.url), { recursive: true }); await writeFile(file, testo); }
console.log(`Partite in programma: ${partite.length}`);
