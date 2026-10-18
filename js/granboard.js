// Pagina di prova (non fa parte dell'app): si collega al Granboard con Web Bluetooth.
// La tavola invia testo del tipo "3.4@" a ogni freccia: con la taratura guidata costruiamo la tabella codice -> settore.
import { html, raw, $ } from './util.js';
import { topbar } from './ui.js';
import { keepAwake } from './training/awake.js';
import { hex, dec, ascii, shortUuid, parseUuids, parseHexBytes } from './granboard-utils.js';
import { ordineTaratura, segmento, disegnoBersaglio } from './dartboard.js';

// Servizio della tavola trovato con nRF Connect: una caratteristica che invia notifiche (...1571) e una in scrittura (...1572).
const SERVICE = '442f1570-8a00-9a28-cbe1-e1d4212d53eb';
const NOTIFY = '442f1571-8a00-9a28-cbe1-e1d4212d53eb';
const WRITE = '442f1572-8a00-9a28-cbe1-e1d4212d53eb';
const STANDARD = ['generic_access', 'generic_attribute', 'device_information', 'battery_service', SERVICE];
// Comandi ai led registrati dall'app ufficiale (16 byte ciascuno).
const PROVE = [
  ['Avvio 1', '1600000000000000000000006e000000'],
  ['Avvio 2', '147d00007d0000000000000205010000'],
  ['Avvio 3', '0d7d0000000000000000000205020000'],
  ['Doppio', '027d00007d0000000000190014000000'],
  ['Singolo', '017d00007d0000000000190014000000'],
  ['Triplo', '110000ff00ffff0000000a0005020000'],
  ['Bull', '1f4b007d4b007d00487d000023010000'],
  ['Fine turno', '0c000000000000000000000010000000'],
  ['Altro 11', '117d00007d0000000000100005000000'],
  ['Spento', '01000000000000000000000000000000'],
];
const KEY = 'fd.granboard.uuids';
const MAP_KEY = 'fd.granboard.map';
const CODICE = /^(\d+)\.(\d+)@$/;
const ORDINE = ordineTaratura();

const store = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage non disponibile */ } },
};
const loadMap = () => { try { return JSON.parse(store.get(MAP_KEY, '{}')) || {}; } catch { return {}; } };

const root = document.getElementById('view');
const supported = 'bluetooth' in navigator;

root.innerHTML = html`
  ${topbar('Prova Granboard')}
  <section class="card sess-intro">
    <p>Pagina di prova: si collega alla tavola, legge i colpi e permette di tararla.</p>
    <p class="muted small">1. Chiudi l'app GranDarts e nRF Connect: la tavola si collega a un solo dispositivo alla volta.<br>
      2. Accendi il Granboard e premi «Collega la tavola».<br>
      3. Scegli GRANBOARD dall'elenco.<br>
      4. Avvia la «Taratura guidata» qui sotto e tira sul settore evidenziato.</p>
    ${supported ? '' : html`<p class="error">Questo browser non supporta Web Bluetooth: apri la pagina con Chrome su Android.</p>`}
  </section>

  <div class="actions tight">
    <button type="button" class="btn primary" id="connect" ${supported ? '' : 'disabled'}>Collega la tavola</button>
    <button type="button" class="btn sec" id="disconnect" hidden>Scollega</button>
  </div>

  <div id="cal"></div>

  <h2 class="section">Registro</h2>
  <pre id="log" class="glog" aria-live="polite">In attesa di collegamento.</pre>
  <div class="actions tight">
    <button type="button" class="btn primary" id="copy">Copia il registro</button>
    <button type="button" class="btn sec" id="clear">Svuota</button>
  </div>

  <section class="card">
    <b>Prove dei led</b>
    <p class="muted small">Comandi registrati dall'app ufficiale. Collega la tavola, tocca un pulsante e scrivi nel registro cosa si accende.</p>
    <div class="opts wrap">${PROVE.map(([nome, h]) => html`<button type="button" class="btn sec" data-prova="${h}">${nome}</button>`)}</div>
  </section>
  <details class="more">
    <summary>Opzioni avanzate</summary>
    <label class="field">UUID aggiuntivi dei servizi (facoltativo, uno per riga)
      <textarea id="uuids" rows="2">${store.get(KEY, '')}</textarea>
    </label>
    <div class="two">
      <label class="field">Invia alla tavola (byte in esadecimale)<input id="hexin" placeholder="es. 01 ff" autocomplete="off"></label>
      <button type="button" class="btn sec" id="send" style="align-self:end" disabled>Invia</button>
    </div>
    <div class="two">
      <label class="field">Nota nel registro<input id="nota" placeholder="es. T20" autocomplete="off"></label>
      <button type="button" class="btn sec" id="addnota" style="align-self:end">Aggiungi</button>
    </div>
  </details>`.s;

// ---------- registro ----------
const logEl = $(root, '#log');
const lines = [];
const t0 = Date.now();
const out = (txt) => {
  lines.push(`${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s  ${txt}`);
  logEl.textContent = lines.join('\n');
  logEl.scrollTop = logEl.scrollHeight;
};

