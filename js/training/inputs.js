// Componenti di inserimento condivisi tra le sessioni e lo Skill test.
import { html, icon } from '../util.js';

export const numRow = (arr, i, label, max) => {
  const big = max >= 50 ? 10 : 5;
  return html`
  <div class="card nrow" data-arr="${arr}" data-i="${i}" data-max="${max}">
    <span class="nlbl">${label}</span>
    <div class="nctl">
      <button type="button" class="nbtn wide" data-d="${-big}" aria-label="${label}: meno ${big}">−${big}</button>
      <button type="button" class="nbtn" data-d="-1" aria-label="${label}: meno 1">${icon('minus')}</button>
      <b class="nval blank">—</b>
      <button type="button" class="nbtn" data-d="1" aria-label="${label}: più 1">${icon('plus')}</button>
      <button type="button" class="nbtn wide" data-d="${big}" aria-label="${label}: più ${big}">+${big}</button>
    </div>
  </div>`;
};

export const optsRow = (arr, i, label, values, sub = '') => html`
  <div class="card orow" data-arr="${arr}" data-i="${i}">
    <span class="olbl"><b>${label}</b>${sub ? html`<small class="muted">${sub}</small>` : ''}</span>
    <div class="opts">
      ${values.map((o) => html`<button type="button" data-v="${o.v}" class="${o.fail ? 'fail' : ''}" aria-label="${label}: ${o.t}">${o.t}</button>`)}
    </div>
  </div>`;

/** Lettura e scrittura del valore di una riga (data-arr / data-i) dentro l'oggetto dati. */
export function rowAccess(data) {
  return {
    get: (row) => (row.dataset.i === '' ? data[row.dataset.arr] : data[row.dataset.arr][+row.dataset.i]),
    set: (row, v) => {
      const max = row.dataset.max ? +row.dataset.max : 3;
      const val = Math.max(0, Math.min(max, v));
      if (row.dataset.i === '') data[row.dataset.arr] = val; else data[row.dataset.arr][+row.dataset.i] = val;
    },
  };
}
