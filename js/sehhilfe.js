// Sehhilfen der Werkstatt: eine Wahl für alle Werkzeuge unter dennismit2n.github.io, als roher Text unter
// werkstatt.darstellung (system, light, dark, hc-dark, hc-light, cvd-dark, cvd-light, invert). Die App ist nur dunkel,
// darum bietet ihr Feld fünf Einträge: Normal, Hoher Kontrast dunkel und hell, Farbenblind, Umgekehrte Farben.
// „Normal“ lässt eine Hell-Dunkel-Wahl aus einem anderen Werkzeug stehen. <html> trägt data-vision (contrast, cvd, invert)
// und beim Hohen Kontrast data-hc (dark, light); das Kopf-Skript in index.html setzt beides schon vor dem ersten Bild.
const SCHLUESSEL = 'werkstatt.darstellung';
const passt = (abfrage) => Boolean(globalThis.matchMedia?.(abfrage).matches);

export function gespeichert() {
  try { return localStorage.getItem(SCHLUESSEL) || 'system'; } catch { return 'system'; }
}
// Gespeicherter Wert -> Eintrag des Feldes
export function eintragVon(wert) {
  if (wert === 'hc-dark' || wert === 'hc-light' || wert === 'invert') return wert;
  if (wert === 'cvd-dark' || wert === 'cvd-light') return 'cvd';
  return 'normal';
}
// Gewählter Eintrag -> Wert zum Speichern (bisher ist der Wert, der schon gespeichert war)
export function wertVon(eintrag, bisher, dunkel = passt('(prefers-color-scheme: dark)')) {
  if (eintrag === 'normal') return eintragVon(bisher) === 'normal' ? bisher : 'system';
  if (eintrag === 'cvd') return eintragVon(bisher) === 'cvd' ? bisher : (dunkel ? 'cvd-dark' : 'cvd-light');
  return eintrag;
}
export function anwenden(wert = gespeichert()) {
  const r = document.documentElement;
  r.removeAttribute('data-vision'); r.removeAttribute('data-hc');
  if (wert === 'hc-dark' || wert === 'hc-light') { r.setAttribute('data-vision', 'contrast'); r.setAttribute('data-hc', wert.slice(3)); }
  else if (wert === 'cvd-dark' || wert === 'cvd-light') r.setAttribute('data-vision', 'cvd');
  else if (wert === 'invert') r.setAttribute('data-vision', 'invert');
  else if (wert === 'system' && passt('(prefers-contrast: more)')) {
    r.setAttribute('data-vision', 'contrast'); r.setAttribute('data-hc', passt('(prefers-color-scheme: dark)') ? 'dark' : 'light');
  }
}
export function waehlen(eintrag) {
  const wert = wertVon(eintrag, gespeichert());
  try { localStorage.setItem(SCHLUESSEL, wert); } catch { /* Speicher gesperrt: gilt nur für diesen Besuch */ }
  anwenden(wert);
}
// Ruft geaendert() auf, wenn sich die Darstellung ohne Zutun des Feldes ändert: das Gerät schaltet um,
// ein anderes Werkzeug im Nachbar-Tab wählt neu, oder die Seite kommt aus dem Zurück-Speicher.
export function beobachten(geaendert) {
  const neu = () => { anwenden(); geaendert(); };
  for (const abfrage of ['(prefers-color-scheme: dark)', '(prefers-contrast: more)']) matchMedia(abfrage).addEventListener('change', neu);
  addEventListener('storage', (e) => { if (e.key === SCHLUESSEL) neu(); });
  addEventListener('pageshow', (e) => { if (e.persisted) neu(); });
}
