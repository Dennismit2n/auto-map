// Gee Tee Auto-MAP+ (die Speicher heißen weiter mappp-…, damit alte Stände erkannt und gelöscht werden).
// Service Worker: online immer die neueste Fassung vom Server holen, offline aus dem Speicher.
// (Bis 20.11.2026 lieferte er zuerst aus dem Speicher; dadurch sah man nach Änderungen die alte Karte.)
// STAND bei jeder Änderung an der Liste hochzählen. Kartenkacheln (assets/karte/kacheln) landen beim Ansehen im Speicher.
const STAND = 'mappp-2026-11-28a';
// Kartenkacheln liegen in einem eigenen Speicher, der neue App-Fassungen überlebt. Nur hochzählen, wenn die Kacheln neu gebaut wurden.
const KACHELN = 'kacheln-2026-11-27b';
const GERUEST = [
  './', 'index.html', 'manifest.webmanifest',
  'css/app.css', 'css/beschlag.css', 'css/sehhilfen.css', 'tokens/tokens.css',
  'js/app.js', 'js/arten.js', 'js/daten.js', 'js/fortschritt.js', 'js/geo.js', 'js/i18n.js', 'js/karte.js', 'js/provider.js', 'js/sehhilfe.js', 'js/speicher.js', 'js/suche.js', 'js/suchworte.js', 'js/fahrzeuge.js',
  'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css',
  'assets/fonts/fraunces-latin-wght-normal.woff2', 'assets/fonts/fraunces-latin-ext-wght-normal.woff2',
  'assets/icons/icon.svg', 'assets/icons/icon-192.png',
  'data/karte.json', 'data/orte.json', 'data/checkliste.json', 'data/missionen.json', 'data/gtadb.json', 'data/mapheist.json', 'data/strassen.json', 'data/radio.json', 'data/nachschlagen.json', 'data/fahrzeuge.json', 'data/cheats.json'
];

self.addEventListener('install', (e) => {
  // cache: 'reload' holt am HTTP-Zwischenspeicher vorbei, sonst geraten nach einem Deploy alte Dateien in den neuen Stand
  e.waitUntil(caches.open(STAND).then((c) => c.addAll(GERUEST.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  // Nur die eigenen alten Speicher löschen: unter dennismit2n.github.io liegen auch die Speicher der anderen Werkzeuge
  // (Pocketsum, Kugelblitz ...). Bis 27.11.2026 löschte diese Zeile alle fremden mit.
  const eigen = (n) => n.startsWith('mappp-') || n.startsWith('kacheln-');
  e.waitUntil(caches.keys().then((alle) => Promise.all(alle.filter((n) => eigen(n) && n !== STAND && n !== KACHELN).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});

// Netz zuerst (mit kurzer Frist), Antwort im Speicher ablegen; ohne Netz der gespeicherte Stand
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const kachel = url.pathname.includes('/assets/karte/kacheln/');
  e.respondWith((async () => {
    const c = await caches.open(kachel ? KACHELN : STAND);
    const netz = fetch(e.request, { cache: 'no-cache' }).then((antwort) => { if (antwort.ok) c.put(e.request, antwort.clone()).catch(() => {}); return antwort; });   // voller Speicher: Kachel fehlt dann nur offline
    netz.catch(() => {});
    try {
      const frist = new Promise((_, nein) => setTimeout(() => nein(new Error('Frist')), kachel ? 1000 : 4000));
      return await Promise.race([netz, frist]);
    } catch {
      // Frist um oder kein Netz: gespeicherter Stand; gibt es keinen, doch noch auf das Netz warten
      const alt = (await c.match(e.request, { ignoreSearch: true })) || (await caches.match(e.request, { ignoreSearch: true }));
      return alt || netz.catch(() => Response.error());
    }
  })());
});
