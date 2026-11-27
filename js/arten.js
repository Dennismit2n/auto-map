// Arten der Orte (Läden, Dienste, Aktivitäten, Verkehr): einzeln schaltbar, jede mit eigenem Piktogramm.
// Die Piktogramme sind eigene Zeichnungen in der Formensprache der Ingame-Karte (flache Umrisse), keine Rockstar-Grafik.
// tags sind die Schlagworte aus data/gtadb.json (Feld art) und aus data/orte.json (Feld arten). Die Reihenfolge der Liste
// entscheidet, welches Zeichen ein Ort mit mehreren Arten bekommt (Pfandhaus mit Waffen: Ammu-Nation).

export const ART_GRUPPEN = [
  { id: 'laden', name_de: 'Läden', name_en: 'Shops', farbe: '--vc-art-laden' },
  { id: 'auto', name_de: 'Auto', name_en: 'Cars', farbe: '--vc-art-auto' },
  { id: 'nacht', name_de: 'Essen und Nacht', name_en: 'Food and nightlife', farbe: '--vc-art-nacht' },
  { id: 'aktiv', name_de: 'Aktivitäten', name_en: 'Activities', farbe: '--vc-art-aktiv' },
  { id: 'dienst', name_de: 'Dienste', name_en: 'Services', farbe: '--vc-art-dienst' },
  { id: 'verkehr', name_de: 'Verkehr', name_en: 'Transport', farbe: '--vc-art-verkehr' }
];

