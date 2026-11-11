// Versione dell'app, mostrata accanto alla firma: se leggi il numero nuovo, l'aggiornamento e' attivo.
// Va aumentata a ogni modifica dell'app pubblicata (insieme alla cache in sw.js).
// Gli aggiornamenti dei soli dati (partite, statistiche in dati/) NON cambiano ne' la versione ne' la cache.
import { html } from './util.js';

export const VERSIONE = '1.34';
export const firma = () => html`<p class="firma">Powered by <b>Cleopatra</b> · <span class="ver">v${VERSIONE}</span></p>`;
