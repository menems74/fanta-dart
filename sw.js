// Service worker: l'app si apre anche offline. I dati li gestisce la cache offline di Firestore.
const CACHE = 'fanta-dart-v2';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/auth.js', 'js/db.js', 'js/firebase.js', 'js/season.js', 'js/stats.js', 'js/ui.js', 'js/util.js',
  'js/views/login.js', 'js/views/partite.js', 'js/views/partita.js', 'js/views/partitaForm.js',
  'js/views/pagellino.js', 'js/views/pagellinoForm.js', 'js/views/classifica.js', 'js/views/profilo.js',
  'js/views/gestione.js', 'js/views/stagione.js', 'js/views/giocatore.js',
  'assets/logo-320.png', 'assets/icon-192.png', 'assets/favicon-64.png',
];
// Librerie statiche su CDN: cache-first (sono versionate nell'URL).
const CDN = ['www.gstatic.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

// 'no-cache' obbliga a ricontrollare il server: GitHub Pages altrimenti fa tenere i file in memoria per 10 minuti.
async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    return (await cache.match(req)) || (await cache.match('index.html')) || Promise.reject(err);
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) e.respondWith(networkFirst(req));
  else if (CDN.includes(url.hostname)) e.respondWith(cacheFirst(req));
});
