// Prototipo grafico della nuova sezione allenamenti. Dati finti, nessun salvataggio, nessun collegamento a Firebase.
// Serve solo a provare l'aspetto su tablet e telefono, in orizzontale e in verticale.
import { SEGMENTI, SETTORI } from './dartboard.js';

const view = document.getElementById('view');
const overlay = document.getElementById('overlay');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- dati finti ----------
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const serieFinta = (n, da, a, rumore) => Array.from({ length: n }, (_, i) => Math.round(da + ((a - da) * i) / Math.max(1, n - 1) + (rnd() - 0.5) * rumore));

// basso: meno e' meglio. voto: da valore a 0-100.
const GIOCHI = [
  { id: 'x501', nome: '501', desc: 'Un leg da solo, double out', unit: 'frecce', basso: true, voto: (v) => (45 - v) / (45 - 12) * 100, storia: serieFinta(14, 34, 27, 4) },
  { id: 'target20', nome: 'Target 20', desc: '10 serie da 9 frecce al 20', unit: '/ 270', voto: (v) => v / 150 * 100, storia: serieFinta(16, 78, 104, 14) },
  { id: 'targetbull', nome: 'Target Bull', desc: '10 serie da 9 frecce al centro', unit: '/ 270', voto: (v) => v / 90 * 100, storia: serieFinta(9, 30, 29, 8) },
  { id: 'scoring', nome: 'Scoring', desc: '18 frecce, dove vuoi', unit: 'punti', voto: (v) => v / 600 * 100, storia: serieFinta(12, 330, 296, 40) },
  { id: 'checkout', nome: 'Checkout', desc: '16 chiusure da 40 a 100', unit: '/ 16', voto: (v) => v / 10 * 100, storia: serieFinta(8, 3, 6, 2) },
  { id: 'doppie', nome: 'Doppie', desc: '15 frecce su 7 doppie', unit: '/ 105', voto: (v) => v / 45 * 100, storia: serieFinta(11, 14, 21, 4) },
  { id: 'rotation', nome: 'Rotation', desc: 'Dall\'1 al 20, poi il bull', unit: 'frecce', basso: true, voto: (v) => (120 - v) / (120 - 25) * 100, storia: serieFinta(6, 74, 63, 10) },
  { id: 'cricket', nome: 'Cricket Train', desc: 'Dal 20 al 15, poi il bull', unit: 'turni', basso: true, voto: (v) => (40 - v) / (40 - 8) * 100, storia: serieFinta(3, 22, 20, 3) },
];
const clamp = (v) => Math.max(0, Math.min(100, v));
const media = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const votoGioco = (g) => Math.round(clamp(media(g.storia.slice(-10).map(g.voto))));
const record = (g) => (g.basso ? Math.min(...g.storia) : Math.max(...g.storia));

/** Pollice: media delle ultime 3 contro le 3 precedenti (voti). Sotto 4 sessioni: "nuovo". */
function trendOf(storia, voto) {
  if (storia.length < 4) return 'nuovo';
  const v = storia.map(voto);
  const ult = media(v.slice(-3));
  const prima = media(v.slice(-6, -3));
  const d = (ult - prima) / Math.max(1, Math.abs(prima));
  return d > 0.03 ? 'su' : d < -0.03 ? 'giu' : 'pari';
}

const SKILL_VOCI = [['Scoring', ['scoring', 'target20']], ['Bull', ['targetbull']], ['Doppie', ['doppie']], ['Checkout', ['checkout']], ['Precisione', ['rotation', 'cricket']], ['501', ['x501']]];
const skillDi = () => Math.round(media(GIOCHI.map(votoGioco)));

const SQUADRA = [
  { nome: 'Remolo', skill: skillDi(), sess: 79, storia: serieFinta(12, 38, skillDi(), 4) },
  { nome: 'Marco', skill: 61, sess: 54, storia: serieFinta(10, 55, 61, 5) },
  { nome: 'Luca', skill: 47, sess: 31, storia: serieFinta(8, 50, 47, 4) },
  { nome: 'Giorgio', skill: 40, sess: 12, storia: serieFinta(5, 36, 40, 4) },
  { nome: 'Fabio', skill: 33, sess: 3, storia: serieFinta(3, 30, 33, 3) },
];

