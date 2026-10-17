import { html, $, icon, toast, go, fmtDate } from '../util.js';
import { session } from '../auth.js';
import { getTraining, listTrainings, listTests, deleteTraining } from '../db.js';
import { topbar, emptyState } from '../ui.js';
import { badgeTile } from './ui.js';
import { newBadges } from './badges.js';
import { TIPO_INFO, sessionInfo } from './catalogo.js';
import {
  headline, compareWith, comparable, scoringResult, doppieResult, checkoutResult, pressioneResult, fmt1,
} from './calc.js';

function message(cmp) {
  const d = (n) => String(Math.abs(n)).replace('.', ',');
  switch (cmp.kind) {
    case 'pb': return { cls: 'pb', title: 'Nuovo record personale!', text: `+${d(cmp.delta)} rispetto all'ultima volta` };
    case 'up': return { cls: 'up', title: `+${d(cmp.delta)} rispetto all'ultima volta`, text: `Il tuo record resta ${fmt1(cmp.best)}: ci sei vicino.` };
    case 'same': return { cls: 'same', title: 'Come l\'ultima volta', text: 'Costanza: è già un buon segno.' };
    case 'down': return { cls: 'down', title: `${d(cmp.delta)} in meno dell'ultima volta`, text: `Capita: il tuo record è ${fmt1(cmp.best)}. La prossima è un'altra occasione.` };
    case 'first': return { cls: 'first', title: 'Primo risultato', text: 'Da qui si migliora: la prossima volta ti confronterai con questo.' };
    default: return null;
  }
}

function details(t) {
  const d = t.dati;
  switch (t.tipo) {
    case 'scoring': {
      const r = scoringResult(d);
      return html`<div class="chipgrid">${d.serie.map((v, i) => html`<span class="mini"><small>S${i + 1}</small><b>${v}</b></span>`)}</div>
        ${r.t20 != null ? html`<p class="muted small">Triple colpite: ${r.t20} su 100</p>` : ''}`;
    }
    case 'doppie': {
      const r = doppieResult(d);
      return html`<div class="chipgrid four">${r.per.map((p) => html`<span class="mini"><small>${p.b}</small><b>${p.hit}/20</b><small>${p.pct}%</small></span>`)}</div>
        <p class="muted small">Più solida: ${r.best.b} · da riprendere: ${r.worst.b}</p>`;
    }
    case 'checkout': {
      const r = checkoutResult(d);
      return html`<div class="chipgrid four">${d.outs.map((o, i) => html`<span class="mini ${d.frecce[i] > 0 ? 'good' : 'bad'}"><small>${o}</small><b>${d.frecce[i] > 0 ? `${d.frecce[i]}ª` : '✕'}</b></span>`)}</div>
        ${r.mediaFrecce != null ? html`<p class="muted small">Chiudi in media alla freccia ${fmt1(r.mediaFrecce)}</p>` : ''}`;
    }
    case 'pressione': {
      const r = pressioneResult(d);
      return html`<div class="chipgrid four">${d.bersagli.map((b, i) => html`<span class="mini ${r.esiti[i] ? 'good' : ''}"><small>${b}</small><b>${d.hit[i]}/3</b></span>`)}</div>
        <p class="muted small">Soglia: almeno ${d.soglia} su 3 · miglior serie: ${r.best}</p>`;
    }
    default: {
      const rows = [
        ['Media', d.average], ['Media first 9', d.first9], ['Doppie chiuse', d.doppieChiuse], ['Frecce alle doppie', d.frecceDoppie],
        ['Miglior checkout', d.bestCheckout], ['Miglior leg (frecce)', d.bestLeg],
        ['Visite 100-139', d.v100], ['Visite 140-179', d.v140], ['180', d.v180],
      ].filter(([, v]) => Number.isFinite(v));
      return rows.length
        ? html`<ul class="kv">${rows.map(([l, v]) => html`<li><span>${l}</span><b>${fmt1(v)}</b></li>`)}</ul>`
        : html`<p class="muted small">Nessun dato aggiuntivo inserito.</p>`;
    }
  }
}

export default async function view([id]) {
  const t = await getTraining(id);
  if (!t) return { html: html`${topbar('Sessione', { back: '/' })}${emptyState('Sessione non trovata', 'Potrebbe essere stata eliminata.')}` };
  const mine = t.playerId === session.account.playerId;
  const [all, tests] = await Promise.all([listTrainings(t.playerId), listTests(t.playerId)]);
  const prev = all
    .filter((x) => x.id !== t.id && comparable(t, x) && (x.creataIl || 0) < (t.creataIl || 0));
  const cmp = message(compareWith(t, prev));
  const h = headline(t);
  const info = sessionInfo(t.tipo, t.k);
  const nuovi = mine ? newBadges(all, tests, { sessionId: t.id }) : [];

  return {
    html: html`
      ${topbar(TIPO_INFO[t.tipo].label, { back: '/' })}
      <section class="card result ${cmp?.cls === 'pb' ? 'pb' : ''}">
        <p class="muted small">Sessione ${t.numero} · ${info.fase.nome} · ${fmtDate(t.data)}</p>
        <p class="result-big">${h.big}<small>${h.unit}</small></p>
        <p class="muted">${h.sub}</p>
        ${cmp ? html`<div class="result-msg ${cmp.cls}">
          ${cmp.cls === 'pb' ? icon('trophy', 22) : ''}
          <div><b>${cmp.title}</b><span>${cmp.text}</span></div></div>` : ''}
      </section>

      ${nuovi.length ? html`<h2 class="section">${nuovi.length === 1 ? 'Nuovo badge' : 'Nuovi badge'}</h2>
        <div class="bgrid">${nuovi.map((b) => badgeTile(b, true))}</div>` : ''}

      <div class="stats three">
        <div class="stat"><b>${t.durataMin ?? '—'}</b><span>Minuti</span></div>
        <div class="stat"><b>${t.concentrazione ?? '—'}</b><span>Concentr.</span></div>
        <div class="stat"><b>${t.feeling ?? '—'}</b><span>Feeling</span></div>
      </div>

      <h2 class="section">Il dettaglio</h2>
      <div class="card">${details(t)}</div>

      <div class="actions">
        <a class="btn primary" href="#/tipo">${icon('play', 18)} Prossimo allenamento</a>
        <a class="btn sec" href="#/">Torna alla home</a>
        ${mine ? html`<button type="button" class="btn danger" id="del">${icon('trash', 18)} Elimina sessione</button>` : ''}
      </div>`,
    mount(root) {
      $(root, '#del')?.addEventListener('click', async () => {
        if (!confirm('Eliminare questa sessione? Il tuo percorso tornerà indietro di un passo.')) return;
        try { await deleteTraining(id); toast('Sessione eliminata'); go('/miei'); }
        catch (e) { console.error(e); toast('Eliminazione non riuscita'); }
      });
    },
  };
}
