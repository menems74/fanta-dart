// Pannello a destra del bersaglio: punteggio e avanzamento di ogni gioco, piu' i comandi per l'inserimento a mano.
import { html } from '../util.js';
import { etichettaDardo } from '../dartboard.js';
import { restoProvvisorio, bersagliRotation } from './giochi.js';
import { frecceChiusura } from './scorer.js';

const somma = (a) => a.reduce((t, v) => t + v, 0);
const ev = (o) => JSON.stringify(o);

const testa = (grande, sopra, destra = '') => html`
  <div class="tscore"><div><p class="mu">${sopra}</p><div class="big">${grande}</div></div>
    <div class="sub">${destra}</div></div>`;
const recordBox = (rec, unit) => (rec == null ? html`<p class="mu sm">Primo risultato:<br>da qui si migliora</p>`
  : html`<p class="mu sm">Record</p><b>${rec}</b><p class="mu sm">${unit}</p>`);

/** Le frecce del turno in corso (3 caselle). */
const turno = (s) => html`<div class="frecce tre">${[0, 1, 2].map((i) => (s.turno[i]
  ? html`<span class="${s.turno[i] === 'X' ? 'v0' : 'v1'}">${etichettaDardo(s.turno[i])}</span>` : html`<span></span>`))}</div>`;

const nomeBersaglio = (n, modo = '') => (n === 25 ? (modo === 'D' ? 'Bull 50' : 'Bull') : `${modo === 'S' ? '' : modo}${n}`);

// ---------------------------------------------------------------- pannelli
const PANNELLI = {
  x501: (g, s, { rec }) => html`
    ${testa(restoProvvisorio(s), `Frecce usate: ${s.frecce}`, recordBox(rec, 'frecce'))}
    ${turno(s)}
    <p class="mu sm">${s.visite.length ? `Ultimo turno: ${s.visite.at(-1)} · media ${s.frecce ? ((501 - s.resto) / s.frecce * 3).toFixed(1) : 0}` : 'Primo turno: tocca a te'}</p>`,

  target20: pannelloTarget(['0', 'S', 'D', 'T']),
  targetbull: pannelloTarget(['0', '25', '', '50']),

  scoring: (g, s, { rec }) => {
    const visite = [...s.visite, ...(s.turno.length ? [s.parziale] : [])];
    return html`
      ${testa(g.valore(s), `Frecce ${s.frecce} di ${g.FRECCE}`, recordBox(rec, 'punti'))}
      <div class="serie sei">${Array.from({ length: 6 }, (_, i) => html`<span class="${i < s.visite.length ? 'fatta' : i === s.visite.length ? 'ora' : ''}">${visite[i] ?? ''}</span>`)}</div>
      ${turno(s)}
      <p class="mu sm">${s.visite.length ? `Media del turno ${(somma(s.visite) / s.visite.length).toFixed(1)}` : 'Tira dove vuoi: conta la somma'}</p>`;
  },

  checkout: (g, s, { rec }) => html`
    ${testa(s.finito ? '—' : s.resto, s.finito ? 'Finito' : `Chiusura ${s.idx + 1} di 16 · parti da ${s.numeri[s.idx]}`,
      html`<p class="mu sm">Chiuse</p><b>${g.valore(s)}</b><p class="mu sm">${rec == null ? 'primo risultato' : `record ${rec}`}</p>`)}
    <div class="pallini">${s.numeri.map((n, i) => html`<span class="${i < s.esiti.length ? (s.esiti[i] ? 'ok' : 'ko') : i === s.idx ? 'ora' : ''}">${n}</span>`)}</div>
    ${turno(s)}`,

  doppie: (g, s, { rec }) => html`
    ${testa(s.finito ? '—' : `D${g.DOPPIE[s.idx]}`, s.finito ? 'Finito' : `Freccia ${s.nella + 1} di ${g.PER_DOPPIA}`,
      html`<p class="mu sm">Colpi</p><b>${g.valore(s)}</b><p class="mu sm">${rec == null ? 'primo risultato' : `record ${rec}`}</p>`)}
    <div class="serie sette">${g.DOPPIE.map((n, i) => html`<span class="${i < s.idx ? 'fatta' : i === s.idx ? 'ora' : ''}"><small>D${n}</small>${i <= s.idx ? s.colpi[i] : ''}</span>`)}</div>
    ${turno(s)}`,

  rotation: (g, s, { rec }) => html`
    ${testa(s.finito ? '—' : nomeBersaglio(g.ROTATION[s.idx], s.modo), `${g.MODI[s.modo]} · frecce ${s.frecce}`, recordBox(rec, 'frecce'))}
    <div class="giro">${g.ROTATION.map((n, i) => html`<span class="${i < s.idx ? 'ok' : i === s.idx ? 'ora' : ''}">${n === 25 ? 'B' : n}</span>`)}</div>
    ${turno(s)}`,

  cricket: (g, s, { rec }) => {
    const ult = s.storia.at(-1);
    const n = g.TRAIN[s.pos];
    return html`
      ${testa(s.finito ? '—' : nomeBersaglio(n ?? 25), `Turno ${s.turni + (s.finito ? 0 : 1)}`, recordBox(rec, 'turni'))}
      <div class="giro treno">${g.TRAIN.map((x, i) => html`<span class="${i < s.pos ? 'ok' : i === s.pos ? 'ora' : ''}">${x === 25 ? 'Bull' : x}</span>`)}</div>
      ${turno(s)}
      <p class="mu sm">${ult ? `Ultimo turno sul ${ult.n === 25 ? 'bull' : ult.n}: ${ult.colpi} ${ult.colpi === 1 ? 'colpo' : 'colpi'}` : '3 colpi avanti, 2 resti, 1 o 0 torni indietro'}</p>`;
  },
};

