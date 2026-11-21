// Leaflet mit CRS.Simple über der Grundkarte (Kacheln der offiziellen Ingame-Karte, dunkel umgefärbt, assets/karte/kacheln).
// Karteneinheiten: x nach rechts 0 bis breite, y nach unten 0 bis hoehe. Leaflet rechnet mit lat nach oben,
// darum überall ll(x, y) = [hoehe - y, x].
/* global L */
import { istGefunden } from './fortschritt.js';

let H = 0;
export const ll = (x, y) => [H - y, x];
const el = (tag, klasse, text) => { const e = document.createElement(tag); if (klasse) e.className = klasse; if (text != null) e.textContent = text; return e; };

// Ab welcher Zoomstufe ein Namenstyp überhaupt in Frage kommt; ob er erscheint, entscheidet dann der Platz
const AB_STUFE = { county: 0, stadt: 0, gewaesser: 1, insel: 1, gebiet: 1, viertel: 2, poi: 2 };

export async function karteAnlegen(element, karte, { onKlick }) {
  H = karte.hoehe;
  const grenzen = [[0, 0], [karte.hoehe, karte.breite]];
  const k = L.map(element, {
    crs: L.CRS.Simple, minZoom: -2.5, maxZoom: 4, zoomSnap: 0.25, zoomDelta: 0.5,
    maxBounds: [[-300, -300], [karte.hoehe + 300, karte.breite + 300]], attributionControl: false, zoomControl: false
  });
  L.control.zoom({ position: 'bottomleft' }).addTo(k);
  L.control.attribution({ prefix: false, position: 'bottomleft' })
    .addAttribution('<a href="https://map.gtadb.org" target="_blank" rel="noopener">gtadb.org</a>, <a href="https://mapheist.com/en/data/" target="_blank" rel="noopener">mapheist.com</a> (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>) · <a href="https://gta.wiki/w/List_of_Street_Names" target="_blank" rel="noopener">gta.wiki</a> (<a href="https://creativecommons.org/licenses/by-nc-sa/3.0/" target="_blank" rel="noopener">CC BY-NC-SA 3.0</a>)').addTo(k);   // ohne Worte, gilt in jeder Sprache; was geändert wurde, steht im Reiter Daten
  k.fitBounds(grenzen, { padding: [8, 8] });

  // Grundkarte: offizielle Ingame-Karte aus den gtadb-Kacheln, auf die Karteneinheiten gelegt und dunkel umgefärbt
  // (tools/karte/kacheln-bauen.py). Eigene Kacheln für Zoom 0 bis 3, darüber und darunter skaliert Leaflet.
  const RAND = 300;
  L.tileLayer('./assets/karte/kacheln/{z}/{x}/{y}.webp', {
    minNativeZoom: 0, maxNativeZoom: 3, minZoom: -2.5, maxZoom: 4, noWrap: true, keepBuffer: 3, className: 'grundkarte',
    bounds: [ll(-RAND, karte.hoehe + RAND), ll(karte.breite + RAND, -RAND)]
  }).addTo(k);

  // Planquadrate wie auf der offiziellen Karte: Spalten 1 bis 9, Zeilen A bis M
  const gt = karte.gitter; const gitter = L.layerGroup().addTo(k);
  const strich = { weight: 1, interactive: false, className: 'gitterlinie' };
  for (let i = 0; i < gt.spalten - 1; i++) L.polyline([ll(gt.x0 + i * gt.dx, 0), ll(gt.x0 + i * gt.dx, karte.hoehe)], strich).addTo(gitter);
  for (let j = 0; j < gt.zeilen.length - 1; j++) L.polyline([ll(0, gt.y0 + j * gt.dy), ll(karte.breite, gt.y0 + j * gt.dy)], strich).addTo(gitter);
  L.rectangle(grenzen, { ...strich, fill: false, weight: 2 }).addTo(gitter);
  const marke = (x, y, t) => L.marker(ll(x, y), { interactive: false, keyboard: false, icon: L.divIcon({ className: 'gitter-marke', html: t, iconSize: [20, 20], iconAnchor: [10, 10] }) }).addTo(gitter);
  for (let i = 0; i < gt.spalten; i++) marke(Math.max(40, gt.x0 + (i - 0.5) * gt.dx), -22, String(i + 1));
  for (let j = 0; j < gt.zeilen.length; j++) marke(-22, Math.min(karte.hoehe - 40, Math.max(40, gt.y0 + (j - 0.5) * gt.dy)), gt.zeilen[j]);

  // Ortsnamen: die Liste ist nach Rang sortiert (Countys, Orte, Gewässer, ...). Es erscheint, was Platz hat.
  const namen = [];
  const namenEbene = L.layerGroup().addTo(k);
  const ebene = k.createPane('namen');            // über den Pins, damit Schrift lesbar bleibt; Klicks gehen durch
  ebene.style.zIndex = 640; ebene.style.pointerEvents = 'none';
  for (const l of karte.labels) {
    const m = L.marker(ll(l.x, l.y), {
      interactive: false, keyboard: false, pane: 'namen',
      icon: L.divIcon({ className: `ortsname on-${l.typ}`, html: el('span', null, l.text).outerHTML, iconSize: [0, 0] })
    }).addTo(namenEbene);
    namen.push({ m, ab: AB_STUFE[l.typ] ?? 2 });
  }
  const stufe = () => Math.max(0, Math.min(4, Math.floor((k.getZoom() + 1.75) / 0.75)));
  let geplant = 0;
  const platzVerteilen = () => {
    geplant = 0;
    const s = stufe(); element.dataset.stufe = String(s);
    const rahmen = element.getBoundingClientRect();
    const belegt = [...element.querySelectorAll('.buendel')].map((b) => b.getBoundingClientRect());   // Bündelzahlen bleiben frei
    for (const n of namen) {
      const span = n.m.getElement()?.firstElementChild;
      if (!span) continue;
      if (n.ab > s) { span.classList.add('verdeckt'); continue; }
      span.classList.remove('verdeckt');
      const r = span.getBoundingClientRect();
      if (r.right < rahmen.left || r.left > rahmen.right || r.bottom < rahmen.top || r.top > rahmen.bottom) continue;
      const frei = !belegt.some((b) => r.left < b.right + 6 && r.right > b.left - 6 && r.top < b.bottom + 2 && r.bottom > b.top - 2);
      if (frei) belegt.push(r); else span.classList.add('verdeckt');
    }
    k.fire('namenverteilt');                         // danach suchen sich die Straßennamen ihren Platz
  };
  k.on('zoomend moveend resize punkteverteilt', () => { if (!geplant) geplant = requestAnimationFrame(platzVerteilen); });
  k.on('zoomend', () => punkteVerteilen(ergebnis));
  platzVerteilen();

  k.on('click', (e) => onKlick?.({ x: Math.round(e.latlng.lng), y: Math.round(karte.hoehe - e.latlng.lat) }, e.latlng));
  const ergebnis = { karte: k, punkte: L.layerGroup().addTo(k), punktNachId: new Map(), leinwand: L.canvas({ padding: 0.3 }), pins: L.layerGroup().addTo(k), nachId: new Map(), ich: null, markierung: null, grenzen };
  return ergebnis;
}

