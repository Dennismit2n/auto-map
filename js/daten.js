// Lädt und prüft Karte, Orte, 100-%-Liste und Missionen. Prüfen ist rein (ohne fetch) und darum testbar.

const ID = /^[a-z0-9-]{2,120}$/;

// Kategorien der Community-Orte von gtadb.org (CC BY 4.0); die Zuordnung macht tools/karte/gtadb-bauen.mjs
export const GTADB_KATEGORIEN = [
  { id: 'g-parkhaus', name_de: 'Parkhäuser (öffentlich)', name_en: 'Parking garages (public)', zeichen: 'P', spoiler: false, gtadb: true },
  { id: 'g-laden', name_de: 'Läden und Dienste', name_en: 'Shops and services', zeichen: 'L', spoiler: false, gtadb: true },
  { id: 'g-verkehr', name_de: 'Verkehr', name_en: 'Transport', zeichen: 'V', spoiler: false, gtadb: true },
  { id: 'g-freizeit', name_de: 'Freizeit und Wahrzeichen', name_en: 'Leisure and landmarks', zeichen: 'F', spoiler: false, gtadb: true },
  { id: 'g-gebaeude', name_de: 'Gebäude', name_en: 'Buildings', zeichen: 'B', spoiler: false, gtadb: true },
  { id: 'm-schauplatz', name_de: 'Schauplätze (Trailer, Vorbilder)', name_en: 'Scenes (trailers, real-world models)', zeichen: 'S', spoiler: false, gtadb: true }
];

// Orte mit Versteck-Wert auf der Flucht: welche Art eines Ortes welchem Flucht-Eintrag (data/nachschlagen.json, Feld versteck)
// entspricht. Gassen, Büsche oder der Kofferraum sind keine Kartenorte und stehen nur im Text.
const VERSTECK_ARTEN = { parkhaus: 'parkhaus', 'pay\'n\'spray': 'pay-n-spray', clothes: 'kleiderladen', hair: 'friseur' };
export function versteckVon(ort) {
  if (ort.kat === 'safehouse') return 'unterschlupf';
  for (const a of [...(ort.art ?? []), ...(ort.arten ?? [])]) if (VERSTECK_ARTEN[a]) return VERSTECK_ARTEN[a];
  // was gtadb ohne Art führt, am Namen: Friseure, überdachte Parkplätze, Ammu-Nation
  const name = ort.name ?? '';
  if (/\bbarber\b|hair salon/i.test(name)) return 'friseur';
  if (/covered parking/i.test(name)) return 'parkhaus';
  return /ammu-nation/i.test(name) ? 'ammu-nation' : null;
}

