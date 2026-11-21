// Reine Logik ohne DOM: Durchgänge, Abhaken, Zähler der 100-%-Liste, Spoiler-Regeln, Export und Import.
// Jeder Eintrag trägt seinen Zeitstempel. So lassen sich zwei Stände Punkt für Punkt
// zusammenführen: der jüngere Eintrag gewinnt (last write wins).

export const EXPORT_FORMAT = 'vice-companion-fortschritt';
export const EXPORT_VERSION = 2;

export function neuesProfil(name, zeit = Date.now(), id = `p-${zeit.toString(36)}-${Math.random().toString(36).slice(2, 7)}`) {
  return { id, name: String(name || 'Durchgang').slice(0, 40), erstellt: zeit, punkte: {}, zaehler: {} };
}

// ---- Abhaken (Orte, eigene Pins, Missionen, Haken-Zeilen) ----
export function istGefunden(profil, id) { return Boolean(profil?.punkte?.[id]?.an); }

export function umschalten(profil, id, zeit = Date.now()) {
  return { ...profil, punkte: { ...profil.punkte, [id]: { an: !istGefunden(profil, id), zeit } } };
}

// ---- Zähler der 100-%-Liste ----
export function zaehlerWert(profil, id) { return profil?.zaehler?.[id]?.wert ?? 0; }

export function setzeZaehler(profil, id, wert, zeit = Date.now(), max = Infinity) {
  const w = Math.max(0, Math.min(max, Math.round(Number(wert) || 0)));
  return { ...profil, zaehler: { ...(profil.zaehler || {}), [id]: { wert: w, zeit } } };
}

export function zeileStand(zeile, profil) {
  if (zeile.art === 'haken') { const an = istGefunden(profil, zeile.id); return { wert: an ? 1 : 0, noetig: 1, erfuellt: an }; }
  const wert = zaehlerWert(profil, zeile.id);
  return { wert, noetig: zeile.noetig, erfuellt: wert >= zeile.noetig };
}

export function checklisteStand(checkliste, profil) {
  let gesamt = 0; let erfuellt = 0; let anteil = 0;
  for (const g of checkliste.gruppen) {
    for (const z of g.zeilen) {
      const s = zeileStand(z, profil); gesamt++;
      if (s.erfuellt) erfuellt++;
      anteil += Math.min(1, s.wert / s.noetig);
    }
  }
  return { gesamt, erfuellt, prozent: gesamt ? Math.floor((100 * anteil) / gesamt) : 0 };
}

// ---- Spoiler ----
// Spoilerfrei verbirgt: Kategorien mit spoiler (Geheimnisse) und einzelne Einträge mit spoiler (spätes Spiel).
export function istVerborgen(eintrag, kategorie, spoilerfrei) {
  if (!spoilerfrei) return false;
  return Boolean(eintrag?.spoiler || kategorie?.spoiler);
}

// Anzeigename einer Mission. In spoilerfreien Kapiteln gibt es nur die Nummer.
export function missionsName(mission, kapitel, spoilerfrei, texte) {
  const nr = mission.id.split('-')[1];
  if (spoilerfrei && kapitel.spoiler) return `${texte.mission} ${kapitel.nr}.${nr}`;
  return mission.name ?? `${texte.mission} ${kapitel.nr}.${nr} (${texte.geschwaerzt})`;
}

// ---- Filter, Zählen, nächstes Ziel für Pins ----
export function passtZumFilter(pin, filter) {
  if (!filter) return true;
  if (filter.countys?.size && !filter.countys.has(pin.county)) return false;
  if (filter.kategorien?.size && !filter.kategorien.has(pin.kat)) return false;
  return true;
}

export function zaehlen(pins, profil, filter) {
  let gesamt = 0; let gefunden = 0;
  for (const p of pins) {
    if (!passtZumFilter(p, filter)) continue;
    gesamt++;
    if (istGefunden(profil, p.id)) gefunden++;
  }
  return { gesamt, gefunden, offen: gesamt - gefunden };
}

export function zaehlenJeCounty(pins, profil) {
  const je = {};
  for (const p of pins) {
    je[p.county] ??= { gesamt: 0, gefunden: 0 };
    je[p.county].gesamt++;
    if (istGefunden(profil, p.id)) je[p.county].gefunden++;
  }
  return je;
}

// Nächstes offenes Ziel zur Position {x, y}; ohne Position das erste offene in Listenreihenfolge.
export function naechstesOffenes(pins, profil, filter, position) {
  let bestes = null; let abstand = Infinity;
  for (const p of pins) {
    if (!passtZumFilter(p, filter) || istGefunden(profil, p.id)) continue;
    if (!position) return { pin: p, abstand: null };
    const d = Math.hypot(p.x - position.x, p.y - position.y);
    if (d < abstand) { abstand = d; bestes = p; }
  }
  return bestes ? { pin: bestes, abstand } : null;
}