// ---------- icone ----------
const ICON = {
  su: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 21h4V9H2v12zm20-11a2 2 0 0 0-2-2h-6.3l1-4.6v-.3c0-.4-.2-.8-.4-1.1L13.2 1 6.6 7.6C6.2 8 6 8.5 6 9v10a2 2 0 0 0 2 2h9c.8 0 1.5-.5 1.8-1.2l3-7.1c.1-.2.2-.5.2-.7v-2z"/></svg>',
  giu: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 3h-4v12h4V3zM2 14a2 2 0 0 0 2 2h6.3l-1 4.6v.3c0 .4.2.8.4 1.1l1.1 1 6.6-6.6c.4-.4.6-.9.6-1.4V5a2 2 0 0 0-2-2H7c-.8 0-1.5.5-1.8 1.2l-3 7.1c-.1.2-.2.5-.2.7v2z"/></svg>',
  pari: '<svg viewBox="0 0 24 24"><path d="M5 12h14" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  chiudi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};
const trendBadge = (t) => `<span class="trend ${t}" title="${{ su: 'In miglioramento', giu: 'In calo', pari: 'Stabile', nuovo: 'Poche sessioni' }[t]}">${t === 'nuovo' ? 'NUOVO' : ICON[t]}</span>`;
const COLORE = { su: '#34d399', giu: '#f87171', pari: '#f59e0b', nuovo: '#94a9cb' };

// ---------- grafici ----------
/** Linea su SVG. Se basso (meno e' meglio) l'asse e' rovesciato: in alto c'e' sempre il meglio. */
function linea(valori, { w = 300, h = 90, colore = '#3b82f6', basso = false, assi = false } = {}) {
  const pad = assi ? { l: 40, r: 14, t: 16, b: 26 } : { l: 4, r: 4, t: 6, b: 6 };
  const min = Math.min(...valori);
  const max = Math.max(...valori);
  const span = max - min || 1;
  const x = (i) => pad.l + (i * (w - pad.l - pad.r)) / Math.max(1, valori.length - 1);
  const y = (v) => { const t = (v - min) / span; return pad.t + (basso ? t : 1 - t) * (h - pad.t - pad.b); };
  const pts = valori.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const area = `M${x(0)},${h - pad.b} L${pts.join(' L')} L${x(valori.length - 1)},${h - pad.b} Z`;
  let extra = '';
  if (assi) {
    const top = basso ? min : max;
    const bot = basso ? max : min;
    extra = `<line class="ax" x1="${pad.l}" x2="${w - pad.r}" y1="${pad.t}" y2="${pad.t}"/><line class="ax" x1="${pad.l}" x2="${w - pad.r}" y1="${h - pad.b}" y2="${h - pad.b}"/>
      <text x="${pad.l - 6}" y="${pad.t + 4}" text-anchor="end">${top}</text><text x="${pad.l - 6}" y="${h - pad.b + 4}" text-anchor="end">${bot}</text>
      <text x="${pad.l}" y="${h - 6}">prima</text><text x="${w - pad.r}" y="${h - 6}" text-anchor="end">ultima</text>
      ${valori.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="5" fill="${colore}"/>`).join('')}
      <text x="${x(valori.length - 1)}" y="${y(valori.at(-1)) - 10}" text-anchor="end" style="fill:${colore};font-weight:800;font-size:14px">${valori.at(-1)}</text>`;
  }
  return `<svg class="line${assi ? ' assi' : ''}" viewBox="0 0 ${w} ${h}"${assi ? '' : ' preserveAspectRatio="none"'} aria-hidden="true">
    <path class="area" d="${area}" fill="${colore}"/><path class="l" d="M${pts.join(' L')}" stroke="${colore}" vector-effect="non-scaling-stroke"/>${extra}</svg>`;
}

// ---------- stato del prototipo ----------
const stato = { tavola: false };

function topbar(titolo, { back = null, extra = '' } = {}) {
  return `<header class="top">
    ${back ? `<a class="iconbtn" href="${back}" aria-label="Indietro">${ICON.back}</a>` : ''}
    <h1>${titolo}</h1>${extra}
    <button class="board-chip ${stato.tavola ? 'on' : ''}" data-act="tavola"><span class="dot"></span>${stato.tavola ? 'Granboard collegato' : 'Collega Granboard'}</button>
    <button class="iconbtn" data-act="full" aria-label="Schermo intero">${ICON.full}</button>
  </header>`;
}

// ---------- home ----------
function home() {
  const skill = skillDi();
  const voci = SKILL_VOCI.map(([n, ids]) => [n, Math.round(media(ids.map((id) => votoGioco(GIOCHI.find((g) => g.id === id)))))]);
  return `${topbar('Allenamenti')}
  <p class="banner">Prototipo: dati finti, nulla viene salvato. Giocabile solo Target 20.</p>
  <div class="page home">
    <aside class="side">
      <section class="figurina">
        <div class="head"><div class="voto">${skill}</div><div><p class="lbl">Skill giocatore</p><p class="nome">Remolo</p></div></div>
        <div class="attr">${voci.map(([n, v]) => `<div><span>${n}</span><b>${v}</b></div>`).join('')}</div>
      </section>
      <nav class="menu">
        <button data-go="#/progressi"><b>I miei progressi</b><span>79 sessioni · 4 questa settimana</span></button>
        <button data-go="#/squadra"><b>Squadra</b><span>5 giocatori</span></button>
        <button class="sfida" data-go="#/gioco/target20"><b>Sfida del sabato · Target 20</b><span>Mancano 5 giorni · in testa Marco con 112</span></button>
      </nav>
    </aside>
    <section class="giochi">
      ${GIOCHI.map((g) => {
        const t = trendOf(g.storia, g.voto);
        return `<button class="gioco" data-go="#/gioco/${g.id}">
          ${trendBadge(t)}
          <h3>${g.nome}</h3><p class="desc">${g.desc}</p>
          ${linea(g.storia.slice(-10), { w: 200, h: 38, colore: COLORE[t], basso: g.basso }).replace('class="line"', 'class="spark"')}
          <div class="nums"><div><small>Record</small><b>${record(g)}</b></div><div><small>Ultima</small><b>${g.storia.at(-1)}</b></div><div><small>Voto</small><b>${votoGioco(g)}</b></div></div>
        </button>`;
      }).join('')}
    </section>
  </div>`;
}

// ---------- progressi ----------
function progressi() {
  const conVoto = GIOCHI.map((g) => ({ g, v: votoGioco(g), t: trendOf(g.storia, g.voto) }));
  const peggiori = [...conVoto].sort((a, b) => (b.t === 'giu') - (a.t === 'giu') || a.v - b.v).slice(0, 2);
  const migliori = [...conVoto].sort((a, b) => (b.t === 'su') - (a.t === 'su') || b.v - a.v).slice(0, 2);
  return `${topbar('I miei progressi', { back: '#/' })}
  <div class="page progressi">
    <div class="stats">
      <div class="card"><b>79</b><span>sessioni</span></div><div class="card"><b>4</b><span>questa settimana</span></div>
      <div class="card"><b>${skillDi()}</b><span>skill</span></div><div class="card"><b>7</b><span>badge</span></div>
    </div>
    <div class="focus">
      <section class="card bad"><h2>Dove impegnarti</h2><ul>${peggiori.map(({ g, v, t }) => `<li><span>${g.nome}</span><span>voto <b>${v}</b> ${t === 'giu' ? '· in calo' : ''}</span></li>`).join('')}</ul></section>
      <section class="card good"><h2>Dove vai forte</h2><ul>${migliori.map(({ g, v, t }) => `<li><span>${g.nome}</span><span>voto <b>${v}</b> ${t === 'su' ? '· in crescita' : ''}</span></li>`).join('')}</ul></section>
    </div>
    <div class="charts">
      ${conVoto.map(({ g, v, t }) => `<button class="card chartcard" data-chart="${g.id}">
        ${trendBadge(t)}<h3>${g.nome}</h3>
        <p class="mu sm">Voto ${v} · record ${record(g)} ${g.unit}${g.basso ? ' · meno è meglio' : ''}</p>
        ${linea(g.storia, { w: 300, h: 90, colore: COLORE[t], basso: g.basso })}
      </button>`).join('')}
    </div>
  </div>`;
}

function apriGrafico(id) {
  const g = GIOCHI.find((x) => x.id === id);
  const t = trendOf(g.storia, g.voto);
  overlay.innerHTML = `<div class="modal" data-act="chiudi"><div class="card" data-stop>
    <header>${trendBadge(t).replace('class="trend', 'style="position:static" class="trend')}<h2>${g.nome}</h2><button class="iconbtn" data-act="chiudi" aria-label="Chiudi">${ICON.chiudi}</button></header>
    <p class="mu">Ultime ${g.storia.length} sessioni · ${g.unit}${g.basso ? ' · meno è meglio, quindi in alto c\'è il risultato migliore' : ''}</p>
    ${linea(g.storia, { w: 800, h: 320, colore: COLORE[t], basso: g.basso, assi: true })}
    <div class="azioni"><a class="btn pri" style="display:grid;place-items:center;text-decoration:none" href="#/gioco/${g.id}">Allenati ora</a></div>
  </div></div>`;
}

// ---------- squadra ----------
function squadra() {
  return `${topbar('Squadra', { back: '#/' })}
  <div class="page team">
    ${SQUADRA.map((p) => {
      const t = trendOf(p.storia, (v) => v);
      return `<button class="card player" data-go="#/progressi"><span class="av">${esc(p.nome[0])}</span>
        <span><b style="font-size:20px">${esc(p.nome)}</b><br><span class="mu sm">${p.sess} sessioni</span></span>
        <span class="sk">${p.skill}</span>${trendBadge(t)}</button>`;
    }).join('')}
  </div>`;
}

// ---------- Target 20 ----------
const T = { frecce: [], conto: null, fine: false };
const VAL = { S20i: 1, S20o: 1, D20: 2, T20: 3 };
const SERIE = 10;
const PER_SERIE = 9;

function bersaglio(target) {
  const isTarget = (s) => s.n === target && s.anello !== 'b';
  const paths = SEGMENTI.map((s) => {
    const cls = ['seg', s.pari ? 'alt' : '', s.anello === 't' || s.anello === 'd' ? 'ring' : '', isTarget(s) ? 'target' : ''].filter(Boolean).join(' ');
    return `<path class="${cls}" data-id="${s.id}" d="${s.path}"${s.evenodd ? ' fill-rule="evenodd"' : ''}/>`;
  }).join('');
  const numeri = SETTORI.map((n, i) => {
    const a = (i * 18 * Math.PI) / 180;
    return `<text class="${n === target ? 'tg' : ''}" x="${(108 * Math.sin(a)).toFixed(1)}" y="${(-108 * Math.cos(a)).toFixed(1)}">${n}</text>`;
  }).join('');
  return `<svg viewBox="-118 -118 236 236" role="img" aria-label="Bersaglio: tocca dove hai colpito"><circle class="miss" data-id="X" r="118"/>${paths}${numeri}</svg>`;
}

function target20() {
  const tot = T.frecce.reduce((a, b) => a + b, 0);
  const serieDi = (i) => T.frecce.slice(i * PER_SERIE, (i + 1) * PER_SERIE);
  const ora = Math.min(Math.floor(T.frecce.length / PER_SERIE), SERIE - 1);
  const cur = serieDi(ora);
  const rec = record(GIOCHI[1]);
  return `${topbar('Target 20', { back: '#/' })}
  <div class="play">
    <div class="bersaglio" id="board">${bersaglio(20)}</div>
    <div class="panel">
      <div class="score"><div><p class="mu">Serie ${ora + 1} di ${SERIE}</p><div class="big">${tot}</div></div>
        <div class="sub"><p class="mu sm">Record</p><b>${rec}</b><p class="mu sm">media ${(tot / Math.max(1, T.frecce.length) * PER_SERIE).toFixed(1)} a serie</p></div></div>
      <div class="serie">${Array.from({ length: SERIE }, (_, i) => {
        const s = serieDi(i);
        const fatta = s.length === PER_SERIE;
        return `<span class="${fatta ? 'fatta' : i === ora ? 'ora' : ''}">${fatta || i === ora ? s.reduce((a, b) => a + b, 0) : ''}</span>`;
      }).join('')}</div>
      <div class="frecce">${Array.from({ length: PER_SERIE }, (_, i) => (i < cur.length ? `<span class="v${cur[i]}">${['0', 'S', 'D', 'T'][cur[i]]}</span>` : '<span></span>')).join('')}</div>
      ${stato.tavola ? '<p class="mu center sm">Tira: le frecce si segnano da sole. Puoi anche toccare il bersaglio.</p>'
        : `<div class="quick"><button class="q0" data-v="0">Mancato<small>0</small></button><button class="q1" data-v="1">Singolo<small>1</small></button>
           <button class="q2" data-v="2">Doppio<small>2</small></button><button class="q3" data-v="3">Triplo<small>3</small></button></div>`}
      <div class="azioni">
        <button class="btn" data-act="annulla">Annulla</button>
        ${stato.tavola ? '<button class="btn sim" data-act="tiro">Tiro simulato</button>' : ''}
        <button class="btn" data-act="finetest">Vai alla fine (prova)</button>
      </div>
    </div>
  </div>`;
}

function lampeggia(id, ok) {
  const p = view.querySelector(`[data-id="${id}"]`);
  if (!p || id === 'X') return;
  p.classList.add(ok ? 'hitok' : 'hit');
  setTimeout(() => p.classList.remove('hitok', 'hit'), 450);
}

function freccia(id) {
  if (T.conto || T.fine) return;
  const v = VAL[id] ?? 0;
  T.frecce.push(v);
  render();
  lampeggia(id, v > 0);
  const n = T.frecce.length;
  if (n >= SERIE * PER_SERIE) { setTimeout(fineGioco, 500); return; }
  if (stato.tavola && n % 3 === 0) contoAllaRovescia();
}
// Con i pulsanti rapidi illumino un settore di esempio del 20.
const freccia_rapida = (v) => freccia(['X', 'S20o', 'D20', 'T20'][v]);

function contoAllaRovescia() {
  const fine = Date.now() + 6000;
  const ultime = T.frecce.slice(-3);
  const disegna = () => {
    const s = Math.ceil((fine - Date.now()) / 1000);
    if (s <= 0) { clearInterval(T.conto); T.conto = null; overlay.innerHTML = ''; return; }
    overlay.innerHTML = `<div class="conto" role="status"><p>Togli le freccette</p><div class="n">${s}</div>
      <p class="riep">Turno: <b>${ultime.map((v) => ['0', 'S', 'D', 'T'][v]).join(' · ')}</b> = <b>${ultime.reduce((a, b) => a + b, 0)}</b></p>
      <button class="btn" data-act="saltaconto">Sono pronto</button></div>`;
  };
  disegna();
  T.conto = setInterval(disegna, 200);
}

function fineGioco() {
  T.fine = true;
  const tot = T.frecce.reduce((a, b) => a + b, 0);
  const rec = record(GIOCHI[1]);
  overlay.innerHTML = `<div class="fine"><div class="card">
    <p class="mu">Target 20 · 90 frecce</p><div class="big">${tot}</div>
    <p>${tot > rec ? `Nuovo record! Il precedente era ${rec}.` : `Il tuo record è ${rec}.`}</p>
    <p class="mu sm">Voto ${Math.round(clamp(GIOCHI[1].voto(tot)))} · ${(tot / SERIE).toFixed(1)} punti a serie</p>
    <div class="azioni"><button class="btn" data-act="torna">Torna agli allenamenti</button><button class="btn pri" data-act="ancora">Gioca ancora</button></div>
  </div></div>`;
}

// ---------- router ----------
function render() {
  const h = location.hash || '#/';
  if (h.startsWith('#/gioco')) view.innerHTML = target20();
  else if (h === '#/progressi') view.innerHTML = progressi();
  else if (h === '#/squadra') view.innerHTML = squadra();
  else view.innerHTML = home();
}
window.addEventListener('hashchange', () => {
  overlay.innerHTML = '';
  if (location.hash.startsWith('#/gioco')) Object.assign(T, { frecce: [], fine: false });
  render();
  scrollTo(0, 0);
});

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-go],[data-act],[data-v],[data-chart]');
  if (!el) return;
  if (el.dataset.go) { location.hash = el.dataset.go; return; }
  if (el.dataset.chart) { apriGrafico(el.dataset.chart); return; }
  if (el.dataset.v !== undefined) { freccia_rapida(+el.dataset.v); return; }
  const a = el.dataset.act;
  if (a === 'chiudi') { if (e.target.closest('[data-stop]') && el.classList.contains('modal')) return; overlay.innerHTML = ''; }
  else if (a === 'tavola') { stato.tavola = !stato.tavola; render(); }
  else if (a === 'full') {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
  } else if (a === 'annulla') { T.frecce.pop(); render(); }
  else if (a === 'tiro') {
    const r = rnd();
    freccia(r < 0.12 ? 'T20' : r < 0.18 ? 'D20' : r < 0.62 ? (rnd() < 0.5 ? 'S20i' : 'S20o') : ['S1o', 'S5o', 'S1i', 'S5i', 'T1', 'T5', 'X'][Math.floor(rnd() * 7)]);
  } else if (a === 'saltaconto') { clearInterval(T.conto); T.conto = null; overlay.innerHTML = ''; }
  else if (a === 'finetest') { while (T.frecce.length < SERIE * PER_SERIE) T.frecce.push(Math.floor(rnd() * 2.2)); render(); fineGioco(); }
  else if (a === 'torna') location.hash = '#/';
  else if (a === 'ancora') { overlay.innerHTML = ''; Object.assign(T, { frecce: [], fine: false }); render(); }
});

// Tocco sul bersaglio: registra il settore (anche "fuori" toccando il bordo esterno).
view.addEventListener('pointerdown', (e) => {
  const p = e.target.closest('#board [data-id]');
  if (p) { e.preventDefault(); freccia(p.dataset.id); }
});

render();