export function pruefeDaten({ karte, orte, checkliste, missionen, gtadb, mapheist, strassen, radio, nachschlagen }) {
  const fehler = [];
  const kapitelOk = (k) => k == null || (Number.isInteger(k) && k >= 1 && k <= 5);
  const ids = new Set();
  const neu = (id, was) => {
    if (!ID.test(id)) fehler.push(`${was}: ID ungültig (${id})`);
    if (ids.has(id)) fehler.push(`${was}: ID doppelt (${id})`);
    ids.add(id);
  };
  const countys = new Set(karte.countys.map((c) => c.id));
  for (const c of karte.countys) if (!/^--vc-ort-/.test(c.farbe)) fehler.push(`County ${c.id}: Farbe muss ein --vc-ort-Token sein`);
  for (const l of karte.labels) {
    if (!(l.x >= 0 && l.x <= karte.breite && l.y >= 0 && l.y <= karte.hoehe)) fehler.push(`Ortsname ${l.text}: liegt außerhalb der Karte`);
    if (l.county && !countys.has(l.county)) fehler.push(`Ortsname ${l.text}: unbekanntes County ${l.county}`);
  }
  const kats = new Set(orte.kategorien.map((k) => k.id));
  for (const o of orte.orte) {
    neu(o.id, 'Ort');
    if (!kats.has(o.kat)) fehler.push(`Ort ${o.id}: unbekannte Kategorie ${o.kat}`);
    if (!countys.has(o.county)) fehler.push(`Ort ${o.id}: unbekanntes County ${o.county}`);
    if (!Number.isFinite(o.x) || !Number.isFinite(o.y)) fehler.push(`Ort ${o.id}: Lage fehlt (Anker ${o.anker})`);
    else if (!(o.x >= 0 && o.x <= karte.breite && o.y >= 0 && o.y <= karte.hoehe)) fehler.push(`Ort ${o.id}: liegt außerhalb der Karte`);
    if (!o.name || !o.text_de || !o.text_en) fehler.push(`Ort ${o.id}: Name oder Text fehlt`);
    if (!kapitelOk(o.ab_kapitel)) fehler.push(`Ort ${o.id}: ab_kapitel ungültig`);
    if (Boolean(o.geheim_de) !== Boolean(o.geheim_en)) fehler.push(`Ort ${o.id}: Geheimnis-Satz nur in einer Sprache`);
  }
  const gKats = new Set(GTADB_KATEGORIEN.map((k) => k.id));
  for (const o of [...(gtadb?.orte ?? []), ...(mapheist?.orte ?? [])]) {
    neu(o.id, 'Community');
    if (!/^[gm]-/.test(o.id)) fehler.push(`Community ${o.id}: ID muss mit g- oder m- beginnen`);
    if (!gKats.has(o.kat)) fehler.push(`gtadb ${o.id}: unbekannte Kategorie ${o.kat}`);
    if (!(o.x >= 0 && o.x <= karte.breite && o.y >= 0 && o.y <= karte.hoehe)) fehler.push(`gtadb ${o.id}: liegt außerhalb der Karte`);
    if (!o.name) fehler.push(`gtadb ${o.id}: Name fehlt`);
  }
  for (const s of strassen?.strassen ?? []) {
    neu(s.id, 'Straße');
    if (s.x != null && !(s.x >= 0 && s.x <= karte.breite && s.y >= 0 && s.y <= karte.hoehe)) fehler.push(`Straße ${s.id}: liegt außerhalb der Karte`);
    if (!s.ungefaehr && !Number.isFinite(s.winkel)) fehler.push(`Straße ${s.id}: Richtung fehlt`);
  }
  for (const g of checkliste.gruppen) {
    for (const z of g.zeilen) {
      neu(z.id, 'Zeile');
      if (!['zaehler', 'haken', 'geld'].includes(z.art)) fehler.push(`Zeile ${z.id}: unbekannte Art ${z.art}`);
      if (!(z.noetig > 0)) fehler.push(`Zeile ${z.id}: noetig fehlt`);
      if (z.vorhanden != null && z.vorhanden < z.noetig) fehler.push(`Zeile ${z.id}: vorhanden kleiner als noetig`);
      for (const h of z.hinweise ?? []) if (!kapitelOk(h.ab) || !h.de || !h.en) fehler.push(`Zeile ${z.id}: Hinweis ohne Text oder mit ungültigem Kapitel`);
      for (const u of z.unterliste ?? []) if (!u.name || !kapitelOk(u.ab)) fehler.push(`Zeile ${z.id}: Eintrag der Unterliste ohne Namen oder mit ungültigem Kapitel`);
    }
  }
  for (const s of radio?.sender ?? []) {
    neu(s.id, 'Sender');
    if (!s.name || !Array.isArray(s.titel) || s.titel.some((t) => !t[0] || !t[1])) fehler.push(`Sender ${s.id}: Name oder Titel fehlt`);
  }
  for (const k of missionen.kapitel) {
    for (const m of k.missionen) {
      neu(m.id, 'Mission');
      if (!m.id.startsWith(`${k.id}-`)) fehler.push(`Mission ${m.id}: passt nicht zum Kapitel ${k.id}`);
    }
  }
  if (nachschlagen) {
    const bereiche = new Set(nachschlagen.bereiche.map((b) => b.id));
    const gruppen = new Map(nachschlagen.gruppen.map((g) => [g.id, g]));
    const zeilen = new Set(checkliste.gruppen.flatMap((g) => g.zeilen.map((z) => z.id)));
    for (const b of nachschlagen.bereiche) if (!b.name_de || !b.name_en || !b.text_de || !b.text_en) fehler.push(`Bereich ${b.id}: Name oder Text fehlt`);
    for (const g of nachschlagen.gruppen) {
      neu(g.id, 'Gruppe');
      if (!bereiche.has(g.bereich) || !g.name_de || !g.name_en) fehler.push(`Gruppe ${g.id}: Bereich unbekannt oder Name fehlt`);
      if (g.zeile && !zeilen.has(g.zeile)) fehler.push(`Gruppe ${g.id}: unbekannte Zeile ${g.zeile}`);
    }
    for (const e of nachschlagen.eintraege) {
      neu(e.id, 'Eintrag');
      if (!bereiche.has(e.bereich)) fehler.push(`Eintrag ${e.id}: unbekannter Bereich ${e.bereich}`);
      if (e.gruppe != null && gruppen.get(e.gruppe)?.bereich !== e.bereich) fehler.push(`Eintrag ${e.id}: Gruppe ${e.gruppe} fehlt oder gehört zu einem anderen Bereich`);
      if (!e.name || !e.text_de || !e.text_en) fehler.push(`Eintrag ${e.id}: Name oder Text fehlt`);
      if (Boolean(e.zusatz_de) !== Boolean(e.zusatz_en) || Boolean(e.spoiler_de) !== Boolean(e.spoiler_en)) fehler.push(`Eintrag ${e.id}: Zusatz oder Spoiler nur in einer Sprache`);
      if (!kapitelOk(e.ab_kapitel)) fehler.push(`Eintrag ${e.id}: ab_kapitel ungültig`);
      if (e.zeile && !zeilen.has(e.zeile)) fehler.push(`Eintrag ${e.id}: unbekannte Zeile ${e.zeile}`);
    }
  }
  return fehler;
}