export const ARTEN = [
  { id: 'ammunation', gruppe: 'laden', name_de: 'Ammu-Nation und Waffen', name_en: 'Ammu-Nation and guns', tags: ['guns'], farbe: '--vc-art-waffen' },
  // Tankstelle vor Supermarkt, Parkplatz vor Hotel: gtadb führt Tankstellen oft nur als Supermarkt und Hotelparkplätze als Hotel
  { id: 'tankstelle', gruppe: 'auto', name_de: 'Tankstelle', name_en: 'Gas station', tags: ['gas'] },
  { id: 'parkplatz', gruppe: 'verkehr', name_de: 'Parkplatz', name_en: 'Parking lot', tags: ['parkplatz'] },
  { id: 'kleidung', gruppe: 'laden', name_de: 'Kleidung und Schuhe', name_en: 'Clothing and shoes', tags: ['clothes', 'shoes'] },
  { id: 'friseur', gruppe: 'laden', name_de: 'Friseur', name_en: 'Barber', tags: ['hair'] },
  { id: 'tattoo', gruppe: 'laden', name_de: 'Tattoo', name_en: 'Tattoo', tags: ['tattoos'] },
  { id: 'pfandhaus', gruppe: 'laden', name_de: 'Pfandhaus', name_en: 'Pawn shop', tags: ['pawn'] },
  { id: 'supermarkt', gruppe: 'laden', name_de: 'Supermarkt und Spirituosen', name_en: 'Supermarket and liquor', tags: ['supermarket', 'liquor'] },
  { id: 'elektronik', gruppe: 'laden', name_de: 'Elektronik', name_en: 'Electronics', tags: ['electronics'] },
  { id: 'juwelier', gruppe: 'laden', name_de: 'Juwelier', name_en: 'Jeweler', tags: ['jewelry', 'diamonds'] },
  { id: 'apotheke', gruppe: 'laden', name_de: 'Apotheke', name_en: 'Pharmacy', tags: ['pharmacy'] },
  { id: 'modshop', gruppe: 'auto', name_de: 'Mod Shop', name_en: 'Mod shop', tags: ['modshop'] },
  { id: 'payspray', gruppe: 'auto', name_de: 'Pay ’n’ Spray', name_en: 'Pay ’n’ Spray', tags: ['pay\'n\'spray'] },
  { id: 'werkstatt', gruppe: 'auto', name_de: 'Werkstatt', name_en: 'Garage and repairs', tags: ['carshop', 'bikeshop'] },
  { id: 'autohaendler', gruppe: 'auto', name_de: 'Autohändler', name_en: 'Car dealer', tags: ['cardealer'] },
  { id: 'waschanlage', gruppe: 'auto', name_de: 'Waschanlage', name_en: 'Car wash', tags: ['carwash'] },
  { id: 'bar', gruppe: 'nacht', name_de: 'Bar', name_en: 'Bar', tags: ['bar', 'drinks'] },
  { id: 'stripclub', gruppe: 'nacht', name_de: 'Stripclub', name_en: 'Strip club', tags: ['stripclub'] },
  { id: 'nachtclub', gruppe: 'nacht', name_de: 'Nachtclub', name_en: 'Nightclub', tags: ['nightclub'] },
  { id: 'restaurant', gruppe: 'nacht', name_de: 'Restaurant und Imbiss', name_en: 'Restaurant and food', tags: ['restaurant', 'fastfood', 'food', 'cafe', 'vendor'] },
  { id: 'schiessstand', gruppe: 'aktiv', name_de: 'Schießstand', name_en: 'Shooting range', tags: ['shootingrange'], farbe: '--vc-art-waffen', leuchten: true },
  { id: 'rennstrecke', gruppe: 'aktiv', name_de: 'Rennstrecke', name_en: 'Racetrack', tags: ['racetrack'] },
  { id: 'golf', gruppe: 'aktiv', name_de: 'Golf', name_en: 'Golf', tags: ['golf'] },
  { id: 'tennis', gruppe: 'aktiv', name_de: 'Tennis', name_en: 'Tennis', tags: ['tennis'] },
  { id: 'fitness', gruppe: 'aktiv', name_de: 'Fitnessstudio', name_en: 'Gym', tags: ['gym'] },
  { id: 'volleyball', gruppe: 'aktiv', name_de: 'Volleyball', name_en: 'Volleyball', tags: ['volleyball'] },
  { id: 'riesenrad', gruppe: 'aktiv', name_de: 'Riesenrad', name_en: 'Ferris wheel', tags: ['ferriswheel'] },
  { id: 'polizei', gruppe: 'dienst', name_de: 'Polizei und Gefängnis', name_en: 'Police and jail', tags: ['police', 'jail'] },
  { id: 'krankenhaus', gruppe: 'dienst', name_de: 'Krankenhaus', name_en: 'Hospital', tags: ['hospital'] },
  { id: 'bank', gruppe: 'dienst', name_de: 'Bank', name_en: 'Bank', tags: ['bank'] },
  { id: 'hotel', gruppe: 'dienst', name_de: 'Hotel', name_en: 'Hotel', tags: ['hotel'] },
  { id: 'hafen', gruppe: 'verkehr', name_de: 'Hafen und Marina', name_en: 'Harbor and marina', tags: ['marina'] },
  { id: 'flughafen', gruppe: 'verkehr', name_de: 'Flughafen', name_en: 'Airport', tags: ['airport', 'airbase'] },
  { id: 'bahn', gruppe: 'verkehr', name_de: 'Bahnhof', name_en: 'Train station', tags: ['train'] },
  { id: 'metro', gruppe: 'verkehr', name_de: 'Metro und Hochbahn', name_en: 'Metro and Metromover', tags: ['metro', 'metromover'] },
  { id: 'bus', gruppe: 'verkehr', name_de: 'Bushaltestelle', name_en: 'Bus stop', tags: ['bus'] }
];

const NACH_ID = new Map(ARTEN.map((a) => [a.id, a]));
const NACH_TAG = new Map(ARTEN.flatMap((a) => a.tags.map((tag) => [tag, a.id])));
const FARBE = new Map(ART_GRUPPEN.map((g) => [g.id, g.farbe]));
export const artMit = (id) => NACH_ID.get(id);
export const artFarbe = (id) => NACH_ID.get(id)?.farbe ?? FARBE.get(NACH_ID.get(id)?.gruppe);

// Arten eines Ortes aus seinen Schlagworten, in der Reihenfolge der Liste; die erste gibt das Zeichen
export function artenAus(tags) {
  const ids = new Set((tags ?? []).map((tag) => NACH_TAG.get(tag)).filter(Boolean));
  return ARTEN.filter((a) => ids.has(a.id)).map((a) => a.id);
}
export const artenVon = (ort) => artenAus([...(ort.art ?? []), ...(ort.arten ?? [])]);