// ---------- taratura guidata ----------
const cal = { attiva: false, map: loadMap(), storia: [], saltati: new Set(), msg: '', errore: false, esporta: false };
const fatti = () => new Set(Object.values(cal.map));
const corrente = () => ORDINE.find((id) => !fatti().has(id) && !cal.saltati.has(id)) || null;
const salva = () => store.set(MAP_KEY, JSON.stringify(cal.map));

function drawCal() {
  const el = $(root, '#cal');
  const done = fatti();
  const target = corrente();
  const tot = ORDINE.length;
  $(root, '.sess-intro').hidden = cal.attiva; // durante la taratura serve solo il settore da colpire
  let corpo;
  if (!cal.attiva) {
    corpo = html`<p class="muted small">Ti mostro un settore alla volta sul bersaglio: tiri una freccia lì e la pagina registra il codice inviato dalla tavola. Sono ${tot} settori; puoi fermarti e riprendere quando vuoi.</p>
      <button type="button" class="btn primary" id="calstart">${done.size ? 'Riprendi la taratura' : 'Inizia la taratura'}</button>`;
  } else if (target) {
    const s = segmento(target);
    corpo = html`
      <div class="card caltarget"><p class="muted small">Tira su questo settore</p><p class="calname">${s.nome}</p>
        <p class="muted small">${s.descr === 'Doppio' ? 'Anello esterno' : s.descr === 'Triplo' ? 'Anello stretto interno' : s.descr === 'Singolo interno' ? 'Parte vicina al bull, prima dell\'anello del triplo' : s.descr === 'Singolo esterno' ? 'Parte tra l\'anello del triplo e quello del doppio' : s.descr}</p></div>
      ${raw(disegnoBersaglio({ done, current: target }))}
      ${cal.msg ? html`<p class="${cal.errore ? 'error' : 'muted'}">${cal.msg}</p>` : ''}
      <div class="actions tight cols3">
        <button type="button" class="btn sec" id="calback">Indietro</button>
        <button type="button" class="btn sec" id="calskip">Salta questo</button>
        <button type="button" class="btn sec" id="calstop">Pausa</button>
      </div>`;
  } else {
    corpo = html`<p class="goal">Taratura completa: ${done.size} settori su ${tot}.</p>${raw(disegnoBersaglio({ done }))}`;
  }
  el.innerHTML = html`
    <h2 class="section">Taratura guidata · ${done.size} / ${tot}</h2>
    ${corpo}
    ${done.size ? html`<button type="button" class="btn sec" id="calexport" style="margin-top:12px">Mostra e copia la tabella</button>` : ''}
    ${cal.esporta ? html`<pre class="glog" id="caljson">${JSON.stringify(cal.map)}</pre>
      <button type="button" class="btn primary" id="calcopy" style="margin-top:8px">Copia la tabella</button>
      <button type="button" class="btn danger" id="calreset" style="margin-top:8px">Azzera la taratura</button>` : ''}`.s;
}

function handleCode(testo) {
  const m = CODICE.exec(testo);
  if (!m || !cal.attiva) return;
  const target = corrente();
  if (!target) return;
  const gia = cal.map[testo];
  if (gia) {
    cal.msg = `Il codice ${testo} è già assegnato a ${segmento(gia).nome}: hai colpito un altro settore? Riprova su quello evidenziato.`;
    cal.errore = true;
  } else {
    cal.map[testo] = target;
    cal.storia.push(testo);
    cal.msg = `${segmento(target).nome} registrato (codice ${testo}).`;
    cal.errore = false;
    salva();
  }
  drawCal();
}

$(root, '#cal').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.id === 'calstart') { cal.attiva = true; cal.msg = ''; }
  else if (b.id === 'calstop') cal.attiva = false;
  else if (b.id === 'calskip') { cal.saltati.add(corrente()); cal.msg = ''; }
  else if (b.id === 'calback') {
    const c = cal.storia.pop();
    if (c) { delete cal.map[c]; salva(); cal.msg = 'Ultimo settore annullato: ripeti il tiro.'; cal.errore = false; }
    else { cal.saltati.clear(); cal.msg = 'Settori saltati di nuovo in lista.'; cal.errore = false; }
  } else if (b.id === 'calexport') cal.esporta = !cal.esporta;
  else if (b.id === 'calreset') {
    if (!confirm('Azzerare tutta la taratura?')) return;
    cal.map = {}; cal.storia = []; cal.saltati.clear(); cal.esporta = false; salva();
  } else if (b.id === 'calcopy') {
    try { await navigator.clipboard.writeText(JSON.stringify(cal.map)); cal.msg = 'Tabella copiata negli appunti.'; cal.errore = false; }
    catch { cal.msg = 'Selezione manuale: tieni premuto sul testo e scegli Copia.'; cal.errore = true; }
  } else return;
  drawCal();
});

// ---------- collegamento ----------
let device = null;
let awake = null;
let writeChar = null;

