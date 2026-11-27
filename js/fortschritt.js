// Reine Logik ohne DOM: Durchgänge, Abhaken, Zähler der 100-%-Liste, Spoiler-Regeln, Export und Import.
// Jeder Eintrag trägt seinen Zeitstempel. So lassen sich zwei Stände Punkt für Punkt
// zusammenführen: der jüngere Eintrag gewinnt (last write wins).

export const EXPORT_FORMAT = 'vice-companion-fortschritt';
export const EXPORT_VERSION = 2;

export function neuesProfil(name, zeit = Date.now(), id = `p-${zeit.toString(36)}-${Math.random().toString(36).slice(2, 7)}`) {
  return { id, name: String(name || 'Durchgang').slice(0, 40), erstellt: zeit, kapitel: 1, punkte: {}, zaehler: {} };
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

// ---- Kapitel und Spoiler ----
// Durchgänge von vor dem 26.11.2026 haben kein Kapitel. Bis dahin verbarg Spoilerfrei fest Kapitel 4 und 5, das bleibt für sie so.
export const KAPITEL_ALT = 3;

// Kapitel, in dem der Durchgang steht: die eigene Angabe, angehoben durch abgehakte Missionen späterer Kapitel.
// Das Anheben wird nicht gespeichert: Nimmst du einen versehentlichen Haken zurück, gilt wieder deine Angabe.
export function kapitelStand(profil, missionen) {
  let stand = Number.isInteger(profil?.kapitel) ? profil.kapitel : KAPITEL_ALT;
  for (const kap of missionen?.kapitel ?? []) if (kap.nr > stand && kap.missionen.some((m) => istGefunden(profil, m.id))) stand = kap.nr;
  return Math.max(1, Math.min(5, stand));
}

// Spoilerfrei verbirgt: Kategorien mit spoiler (Geheimnisse), alles, was erst nach dem eigenen Kapitel kommt (ab_kapitel),
// und Einträge mit spoiler ohne Kapitelangabe.
export function istVerborgen(eintrag, kategorie, spoilerfrei, stand = KAPITEL_ALT) {
  if (!spoilerfrei) return false;
  if (kategorie?.spoiler) return true;
  if (eintrag?.ab_kapitel != null) return eintrag.ab_kapitel > stand;
  return Boolean(eintrag?.spoiler);
}

// Die Hinweise einer Zeile der 100-%-Liste sind nach Kapitel gestaffelt (hinweise: [{ab, de, en}]), ebenso einzelne Einträge
// ihrer Unterliste (ab). Spoilerfrei zeigt nur, was bis zum eigenen Kapitel passt; spaeter nennt das Kapitel, ab dem mehr kommt.
export function sichtbareHinweise(zeile, spoilerfrei, stand = KAPITEL_ALT) {
  const alle = zeile.hinweise ?? []; const liste = zeile.unterliste ?? [];
  if (!spoilerfrei) return { teile: alle, unterliste: liste, spaeter: null };
  const rest = [...alle, ...liste].map((h) => h.ab ?? 1).filter((ab) => ab > stand);
  return { teile: alle.filter((h) => (h.ab ?? 1) <= stand), unterliste: liste.filter((u) => (u.ab ?? 1) <= stand), spaeter: rest.length ? Math.min(...rest) : null };
}

// Anzeigename einer Mission. In Kapiteln nach dem eigenen gibt es spoilerfrei nur die Nummer.
export function missionsName(mission, kapitel, spoilerfrei, texte, stand = KAPITEL_ALT) {
  const nr = mission.id.split('-')[1];
  if (spoilerfrei && kapitel.nr > stand) return `${texte.mission} ${kapitel.nr}.${nr}`;
  return mission.name ?? `${texte.mission} ${kapitel.nr}.${nr} (${texte.geschwaerzt})`;
}

// ---- Filter, Zählen, nächstes Ziel für Pins ----
export function passtZumFilter(pin, filter) {
  if (!filter) return true;
  if (filter.countys?.size && !filter.countys.has(pin.county)) return false;
  if (filter.kategorien?.size && !filter.kategorien.has(pin.kat)) return false;
  if (filter.versteck && !pin.versteck) return false;
  return true;
}

// ---- Nachschlagen (Ausrüstung, Sammlung, Aktivitäten, Herausforderungen, Flucht) ----
// Einträge eines Bereichs, die der Durchgang sehen darf, und wie viele Spoilerfrei noch verbirgt (mit dem Kapitel, ab dem mehr kommt).
export function nachschlagenSicht(nachschlagen, bereichId, spoilerfrei, stand = KAPITEL_ALT) {
  const alle = nachschlagen.eintraege.filter((e) => e.bereich === bereichId);
  const sichtbar = alle.filter((e) => !istVerborgen(e, null, spoilerfrei, stand));
  const rest = alle.filter((e) => istVerborgen(e, null, spoilerfrei, stand)).map((e) => e.ab_kapitel).filter(Number.isInteger);
  return { sichtbar, verborgen: alle.length - sichtbar.length, spaeter: rest.length ? Math.min(...rest) : null };
}

// Zähler eines Bereichs: abhakbar ist alles außer Einträgen und Gruppen mit abhaken: false. Verborgene zählen mit, damit die Summe stimmt.
export function nachschlagenStand(nachschlagen, bereichId, profil) {
  const bereich = nachschlagen.bereiche.find((b) => b.id === bereichId);
  if (!bereich || bereich.abhaken === false) return { gesamt: 0, fertig: 0 };
  const ohne = new Set(nachschlagen.gruppen.filter((g) => g.abhaken === false).map((g) => g.id));
  const zaehlbar = nachschlagen.eintraege.filter((e) => e.bereich === bereichId && e.abhaken !== false && !ohne.has(e.gruppe));
  return { gesamt: zaehlbar.length, fertig: zaehlbar.filter((e) => istGefunden(profil, e.id)).length };
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
  const kapitel = Number.isInteger(p.kapitel) && p.kapitel >= 1 && p.kapitel <= 5 ? { kapitel: p.kapitel } : {};
  return { id: p.id, name: p.name.slice(0, 40), erstellt: Number(p.erstellt) || 0, ...kapitel, punkte, zaehler };
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

// Führt zwei Stände desselben Profils zusammen, je Eintrag gewinnt der jüngere; beim Kapitel das höhere.
export function zusammenfuehren(alt, neu) {
  // Fehlt das Kapitel auf einer Seite (alte Sicherung), sagt sie dazu nichts: Die eigene Angabe bleibt.
  const angaben = [alt.kapitel, neu.kapitel].filter(Number.isInteger);
  const kapitel = angaben.length ? { kapitel: Math.max(...angaben) } : {};
  return { ...alt, name: neu.name || alt.name, ...kapitel, punkte: juenger(alt.punkte, neu.punkte), zaehler: juenger(alt.zaehler || {}, neu.zaehler || {}) };
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

// Was ein Zusammenführen ändern würde: Pins, die neu oder jünger sind als der eigene Stand
export function pinsNeuheiten(vorhandene, eingelesene) {
  const nachId = new Map(vorhandene.map((p) => [p.id, p]));
  return eingelesene.filter((p) => { const alt = nachId.get(p.id); return alt ? (p.zeit ?? 0) > (alt.zeit ?? 0) : !p.geloescht; });
}

// ---- Pins teilen per Link ----
// Die eigenen Pins (samt Löschvermerken) als kurzer Text für den Anker eines Links: JSON, gepackt (deflate), base64url.
// Kein Server sieht den Anker; wer den Link hat, hat die Pins.
const PINS_KENNUNG = 'mp1';
export const PINS_HOECHSTENS = 500;
const ENTPACKT_HOECHSTENS = 2_000_000;   // Bytes; ein echter Link mit 500 Pins bleibt weit darunter
// Schickt Bytes durch einen (De-)Kompressionsstrom und bricht ab, wenn mehr als hoechstens herauskommt (präparierte Links)
async function durchStrom(bytes, strom, hoechstens = Infinity) {
  const leser = new Blob([bytes]).stream().pipeThrough(strom).getReader();
  const teile = []; let n = 0;
  for (;;) {
    const { done, value } = await leser.read();
    if (done) break;
    n += value.length;
    if (n > hoechstens) { await leser.cancel(); throw new Error('zu groß'); }
    teile.push(value);
  }
  const aus = new Uint8Array(n); let ab = 0;
  for (const teil of teile) { aus.set(teil, ab); ab += teil.length; }
  return aus;
}

export async function pinsVerpacken(pins) {
  // Erst die sichtbaren Pins, dann die Löschvermerke: Reicht der Platz nicht, fallen Vermerke weg, keine Pins.
  // Von einem gelöschten Pin reist nur der Vermerk (ID und Zeit) mit, nicht Name, Notiz oder Lage.
  const zeilen = [...pins.filter((p) => !p.geloescht), ...pins.filter((p) => p.geloescht)].slice(0, PINS_HOECHSTENS)
    .map((p) => (p.geloescht ? [p.id, '', '', '', 0, 0, null, p.erstellt, p.zeit, 1] : [p.id, p.art, p.name, p.notiz, p.x, p.y, p.county, p.erstellt, p.zeit, 0]));
  const gepackt = await durchStrom(new TextEncoder().encode(JSON.stringify(zeilen)), new CompressionStream('deflate-raw'));
  let s = ''; for (const b of gepackt) s += String.fromCharCode(b);
  return `${PINS_KENNUNG}.${btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

export async function pinsAuspacken(text) {
  const m = /^mp1\.([A-Za-z0-9_-]{1,400000})$/.exec(String(text ?? '').trim());
  if (!m) throw new Error('Kein gültiger Pin-Link');
  let zeilen;
  try {
    const roh = atob(m[1].replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(roh, (c) => c.charCodeAt(0));
    zeilen = JSON.parse(new TextDecoder().decode(await durchStrom(bytes, new DecompressionStream('deflate-raw'), ENTPACKT_HOECHSTENS)));
  } catch { throw new Error('Pin-Link ist beschädigt'); }
  if (!Array.isArray(zeilen) || zeilen.length > PINS_HOECHSTENS) throw new Error('Pin-Link ist beschädigt');
  return zeilen.map((z) => (Array.isArray(z)
    ? pruefePin({ id: z[0], art: z[1], name: z[2], notiz: z[3], x: z[4], y: z[5], county: z[6], erstellt: z[7], zeit: z[8], geloescht: z[9] === 1 })
    : null)).filter(Boolean);
}
