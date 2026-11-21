// Suche über Ortsnamen, feste Orte und eigene Pins. Rein und ohne DOM, darum testbar.

// Für den Vergleich: klein, ohne Akzente, typografische Zeichen vereinfacht
export function normal(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`´]/g, '\'')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Punktzahl eines Eintrags: ganzer Name > Anfang > Wortanfang > irgendwo; Zusatztext (Art, Notiz) zählt weniger
function wertung(eintrag, worte) {
  const name = eintrag._name ??= normal(eintrag.name);
  const zusatz = eintrag._zusatz ??= normal(eintrag.zusatz);
  let punkte = 0;
  for (const w of worte) {
    if (name === w) punkte += 100;
    else if (name.startsWith(w)) punkte += 60;
    else if ((' ' + name).includes(' ' + w)) punkte += 40;
    else if (name.includes(w)) punkte += 20;
    else if ((' ' + zusatz).includes(' ' + w)) punkte += 10;
    else if (zusatz.includes(w)) punkte += 5;
    else return 0;               // jedes Wort muss irgendwo vorkommen
  }
  return punkte + (eintrag.gewicht ?? 0);
}

// eintraege: [{name, zusatz?, gewicht?, ...}]; liefert höchstens max Treffer, beste zuerst
export function suchen(anfrage, eintraege, max = 8) {
  const worte = normal(anfrage).split(' ').filter(Boolean);
  if (!worte.length) return [];
  const treffer = [];
  for (const e of eintraege) {
    const p = wertung(e, worte);
    if (p > 0) treffer.push({ e, p });
  }
  treffer.sort((a, b) => b.p - a.p || a.e.name.length - b.e.name.length || a.e.name.localeCompare(b.e.name));
  return treffer.slice(0, max).map((t) => t.e);
}