const onValue = (ev) => {
  const c = ev.target;
  const v = c.value;
  const testo = new TextDecoder().decode(v).trim();
  out(`${shortUuid(c.uuid)}  hex[${hex(v)}]  dec[${dec(v)}]  txt[${ascii(v)}]`);
  handleCode(testo);
};

async function connect() {
  const { ok, ko } = parseUuids($(root, '#uuids').value);
  store.set(KEY, $(root, '#uuids').value);
  if (ko.length) out(`UUID ignorati perché non validi: ${ko.join(', ')}`);
  try {
    device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [...STANDARD, ...ok] });
  } catch (e) {
    out(e.name === 'NotFoundError' ? 'Nessun dispositivo scelto.' : `Errore: ${e.name}: ${e.message}`);
    return;
  }
  out(`Dispositivo: ${device.name || '(senza nome)'}`);
  device.addEventListener('gattserverdisconnected', () => {
    out('Tavola scollegata.');
    writeChar = null;
    $(root, '#send').disabled = true;
    $(root, '#disconnect').hidden = true;
    $(root, '#connect').hidden = false;
    awake?.release();
  });
  try {
    out('Mi collego…');
    const server = await device.gatt.connect();
    const services = await server.getPrimaryServices();
    out(`Servizi accessibili: ${services.length}`);
    let notifiche = 0;
    for (const s of services) {
      out(`SERVIZIO ${shortUuid(s.uuid)}`);
      let chars = [];
      try { chars = await s.getCharacteristics(); } catch (e) { out(`  caratteristiche non leggibili: ${e.message}`); }
      for (const c of chars) {
        const p = c.properties;
        const prop = ['read', 'write', 'writeWithoutResponse', 'notify', 'indicate'].filter((k) => p[k]).join(', ');
        out(`  caratteristica ${shortUuid(c.uuid)} (${prop || 'nessuna proprieta'})${c.uuid === NOTIFY ? '  <- notifiche' : c.uuid === WRITE ? '  <- scrittura' : ''}`);
        if (c.uuid === WRITE) { writeChar = c; $(root, '#send').disabled = false; }
        if (p.read && c.uuid !== NOTIFY) {
          try { const v = await c.readValue(); out(`    lettura: hex[${hex(v)}] txt[${ascii(v)}]`); } catch (e) { out(`    lettura fallita: ${e.message}`); }
        }
        if (p.notify || p.indicate) {
          try {
            c.addEventListener('characteristicvaluechanged', onValue);
            await c.startNotifications();
            notifiche++;
            out('    ascolto attivo: tira una freccia');
          } catch (e) { out(`    ascolto fallito: ${e.message}`); }
        }
      }
    }
    if (!notifiche) out('Nessuna caratteristica che invia notifiche: mandami questo registro.');
    $(root, '#disconnect').hidden = false;
    $(root, '#connect').hidden = true;
    awake = keepAwake();
  } catch (e) {
    out(`Collegamento fallito: ${e.name}: ${e.message}`);
  }
}

$(root, '#connect').addEventListener('click', connect);
$(root, '#disconnect').addEventListener('click', () => device?.gatt?.disconnect());
$(root, '#send').addEventListener('click', async () => {
  const bytes = parseHexBytes($(root, '#hexin').value);
  if (!bytes) { out('Byte non validi: usa coppie di cifre esadecimali, per esempio 01 ff.'); return; }
  try {
    if (writeChar.properties.writeWithoutResponse) await writeChar.writeValueWithoutResponse(bytes);
    else await writeChar.writeValue(bytes);
    out(`>>> INVIATO hex[${hex(new DataView(bytes.buffer))}]`);
  } catch (e) { out(`Invio fallito: ${e.name}: ${e.message}`); }
});
root.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-prova]');
  if (!b) return;
  if (!writeChar) { out('Prima collega la tavola.'); return; }
  const bytes = parseHexBytes(b.dataset.prova);
  try {
    if (writeChar.properties.writeWithoutResponse) await writeChar.writeValueWithoutResponse(bytes);
    else await writeChar.writeValue(bytes);
    out(`>>> PROVA ${b.textContent}: hex[${hex(new DataView(bytes.buffer))}]`);
  } catch (err) { out(`Invio fallito: ${err.name}: ${err.message}`); }
});
$(root, '#nota').addEventListener('keydown', (e) => { if (e.key === 'Enter') $(root, '#addnota').click(); });
$(root, '#addnota').addEventListener('click', () => {
  const n = $(root, '#nota');
  if (n.value.trim()) { out(`>>> NOTA: ${n.value.trim()}`); n.value = ''; }
});
$(root, '#clear').addEventListener('click', () => { lines.length = 0; logEl.textContent = ''; });
$(root, '#copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(lines.join('\n')); out('Registro copiato negli appunti.'); }
  catch {
    const r = document.createRange();
    r.selectNodeContents(logEl);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    out('Selezionato: usa Copia dal menu del telefono.');
  }
});

// Aiuto per provare la pagina senza la tavola: apri granboard.html?simula e usa window.__codice('3.4@') dalla console.
if (new URLSearchParams(location.search).has('simula')) window.__codice = handleCode;

drawCal();