function pannelloTarget(etichette) {
  return (g, s, { rec }) => {
    const n = s.punti.length;
    const ora = Math.min(Math.floor(n / g.PER_SERIE), s.nSerie - 1);
    const serie = (i) => s.punti.slice(i * g.PER_SERIE, (i + 1) * g.PER_SERIE);
    const cur = serie(ora);
    return html`
      ${testa(g.valore(s), `Serie ${ora + 1} di ${s.nSerie}`, recordBox(rec, `punti in ${s.nSerie} serie`))}
      <div class="serie n${s.nSerie}">${Array.from({ length: s.nSerie }, (_, i) => {
        const x = serie(i);
        const fatta = x.length === g.PER_SERIE;
        return html`<span class="${fatta ? 'fatta' : i === ora ? 'ora' : ''}">${fatta || i === ora ? somma(x) : ''}</span>`;
      })}</div>
      <div class="frecce">${Array.from({ length: g.PER_SERIE }, (_, i) => (i < cur.length
        ? html`<span class="v${cur[i]}">${etichette[cur[i]]}</span>` : html`<span></span>`))}</div>`;
  };
}

export const pannello = (g, s, ctx) => PANNELLI[g.id](g, s, ctx);

// ---------------------------------------------------------------- comandi manuali
const tastierino = (input, testo) => html`
  <div class="tast">
    <div class="kdisp ${input ? '' : 'vuoto'}">${input || testo}</div>
    ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => html`<button type="button" data-k="${n}">${n}</button>`)}
    <button type="button" data-k="back" class="canc" aria-label="Cancella l'ultima cifra">⌫</button>
    <button type="button" data-k="ok" class="ok">OK</button>
  </div>`;
const rapido = (e, testo, sotto, cls = '') => html`<button type="button" class="${cls}" data-ev="${ev(e)}">${testo}${sotto != null ? html`<small>${sotto}</small>` : ''}</button>`;
const dardoBtn = (id, testo, sotto, cls = '') => rapido({ t: 'd', id }, testo, sotto, cls);

/** Comandi per chi non ha il Granboard (o vuole inserire a mano). ctx: { input, chiusura } */
export function comandi(g, s, ctx) {
  if (s.finito) return '';
  switch (g.id) {
    case 'x501':
      if (ctx.chiusura) {
        return html`<div class="quick">${frecceChiusura(ctx.chiusura.resto).map((n) => rapido({ t: 'turno', s: ctx.chiusura.s, d: n }, `${n}ª freccia`, 'chiuso', 'q2'))}
          ${rapido({ t: 'turno', s: ctx.chiusura.s, d: 0 }, 'Non in doppia', 'sballato', 'q0')}</div>`;
      }
      return s.turno.length ? '' : tastierino(ctx.input, 'Somma del turno');
    case 'scoring': return s.turno.length ? '' : tastierino(ctx.input, 'Somma del turno');
    case 'target20':
    case 'targetbull':
      return html`<div class="quick">${g.quick.map(([id, testo, v], i) => dardoBtn(id, testo, v, `q${Math.min(i, 3)}`))}</div>`;
    case 'checkout':
      return s.turno.length ? '' : html`<div class="quick">${rapido({ t: 'esito', ok: true }, 'Chiuso', 'entro 3 frecce', 'q2')}${rapido({ t: 'esito', ok: false }, 'Non chiuso', 'o sballato', 'q0')}</div>`;
    case 'doppie': {
      const n = g.DOPPIE[s.idx];
      return html`<div class="quick">${dardoBtn('X', 'Mancata', null, 'q0')}${dardoBtn(`D${n}`, `Presa D${n}`, null, 'q2')}</div>`;
    }
    case 'rotation': {
      const [id] = bersagliRotation(s.modo, g.ROTATION[s.idx]);
      return html`<div class="quick">${dardoBtn('X', 'Mancato', null, 'q0')}${dardoBtn(id, 'Preso', nomeBersaglio(g.ROTATION[s.idx], s.modo), 'q2')}</div>`;
    }
    case 'cricket': {
      if (s.turno.length) return '';
      if (g.TRAIN[s.pos] === 25) return html`<div class="quick">${rapido({ t: 'colpi', n: 0 }, 'Bull mancato', 'torni al 15', 'q0')}${rapido({ t: 'colpi', n: 1 }, 'Bull preso', 'fine!', 'q3')}</div>`;
      return html`<p class="mu sm">Quanti colpi sul ${g.TRAIN[s.pos]} in questo turno?</p>
        <div class="quick">${[0, 1, 2, 3].map((n) => rapido({ t: 'colpi', n }, String(n), n === 3 ? 'avanti' : n === 2 ? 'resti' : 'indietro', `q${n}`))}</div>`;
    }
    default: return '';
  }
}