// pins: [{id, x, y, county, kat, name, zeichen, farbe, popup()}]
export function pinsZeichnen(k, { pins, profil, zielId }) {
  k.pins.clearLayers(); k.nachId.clear();
  for (const p of pins) {
    const gefunden = istGefunden(profil, p.id);
    const icon = L.divIcon({
      className: '',
      html: `<div class="pin${gefunden ? ' gefunden' : ''}${p.id === zielId ? ' ziel' : ''}${p.kat === 'eigen' ? ' eigen' : ''}" style="--ort:var(${p.farbe})"><b>${gefunden ? '✓' : p.zeichen}</b></div>`,
      iconSize: [22, 22], iconAnchor: [11, 22], popupAnchor: [0, -22]
    });
    const marker = L.marker(ll(p.x, p.y), { icon, title: p.name, alt: p.name, keyboard: true, zIndexOffset: p.id === zielId ? 500 : 0 });
    marker.bindPopup(() => p.popup(() => k.karte.closePopup()), { maxWidth: 300, minWidth: 220 });
    marker.addTo(k.pins); k.nachId.set(p.id, marker);
  }
}

// Community-Orte als kleine Punkte auf einer Leinwand (schnell auch bei fast tausend Orten). Unterhalb von BUENDEL_BIS
// fasst die Karte nahe Punkte (Umkreis 40 Bildpunkte) zu Bündeln mit Anzahl zusammen; ein Klick zoomt hinein.
const PUNKT = [2, 2.5, 3.5, 5, 6];
const BUENDEL_BIS = 1.25;
const stufeVon = (zoom) => Math.max(0, Math.min(4, Math.floor((zoom + 1.75) / 0.75)));
function punkteVerteilen(k) {
  const zoom = k.karte.getZoom(); const r = PUNKT[stufeVon(zoom)];
  const alle = [...k.punktNachId.values()];
  const offen = alle.find((m) => m.isPopupOpen());   // ein offenes Fenster bleibt nach dem Neuverteilen offen
  k.punkte.clearLayers();
  const einzeln = (m) => { m.setRadius(r); m.addTo(k.punkte); };
  const fertig = () => { if (offen && k.punkte.hasLayer(offen)) offen.openPopup(); k.karte.fire('punkteverteilt'); };
  if (zoom >= BUENDEL_BIS) { alle.forEach(einzeln); fertig(); return; }
  const lage = alle.map((m) => k.karte.project(m.getLatLng(), zoom)); const frei = alle.map(() => true);
  for (let i = 0; i < alle.length; i++) {
    if (!frei[i]) continue;
    const gruppe = [];
    for (let j = i; j < alle.length; j++) if (frei[j] && lage[i].distanceTo(lage[j]) < 40) { gruppe.push(j); frei[j] = false; }
    if (gruppe.length < 3) { gruppe.forEach((j) => einzeln(alle[j])); continue; }
    const marker = gruppe.map((j) => alle[j]); const n = marker.length;
    const zaehl = new Map(); for (const m of marker) zaehl.set(m.farbe, (zaehl.get(m.farbe) ?? 0) + 1);
    const farbe = [...zaehl].sort((a, b) => b[1] - a[1])[0][0];
    const mitte = L.latLng(marker.reduce((s, m) => s + m.getLatLng().lat, 0) / n, marker.reduce((s, m) => s + m.getLatLng().lng, 0) / n);
    const g = n < 10 ? 24 : n < 50 ? 28 : 32;
    L.marker(mitte, {
      icon: L.divIcon({ className: '', html: `<div class="buendel" style="--ort:var(${farbe})">${n}</div>`, iconSize: [g, g], iconAnchor: [g / 2, g / 2] }),
      title: k.buendelTitel?.(n) ?? String(n), alt: k.buendelTitel?.(n) ?? String(n), riseOnHover: true, zIndexOffset: 600
    }).on('click', () => k.karte.fitBounds(L.latLngBounds(marker.map((m) => m.getLatLng())), { padding: [60, 60], maxZoom: BUENDEL_BIS })).addTo(k.punkte);
  }
  fertig();
}
export function punkteZeichnen(k, { orte, farbeVon, popup, buendelTitel }) {
  k.punktNachId.clear(); k.buendelTitel = buendelTitel;
  const stil = getComputedStyle(document.documentElement);
  const rand = stil.getPropertyValue('--vc-grund-nacht').trim();
  for (const o of orte) {
    const m = L.circleMarker(ll(o.x, o.y), {
      renderer: k.leinwand, radius: 3, weight: 1, color: rand, fillColor: stil.getPropertyValue(farbeVon(o)).trim(), fillOpacity: 0.95
    });
    m.farbe = farbeVon(o);
    m.bindPopup(() => popup(o, () => k.karte.closePopup()), { maxWidth: 300, minWidth: 220 });
    m.bindTooltip(o.name, { direction: 'top', offset: [0, -4], className: 'punkt-name' });
    k.punktNachId.set(o.id, m);
  }
  punkteVerteilen(k);
}
export function punktOeffnen(k, id) {
  const m = k.punktNachId.get(id);
  if (!m) return false;
  k.karte.once('moveend', () => m.openPopup());
  k.karte.flyTo(m.getLatLng(), Math.max(k.karte.getZoom(), BUENDEL_BIS), { duration: 0.6 });   // dort sind alle Punkte einzeln
  return true;
}

