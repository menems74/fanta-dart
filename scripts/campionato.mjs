// Legge il PDF delle statistiche di un campionato softdart.it e lo trasforma in JSON per l'app.
// Uso: node scripts/campionato.mjs <id> <url-o-file-pdf> "<nome del campionato>" [--chiuso]
//   es. node scripts/campionato.mjs 2026bis-lombardia-as4 https://www.softdart.it/pdf/campionati/2026bis/lombardia/as4.pdf "Lombardia AS4 · 2026 bis"
// Scrive dati/campionati/<id>.json e aggiorna dati/campionati/indice.json (elenco dei campionati, il piu' recente per primo).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { analizzaPdf } from '../js/campionato-pdf.js';

const [id, sorgente, nome, ...resto] = process.argv.slice(2);
if (!id || !sorgente || !nome) {
  console.error('Uso: node scripts/campionato.mjs <id> <url-o-file-pdf> "<nome>" [--chiuso]');
  process.exit(1);
}
const chiuso = resto.includes('--chiuso');

const pdf = /^https?:/.test(sorgente)
  ? new Uint8Array(await (await fetch(`${sorgente}${sorgente.includes('?') ? '&' : '?'}v=${Date.now()}`)).arrayBuffer())
  : new Uint8Array(await readFile(sorgente));

const squadre = analizzaPdf(pdf, (b) => inflateSync(b));
const giocatori = squadre.reduce((n, s) => n + s.giocatori.length, 0);
if (!giocatori) { console.error('Nessun giocatore trovato: il PDF ha cambiato formato?'); process.exit(2); }

const dir = new URL('../dati/campionati/', import.meta.url);
await mkdir(dir, { recursive: true });
const dati = {
  id, nome, chiuso,
  fonte: /^https?:/.test(sorgente) ? sorgente.replace(/\?.*$/, '') : null,
  aggiornato: new Date().toISOString(),
  squadre,
};
await writeFile(new URL(`${id}.json`, dir), `${JSON.stringify(dati)}\n`);

const fileIndice = new URL('indice.json', dir);
let indice = [];
try { indice = JSON.parse(await readFile(fileIndice, 'utf8')); } catch { /* primo campionato */ }
const voce = { id, nome, chiuso, fonte: dati.fonte, aggiornato: dati.aggiornato };
const i = indice.findIndex((x) => x.id === id);
if (i >= 0) indice[i] = voce; else indice.unshift(voce);
await writeFile(fileIndice, `${JSON.stringify(indice, null, 2)}\n`);
console.log(`${nome}: ${squadre.length} squadre, ${giocatori} giocatori`);
