// Lädt und prüft Karte, Orte, 100-%-Liste und Missionen. Prüfen ist rein (ohne fetch) und darum testbar.

const ID = /^[a-z0-9-]{2,120}$/;

// Kategorien der Community-Orte von gtadb.org (CC BY 4.0); die Zuordnung macht tools/karte/gtadb-bauen.mjs
export const GTADB_KATEGORIEN = [
  { id: 'g-laden', name_de: 'Läden und Dienste', name_en: 'Shops and services', zeichen: 'L', spoiler: false, gtadb: true },
  { id: 'g-verkehr', name_de: 'Verkehr', name_en: 'Transport', zeichen: 'V', spoiler: false, gtadb: true },
  { id: 'g-freizeit', name_de: 'Freizeit und Wahrzeichen', name_en: 'Leisure and landmarks', zeichen: 'F', spoiler: false, gtadb: true },
  { id: 'g-gebaeude', name_de: 'Gebäude', name_en: 'Buildings', zeichen: 'B', spoiler: false, gtadb: true },
  { id: 'm-schauplatz', name_de: 'Schauplätze (Trailer, Vorbilder)', name_en: 'Scenes (trailers, real-world models)', zeichen: 'S', spoiler: false, gtadb: true }
];

export function pruefeDaten({ karte, orte, checkliste, missionen, gtadb, mapheist, strassen }) {
  const fehler = [];
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
    }
  }
  for (const k of missionen.kapitel) {
    for (const m of k.missionen) {
      neu(m.id, 'Mission');
      if (!m.id.startsWith(`${k.id}-`)) fehler.push(`Mission ${m.id}: passt nicht zum Kapitel ${k.id}`);
    }
  }
  return fehler;
}

export async function ladeDaten(basis = './data/') {
  const holen = async (pfad) => {
    const antwort = await fetch(basis + pfad);
    if (!antwort.ok) throw new Error(`${pfad}: ${antwort.status}`);
    return antwort.json();
  };
  const [karte, orte, checkliste, missionen, gtadb, mapheist, strassen] = await Promise.all([holen('karte.json'), holen('orte.json'), holen('checkliste.json'), holen('missionen.json'), holen('gtadb.json'), holen('mapheist.json'), holen('strassen.json')]);
  orte.kategorien = [...orte.kategorien.filter((k) => k.id !== 'eigen'), ...GTADB_KATEGORIEN, ...orte.kategorien.filter((k) => k.id === 'eigen')];
  const daten = { karte, orte, checkliste, missionen, gtadb, mapheist, strassen, community: [...gtadb.orte.map((o) => ({ ...o, quelle: 'gtadb' })), ...mapheist.orte] };
  const fehler = pruefeDaten(daten);
  if (fehler.length) console.warn('Datenfehler:', fehler);
  return daten;
}