// Einträge des Reiters Nachschlagen und Zeilen der 100-%-Liste, zu denen es Orte einer Art auf der Karte gibt
export const ARTEN_ZU = {
  't-schiessstand': ['schiessstand'], 'schiessstand-gold': ['schiessstand'],
  't-golf': ['golf'], 'minigolf-kurse': ['golf'], 't-rennen': ['rennstrecke'], 't-renn-challenges': ['rennstrecke'], 'rennen-gewonnen': ['rennstrecke'], 'renn-challenges-gold': ['rennstrecke'],
  't-fitness': ['fitness'], 't-stripclubs': ['stripclub'], 't-bars-nachtleben': ['bar', 'nachtclub'],
  'f-versteck-ammu-nation': ['ammunation'], 'f-versteck-kleiderladen': ['kleidung'], 'f-versteck-friseur': ['friseur'], 'f-versteck-pay-n-spray': ['payspray']
};

// Piktogramme im Raster 24 × 24. f: Fläche in der Farbe der Art, d: dunkle Einzelheiten darauf (gerade-ungerade gefüllt),
// s: dunkle Linien. Jedes Zeichen bekommt außen einen dunklen Saum, damit es auf Straßen und Wasser gleich gut steht.
const KREIS = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0-${2 * r} 0z`;
const KACHEL = 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z';
export const ZEICHEN = {
  ammunation: { f: 'M3 6h18v4h-6.6c-.3 2.1-1.4 3-3.4 3h-1l-1 7H4l1.6-7.5H3z', d: 'M15 7.2h4.5v1H15z' },
  kleidung: { f: 'M8.2 3L3 6.6l2.4 4 2.1-1V21h9V9.6l2.1 1 2.4-4L15.8 3c-.9 1.9-6.7 1.9-7.6 0z' },
  friseur: { f: `M9 14.6L19.6 3.6l1.3 1.6-10 11.2z M15 14.6L4.4 3.6 3.1 5.2l10 11.2z ${KREIS(7.2, 18, 3.2)} ${KREIS(16.8, 18, 3.2)}`, d: `${KREIS(7.2, 18, 1.4)} ${KREIS(16.8, 18, 1.4)}` },
  tattoo: { f: 'M12 21C5 15.2 3 12 3 8.6 3 5.6 5.2 3.5 7.8 3.5c1.8 0 3.4 1 4.2 2.5.8-1.5 2.4-2.5 4.2-2.5 2.6 0 4.8 2.1 4.8 5.1 0 3.4-2 6.6-9 12.4z', d: 'M6 11.9l12-2.3v2.6l-12 2.3z' },
  pfandhaus: { f: `M5 4h14v2H5z M6.5 6h1v3h-1z M16.5 6h1v3h-1z M11.5 6h1v9h-1z ${KREIS(7, 11.2, 2.9)} ${KREIS(17, 11.2, 2.9)} ${KREIS(12, 17.6, 3.1)}` },
  supermarkt: { f: `M2 4h3.6l.8 3H21l-2 7.5H8.4l.4 1.5H19v2H7.2L4.1 6H2z ${KREIS(9.1, 20.3, 1.7)} ${KREIS(17.1, 20.3, 1.7)}` },
  elektronik: { f: 'M3 4.5h18v12H3z M10.5 16.5h3V19h-3z M8 19h8v2H8z', d: 'M5 6.5h14v8H5z' },
  juwelier: { f: 'M7 4h10l4.5 5.5L12 21 2.5 9.5z', s: 'M3 9.5h18 M9 4.2L7.6 9.5 12 20.4l4.4-10.9L15 4.2' },
  apotheke: { f: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z' },
  tankstelle: { f: 'M5 3h9v18H5z M4 20h11v2H4z M14 8h3l3 3v8h-2v-7l-1.5-1.5H14z', d: 'M7 5.5h5V10H7z' },
  modshop: { f: 'M20.5 6.6l-3 3-3-3 3-3c-2.5-1-5-.2-6.3 1.7-1 1.5-1.1 3.3-.5 4.8L3 17.8 6.2 21l7.7-7.7c1.5.6 3.3.5 4.8-.5 1.9-1.3 2.7-3.8 1.8-6.2z' },
  payspray: { f: `M7 9h8v12H7z M9 6h4v3H9z M10 3.5h2.6V6H10z ${KREIS(16.8, 4.6, 1)} ${KREIS(19.8, 2.9, 1)} ${KREIS(19.8, 6.5, 1)}`, d: 'M7 12.5h8v2.2H7z' },
  werkstatt: { f: KREIS(12, 12, 9), d: `${KREIS(12, 12, 5.8)} ${KREIS(12, 12, 2.4)}` },
  autohaendler: { f: `M2 14l2.5-1L7 8.5c.3-.5.8-.8 1.5-.8H15c.7 0 1.3.3 1.7.9l2.8 4 1.8.6c.5.2.7.6.7 1.1v3.2H2z ${KREIS(7, 17.8, 2.4)} ${KREIS(17.2, 17.8, 2.4)}`, d: `M8.4 9.3h2.9v3.2H6.6z M12.6 9.3h2.4l2.2 3.2h-4.6z ${KREIS(7, 17.8, 1)} ${KREIS(17.2, 17.8, 1)}` },
  waschanlage: { f: 'M12 3S5.5 10.6 5.5 14.8a6.5 6.5 0 0 0 13 0C18.5 10.6 12 3 12 3z', s: 'M8.8 15.2a3.3 3.3 0 0 0 2.7 3' },
  bar: { f: 'M3 4h18l-8 9v6h4v2H7v-2h4v-6z', s: 'M6.4 7.2h11.2' },
  stripclub: { f: 'M3 5c3.2.2 5.4 2.2 7.2 5.2 1.9 3 4.8 4.3 10.8 5V18h-9.5l-2.7-4v5H7v-5.5L3 9z' },
  nachtclub: { f: 'M9 4.2l11-1.7v14a3 3 0 1 1-2-2.8V7.3l-7 1.1v10.1a3 3 0 1 1-2-2.8z' },
  restaurant: { f: 'M6 3v6a2 2 0 0 0 1.5 1.9V21h2V10.9A2 2 0 0 0 11 9V3H9.8v5h-.7V3H7.9v5h-.7V3z M15 3c2.5 1.5 3.5 5 3 10h-1.2v8H15z' },
  schiessstand: { f: KREIS(12, 12, 9.5), d: `${KREIS(12, 12, 7)} ${KREIS(12, 12, 4.7)} ${KREIS(12, 12, 2.4)}` },
  rennstrecke: { f: 'M4 3h2v19H4z M6 4h14v10H6z', d: 'M9.5 4H13v3.33H9.5z M16.5 4H20v3.33h-3.5z M6 7.33h3.5v3.34H6z M13 7.33h3.5v3.34H13z M9.5 10.67H13V14H9.5z M16.5 10.67H20V14h-3.5z' },
  golf: { f: `M8 3h1.8v17H8z M9.8 3.4l9 3.4-9 3.4z M3 20.2a6 1.8 0 1 0 12 0a6 1.8 0 1 0-12 0z ${KREIS(18.2, 18.6, 1.8)}` },
  tennis: { f: `M3.5 9.2a6 6.8 0 1 0 12 0a6 6.8 0 1 0-12 0z M12.4 14.4l1.9-1.8 7.2 7.3-1.9 1.8z ${KREIS(19.2, 5, 2)}`, d: 'M5.3 9.2a4.2 5 0 1 0 8.4 0a4.2 5 0 1 0-8.4 0z M8.9 4.4h1.2v9.6H8.9z M5.5 8.6h8v1.2h-8z' },
  fitness: { f: 'M2 9.5h2.5v5H2z M5 6.5h3v11H5z M8 10.8h8v2.4H8z M16 6.5h3v11h-3z M19.5 9.5H22v5h-2.5z' },
  volleyball: { f: KREIS(12, 12, 9), s: 'M12 3c-2.2 3.2-2 7 0 9 M12 12c3-.9 6.8.3 8.5 3 M12 12c-1.2 2.8-4.2 5.5-7.8 5.2' },
  riesenrad: { f: `M4.5 9.9h15v1.2h-15z M11.4 3h1.2v15h-1.2z M6.3 5.6l.85-.85 10.6 10.6-.85.85z M17.7 5.6l-.85-.85-10.6 10.6.85.85z M11.2 11L6.8 21.5h1.9L12 13.6l3.3 7.9h1.9L12.8 11z ${[[19.5, 10.5], [17.3, 15.8], [12, 18], [6.7, 15.8], [4.5, 10.5], [6.7, 5.2], [12, 3], [17.3, 5.2]].map(([x, y]) => KREIS(x, y, 1.7)).join(' ')} ${KREIS(12, 10.5, 1.9)}` },
  polizei: { f: 'M12 2.5l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6z', d: 'M12 7l1.12 2.96 3.16.15-2.47 1.98.84 3.05L12 13.4l-2.65 1.74.84-3.05-2.47-1.98 3.16-.15z' },
  krankenhaus: { f: KACHEL, d: 'M7.5 6.5H10v4.2h4V6.5h2.5v11H14v-4.2h-4v4.2H7.5z' },
  bank: { f: 'M12 2.5L21.5 8v1.8h-19V8z M5 11h2.5v6.5H5z M10.75 11h2.5v6.5h-2.5z M16.5 11H19v6.5h-2.5z M3 19h18v2.5H3z' },
  hotel: { f: `M2 6h2v7h18v6.5h-2V17H4v2.5H2z ${KREIS(7, 10, 2)} M10 9h8.5a3.5 3.5 0 0 1 3.5 3.5v.5H10z` },
  hafen: { f: `${KREIS(12, 4.8, 2.3)} M11 7h2v13h-2z M8 9.5h8v1.8H8z M4 13l3.5.5-1.1 1.3c1.2 2.2 3.2 3.6 5.6 3.8 2.4-.2 4.4-1.6 5.6-3.8l-1.1-1.3L20 13l.3 3.6-1.1-1c-1.4 3.2-4 5.4-7.2 5.8-3.2-.4-5.8-2.6-7.2-5.8l-1.1 1z`, d: KREIS(12, 4.8, 1) },
  flughafen: { f: 'M12 2c1 0 1.6 1.2 1.6 3v4.2L22 14.5v2.1L13.6 14v4.4l2.6 2V22L12 20.8 7.8 22v-1.6l2.6-2V14L2 16.6v-2.1l8.4-5.3V5c0-1.8.6-3 1.6-3z' },
  bahn: { f: 'M7 2.5h10a3 3 0 0 1 3 3V16a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5.5a3 3 0 0 1 3-3z M7.5 19L5 22.5h2.3L9.5 19z M16.5 19l2.5 3.5h-2.3L14.5 19z', d: `M6.5 6h11v5h-11z ${KREIS(8, 15, 1.3)} ${KREIS(16, 15, 1.3)}` },
  metro: { f: KREIS(12, 12, 9.5), d: 'M6.5 17V7H9l3 5.5L15 7h2.5v10h-2.3v-5.8l-2.3 4.2h-1.8l-2.3-4.2V17z' },
  bus: { f: 'M5 3h14a2 2 0 0 1 2 2v13H3V5a2 2 0 0 1 2-2z M5 18h3.5v3H5z M15.5 18H19v3h-3.5z', d: `M5.5 6h13v5.5h-13z ${KREIS(7, 15, 1.2)} ${KREIS(17, 15, 1.2)}` },
  parkplatz: { f: KACHEL, d: 'M8.5 6.5h4.7a3.8 3.8 0 0 1 0 7.6H11v3.4H8.5z M11 8.8v3h2a1.5 1.5 0 0 0 0-3z' }
};

// Piktogramm als SVG-Text. farbe und dunkel sind CSS-Farben (auch var(...)), für ein Bild auf der Leinwand fertige Werte.
export function zeichenSvg(id, farbe, dunkel, groesse = 24) {
  const z = ZEICHEN[id];
  if (!z) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 28 28" width="${groesse}" height="${groesse}" aria-hidden="true" focusable="false">`
    + `<path d="${z.f}" style="fill:${dunkel};stroke:${dunkel};stroke-width:3.4;stroke-linejoin:round"/>`
    + `<path d="${z.f}" style="fill:${farbe}"/>`
    + (z.d ? `<path d="${z.d}" fill-rule="evenodd" style="fill:${dunkel}"/>` : '')
    + (z.s ? `<path d="${z.s}" style="fill:none;stroke:${dunkel};stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round"/>` : '')
    + '</svg>';
}
