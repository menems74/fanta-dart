// Versione dell'app, mostrata accanto alla firma: se leggi il numero nuovo, l'aggiornamento e' attivo.
// Va aumentata a ogni modifica pubblicata (insieme alla cache in sw.js).
import { html } from './util.js';

export const VERSIONE = '1.20';
export const firma = () => html`<p class="firma">Powered by <b>Cleopatra</b> · <span class="ver">v${VERSIONE}</span></p>`;
