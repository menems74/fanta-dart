// Pagina di prova (non fa parte dell'app): si collega al Granboard con Web Bluetooth e mostra i messaggi grezzi
// che la tavola invia a ogni freccia, per capire se si puo' leggere il punteggio in automatico.
import { html, $ } from './util.js';
import { topbar } from './ui.js';
import { keepAwake } from './training/awake.js';
import { hex, dec, ascii, shortUuid, parseUuids } from './granboard-utils.js';

// Web Bluetooth legge solo i servizi di cui conosce l'UUID in anticipo: questi sono quelli standard piu' comuni.
const STANDARD = ['generic_access', 'generic_attribute', 'device_information', 'battery_service',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', 0xffe0, 0xfff0, 0xffd0];
const KEY = 'fd.granboard.uuids';

const read = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
const write = (v) => { try { localStorage.setItem(KEY, v); } catch { /* storage non disponibile */ } };

const root = document.getElementById('view');
const supported = 'bluetooth' in navigator;

root.innerHTML = html`
  ${topbar('Prova Granboard')}
  <section class="card sess-intro">
    <p>Pagina di prova: si collega alla tavola e mostra i messaggi che invia a ogni freccia.</p>
    <p class="muted small">1. Chiudi l'app GranDarts e spegni il Bluetooth di altri dispositivi collegati alla tavola.<br>
      2. Accendi il Granboard.<br>
      3. Incolla qui sotto gli UUID dei servizi (li trovi con l'app gratuita nRF Connect, vedi le istruzioni in chat).<br>
      4. Premi «Collega la tavola» e scegli il Granboard dall'elenco.<br>
      5. Tira una freccia, scrivi il settore colpito nel campo «Nota» e premi «Aggiungi».</p>
    ${supported ? '' : html`<p class="error">Questo browser non supporta Web Bluetooth: apri la pagina con Chrome su Android.</p>`}
  </section>

  <label class="field">UUID dei servizi (uno per riga)
    <textarea id="uuids" rows="3" placeholder="es. ffe0&#10;6e400001-b5a3-f393-e0a9-e50e24dcca9e">${read()}</textarea>
  </label>
  <div class="actions tight">
    <button type="button" class="btn primary" id="connect" ${supported ? '' : 'disabled'}>Collega la tavola</button>
    <button type="button" class="btn sec" id="disconnect" hidden>Scollega</button>
  </div>

  <h2 class="section">Registro</h2>
  <div class="two">
    <label class="field">Nota (settore tirato)<input id="nota" placeholder="es. T20" autocomplete="off"></label>
    <button type="button" class="btn sec" id="addnota" style="align-self:end">Aggiungi</button>
  </div>
  <pre id="log" class="glog" aria-live="polite">In attesa di collegamento.</pre>
  <div class="actions tight">
    <button type="button" class="btn primary" id="copy">Copia il registro</button>
    <button type="button" class="btn sec" id="clear">Svuota</button>
  </div>`.s;

const logEl = $(root, '#log');
const lines = [];
const t0 = Date.now();
const out = (txt) => {
  lines.push(`${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s  ${txt}`);
  logEl.textContent = lines.join('\n');
  logEl.scrollTop = logEl.scrollHeight;
};

let device = null;
let awake = null;

const onValue = (ev) => {
  const c = ev.target;
  const v = c.value;
  out(`${shortUuid(c.uuid)}  hex[${hex(v)}]  dec[${dec(v)}]  txt[${ascii(v)}]`);
};

async function connect() {
  const { ok, ko } = parseUuids($(root, '#uuids').value);
  write($(root, '#uuids').value);
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
        out(`  caratteristica ${shortUuid(c.uuid)} (${prop || 'nessuna proprieta'})`);
        if (p.read) {
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
    if (!services.some((s) => !/^0000(1800|1801|180a|180f)-/.test(s.uuid))) {
      out('Nessun servizio della tavola e\' accessibile: aggiungi gli UUID nel campo in alto e riprova.');
    } else if (!notifiche) {
      out('Nessuna caratteristica che invia notifiche: mandami questo registro.');
    }
    $(root, '#disconnect').hidden = false;
    $(root, '#connect').hidden = true;
    awake = keepAwake();
  } catch (e) {
    out(`Collegamento fallito: ${e.name}: ${e.message}`);
  }
}

$(root, '#connect').addEventListener('click', connect);
$(root, '#disconnect').addEventListener('click', () => device?.gatt?.disconnect());
$(root, '#addnota').addEventListener('click', () => {
  const n = $(root, '#nota');
  if (n.value.trim()) { out(`>>> NOTA: ${n.value.trim()}`); n.value = ''; }
});
$(root, '#clear').addEventListener('click', () => { lines.length = 0; logEl.textContent = ''; });
$(root, '#copy').addEventListener('click', async () => {
  const text = lines.join('\n');
  try { await navigator.clipboard.writeText(text); out('Registro copiato negli appunti.'); }
  catch {
    const r = document.createRange();
    r.selectNodeContents(logEl);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    out('Selezionato: usa Copia dal menu del telefono.');
  }
});
