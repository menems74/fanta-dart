// Legge il PDF delle statistiche di un campionato softdart.it e lo trasforma in JSON per l'app.
// Uso:
//   node scripts/campionato.mjs <id> <url-o-file-pdf> "<nome del campionato>" [--chiuso]
//     es. node scripts/campionato.mjs 2026bis-lombardia-as4 https://www.softdart.it/pdf/campionati/2026bis/lombardia/as4.pdf "Lombardia AS4 · 2026 bis"
//   node scripts/campionato.mjs --tutti
//     aggiorna tutti i campionati non conclusi dell'indice, dal loro PDF (lo usa l'aggiornamento automatico notturno).
// Scrive dati/campionati/<id>.json e aggiorna dati/campionati/indice.json (il piu' recente per primo).
// Se i dati non sono cambiati non tocca i file, cosi' "aggiornato" resta la data dell'ultima novita'.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { analizzaPdf } from '../js/campionato-pdf.js';

const dir = new URL('../dati/campionati/', import.meta.url);
const fileIndice = new URL('indice.json', dir);
const leggiJson = async (url, vuoto) => { try { return JSON.parse(await readFile(url, 'utf8')); } catch { return vuoto; } };

async function scaricaPdf(sorgente) {
  if (!/^https?:/.test(sorgente)) return new Uint8Array(await readFile(sorgente));
  const r = await fetch(`${sorgente}${sorgente.includes('?') ? '&' : '?'}v=${Date.now()}`);
  if (!r.ok) throw new Error(`PDF non scaricato (${r.status}): ${sorgente}`);
  return new Uint8Array(await r.arrayBuffer());
}

async function aggiorna(id, sorgente, nome, chiuso) {
  const squadre = analizzaPdf(await scaricaPdf(sorgente), (b) => inflateSync(b));
  const giocatori = squadre.reduce((n, s) => n + s.giocatori.length, 0);
  if (!giocatori) throw new Error(`${nome}: nessun giocatore trovato, il PDF ha cambiato formato?`);

  const fileCamp = new URL(`${id}.json`, dir);
  const prima = await leggiJson(fileCamp, null);
  const fonte = /^https?:/.test(sorgente) ? sorgente.replace(/\?.*$/, '') : (prima?.fonte ?? null);
  const uguale = prima && prima.nome === nome && prima.chiuso === chiuso && JSON.stringify(prima.squadre) === JSON.stringify(squadre);
  if (uguale) { console.log(`${nome}: nessuna novita'`); return false; }

  // breve (nome corto nei grafici) e incontri si conservano: il PDF non li contiene
  const dati = { id, nome, ...(prima?.breve ? { breve: prima.breve } : {}), chiuso, fonte, aggiornato: new Date().toISOString(), squadre, ...(prima?.incontri ? { incontri: prima.incontri } : {}) };
  await writeFile(fileCamp, `${JSON.stringify(dati)}\n`);
  const indice = await leggiJson(fileIndice, []);
  const voce = { id, nome, chiuso, fonte, aggiornato: dati.aggiornato };
  const i = indice.findIndex((x) => x.id === id);
  if (i >= 0) indice[i] = voce; else indice.unshift(voce);
  await writeFile(fileIndice, `${JSON.stringify(indice, null, 2)}\n`);
  console.log(`${nome}: ${squadre.length} squadre, ${giocatori} giocatori (aggiornato)`);
  return true;
}

await mkdir(dir, { recursive: true });
const args = process.argv.slice(2);
if (args[0] === '--tutti') {
  const aperti = (await leggiJson(fileIndice, [])).filter((c) => !c.chiuso && c.fonte);
  if (!aperti.length) console.log('Nessun campionato in corso da aggiornare');
  for (const c of aperti) await aggiorna(c.id, c.fonte, c.nome, false);
} else {
  const [id, sorgente, nome, ...resto] = args;
  if (!id || !sorgente || !nome) {
    console.error('Uso: node scripts/campionato.mjs <id> <url-o-file-pdf> "<nome>" [--chiuso]  oppure  --tutti');
    process.exit(1);
  }
  await aggiorna(id, sorgente, nome, resto.includes('--chiuso'));
}
