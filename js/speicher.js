// Fortschritt in IndexedDB statt localStorage: mehr Platz, und installierte Web-Apps
// behalten ihn auch unter Safari. Ablagen: profile (je Durchgang), pins (eigene Pins), einstellungen.
const NAME = 'vice-companion';
const VERSION = 2;

function oeffnen() {
  return new Promise((ok, fehler) => {
    const anfrage = indexedDB.open(NAME, VERSION);
    anfrage.onupgradeneeded = () => {
      const db = anfrage.result;
      if (!db.objectStoreNames.contains('profile')) db.createObjectStore('profile', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('pins')) db.createObjectStore('pins', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('einstellungen')) db.createObjectStore('einstellungen');
    };
    anfrage.onsuccess = () => ok(anfrage.result);
    anfrage.onerror = () => fehler(anfrage.error);
  });
}

let dbVersprechen;
const db = () => (dbVersprechen ??= oeffnen());

async function vorgang(ablage, modus, arbeit) {
  const d = await db();
  return new Promise((ok, fehler) => {
    const t = d.transaction(ablage, modus);
    const ergebnis = arbeit(t.objectStore(ablage));
    // Lesende Vorgänge liefern eine IDBRequest, deren result auch undefined sein darf
    t.oncomplete = () => ok(ergebnis instanceof IDBRequest ? ergebnis.result : ergebnis);
    t.onerror = () => fehler(t.error);
    t.onabort = () => fehler(t.error);
  });
}

export const alleProfile = () => vorgang('profile', 'readonly', (s) => s.getAll());
export const profilSpeichern = (p) => vorgang('profile', 'readwrite', (s) => { s.put(p); });
export const profilLoeschen = (id) => vorgang('profile', 'readwrite', (s) => { s.delete(id); });
export const allePins = () => vorgang('pins', 'readonly', (s) => s.getAll());
export const pinSpeichern = (p) => vorgang('pins', 'readwrite', (s) => { s.put(p); });
export const einstellungLesen = (schluessel) => vorgang('einstellungen', 'readonly', (s) => s.get(schluessel));
export const einstellungSchreiben = (schluessel, wert) => vorgang('einstellungen', 'readwrite', (s) => { s.put(wert, schluessel); });

// Bittet den Browser, die Daten nicht bei Platzmangel zu räumen. Antwort ist nur ein Hinweis.
export async function dauerhaftAnfragen() {
  try { return navigator.storage?.persist ? await navigator.storage.persist() : false; } catch { return false; }
}