// Community-Orte (gtadb, Mapheist), die es schon als festen Ort gibt (gleicher Name oder im festen Ort als derselbe vermerkt), nicht doppelt zeigen.
// So verrät auch kein Community-Punkt einen festen Ort, den Spoilerfrei gerade verbirgt.
// Mapheist führt zwei feste Orte unter anderem Namen und an der Stelle des Vorbilds: One-Eyed Willie’s (Auto Shop) und das
// Gefängnis bei Hamlet unter seinem alten Namen
const ZWILLINGE = { 'm-venue-one-eyed-willies': 'ort-one-eyed-willies-auto-shop', 'm-place-broward-jail': 'ort-bundesgefaengnis-key-lento' };
export function ohneDoppelte(gtadbOrte, festeOrte) {
  const fest = new Set(festeOrte.map((o) => o.id));
  const gleich = (s) => String(s ?? '').toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '');
  const namen = new Set(festeOrte.flatMap((o) => [gleich(o.name), gleich(o.name_en)]).filter(Boolean));
  const ids = new Set(festeOrte.filter((o) => o.gtadb_selbst).map((o) => o.gtadb));
  return gtadbOrte.filter((o) => !ids.has(o.id) && !fest.has(ZWILLINGE[o.id]) && !(namen.has(gleich(o.name)) && !o.namenlos));
}

export async function ladeDaten(basis = './data/') {
  const holen = async (pfad) => {
    const antwort = await fetch(basis + pfad);
    if (!antwort.ok) throw new Error(`${pfad}: ${antwort.status}`);
    return antwort.json();
  };
  const [karte, orte, checkliste, missionen, gtadb, mapheist, strassen, radio, nachschlagen] = await Promise.all([holen('karte.json'), holen('orte.json'), holen('checkliste.json'), holen('missionen.json'), holen('gtadb.json'), holen('mapheist.json'), holen('strassen.json'), holen('radio.json'), holen('nachschlagen.json')]);
  orte.kategorien = [...orte.kategorien.filter((k) => k.id !== 'eigen'), ...GTADB_KATEGORIEN, ...orte.kategorien.filter((k) => k.id === 'eigen')];
  const daten = { karte, orte, checkliste, missionen, gtadb, mapheist, strassen, radio, nachschlagen, community: [...ohneDoppelte(gtadb.orte, orte.orte).map((o) => ({ ...o, quelle: 'gtadb' })), ...ohneDoppelte(mapheist.orte, orte.orte)] };
  const fehler = pruefeDaten(daten);
  if (fehler.length) console.warn('Datenfehler:', fehler);
  return daten;
}