// Straßennamen entlang der Straße (Lage aus den gtadb-Adressen, Verlauf aus dem Straßennetz); per CSS erst ab mittlerem Zoom
// sichtbar. Mit Verlauf läuft die Schrift auf der Kurve (SVG textPath), sonst gerade und gedreht.
export function strassenZeichnen(k, strassen) {
  const ebene = L.layerGroup().addTo(k.karte);
  const ns = 'http://www.w3.org/2000/svg'; const [, [hoehe, breite]] = k.grenzen;
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${breite} ${hoehe}`); svg.setAttribute('class', 'strassenpfade'); svg.setAttribute('aria-hidden', 'true');
  const texte = [];
  for (const s of strassen) {
    if (s.ungefaehr) continue;
    for (const st of [s, ...(s.weitere || [])]) {
      if (st.pfad) {
        const pfad = document.createElementNS(ns, 'path'); pfad.id = `sp-${texte.length}`;
        pfad.setAttribute('d', `M${st.pfad.map((p) => p.join(',')).join('L')}`); pfad.setAttribute('fill', 'none');
        const text = document.createElementNS(ns, 'text'); const tp = document.createElementNS(ns, 'textPath');
        tp.setAttribute('href', `#${pfad.id}`); tp.setAttribute('startOffset', '50%'); tp.setAttribute('text-anchor', 'middle'); tp.textContent = s.name;
        text.append(tp); svg.append(pfad, text); texte.push({ pfad, text, rang: st.gebaeude ?? 0 });
        continue;
      }
      const span = el('span', null, s.name); span.style.setProperty('--winkel', `${st.winkel}deg`);
      L.marker(ll(st.x, st.y), { interactive: false, keyboard: false, pane: 'namen', icon: L.divIcon({ className: 'strassenname', html: span.outerHTML, iconSize: [0, 0] }) }).addTo(ebene);
    }
  }
  L.svgOverlay(svg, k.grenzen, { interactive: false, pane: 'namen' }).addTo(ebene);
  // Schriftgröße in Karteneinheiten so setzen, dass sie auf dem Schirm gleich bleibt; zu kurze Stücke ausblenden.
  // Platz: Ortsnamen und Bündel gehen vor, unter den Straßen die mit mehr Adressen. Gemessen wird je Buchstabe,
  // weil das Rechteck um einen schrägen oder gebogenen Namen viel zu groß wäre.
  texte.sort((a, b) => b.rang - a.rang);
  const ueber = (r, b) => r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top;
  const buchstaben = (text) => {
    const m = text.getScreenCTM(); const out = [];
    for (let i = 0; i < text.getNumberOfChars(); i++) {
      const e = text.getExtentOfChar(i);
      const p = new DOMPoint(e.x, e.y).matrixTransform(m); const q = new DOMPoint(e.x + e.width, e.y + e.height).matrixTransform(m);
      out.push({ left: Math.min(p.x, q.x), right: Math.max(p.x, q.x), top: Math.min(p.y, q.y), bottom: Math.max(p.y, q.y) });
    }
    return out;
  };
  const anpassen = () => {
    const z = k.karte.getZoom(); const wurzel = k.karte.getContainer();
    svg.style.fontSize = `${(z >= 1 ? 13 : 11) / 2 ** z}px`;
    const belegt = [...wurzel.querySelectorAll('.ortsname span:not(.verdeckt), .buendel')].map((x) => x.getBoundingClientRect());
    for (const t of texte) {
      t.text.classList.remove('verdeckt');
      if (t.text.classList.toggle('zu-lang', t.text.getComputedTextLength() > t.pfad.getTotalLength() * 0.96)) continue;
      const rs = buchstaben(t.text);
      if (rs.some((r) => belegt.some((b) => ueber(r, b)))) t.text.classList.add('verdeckt'); else belegt.push(...rs);
    }
    for (const span of wurzel.querySelectorAll('.strassenname span')) {   // gerade Straßennamen ohne Verlauf
      span.classList.remove('verdeckt');
      const r = span.getBoundingClientRect();
      if (belegt.some((b) => ueber(r, b))) span.classList.add('verdeckt'); else belegt.push(r);
    }
  };
  k.karte.on('namenverteilt', anpassen); anpassen();
}

