// Reine Kartenrechnung ohne DOM: Planquadrat wie auf der offiziellen Karte, Entfernung, County-Zuordnung.

// Planquadrat (z. B. "F7") zu einem Punkt in Karteneinheiten (x nach rechts, y nach unten).
export function planquadrat(x, y, gitter) {
  const spalte = Math.min(gitter.spalten, Math.max(1, Math.floor((x - gitter.x0) / gitter.dx) + 2));
  const zeile = Math.min(gitter.zeilen.length - 1, Math.max(0, Math.floor((y - gitter.y0) / gitter.dy) + 1));
  return `${gitter.zeilen[zeile]}${spalte}`;
}

// Entfernung als Text. meterJeEinheit kommt aus dem Maßstab der Karte (ein Gitterfeld ist eine Meile).
export function entfernungText(einheiten, meterJeEinheit, sprache = 'de') {
  const m = einheiten * meterJeEinheit;
  if (m < 950) return `${Math.round(m / 10) * 10} m`;
  const km = (m / 1000).toFixed(1);
  return `${sprache === 'de' ? km.replace('.', ',') : km} km`;
}

// County eines beliebigen Punktes: der nächste Ortsname mit bekanntem County entscheidet.
export function countyVon(x, y, labels) {
  let best = null; let d = Infinity;
  for (const l of labels) {
    if (!l.county) continue;
    const e = Math.hypot(l.x - x, l.y - y);
    if (e < d) { d = e; best = l.county; }
  }
  return best;
}

export function innerhalb(x, y, karte) { return x >= 0 && y >= 0 && x <= karte.breite && y <= karte.hoehe; }
