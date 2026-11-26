// Suche über alles Durchsuchbare der App: Ortsnamen, feste Orte, Läden, eigene Pins, Straßen, 100-%-Liste, Radio.
// Rein und ohne DOM, darum testbar.

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

// Füllwörter zählen nicht, solange die Anfrage noch andere Wörter hat („Läden für Kleidung“)
const FUELL = new Set(['fur', 'der', 'die', 'das', 'und', 'in', 'im', 'am', 'von', 'mit', 'zum', 'zur', 'the', 'of', 'for', 'and', 'a', 'an', 'at', 'to']);
function anfrageWorte(anfrage) {
  const alle = normal(anfrage).split(' ').filter(Boolean);
  const ohne = alle.filter((w) => !FUELL.has(w));
  return ohne.length ? ohne : alle;
}

// Punktzahl eines Eintrags: ganzer Name > erstes Wort > ganzes Wort > Art im Zusatz > Wortanfang > irgendwo. Der Zusatztext (Art, Notiz)
// zählt weniger; steht das Wort dort ganz (etwa die Art „Bar“), liegt der Eintrag aber vor bloßen Wortanfängen („Barber“).
// eintrag.suchname (optional) ersetzt den Namen beim Vergleich: leer bei Läden ohne eigenen Namen, die nur nach ihrer Art heißen
// und darum nicht vor den Läden mit Namen stehen sollen.
function wertung(eintrag, worte) {
  const name = eintrag._name ??= normal(eintrag.suchname ?? eintrag.name);
  const zusatz = eintrag._zusatz ??= normal(eintrag.zusatz);
  // „brian“ soll „Brian’s Lockup“ als ganzes Wort treffen: für den Vergleich ganzer Wörter zählt das Besitz-s nicht
  const ohneS = eintrag._ohneS ??= name.replace(/'s\b/g, '');
  let punkte = 0;
  for (const w of worte) {
    if (name === w) punkte += 100;
    else if (name.startsWith(w + ' ') || ohneS.startsWith(w + ' ')) punkte += 80;
    else if ((' ' + name + ' ').includes(' ' + w + ' ') || (' ' + ohneS + ' ').includes(' ' + w + ' ')) punkte += 65;
    else if ((' ' + zusatz + ' ').includes(' ' + w + ' ')) punkte += 45;
    else if ((' ' + name).includes(' ' + w)) punkte += 40;
    else if (name.includes(w)) punkte += 20;
    else if ((' ' + zusatz).includes(' ' + w)) punkte += 10;
    else if (w.length >= 4 && zusatz.includes(w)) punkte += 5;   // kurze Wörter nicht mitten im Zusatz („bar“ in „betretbar“)
    else return 0;               // jedes Wort muss irgendwo vorkommen
  }
  return punkte + (eintrag.gewicht ?? 0);
}

// Zahl der Tippfehler zwischen zwei Wörtern (Levenshtein), abgebrochen, sobald es mehr als max sind
export function tippfehler(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let vor = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const zeile = [i]; let klein = i;
    for (let j = 1; j <= b.length; j++) {
      zeile[j] = Math.min(vor[j] + 1, zeile[j - 1] + 1, vor[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (zeile[j] < klein) klein = zeile[j];
    }
    if (klein > max) return max + 1;
    vor = zeile;
  }
  return vor[b.length];
}

// Zweiter Durchgang, wenn nichts genau passt: je Wort ein Tippfehler erlaubt, ab 8 Buchstaben zwei.
// Verglichen wird mit ganzen Wörtern und mit gleich langen Wortanfängen (man tippt ja noch).
function wertungUngefaehr(eintrag, worte) {
  const name = eintrag._name ??= normal(eintrag.suchname ?? eintrag.name);
  const zusatz = eintrag._zusatz ??= normal(eintrag.zusatz);
  const nWorte = eintrag._nworte ??= name.split(' ');
  const zWorte = eintrag._zworte ??= zusatz.split(' ');
  // Der erste Buchstabe muss stimmen, sonst passt zu viel („garge“ soll Garage finden, nicht Target)
  const nah = (w, liste, max) => liste.some((x) => x[0] === w[0] && (tippfehler(w, x, max) <= max || (x.length > w.length && tippfehler(w, x.slice(0, w.length), max) <= max)));
  let punkte = 0;
  for (const w of worte) {
    if (name.includes(w)) { punkte += 20; continue; }
    if (zusatz.includes(w)) { punkte += 5; continue; }
    if (w.length < 4) return 0;
    const max = w.length >= 8 ? 2 : 1;
    if (nah(w, nWorte, max)) punkte += 8;
    else if (nah(w, zWorte, max)) punkte += 3;
    else return 0;
  }
  return punkte + (eintrag.gewicht ?? 0);
}

// eintraege: [{name, zusatz?, gewicht?, ...}]; liefert höchstens max Treffer, beste zuerst
export function suchen(anfrage, eintraege, max = 8) {
  const worte = anfrageWorte(anfrage);
  if (!worte.length) return [];
  const treffer = [];
  for (const e of eintraege) {
    const p = wertung(e, worte);
    if (p > 0) treffer.push({ e, p });
  }
  if (!treffer.length) {
    for (const e of eintraege) {
      const p = wertungUngefaehr(e, worte);
      if (p > 0) treffer.push({ e, p });
    }
  }
  treffer.sort((a, b) => b.p - a.p || a.e.name.length - b.e.name.length || a.e.name.localeCompare(b.e.name));
  return treffer.slice(0, max).map((t) => t.e);
}

// Treffer nach Gruppe sortieren (Reihenfolge der Gruppen fest), je Gruppe höchstens jeGruppe; der Rest steht als Zahl in „weitere“
export function gruppieren(treffer, gruppen, jeGruppe = 100) {
  return gruppen.map((g) => {
    const alle = treffer.filter((e) => e.gruppe === g);
    return { gruppe: g, treffer: alle.slice(0, jeGruppe), weitere: Math.max(0, alle.length - jeGruppe) };
  }).filter((x) => x.treffer.length);
}
