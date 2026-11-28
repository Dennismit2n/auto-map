// Fahrzeuge und Cheats: reine Logik ohne DOM (getestet in test/fahrzeuge.test.mjs).

export const FZ_BEREICHE = ['land', 'wasser', 'luft'];

// Sichtbare Liste: nach Bereich und Klasse gefiltert, sortiert nach Name, Hersteller, den Spielwerten (0 bis 10)
// oder, sobald es Messungen gibt, nach km/h und Flughöhe. Fahrzeuge ohne Wert stehen beim Sortieren nach Zahlen am Ende.
export function fahrzeugListe(fahrzeuge, { bereich = 'alle', klasse = '', sortierung = 'name' } = {}) {
  const liste = fahrzeuge.filter((f) => (bereich === 'alle' || f.bereich === bereich) && (!klasse || f.klasse === klasse));
  // Baujahr vorn ('95 Bison 900) zählt beim Namen nicht mit
  const ohneJahr = (n) => n.replace(/^['’]\d{2} /, '');
  const nachName = (a, b) => ohneJahr(a.name).localeCompare(ohneJahr(b.name), 'en', { sensitivity: 'base' }) || a.name.localeCompare(b.name) || (a.hersteller ?? '').localeCompare(b.hersteller ?? '');
  const zahlAbwaerts = (wert) => (a, b) => (wert(b) ?? -1) - (wert(a) ?? -1) || nachName(a, b);
  const vergleich = {
    name: nachName,
    hersteller: (a, b) => (a.hersteller ?? '￿').localeCompare(b.hersteller ?? '￿', 'en', { sensitivity: 'base' }) || nachName(a, b),
    tempo: zahlAbwaerts((f) => f.werte?.tempo),
    beschleunigung: zahlAbwaerts((f) => f.werte?.beschleunigung),
    handling: zahlAbwaerts((f) => f.werte?.handling),
    offroad: zahlAbwaerts((f) => f.werte?.offroad),
    vmax: zahlAbwaerts((f) => f.vmax_kmh),
    hoehe: zahlAbwaerts((f) => f.hoehe_max_m)
  }[sortierung] ?? nachName;
  return [...liste].sort(vergleich);
}

// Klassen eines Bereichs mit Anzahl, häufigste zuerst
export function fahrzeugKlassen(fahrzeuge, bereich = 'alle') {
  const zahl = new Map();
  for (const f of fahrzeuge) if (bereich === 'alle' || f.bereich === bereich) zahl.set(f.klasse, (zahl.get(f.klasse) ?? 0) + 1);
  return [...zahl].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([klasse, anzahl]) => ({ klasse, anzahl }));
}

// Text, der erst ab einem späteren Kapitel stimmt (Erhalt über eine Mission, Freischaltung eines Cheats), bleibt
// spoilerfrei verborgen. Liefert den Text oder null und das Kapitel, ab dem er kommt.
export function kapitelText(eintrag, feldName, sprache, spoilerfrei, stand) {
  const text = eintrag[`${feldName}_${sprache}`] ?? eintrag[`${feldName}_de`] ?? null;
  if (!text) return { text: null, ab: null };
  if (spoilerfrei && eintrag.ab_kapitel != null && eintrag.ab_kapitel > stand) return { text: null, ab: eintrag.ab_kapitel };
  return { text, ab: null };
}

export const mphZuKmh = (mph) => Math.round(mph * 1.609344);
export const kmhZuMph = (kmh) => Math.round(kmh / 1.609344);