// ---- Eigene Pins ----
export function neuerPin({ x, y, art, name, notiz, county }, zeit = Date.now(), id = `pin-${zeit.toString(36)}-${Math.random().toString(36).slice(2, 7)}`) {
  return {
    id, kat: 'eigen', art: String(art || 'sonstiges').slice(0, 40), name: String(name || '').trim().slice(0, 60),
    notiz: String(notiz || '').trim().slice(0, 240), x: Math.round(x), y: Math.round(y), county: county || null, erstellt: zeit, zeit
  };
}

// ---- Export, Import ----
export function exportieren(profile, pins = [], zeit = Date.now()) {
  return { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportiert: zeit, profile, pins };
}

const ID = /^[a-z0-9-]{1,120}$/;

function pruefeProfil(p) {
  if (!p || typeof p !== 'object') throw new Error('Profil fehlt');
  if (typeof p.id !== 'string' || !ID.test(p.id)) throw new Error('Profil ohne gültige ID');
  if (typeof p.name !== 'string') throw new Error(`Profil ${p.id} ohne Namen`);
  if (!p.punkte || typeof p.punkte !== 'object') throw new Error(`Profil ${p.id} ohne Punkte`);
  const punkte = {}; const zaehler = {};
  for (const [id, e] of Object.entries(p.punkte)) {
    if (!ID.test(id) || !e || typeof e.an !== 'boolean' || !Number.isFinite(e.zeit)) continue;
    punkte[id] = { an: e.an, zeit: e.zeit };
  }
  for (const [id, e] of Object.entries(p.zaehler || {})) {
    if (!ID.test(id) || !e || !Number.isFinite(e.wert) || !Number.isFinite(e.zeit) || e.wert < 0) continue;
    zaehler[id] = { wert: Math.round(e.wert), zeit: e.zeit };
  }
  return { id: p.id, name: p.name.slice(0, 40), erstellt: Number(p.erstellt) || 0, punkte, zaehler };
}

function pruefePin(p) {
  if (!p || typeof p.id !== 'string' || !ID.test(p.id)) return null;
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  const pin = neuerPin(p, Number(p.erstellt) || 0, p.id);
  pin.zeit = Number.isFinite(p.zeit) ? p.zeit : pin.erstellt;
  pin.county = typeof p.county === 'string' && ID.test(p.county) ? p.county : null;
  if (p.geloescht === true) pin.geloescht = true;
  return pin;
}

export function einlesen(text) {
  let daten;
  try { daten = typeof text === 'string' ? JSON.parse(text) : text; } catch { throw new Error('Keine gültige JSON-Datei'); }
  if (daten?.format !== EXPORT_FORMAT) throw new Error('Unbekanntes Dateiformat');
  if (!(daten.version <= EXPORT_VERSION)) throw new Error('Datei stammt aus einer neueren Version der App');
  if (!Array.isArray(daten.profile)) throw new Error('Keine Profile in der Datei');
  return {
    profile: daten.profile.map(pruefeProfil),
    pins: (Array.isArray(daten.pins) ? daten.pins : []).map(pruefePin).filter(Boolean)
  };
}

function juenger(alt, neu) {
  const out = { ...alt };
  for (const [id, e] of Object.entries(neu || {})) {
    if (!out[id] || e.zeit > out[id].zeit) out[id] = e;
  }
  return out;
}

// Führt zwei Stände desselben Profils zusammen, je Eintrag gewinnt der jüngere.
export function zusammenfuehren(alt, neu) {
  return { ...alt, name: neu.name || alt.name, punkte: juenger(alt.punkte, neu.punkte), zaehler: juenger(alt.zaehler || {}, neu.zaehler || {}) };
}

export function importieren(vorhandene, eingelesene) {
  const nachId = new Map(vorhandene.map((p) => [p.id, p]));
  for (const p of eingelesene) nachId.set(p.id, nachId.has(p.id) ? zusammenfuehren(nachId.get(p.id), p) : p);
  return [...nachId.values()];
}

// Eigene Pins zusammenführen: je Pin gewinnt der jüngere Stand (auch ein Löschvermerk).
export function pinsZusammenfuehren(vorhandene, eingelesene) {
  const nachId = new Map(vorhandene.map((p) => [p.id, p]));
  for (const p of eingelesene) {
    const alt = nachId.get(p.id);
    if (!alt || (p.zeit ?? 0) > (alt.zeit ?? 0)) nachId.set(p.id, p);
  }
  return [...nachId.values()];
}