export function positionZeigen(k, position, titel) {
  if (k.ich) k.karte.removeLayer(k.ich);
  k.ich = null;
  if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) return;
  k.ich = L.marker(ll(position.x, position.y), {
    icon: L.divIcon({ className: '', html: '<div class="ich"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }),
    title: titel, interactive: false, keyboard: false, zIndexOffset: 400
  }).addTo(k.karte);
}

export function popupZeigen(k, latlng, inhalt) { return L.popup({ maxWidth: 300, minWidth: 230 }).setLatLng(latlng).setContent(inhalt).openOn(k.karte); }
export function hinfliegen(k, p, zoom = 0.5) { k.karte.flyTo(ll(p.x, p.y), Math.max(k.karte.getZoom(), zoom), { duration: 0.6 }); }
export function ganzeKarte(k) { k.karte.fitBounds(k.grenzen, { padding: [8, 8] }); }

// Suchtreffer anfliegen: Pins öffnen ihr Fenster, Ortsnamen bekommen kurz einen leuchtenden Ring
export function pinOeffnen(k, id) {
  const m = k.nachId.get(id);
  if (!m) return false;
  k.karte.once('moveend', () => m.openPopup());
  k.karte.flyTo(m.getLatLng(), Math.max(k.karte.getZoom(), 0.5), { duration: 0.6 });
  return true;
}
export function stelleMarkieren(k, p, zoom) {
  if (k.markierung) k.karte.removeLayer(k.markierung);
  k.markierung = L.marker(ll(p.x, p.y), { interactive: false, keyboard: false, zIndexOffset: 300, icon: L.divIcon({ className: '', html: '<div class="such-ring"></div>', iconSize: [44, 44], iconAnchor: [22, 22] }) }).addTo(k.karte);
  const weg = k.markierung; setTimeout(() => { if (k.markierung === weg) { k.karte.removeLayer(weg); k.markierung = null; } }, 6000);
  k.karte.flyTo(ll(p.x, p.y), zoom, { duration: 0.6 });
  return ll(p.x, p.y);
}
