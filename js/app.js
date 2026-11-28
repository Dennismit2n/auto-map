import { ladeDaten, versteckVon } from './daten.js';
import {
  neuesProfil, umschalten, istGefunden, setzeZaehler, zeileStand, checklisteStand, istVerborgen, missionsName, kapitelStand, sichtbareHinweise,
  passtZumFilter, zaehlen, zaehlenJeCounty, naechstesOffenes, neuerPin, exportieren, einlesen, importieren, pinsZusammenfuehren,
  pinsNeuheiten, pinsVerpacken, pinsAuspacken, nachschlagenSicht, nachschlagenStand
} from './fortschritt.js';
import { planquadrat, entfernungText, countyVon, innerhalb } from './geo.js';
import * as speicher from './speicher.js';
import { alleProvider } from './provider.js';
import { t, feld, zahl, sprache, setzeSprache, uebersetzeSeite, sprachen, pinArten, FEHLER_EN } from './i18n.js';
import { karteAnlegen, strassenZeichnen, pinsZeichnen, punkteZeichnen, punktOeffnen, positionZeigen, popupZeigen, hinfliegen, ganzeKarte, pinOeffnen, stelleMarkieren, markierungWeg, ausschnittZeigen } from './karte.js';
import { suchen, gruppieren } from './suche.js';
import { FZ_BEREICHE, fahrzeugListe, fahrzeugKlassen, kapitelText } from './fahrzeuge.js';
import { ARTWORTE, KATWORTE, BEREICHWORTE, VERSTECKWORTE } from './suchworte.js';
import { ARTEN, ART_GRUPPEN, ARTEN_ZU, artenVon, artenAus, artMit, artFarbe, zeichenSvg } from './arten.js';
import * as sehhilfe from './sehhilfe.js';

const $ = (sel) => document.querySelector(sel);
// Wer im System „Bewegung reduzieren“ gewählt hat, bekommt kein weiches Rollen (die Karte springt dann ebenfalls, js/karte.js)
const ROLLEN = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
function el(tag, attrs = {}, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style') e.style.cssText = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kind of kinder.flat()) if (kind != null && kind !== false) e.append(kind);
  return e;
}
const knopf = (text, onclick, klasse = 'knopf', extra = {}) => el('button', { type: 'button', class: klasse, text, onclick, ...extra });
// Knöpfe in Karten-Popups: erst nach dem Klick handeln. Verschwindet der Knopf noch während des Klicks aus dem
// Dokument, hält Leaflet den Klick für einen Klick auf die Karte und öffnet das Positionsmenü.
const popupKnopf = (text, onclick, klasse) => knopf(text, () => setTimeout(onclick, 0), klasse);

const zustand = {
  daten: null, profile: [], aktivId: null, pins: [], position: null, spoilerfrei: true, tab: 'karte',
  filter: { countys: new Set(), kategorien: new Set(), arten: new Set(), versteck: false }, offeneKapitel: null, offeneZeile: null,
  setzmodus: false, nachBereich: 'herausforderungen', nachOffen: new Set(), nachMarkiert: null,
  artOffen: null,      // aufgeklappte Gruppen der Arten im Filter
  fz: { bereich: 'alle', klasse: '', sortierung: 'name' },   // Bereich Fahrzeuge in Nachschlagen
  radioOffen: new Set(),
  gesucht: new Set()   // IDs der Orte, die die Suche zuletzt gezeigt hat: bleiben sichtbar, auch wenn ein Filter sie ausblendet
};
let k;
const aktiv = () => zustand.profile.find((p) => p.id === zustand.aktivId);
// Kapitel, in dem der gewählte Durchgang steht; Spoilerfrei verbirgt alles danach
const stand = () => kapitelStand(aktiv(), zustand.daten.missionen);
const kategorie = (id) => zustand.daten.orte.kategorien.find((x) => x.id === id);
const county = (id) => zustand.daten.karte.countys.find((c) => c.id === id);
const pinArt = (id) => pinArten.find((a) => a.id === id) ?? pinArten.at(-1);
// Einträge der Unterlisten: Eigennamen haben nur name, übersetzbare zusätzlich name_en
const unterName = (u) => (sprache === 'en' && u.name_en ? u.name_en : u.name);
// Piktogramm einer Art als Element (für Knöpfe und Legende) und als fertiges Bild für die Leinwand der Karte
const DUNKEL = 'var(--vc-grund-nacht)';
const zeichenEl = (artId, groesse = 20) => { const s = el('span', { class: 'zeichen', 'aria-hidden': 'true' }); s.innerHTML = zeichenSvg(artId, `var(${artFarbe(artId)})`, DUNKEL, groesse); return s; };
const zeichenBild = new Map();
async function zeichenLaden() {
  const stil = getComputedStyle($('#karte')); const dunkel = stil.getPropertyValue('--vc-grund-nacht').trim();
  await Promise.all(ARTEN.map((a) => {
    const bild = new Image();
    bild.src = `data:image/svg+xml,${encodeURIComponent(zeichenSvg(a.id, stil.getPropertyValue(artFarbe(a.id)).trim(), dunkel, 96))}`;
    zeichenBild.set(a.id, bild);
    return bild.decode().catch(() => {});       // ohne Bild bleibt der Ort ein Punkt
  }));
}

// Alle Pins, die gerade sichtbar sein dürfen: feste Orte (ohne Verborgenes) und eigene Pins.
// Community-Orte (gtadb, Mapheist) ohne das, was der Spoiler-Schalter verbirgt
// Läden ohne eigenen Namen heißen nach ihrer Art, in der Sprache der Oberfläche
function sichtbareCommunity() {
  const st = stand();
  return zustand.daten.community.filter((o) => !istVerborgen(o, kategorie(o.kat), zustand.spoilerfrei, st))
    .map((o) => ({
      ...o, ...(o.namenlos ? { name: artText(o.art.slice(0, 1)) } : {}), versteck: versteckVon(o), artIds: artenVon(o),
      ...(o.kat === 'g-parkhaus' ? { schild: kategorie(o.kat).zeichen, titel: `${o.name}, ${lageText(o)}` } : {})
    }));
}

function sichtbarePins() {
  const { orte } = zustand.daten; const st = stand();
  const fest = orte.orte.filter((o) => !istVerborgen(o, kategorie(o.kat), zustand.spoilerfrei, st))
    .map((o) => ({ ...o, ...(sprache === 'en' && o.name_en ? { name: o.name_en } : {}), versteck: versteckVon(o), artIds: artenVon(o) }));
  const eigene = zustand.pins.filter((p) => !p.geloescht).map((p) => ({ ...p, name: p.name || pinArt(p.art)[sprache], versteck: p.art === 'versteck' ? 'eigen' : null }));
  return [...fest, ...eigene];
}

async function profilSichern(p) {
  zustand.profile = zustand.profile.map((x) => (x.id === p.id ? p : x));
  await speicher.profilSpeichern(p);
}

// ---------- Start ----------
async function start() {
  setzeSprache((await speicher.einstellungLesen('sprache').catch(() => null)) || sprache);
  uebersetzeSeite();
  zustand.daten = await ladeDaten();
  zustand.profile = await speicher.alleProfile();
  if (!zustand.profile.length) {
    const p = neuesProfil(t('erster'));
    await speicher.profilSpeichern(p);
    zustand.profile = [p];
  }
  zustand.aktivId = (await speicher.einstellungLesen('aktivesProfil')) || zustand.profile[0].id;
  if (!aktiv()) zustand.aktivId = zustand.profile[0].id;
  zustand.pins = await speicher.allePins();
  const f = await speicher.einstellungLesen('filter');
  if (f) zustand.filter = { countys: new Set(f.countys || []), kategorien: new Set(f.kategorien || []), arten: new Set(f.arten || []), versteck: f.versteck === true };
  zustand.artOffen = new Set(zustand.filter.arten.size ? [...zustand.filter.arten].map((a) => artMit(a)?.gruppe) : [ART_GRUPPEN[0].id]);
  const pos = await speicher.einstellungLesen('position');
  zustand.position = pos && innerhalb(pos.x, pos.y, zustand.daten.karte) ? pos : null;
  zustand.spoilerfrei = (await speicher.einstellungLesen('spoilerfrei')) !== false;   // Standard: spoilerfrei
  zustand.tab = (await speicher.einstellungLesen('tab')) || 'karte';
  const nb = await speicher.einstellungLesen('nachBereich');
  if (nachBereiche().some((b) => b.id === nb)) zustand.nachBereich = nb;
  const fz = await speicher.einstellungLesen('fz');
  if (fz) zustand.fz = { ...zustand.fz, ...fz };

  await zeichenLaden();
  k = await karteAnlegen($('#karte'), zustand.daten.karte, { onKlick: kartenKlick });
  strassenZeichnen(k, zustand.daten.strassen.strassen);
  steuerungVerdrahten();
  allesZeichnen();
  speicherHinweis();
  geteiltePinsPruefen();
  addEventListener('hashchange', geteiltePinsPruefen);
}

// ---------- Zeichnen ----------
function allesZeichnen() {
  const fokus = document.activeElement?.dataset?.fokus;
  suchIndex = null;
  filterBereinigen();
  const p = aktiv(); const pins = sichtbarePins(); const community = sichtbareCommunity();
  const ziel = naechstesOffenes(pins, p, zustand.filter, zustand.position);
  // Was die Suche zuletzt gezeigt hat, bleibt auf der Karte, auch wenn der Filter es sonst ausblendet
  const zeigen = (x) => zustand.gesucht.has(x.id) || passtZumFilter(x, zustand.filter);
  pinsZeichnen(k, {
    profil: p, zielId: ziel?.pin.id,
    pins: pins.filter(zeigen).map((x) => {
      const art = artMit(x.artIds?.[0]);      // feste Orte mit bekannter Art tragen deren Piktogramm statt des Buchstabens
      return {
        ...x, zeichen: kategorie(x.kat).zeichen, farbe: county(x.county)?.farbe ?? '--vc-akzent-lavendel', popup: (zu) => pinPopup(x, zu),
        ...(art ? { bild: zeichenSvg(art.id, `var(${artFarbe(art.id)})`, DUNKEL, 26), artFarbe: artFarbe(art.id), leuchten: art.leuchten === true } : {})
      };
    })
  });
  punkteZeichnen(k, {
    orte: community.filter(zeigen).map((o) => ({ ...o, bild: zeichenBild.get(o.artIds[0]) })),
    farbeVon: (o) => county(o.county)?.farbe ?? '--vc-akzent-lavendel', popup: punktPopup, buendelTitel: (n) => t('buendel', { n: zahl(n) })
  });
  positionZeigen(k, zustand.position, t('meinePosition'));
  kopfZeichnen(); tabsZeichnen();
  kartenTabZeichnen(pins, ziel, community); listeZeichnen(); nachschlagenZeichnen(); missionenZeichnen(); datenZeichnen(); legendeZeichnen();
  if (fokus) document.querySelector(`[data-fokus="${CSS.escape(fokus)}"]`)?.focus();
}

// Verborgene Kategorien dürfen nicht als Filter hängen bleiben
function filterBereinigen() {
  for (const id of [...zustand.filter.kategorien]) {
    const kat = kategorie(id);
    if (!kat || (zustand.spoilerfrei && kat.spoiler)) zustand.filter.kategorien.delete(id);
  }
  for (const id of [...zustand.filter.arten]) if (!artMit(id)) zustand.filter.arten.delete(id);
}

function kopfZeichnen() {
  $('#profil-wahl').replaceChildren(...zustand.profile.map((p) => new Option(p.name, p.id, false, p.id === zustand.aktivId)));
  const st = stand();
  $('#kapitel-wahl').replaceChildren(...zustand.daten.missionen.kapitel.map((kap) => new Option(t('kapitelKurz', { n: kap.nr }), kap.nr, false, kap.nr === st)));
  const s = $('#spoiler');
  s.classList.toggle('frei', zustand.spoilerfrei);
  s.title = t(zustand.spoilerfrei ? 'spoilerTitelFrei' : 'spoilerTitelAn', { n: st });
  s.replaceChildren(el('span', { class: 'spoiler-zeichen', 'aria-hidden': 'true', text: zustand.spoilerfrei ? '✓' : '!' }), el('span', { text: t(zustand.spoilerfrei ? 'spoilerfrei' : 'spoilerAn') }));
}

function tabsZeichnen() {
  for (const b of document.querySelectorAll('[role="tab"]')) {
    const an = b.dataset.tab === zustand.tab;
    b.setAttribute('aria-selected', String(an)); b.tabIndex = an ? 0 : -1;
    $(`#tab-${b.dataset.tab}`).hidden = !an;
  }
}

function gurt(zahlText, anteil, unterText) {
  return el('div', {},
    el('div', { class: 'gurt' }, el('span', { class: 'zahl', text: zahlText }), el('span', { class: 'balken' }, el('i', { style: `width:${Math.max(0, Math.min(100, anteil * 100))}%` }))),
    unterText ? el('p', { class: 'leise-text', text: unterText }) : null);
}

function missionsStand(p) {
  let gesamt = 0; let fertig = 0;
  // optionale Missionen zählen nicht mit (95 Pflichtmissionen), abhaken lassen sie sich trotzdem
  for (const kap of zustand.daten.missionen.kapitel) for (const m of kap.missionen) { if (m.optional) continue; gesamt++; if (istGefunden(p, m.id)) fertig++; }
  return { gesamt, fertig };
}

function chip({ text, an, farbe, art, anzahl, onKlick, fokus }) {
  return el('button', { type: 'button', class: `chip${farbe ? ' county-chip' : ''}${art ? ' art-chip' : ''}`, 'aria-pressed': String(an), style: farbe || art ? `--ort:var(${farbe ?? artFarbe(art)})` : null, onclick: onKlick, 'data-fokus': fokus },
    farbe ? el('span', { class: 'farbe', 'aria-hidden': 'true' }) : null, art ? zeichenEl(art) : null, el('span', { class: 'name', text }), anzahl ? el('span', { class: 'anzahl', text: anzahl }) : null);
}

async function filterGeaendert() {
  await speicher.einstellungSchreiben('filter', { countys: [...zustand.filter.countys], kategorien: [...zustand.filter.kategorien], arten: [...zustand.filter.arten], versteck: zustand.filter.versteck });
  allesZeichnen();
}
const wechsel = (menge, id) => { if (menge.has(id)) menge.delete(id); else menge.add(id); filterGeaendert(); };
const filterLeeren = () => { zustand.filter.countys.clear(); zustand.filter.kategorien.clear(); zustand.filter.arten.clear(); zustand.filter.versteck = false; };

function kartenTabZeichnen(pins, ziel, community) {
  const p = aktiv(); const { karte, orte, checkliste } = zustand.daten; const f = zustand.filter;
  const z = zaehlen(pins, p, f); const cl = checklisteStand(checkliste, p); const ms = missionsStand(p);
  $('#uebersicht').replaceChildren(
    gurt(`${z.gefunden} / ${z.gesamt}`, z.gesamt ? z.gefunden / z.gesamt : 0, t('orte')),
    gurt(`${cl.erfuellt} / ${cl.gesamt}`, cl.prozent / 100, t('zeilen')),
    gurt(`${ms.fertig} / ${ms.gesamt}`, ms.gesamt ? ms.fertig / ms.gesamt : 0, t('missionen')));

  const je = zaehlenJeCounty(pins.filter((x) => passtZumFilter(x, { kategorien: f.kategorien, arten: f.arten, versteck: f.versteck })), p);
  $('#county-chips').replaceChildren(...karte.countys.map((c) => chip({
    text: c.name, an: f.countys.has(c.id), farbe: c.farbe, fokus: `county-${c.id}`,
    anzahl: `${je[c.id]?.gefunden ?? 0}/${je[c.id]?.gesamt ?? 0}`, onKlick: () => wechsel(f.countys, c.id)
  })));
  $('#kategorien-chips').replaceChildren(...orte.kategorien.filter((x) => !(zustand.spoilerfrei && x.spoiler)).map((x) => chip({
    text: `${x.zeichen} · ${feld(x, 'name')}`, an: f.kategorien.has(x.id), fokus: `kat-${x.id}`, onKlick: () => wechsel(f.kategorien, x.id)
  })), chip({ text: t('versteckChip'), an: f.versteck, fokus: 'kat-versteck', onKlick: () => { f.versteck = !f.versteck; filterGeaendert(); } }));
  // Arten: je Gruppe aufklappbar, jede Art mit ihrem Piktogramm und der Zahl ihrer Orte (im gewählten County)
  const jeArt = new Map();
  for (const o of [...pins, ...community]) if (!f.countys.size || f.countys.has(o.county)) for (const a of o.artIds ?? []) jeArt.set(a, (jeArt.get(a) ?? 0) + 1);
  $('#arten-chips').replaceChildren(...ART_GRUPPEN.map((g) => {
    const arten = ARTEN.filter((a) => a.gruppe === g.id && (jeArt.get(a.id) || f.arten.has(a.id)));
    if (!arten.length) return null;
    const an = arten.filter((a) => f.arten.has(a.id)).length;
    return el('details', { class: 'art-gruppe', open: zustand.artOffen.has(g.id), ontoggle: (ev) => { if (ev.target.open) zustand.artOffen.add(g.id); else zustand.artOffen.delete(g.id); } },
      el('summary', { 'data-fokus': `artgruppe-${g.id}` }, el('span', { class: 'art-gruppen-name', style: `--ort:var(${g.farbe})`, text: feld(g, 'name') }), el('span', { class: 'zahl', text: an ? t('artenAn', { n: zahl(an), m: zahl(arten.length) }) : zahl(arten.length) })),
      el('div', { class: 'chips' }, arten.map((a) => chip({ text: feld(a, 'name'), an: f.arten.has(a.id), art: a.id, anzahl: zahl(jeArt.get(a.id) ?? 0), fokus: `art-${a.id}`, onKlick: () => wechsel(f.arten, a.id) }))));
  }).filter(Boolean));
  $('#filter-alle').hidden = !f.countys.size && !f.kategorien.size && !f.arten.size && !f.versteck;

  const box = $('#ziel-inhalt'); box.replaceChildren();
  if (!ziel) { box.append(el('p', { class: 'leise-text', text: t('zielLeer') })); return; }
  const pin = ziel.pin;
  box.append(el('p', { class: 'ziel-name', text: pin.name }),
    el('p', { class: 'leise-text', text: `${county(pin.county)?.name ?? t('ohneCounty')} · ${t('planquadrat')} ${planquadrat(pin.x, pin.y, karte.gitter)}` }),
    ziel.abstand != null
      ? el('p', { class: 'ziel-abstand', text: `${entfernungText(ziel.abstand, karte.meter_je_einheit, sprache)} (${t('luftlinie')})` })
      : el('p', { class: 'leise-text', text: t('zielOhnePosition') }),
    el('div', { class: 'reihe' }, knopf(t('zielZeigen'), () => hinfliegen(k, pin), 'knopf', { 'data-fokus': 'ziel-zeigen' }), knopf(t('abhaken'), () => abhaken(pin.id), 'knopf leise', { 'data-fokus': 'ziel-haken' })));
}

// ---------- 100-%-Liste ----------
function listeZeichnen() {
  const p = aktiv(); const { checkliste } = zustand.daten; const cl = checklisteStand(checkliste, p);
  const teile = [gurt(`${cl.erfuellt} / ${cl.gesamt}`, cl.prozent / 100, `${t('zeilen')}: ${cl.erfuellt} ${t('erfuellt')}`)];
  for (const g of checkliste.gruppen) {
    teile.push(el('h3', { class: 'unterkopf', text: feld(g, 'name') }));
    for (const z of g.zeilen) teile.push(zeileZeichnen(z, p));
  }
  teile.push(el('p', { class: 'leise-text', text: feld(checkliste, 'hinweis') }));
  $('#liste-inhalt').replaceChildren(...teile);
}

function zeileZeichnen(z, p) {
  const s = zeileStand(z, p); const geld = z.art === 'geld';
  const sicht = sichtbareHinweise(z, zustand.spoilerfrei, stand());
  const hinweis = [...sicht.teile.map((h) => h[sprache] ?? h.de), sicht.spaeter ? t('zeileSpaeter', { n: sicht.spaeter }) : null].filter(Boolean).join(' ');
  const unter = sicht.unterliste.length
    ? el('details', { class: 'unterliste', open: zustand.offeneZeile === z.id, ontoggle: (e) => { if (e.target.open) zustand.offeneZeile = z.id; else if (zustand.offeneZeile === z.id) zustand.offeneZeile = null; } },
      el('summary', { text: t('unterliste', { n: zahl(sicht.unterliste.length) }) }),
      el('ul', {}, sicht.unterliste.map((u) => el('li', {}, el('span', { class: 'treffer-name', text: u.anzahl != null ? `${unterName(u)} (${zahl(u.anzahl)})` : unterName(u) }), feld(u, 'info') ? el('span', { class: 'leise-text', text: ` ${feld(u, 'info')}` }) : null))))
    : null;
  const setzen = async (wert) => { await profilSichern(setzeZaehler(aktiv(), z.id, wert, Date.now(), geld ? 99999999 : (z.vorhanden ?? 9999))); allesZeichnen(); };
  let bedienung;
  if (z.art === 'haken') {
    bedienung = knopf(s.erfuellt ? `✓ ${t('erledigt')}` : t('abhaken'), () => abhaken(z.id), s.erfuellt ? 'knopf leise' : 'knopf', { 'aria-pressed': String(s.erfuellt), 'data-fokus': `z-${z.id}` });
  } else {
    const schritt = geld ? 5000 : 1;
    bedienung = el('div', { class: 'stepper' },
      knopf('−', () => setzen(s.wert - schritt), 'knopf leise rund', { 'aria-label': `${feld(z, 'name')}: ${t('weniger')}`, 'data-fokus': `z-${z.id}-minus` }),
      el('input', { type: 'number', min: '0', inputmode: 'numeric', value: String(s.wert), 'aria-label': `${feld(z, 'name')}: ${t('stand')}`, 'data-fokus': `z-${z.id}-feld`, onchange: (e) => setzen(e.target.value) }),
      knopf('+', () => setzen(s.wert + schritt), 'knopf rund', { 'aria-label': `${feld(z, 'name')}: ${t('mehr')}`, 'data-fokus': `z-${z.id}-plus` }));
  }
  const ziel = geld ? `${zahl(s.wert)} / ${zahl(z.noetig)} $` : z.art === 'haken' ? (s.erfuellt ? t('erledigt') : t('offen')) : `${zahl(s.wert)} / ${zahl(z.noetig)}`;
  const zusatz = z.vorhanden != null && z.vorhanden !== z.noetig ? ` (${zahl(z.vorhanden)} ${t('imSpiel')})` : '';
  return el('div', { class: `zeile${s.erfuellt ? ' erfuellt' : ''}`, 'data-zeile': z.id },
    el('div', { class: 'zeile-kopf' }, el('span', { class: 'zeile-name', text: `${s.erfuellt ? '✓ ' : ''}${feld(z, 'name')}` }), el('span', { class: 'zeile-zahl', text: ziel + zusatz })),
    hinweis ? el('p', { class: 'leise-text', text: hinweis }) : null, unter, aufKarteKnopf(ARTEN_ZU[z.id]), bedienung);
}

// ---------- Nachschlagen ----------
// Bereiche wie im Ingame-Menü Fortschritt (Ausrüstung, Sammlung, Aktivitäten, Herausforderungen), dazu Fluchtwissen.
// Abhaken je Durchgang; Spoilerfrei verbirgt Einträge, die erst nach dem eigenen Kapitel kommen.
// Fahrzeuge und Radio sind eigene Bereiche ohne Haken; ihre Daten stehen in data/fahrzeuge.json und data/radio.json
const ZUSATZ_BEREICHE = [{ id: 'fahrzeuge', name_de: 'Fahrzeuge', name_en: 'Vehicles' }, { id: 'radio', name_de: 'Radio', name_en: 'Radio' }];
const nachBereiche = () => [...zustand.daten.nachschlagen.bereiche, ...ZUSATZ_BEREICHE];
function nachschlagenZeichnen() {
  const n = zustand.daten.nachschlagen; const p = aktiv(); const st = stand();
  const bereich = nachBereiche().find((b) => b.id === zustand.nachBereich) ?? n.bereiche[0];
  const zusatzZahl = { fahrzeuge: sichtbareFahrzeuge().length, radio: zustand.daten.radio.sender.length };
  $('#nach-bereiche').replaceChildren(...nachBereiche().map((b) => {
    const s = nachschlagenStand(n, b.id, p);
    const anzahl = s.gesamt ? `${s.fertig}/${s.gesamt}` : zusatzZahl[b.id] ? zahl(zusatzZahl[b.id]) : null;
    return chip({ text: feld(b, 'name'), an: b.id === bereich.id, anzahl, fokus: `nach-${b.id}`, onKlick: () => bereichZeigen(b.id) });
  }));
  if (bereich.id === 'fahrzeuge') { $('#nach-inhalt').replaceChildren(...fahrzeugeTeile()); return; }
  if (bereich.id === 'radio') { $('#nach-inhalt').replaceChildren(...radioTeile()); return; }
  const s = nachschlagenStand(n, bereich.id, p); const sicht = nachschlagenSicht(n, bereich.id, zustand.spoilerfrei, st);
  const ohneHaken = new Set(n.gruppen.filter((g) => g.abhaken === false).map((g) => g.id));
  const abhakbar = (e) => bereich.abhaken !== false && e.abhaken !== false && !ohneHaken.has(e.gruppe);
  const zusatzKopf = bereich.id === 'ausruestung' ? t('nachBekommen') : bereich.id === 'herausforderungen' ? t('nachTipp') : null;
  const zeilenKnopf = (zid) => {
    const z = zustand.daten.checkliste.gruppen.flatMap((g) => g.zeilen).find((x) => x.id === zid);
    return z ? knopf(t('nachZeile', { name: feld(z, 'name') }), () => zeileZeigen(zid), 'knopf leise klein') : null;
  };
  const eintrag = (e) => {
    const an = istGefunden(p, e.id); const name = unterName(e);
    const kopf = abhakbar(e)
      ? el('label', { class: an ? 'fertig' : null },
        el('input', { type: 'checkbox', checked: an, 'data-fokus': `n-${e.id}`, onchange: () => abhaken(e.id) }),
        el('span', { class: 'eintrag-name', text: e.anzahl != null ? `${name} (${zahl(e.anzahl)})` : name }),
        e.schwer ? el('span', { class: 'schildchen', text: t('nachSchwer') }) : null)
      : el('p', { class: 'eintrag-name', text: name });
    const zusatz = feld(e, 'zusatz');
    return el('li', { class: `eintrag${abhakbar(e) ? '' : ' ohne-haken'}${zustand.nachMarkiert === e.id ? ' gefunden' : ''}`, 'data-eintrag': e.id },
      kopf,
      el('p', { class: 'leise-text einzug', text: feld(e, 'text') }),
      zusatz ? el('p', { class: 'leise-text einzug' }, zusatzKopf ? el('strong', { text: `${zusatzKopf}: ` }) : null, zusatz) : null,
      !zustand.spoilerfrei && feld(e, 'spoiler') ? el('p', { class: 'leise-text einzug', text: feld(e, 'spoiler') }) : null,
      e.zeile && !n.gruppen.find((g) => g.id === e.gruppe)?.zeile ? el('div', { class: 'einzug' }, zeilenKnopf(e.zeile)) : null,
      ARTEN_ZU[e.id] ? el('div', { class: 'einzug' }, aufKarteKnopf(ARTEN_ZU[e.id])) : null);
  };
  const teile = [];
  if (s.gesamt) teile.push(gurt(`${s.fertig} / ${s.gesamt}`, s.fertig / s.gesamt, bereich.noetig ? t('nachNoetig', { n: zahl(bereich.noetig) }) : null));
  teile.push(el('p', { class: 'leise-text', text: feld(bereich, 'text') }));
  const gruppen = n.gruppen.filter((g) => g.bereich === bereich.id);
  for (const g of gruppen) {
    const eigene = sicht.sichtbar.filter((e) => e.gruppe === g.id);
    const zaehlbar = eigene.filter(abhakbar); const fertig = zaehlbar.filter((e) => istGefunden(p, e.id)).length;
    if (!eigene.length && !feld(g, 'text')) continue;
    teile.push(el('details', { class: 'kapitel', open: zustand.nachOffen.has(g.id), ontoggle: (ev) => { if (ev.target.open) zustand.nachOffen.add(g.id); else zustand.nachOffen.delete(g.id); } },
      el('summary', {}, el('span', { class: 'kapitel-name', text: feld(g, 'name') }), el('span', { class: 'zahl', text: zaehlbar.length ? `${fertig} / ${zaehlbar.length}` : zahl(eigene.length) })),
      feld(g, 'text') ? el('p', { class: 'leise-text', text: feld(g, 'text') }) : null,
      g.zeile ? zeilenKnopf(g.zeile) : null,
      el('ul', { class: 'missionen eintraege' }, eigene.map(eintrag))));
  }
  const lose = sicht.sichtbar.filter((e) => e.gruppe == null);
  if (lose.length) teile.push(el('ul', { class: 'missionen eintraege' }, lose.map(eintrag)));
  if (sicht.verborgen) teile.push(el('p', { class: 'leise-text', text: t('nachSpaeter', { n: zahl(sicht.verborgen), k: sicht.spaeter ?? '?' }) }));
  teile.push(el('p', { class: 'leise-text', text: t('nachStand', { stand: datum(n.stand) }) }));
  $('#nach-inhalt').replaceChildren(...teile);
}

async function bereichZeigen(id) {
  zustand.nachBereich = id; zustand.nachMarkiert = null;
  await speicher.einstellungSchreiben('nachBereich', id); allesZeichnen();
}

// ---------- Fahrzeuge ----------
// Klassen heißen im Spiel englisch; die deutsche Fassung des Spiels nennt sie so (fehlt eine, bleibt der englische Name)
const KLASSE_DE = {
  Super: 'Supersportwagen', Sports: 'Sportwagen', 'Sports Classics': 'Sportklassiker', Muscle: 'Muscle-Cars', Coupes: 'Coupés', Sedans: 'Limousinen',
  SUVs: 'SUVs', Compacts: 'Kompaktwagen', 'Off-Road': 'Geländewagen', Motorcycles: 'Motorräder', Cycles: 'Fahrräder', Vans: 'Transporter',
  Utility: 'Nutzfahrzeuge', Industrial: 'Industriefahrzeuge', Commercial: 'Gewerbliche Fahrzeuge', Service: 'Dienstfahrzeuge', Emergency: 'Einsatzfahrzeuge',
  Military: 'Militär', Boats: 'Boote', Planes: 'Flugzeuge', Helicopters: 'Hubschrauber', Trains: 'Züge', Lowriders: 'Lowrider'
};
const klasseName = (k) => (sprache === 'de' ? KLASSE_DE[k] ?? k : k) || '?';
const fzNameKurz = (f) => (sprache === 'en' && f.name_en ? f.name_en : f.name);
const fzName = (f) => (f.hersteller ? `${f.hersteller} ${fzNameKurz(f)}` : fzNameKurz(f));
const sichtbareFahrzeuge = () => zustand.daten.fahrzeuge.fahrzeuge.filter((f) => !(zustand.spoilerfrei && f.geheim));
// Tempo in beiden Einheiten, die gewohnte zuerst
function tempoTeile(f) {
  if (f.vmax_kmh == null && f.vmax_mph == null) return ['?', null];
  const kmh = `${zahl(f.vmax_kmh)} km/h`; const mph = `${zahl(f.vmax_mph)} mph`;
  return sprache === 'en' ? [mph, kmh] : [kmh, mph];
}
const hoeheTeile = (f) => (f.hoehe_max_m == null ? ['?', null] : [`${zahl(f.hoehe_max_m)} m`, `${zahl(Math.round(f.hoehe_max_m * 3.28084))} ft`]);
// Spielwerte immer mit einer Nachkommastelle wie im Spiel (6,0 statt 6)
const wert1 = (v) => Number(v).toLocaleString(sprache === 'de' ? 'de-DE' : 'en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const zahlZelle = ([haupt, neben]) => el('td', { class: 'zahlspalte' }, el('span', { text: haupt }), neben ? el('span', { class: 'treffer-zusatz', text: neben }) : null);

function fahrzeugeTeile() {
  const d = { ...zustand.daten.fahrzeuge, fahrzeuge: sichtbareFahrzeuge() }; const fz = zustand.fz;
  const setze = async (neu) => {
    const fokus = document.activeElement?.dataset?.fokus;
    Object.assign(zustand.fz, neu); await speicher.einstellungSchreiben('fz', { ...zustand.fz }); nachschlagenZeichnen();
    if (fokus) document.querySelector(`[data-fokus="${CSS.escape(fokus)}"]`)?.focus();
  };
  const klassen = fahrzeugKlassen(d.fahrzeuge, fz.bereich);
  if (fz.klasse && !klassen.some((x) => x.klasse === fz.klasse)) fz.klasse = '';
  // Spalten und Sortierungen nur, wo es Werte gibt: Spielwerte haben bisher nur Landfahrzeuge, km/h und Flughöhe noch keines
  const imBereich = d.fahrzeuge.filter((f) => fz.bereich === 'alle' || f.bereich === fz.bereich);
  const mitWerten = imBereich.some((f) => f.werte?.tempo != null);
  const mitVmax = imBereich.some((f) => f.vmax_kmh != null);
  const mitHoehe = imBereich.some((f) => f.hoehe_max_m != null);
  const sortierungen = ['name', 'hersteller', ...(mitWerten ? ['tempo', 'beschleunigung', 'handling', 'offroad'] : []), ...(mitVmax ? ['vmax'] : []), ...(mitHoehe ? ['hoehe'] : [])];
  if (!sortierungen.includes(fz.sortierung)) fz.sortierung = 'name';
  const liste = fahrzeugListe(d.fahrzeuge, fz);
  const wertZelle = (v) => el('td', { class: 'zahlspalte' }, v == null ? '?' : el('span', { class: 'fz-wert', style: `--anteil:${v * 10}%`, text: wert1(v) }));
  const option = (text, wert, an) => { const o = new Option(text, wert); o.selected = an; return o; };
  const bereiche = el('div', { class: 'chips', role: 'group', 'aria-label': t('fzBereich') },
    chip({ text: t('fzAlle'), an: fz.bereich === 'alle', anzahl: zahl(d.fahrzeuge.length), fokus: 'fz-alle', onKlick: () => setze({ bereich: 'alle', klasse: '' }) }),
    ...FZ_BEREICHE.map((b) => chip({ text: t('fz_' + b), an: fz.bereich === b, anzahl: zahl(d.fahrzeuge.filter((f) => f.bereich === b).length), fokus: `fz-${b}`, onKlick: () => setze({ bereich: b, klasse: '' }) })));
  const wahl = el('div', { class: 'reihe fz-wahl' },
    el('label', {}, el('span', { class: 'unterkopf', text: t('fzKlasse') }),
      el('select', { 'data-fokus': 'fz-klasse', onchange: (e) => setze({ klasse: e.target.value }) },
        option(t('fzAlleKlassen'), '', !fz.klasse), ...klassen.map((x) => option(`${klasseName(x.klasse)} (${zahl(x.anzahl)})`, x.klasse, x.klasse === fz.klasse)))),
    el('label', {}, el('span', { class: 'unterkopf', text: t('fzSortierung') }),
      el('select', { 'data-fokus': 'fz-sort', onchange: (e) => setze({ sortierung: e.target.value }) }, ...sortierungen.map((s) => option(t('fzSort_' + s), s, s === fz.sortierung)))));
  const kopfZelle = (text, klasse) => el('th', { scope: 'col', class: klasse, text });
  const tabelle = el('div', { class: 'fz-rahmen' }, el('table', { class: 'fz-tabelle' },
    el('thead', {}, el('tr', {}, kopfZelle(t('fzName')), kopfZelle(t('fzKlasse'), 'fz-klasse'),
      mitWerten ? kopfZelle(t('fzWert_tempo'), 'zahlspalte') : null, mitWerten ? kopfZelle(t('fzWertKurz_beschleunigung'), 'zahlspalte fz-neben') : null,
      mitVmax ? kopfZelle(t('fzTempo'), 'zahlspalte') : null, mitHoehe ? kopfZelle(t('fzHoehe'), 'zahlspalte') : null, kopfZelle(t('fzSitze'), 'zahlspalte fz-sitze'))),
    el('tbody', {}, liste.map((f) => el('tr', {},
      el('td', {}, el('button', { type: 'button', class: 'fz-name', 'data-fokus': `fz-${f.id}`, onclick: () => fahrzeugZeigen(f) },
        el('span', { class: 'treffer-name', text: fzNameKurz(f) }), el('span', { class: 'treffer-zusatz', text: [f.hersteller, f.standout ? t('fzStandout') : null].filter(Boolean).join(' · ') || ' ' }))),
      el('td', { class: 'fz-klasse', text: klasseName(f.klasse) }),
      mitWerten ? wertZelle(f.werte?.tempo) : null,
      mitWerten ? el('td', { class: 'zahlspalte fz-neben', text: f.werte?.beschleunigung != null ? wert1(f.werte.beschleunigung) : '?' }) : null,
      mitVmax ? zahlZelle(tempoTeile(f)) : null,
      mitHoehe ? zahlZelle(hoeheTeile(f)) : null,
      el('td', { class: 'zahlspalte fz-sitze', text: f.sitze ?? '?' }))))));
  return [
    el('p', { class: 'leise-text', text: t('fzEinleitung', { n: zahl(d.fahrzeuge.length) }) }),
    el('p', { class: 'leise-text', text: t('fzOhneKmh') }),
    bereiche, wahl,
    el('p', { class: 'leise-text', text: t('fzZahl', { n: zahl(liste.length) }) }),
    tabelle,
    feld(d, 'hinweise') ? el('p', { class: 'leise-text', text: feld(d, 'hinweise') }) : null,
    el('p', { class: 'leise-text quelle' }, t('fzQuellen', { stand: datum(d.stand) }) + ' ',
      quellenLink(t('fzWikiAutoren'), 'https://gta.wiki/w/Vehicles_in_GTA_VI'), ' (', quellenLink('CC BY-NC-SA 3.0', 'https://creativecommons.org/licenses/by-nc-sa/3.0/'), '). ' + t('fzLizenz'))
  ].filter(Boolean);
}

function fahrzeugZeigen(f) {
  const d = zustand.daten.fahrzeuge;
  const erhalt = kapitelText(f, 'erhalt', sprache, zustand.spoilerfrei, stand());
  const besonderheit = kapitelText(f, 'besonderheit', sprache, zustand.spoilerfrei, stand()).text;
  const zeile = (name, wert) => (wert == null || wert === '' ? null : el('div', { class: 'fz-zeile' }, el('dt', { text: name }), el('dd', { text: wert })));
  const [tHaupt, tNeben] = tempoTeile(f); const [hHaupt, hNeben] = hoeheTeile(f);
  const werte = Object.entries(f.werte ?? {}).filter(([, v]) => v != null);
  const quellen = (f.quellen ?? []).map((id) => d.quellen.find((q) => q.id === id)).filter(Boolean);
  fensterZeigen(
    el('h2', { id: 'fenster-titel', text: fzName(f) }),
    el('p', { class: 'leise-text', text: [t('fz_' + f.bereich), klasseName(f.klasse), f.standout ? t('fzStandout') : null].filter(Boolean).join(' · ') }),
    el('dl', { class: 'fz-daten' },
      zeile(t('fzTempo'), f.vmax_kmh == null && f.vmax_mph == null ? t('fzNichtGemessen') : `${tHaupt} (${tNeben})${f.vmax_art ? ` · ${t('fzArt_' + f.vmax_art)}` : ''}`),
      f.bereich === 'luft' ? zeile(t('fzHoehe'), f.hoehe_max_m == null ? t('fzHoeheUnbekannt') : `${hHaupt} (${hNeben})`) : null,
      zeile(t('fzVorbild'), f.vorbild),
      zeile(t('fzSitze'), f.sitze != null ? zahl(f.sitze) : null),
      zeile(t('fzAntrieb'), f.antrieb),
      zeile(t('fzBewaffnet'), f.bewaffnet == null ? null : t(f.bewaffnet ? 'ja' : 'nein')),
      zeile(t('fzErhalt'), erhalt.text ?? (erhalt.ab ? t('fzErhaltSpaeter', { n: erhalt.ab }) : null)),
      zeile(t('fzSicherheit'), f.sicherheit ? t('sicher_' + f.sicherheit) : null)),
    werte.length ? el('div', { class: 'fz-werte' }, el('h3', { class: 'unterkopf', text: t('fzWerte') }), ...werte.map(([k, v]) => gurt(`${t('fzWert_' + k)} ${wert1(v)}`, v / 10)),
      f.wertung ? el('p', { class: 'leise-text', text: t('fzWertung', { s: f.wertung.strasse ?? '?', o: f.wertung.offroad ?? '?' }) }) : null) : null,
    besonderheit ? el('p', { text: besonderheit }) : null,
    quellen.length ? el('p', { class: 'leise-text quelle' }, t('quellenKurz') + ': ', ...quellen.flatMap((q, i) => [i ? ', ' : '', quellenLink(q.titel, q.url)])) : null);
}

// ---------- Radio ----------
function radioTeile() {
  const { radio } = zustand.daten;
  const titelZahl = radio.sender.reduce((n, s) => n + s.titel.length, 0);
  return [
    el('p', { class: 'leise-text' }, t('radioHinweis', { n: zahl(radio.sender.length), m: zahl(titelZahl) }) + ' ',
      quellenLink('Rockstar Games', radio.link), ', ' + t('radioAbgleich', { stand: datum(radio.stand) })),
    feld(radio, 'hinweise') ? el('details', { class: 'unterliste' }, el('summary', { text: t('radioMehr') }), el('p', { class: 'leise-text', text: feld(radio, 'hinweise') })) : null,
    ...radio.sender.map((s) => el('details', { class: 'kapitel radio-sender', open: zustand.radioOffen.has(s.id), ontoggle: (ev) => { if (ev.target.open) zustand.radioOffen.add(s.id); else zustand.radioOffen.delete(s.id); } },
      el('summary', {}, el('span', { class: 'kapitel-name' }, el('span', { class: 'treffer-name', text: s.name }), el('span', { class: 'treffer-zusatz', text: ` · ${feld(s, 'genre')}` })),
        el('span', { class: 'zahl', text: s.titel.length ? zahl(s.titel.length) : 'Talk' })),
      feld(s, 'beschreibung') ? el('p', { text: feld(s, 'beschreibung') }) : null,
      el('p', { class: 'leise-text', text: `${t('radioHosts')}: ${feld(s, 'hosts')}` }),
      feld(s, 'hinweis') ? el('p', { class: 'leise-text', text: feld(s, 'hinweis') }) : null,
      s.titel.length
        ? el('ol', { class: 'radio-titel' }, s.titel.map((ti) => el('li', {}, el('span', { class: 'treffer-name', text: ti[1] }), el('span', { class: 'treffer-zusatz', text: ti[0] }))))
        : el('p', { class: 'leise-text', text: t('radioOhneTitel') })))
  ];
}

// ---------- Cheats ----------
// Fenster mit allen Cheats, nach Gruppen. Freischaltungen, die eine spätere Mission nennen, bleiben spoilerfrei verborgen.
function cheatsZeigen(markiert) {
  const c = zustand.daten.cheats; const st = stand();
  const mitCode = c.cheats.filter((x) => x.code).length;
  fensterZeigen(
    el('h2', { id: 'fenster-titel', text: 'Cheats' }),
    el('p', { class: 'leise-text', text: t('cheatsZahl', { n: zahl(c.cheats.length), m: zahl(mitCode) }) }),
    feld(c, 'eingabe') ? el('p', { text: feld(c, 'eingabe') }) : null,
    feld(c, 'regeln') ? el('p', { class: 'leise-text', text: feld(c, 'regeln') }) : null,
    ...c.gruppen.map((g) => {
      const liste = c.cheats.filter((x) => x.gruppe === g.id);
      if (!liste.length) return null;
      return el('section', { class: 'cheat-gruppe' },
        el('h3', { class: 'unterkopf', text: `${feld(g, 'name')} (${zahl(liste.length)})` }),
        el('ul', { class: 'cheat-liste' }, liste.map((x) => {
          const frei = kapitelText(x, 'freischaltung', sprache, zustand.spoilerfrei, st);
          return el('li', { class: x.id === markiert ? 'gefunden' : null, 'data-cheat': x.id },
            el('div', { class: 'cheat-kopf' }, el('span', { class: 'treffer-name', text: x.name }),
              x.code ? el('code', { class: 'cheat-code', text: x.code }) : el('span', { class: 'leise-text', text: t('cheatOhneCode') })),
            feld(x, 'wirkung') ? el('p', { text: feld(x, 'wirkung') }) : null,
            frei.text || frei.ab ? el('p', { class: 'leise-text', text: frei.text ? `${t('cheatFrei')}: ${frei.text}` : t('cheatFreiSpaeter', { n: frei.ab }) }) : null);
        })));
    }),
    el('p', { class: 'leise-text quelle' }, t('cheatsStand', { stand: datum(c.stand) }) + ' ' + t('quellenKurz') + ': ',
      ...(c.quellen ?? []).flatMap((q, i) => [i ? ', ' : '', quellenLink(q.titel, q.url)])));
  if (markiert) document.querySelector(`[data-cheat="${CSS.escape(markiert)}"]`)?.scrollIntoView({ block: 'center' });
}

// Einen Eintrag aufschlagen (aus der Suche oder aus einem Karten-Fenster): Reiter, Bereich und Gruppe öffnen, hinrollen, markieren
async function eintragZeigen(id) {
  const e = zustand.daten.nachschlagen.eintraege.find((x) => x.id === id);
  if (!e) return;
  zustand.tab = 'nachschlagen'; zustand.nachBereich = e.bereich; zustand.nachMarkiert = id;
  if (e.gruppe) zustand.nachOffen.add(e.gruppe);
  await speicher.einstellungSchreiben('tab', 'nachschlagen'); await speicher.einstellungSchreiben('nachBereich', e.bereich);
  k.karte.closePopup(); allesZeichnen();
  document.querySelector(`[data-eintrag="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'center', behavior: ROLLEN });
}

// Orte bestimmter Arten auf der Karte zeigen (aus der 100-%-Liste, dem Reiter Nachschlagen oder dem Ladenwissen):
// der Filter steht danach genau auf diesen Arten, die Karte zeigt den Ausschnitt mit allen Treffern.
const orteDerArten = (ids) => [...sichtbarePins(), ...sichtbareCommunity()].filter((o) => o.artIds?.some((a) => ids.includes(a)));
function aufKarteKnopf(ids, nachher) {
  const n = ids?.length ? orteDerArten(ids).length : 0;
  return n ? knopf(t('aufKarte', { n: zahl(n) }), () => { nachher?.(); artenZeigen(ids); }, 'knopf leise klein') : null;
}
async function artenZeigen(ids) {
  filterLeeren(); zustand.gesucht.clear(); markierungWeg(k);
  for (const id of ids) { zustand.filter.arten.add(id); zustand.artOffen.add(artMit(id).gruppe); }
  zustand.tab = 'karte'; await speicher.einstellungSchreiben('tab', 'karte');
  await filterGeaendert();
  k.karte.closePopup(); karteInsBild(); ausschnittZeigen(k, orteDerArten(ids));
}

// Zeichen der Karte in der Legende: was U, G, P und der Stern bedeuten
function legendeZeichnen() {
  const zeile = (zeichen, text, klasse = 'lz') => el('li', {}, el('b', { class: klasse, 'aria-hidden': 'true', text: zeichen }), el('span', { text }));
  const kat = (id) => kategorie(id);
  $('#legende-zeichen').replaceChildren(
    ...['safehouse', 'garage', 'ort'].map((id) => zeile(kat(id).zeichen, feld(kat(id), 'name'))),
    zeile(kat('g-parkhaus').zeichen, t('lz_parkhaus'), 'lz schild-ort'),
    zeile(kat('eigen').zeichen, t('lz_eigen'), 'lz rund'),
    el('li', {}, zeichenEl('kleidung', 18), el('span', { text: t('lz_zeichen') })),
    zeile('', t('lz_punkt'), 'lz punkt'),
    zeile('', t('lz_ich'), 'lz ichpunkt'));
}

// ---------- Missionen ----------
function missionenZeichnen() {
  const p = aktiv(); const { missionen } = zustand.daten; const ms = missionsStand(p);
  if (!zustand.offeneKapitel) {
    const erstes = missionen.kapitel.find((kap) => kap.missionen.some((m) => !istGefunden(p, m.id)));
    zustand.offeneKapitel = new Set(erstes ? [erstes.id] : []);
  }
  const texte = { mission: t('mission'), geschwaerzt: t('geschwaerzt') }; const st = stand();
  const teile = [gurt(`${ms.fertig} / ${ms.gesamt}`, ms.gesamt ? ms.fertig / ms.gesamt : 0, t('missionen'))];
  for (const kap of missionen.kapitel) {
    const verborgen = zustand.spoilerfrei && kap.nr > st;
    const fertig = kap.missionen.filter((m) => istGefunden(p, m.id)).length;
    const liste = el('ul', { class: 'missionen' }, kap.missionen.map((m) => {
      const an = istGefunden(p, m.id); const frei = verborgen ? null : feld(m, 'frei');
      return el('li', {},
        el('label', { class: an ? 'fertig' : null },
          el('input', { type: 'checkbox', checked: an, 'data-fokus': `m-${m.id}`, onchange: () => abhaken(m.id) }),
          el('span', { text: missionsName(m, kap, zustand.spoilerfrei, texte, st) }),
          m.optional && !verborgen ? el('span', { class: 'schildchen', text: t('optional') }) : null),
        frei ? el('p', { class: 'leise-text einzug', text: `${t('schaltetFrei')}: ${frei}` }) : null);
    }));
    const kopf = el('summary', {}, el('span', { class: 'schild', text: `${t('kapitel')} ${kap.nr}` }),
      el('span', { class: 'kapitel-name', text: verborgen ? t('nameVerborgen') : kap.name }), el('span', { class: 'zahl', text: `${fertig} / ${kap.missionen.length}` }));
    const d = el('details', { class: 'kapitel', open: zustand.offeneKapitel.has(kap.id), ontoggle: (e) => { if (e.target.open) zustand.offeneKapitel.add(kap.id); else zustand.offeneKapitel.delete(kap.id); } },
      kopf, verborgen ? null : el('p', { class: 'leise-text', text: [feld(kap, 'rahmen'), feld(kap, 'notiz')].filter(Boolean).join(' ') }), liste);
    teile.push(d);
  }
  teile.push(el('p', { class: 'leise-text', text: feld(missionen, 'hinweis') }));
  $('#missionen-inhalt').replaceChildren(...teile);
}

// ---------- Daten ----------
function datenZeichnen() {
  $('#provider-liste').replaceChildren(...alleProvider.map((pr) => el('li', {},
    el('span', { class: pr.aktiv ? 'an' : 'aus', 'aria-hidden': 'true', text: pr.aktiv ? '✓ ' : '○ ' }), el('strong', { text: t(pr.name) }), el('br'), el('span', { class: 'leise-text', text: t(pr.text) }))));
  const g = zustand.daten.gtadb;
  $('#hinweise').replaceChildren(el('p', { class: 'leise-text', text: t('kartenHinweis') }), el('p', { class: 'leise-text', text: feld(zustand.daten.orte, 'hinweis') }),
    el('p', { class: 'leise-text' }, t('gtadbHinweis', { n: zahl(g.orte.length), stand: g.stand }) + ' ',
      el('a', { href: 'https://map.gtadb.org', target: '_blank', rel: 'noopener', text: 'gtadb.org and contributors' }), ', ',
      el('a', { href: 'https://creativecommons.org/licenses/by/4.0/', target: '_blank', rel: 'noopener', text: 'CC BY 4.0' }), '. ' + t('gtadbAenderung') + ' ' + t('ladenHinweis')),
    el('p', { class: 'leise-text' }, t('radioHinweis', { n: zahl(zustand.daten.radio.sender.length), m: zahl(zustand.daten.radio.sender.reduce((n, s) => n + s.titel.length, 0)) }) + ' ',
      quellenLink('Rockstar Games', zustand.daten.radio.link), ', ' + t('radioAbgleich', { stand: datum(zustand.daten.radio.stand) })),
    el('p', { class: 'leise-text' }, t('kartenbildHinweis') + ' ', quellenLink('gtadb.org', 'https://map.gtadb.org'), ', ', quellenLink('CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'), '. ' + t('kartenbildAenderung')),
    el('p', { class: 'leise-text' }, t('mapheistHinweis', { n: zahl(zustand.daten.mapheist.orte.length) }) + ' ', quellenLink('mapheist.com', 'https://mapheist.com/en/data/'), ', ', quellenLink('CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'), '. ' + t('mapheistAenderung')),
    el('p', { class: 'leise-text' }, t('strassenHinweis', { n: zahl(zustand.daten.strassen.strassen.length), m: zahl(zustand.daten.strassen.strassen.filter((s) => !s.ungefaehr).length) }) + ' ', quellenLink('gta.wiki', 'https://gta.wiki/w/List_of_Street_Names'), ', ', quellenLink('CC BY-NC-SA 3.0', 'https://creativecommons.org/licenses/by-nc-sa/3.0/'), '. ' + t('strassenAenderung')));
}

async function speicherHinweis() {
  const dauerhaft = await speicher.dauerhaftAnfragen();
  $('#speicher-hinweis').textContent = t(dauerhaft ? 'speicherDauerhaft' : 'speicherFluechtig');
}

// ---------- Aktionen ----------
// Abhaken. Eine abgehakte Mission aus einem späteren Kapitel hebt das Kapitel des Durchgangs an (kapitelStand),
// solange der Haken sitzt; gespeichert wird nur die eigene Auswahl.
async function abhaken(id) { await profilSichern(umschalten(aktiv(), id)); allesZeichnen(); }

function pinPopup(pin, schliessen) {
  const { karte } = zustand.daten; const eigen = pin.kat === 'eigen';
  const teile = [
    el('strong', { class: 'schild popup-titel', text: pin.name }),
    el('p', { class: 'leise-text', text: `${eigen ? pinArt(pin.art)[sprache] : feld(kategorie(pin.kat), 'name')} · ${county(pin.county)?.name ?? t('ohneCounty')} · ${t('planquadrat')} ${planquadrat(pin.x, pin.y, karte.gitter)}` })
  ];
  if (eigen) { if (pin.notiz) teile.push(el('p', { text: pin.notiz })); }
  else {
    const plaetze = pin.kat === 'garage' ? /\d+ (Stellpl[a-zä]+|spaces?)/.exec(feld(pin, 'text')) : null;
    if (plaetze) teile.push(el('p', {}, el('strong', { text: `${t('eigeneGarage')} · ${plaetze[0]}` })));
    teile.push(el('p', { text: feld(pin, 'text') }));
    // Easter Eggs an gewöhnlichen Orten: wie die Kategorie Geheimnisse nur, wenn Spoilerfrei aus ist
    if (!zustand.spoilerfrei && feld(pin, 'geheim')) teile.push(el('p', { text: feld(pin, 'geheim') }));
    teile.push(el('p', { class: 'leise-text', text: [feld(pin, 'lage'), pin.ab_kapitel ? `${t('ab')} ${pin.ab_kapitel}` : null, t(pin.genau ? 'genau' : 'ungefaehr')].filter(Boolean).join(' · ') }));
    teile.push(versteckZeile(pin, schliessen));
  }
  const reihe = el('div', { class: 'reihe' }, popupKnopf(istGefunden(aktiv(), pin.id) ? t('zuruecknehmen') : t('abhaken'), () => { schliessen(); abhaken(pin.id); }),
    popupKnopf(t('hierBinIch'), () => positionSetzen(pin), 'knopf leise'));
  if (eigen) reihe.append(popupKnopf(t('pinLoeschen'), async () => {
    if (!confirm(t('pinLoeschenFrage'))) return;
    const weg = { ...zustand.pins.find((x) => x.id === pin.id), geloescht: true, zeit: Date.now() };
    zustand.pins = zustand.pins.map((x) => (x.id === weg.id ? weg : x)); await speicher.pinSpeichern(weg); schliessen(); allesZeichnen();
  }, 'knopf leise'));
  teile.push(reihe);
  return el('div', { class: 'popup' }, teile);
}

// Arten der gtadb-Orte (englische Stichworte) in der Sprache der Oberfläche
function lageText(o) { return (sprache === 'en' && o.lage_en) ? o.lage_en : (o.lage || ''); }
const datum = (iso) => new Date(iso).toLocaleDateString(sprache === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const quellenLink = (text, href) => el('a', { href, target: '_blank', rel: 'noopener', text });

function strasseZeigen(s) {
  const { karte } = zustand.daten;
  const quelle = s.quelle === 'gtawiki'
    ? [quellenLink('gta.wiki', 'https://gta.wiki/w/List_of_Street_Names'), ', ', quellenLink('CC BY-NC-SA 3.0', 'https://creativecommons.org/licenses/by-nc-sa/3.0/')]
    : [quellenLink('gtadb.org', 'https://map.gtadb.org'), ', ', quellenLink('CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/')];
  const inhalt = el('div', { class: 'popup' },
    el('strong', { class: 'schild popup-titel', text: s.name }),
    el('p', { class: 'leise-text', text: `${t(s.fern ? 't_fern' : 't_strasse')} · ${s.gebiet ?? county(s.county)?.name ?? t('ohneCounty')}${s.ungefaehr ? '' : ` · ${t('planquadrat')} ${planquadrat(s.x, s.y, karte.gitter)}`}` }),
    el('p', { class: 'leise-text', text: s.ungefaehr ? t(s.x == null ? 'strasseOhneLage' : 'strasseUngefaehr') : t('strasseLage', { n: s.gebaeude }) }),
    el('p', { class: 'leise-text quelle' }, t('quelleGtadb') + ' ', ...quelle));
  if (s.x == null) { k.karte.once('moveend', () => popupZeigen(k, k.karte.getCenter(), inhalt)); ganzeKarte(k); return; }
  stelleMarkieren(k, [s], s.ungefaehr ? 0 : 1, (latlng) => popupZeigen(k, latlng, inhalt));
}

function artText(arten) { return (arten || []).map((a) => { const s = t('art_' + a.replace(/[^a-z]/g, '')); return s.startsWith('art_') ? a : s; }).join(', '); }

function punktPopup(o, schliessen) {
  const { karte } = zustand.daten;
  const quelle = el('p', { class: 'leise-text quelle' }, t('quelleGtadb') + ' ',
    o.quelle === 'mapheist' ? quellenLink('mapheist.com', o.link || 'https://mapheist.com/en/data/') : quellenLink('gtadb.org', 'https://map.gtadb.org'), ', ',
    quellenLink('CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'));
  return el('div', { class: 'popup' },
    el('strong', { class: 'schild popup-titel', text: o.name }),
    el('p', { class: 'leise-text', text: `${feld(kategorie(o.kat), 'name')} · ${county(o.county)?.name ?? t('ohneCounty')} · ${t('planquadrat')} ${planquadrat(o.x, o.y, karte.gitter)}` }),
    lageText(o) ? el('p', { text: lageText(o) }) : null,
    o.art?.length ? el('p', { class: 'leise-text', text: artText(o.art) + (o.sicherheit ? ` · ${t('sicher_' + o.sicherheit)}` : '') }) : null,
    o.unsicher ? el('p', { class: 'leise-text', text: t('unsicher') }) : null,
    o.kat === 'g-parkhaus' ? el('p', { class: 'leise-text', text: t('parkhausText') }) : null,
    versteckZeile(o, schliessen),
    quelle,
    el('div', { class: 'reihe' }, popupKnopf(t('hierBinIch'), () => positionSetzen(o))));
}

// Zeile „Versteck auf der Flucht“ im Fenster eines Ortes: wogegen der Ort hilft, mit Sprung zum Fluchtwissen
function versteckZeile(ort, schliessen) {
  if (!ort.versteck || ort.versteck === 'eigen') return null;
  const e = zustand.daten.nachschlagen.eintraege.find((x) => x.versteck === ort.versteck);
  if (!e) return null;
  return el('div', { class: 'versteck-zeile' },
    el('p', {}, el('strong', { text: `${t('versteck')}: ` }), feld(e, 'text')),
    popupKnopf(t('versteckMehr'), () => { schliessen(); eintragZeigen(e.id); }, 'knopf leise klein'));
}

// ---------- Kartenklick und Setzmodus ----------
// Ein Klick ins Leere tut nichts. Erst der Knopf „Pin setzen“ schaltet den Setzmodus ein; der nächste Klick auf die Karte
// öffnet dann das Formular für einen eigenen Pin, danach ist der Modus wieder aus.
function setzmodus(an) {
  zustand.setzmodus = an;
  $('#pin-modus').setAttribute('aria-pressed', String(an));
  $('#karte').classList.toggle('setzmodus', an);
  $('#setz-hinweis').hidden = !an;
  if (an) { k.karte.closePopup(); karteInsBild(); }
}

function kartenKlick(pos, latlng) {
  const { karte } = zustand.daten;
  if (!zustand.setzmodus || !innerhalb(pos.x, pos.y, karte)) return;
  setzmodus(false);
  const art = el('select', { id: 'pin-art' }, pinArten.map((a) => new Option(a[sprache], a.id)));
  const name = el('input', { id: 'pin-name', type: 'text', maxlength: '60', autocomplete: 'off' });
  const notiz = el('textarea', { id: 'pin-notiz', rows: '2', maxlength: '240' });
  const inhalt = el('div', { class: 'popup' },
    el('p', { class: 'leise-text', text: `${t('planquadrat')} ${planquadrat(pos.x, pos.y, karte.gitter)}` }),
    el('label', { for: 'pin-art', text: t('pinArt') }), art,
    el('label', { for: 'pin-name', text: t('pinName') }), name,
    el('label', { for: 'pin-notiz', text: t('pinNotiz') }), notiz,
    el('div', { class: 'reihe' },
      popupKnopf(t('pinSpeichern'), async () => {
        const pin = neuerPin({ ...pos, art: art.value, name: name.value, notiz: notiz.value, county: countyVon(pos.x, pos.y, karte.labels) });
        zustand.pins.push(pin); await speicher.pinSpeichern(pin); k.karte.closePopup(); allesZeichnen();
      }),
      popupKnopf(t('pinPosition'), () => positionSetzen(pos), 'knopf leise')));
  popupZeigen(k, latlng, inhalt);
  art.focus();
}

async function positionSetzen(pos) {
  zustand.position = { x: Math.round(pos.x), y: Math.round(pos.y) };
  await speicher.einstellungSchreiben('position', zustand.position); k.karte.closePopup(); allesZeichnen();
}

// Suchtreffer auf einen Ortsnamen: kleines Fenster mit Name und Planquadrat, ohne Pin-Formular
function ortsnameZeigen(e, latlng) {
  popupZeigen(k, latlng, el('div', { class: 'popup' },
    el('strong', { class: 'schild popup-titel', text: e.name }),
    el('p', { class: 'leise-text', text: `${t('t_' + e.typ)} · ${t('planquadrat')} ${planquadrat(e.x, e.y, zustand.daten.karte.gitter)}` }),
    el('div', { class: 'reihe' }, popupKnopf(t('hierBinIch'), () => positionSetzen(e)))));
}

// ---------- Pins teilen per Link ----------
// Die eigenen Pins stecken im Anker des Links (#pins=…). Den Anker sieht kein Server; wer den Link öffnet, wird gefragt.
async function pinsTeilen() {
  const n = zustand.pins.filter((p) => !p.geloescht).length;
  if (!n) { fensterZeigen(el('h2', { id: 'fenster-titel', text: t('teilenKopf') }), el('p', { text: t('teilenLeer') })); return; }
  const link = `${location.origin}${location.pathname}#pins=${await pinsVerpacken(zustand.pins)}`;
  const feldLink = el('textarea', { class: 'teilen-link', rows: '4', readonly: true, 'aria-label': t('teilenLink') }); feldLink.value = link;
  const kopieren = knopf(t('teilenKopieren'), async () => {
    try { await navigator.clipboard.writeText(link); } catch { feldLink.select(); document.execCommand('copy'); }
    kopieren.textContent = `✓ ${t('teilenKopiert')}`;
  });
  const senden = navigator.share ? knopf(t('teilenSenden'), () => navigator.share({ title: document.title, url: link }).catch(() => {}), 'knopf leise') : null;
  fensterZeigen(el('h2', { id: 'fenster-titel', text: t('teilenKopf') }), el('p', { text: t('teilenText', { n: zahl(n) }) }), feldLink, el('div', { class: 'reihe' }, kopieren, senden));
  feldLink.addEventListener('focus', () => feldLink.select());
}

// Der Anker bleibt in der Adresse, bis entschieden ist. Lädt eine neue App-Fassung die Seite genau jetzt neu
// (Service Worker), kommt die Frage danach wieder, statt dass der Link verpufft.
let geteiltOffen = false;
async function geteiltePinsPruefen() {
  const m = /^#pins=(.+)$/.exec(location.hash);
  if (!m || geteiltOffen) return;
  geteiltOffen = true;
  const ankerWeg = () => { if (location.hash.startsWith('#pins=')) history.replaceState(null, '', location.pathname + location.search); };
  const zeigen = (...inhalt) => fensterZeigen(el('h2', { id: 'fenster-titel', text: t('geteiltKopf') }), ...inhalt)
    .addEventListener('close', () => { geteiltOffen = false; ankerWeg(); }, { once: true });
  let pins;
  try { pins = await pinsAuspacken(decodeURIComponent(m[1])); } catch { zeigen(el('p', { text: t('geteiltFehler') })); return; }
  const neu = pinsNeuheiten(zustand.pins, pins); const im = pins.filter((p) => !p.geloescht).length;
  if (!neu.length) { zeigen(el('p', { text: t('geteiltNichts', { m: zahl(im) }) })); return; }
  const text = el('p', { text: t('geteiltText', { n: zahl(neu.length), m: zahl(im) }) });
  const nehmen = knopf(t('geteiltNehmen'), async () => {
    nehmen.disabled = true;
    zustand.pins = pinsZusammenfuehren(zustand.pins, pins);
    for (const p of neu) await speicher.pinSpeichern(p);
    ankerWeg(); text.textContent = t('geteiltFertig', { n: zahl(neu.length) }); nehmen.remove(); allesZeichnen();
  });
  zeigen(text, el('div', { class: 'reihe' }, nehmen));
}

// ---------- Suche ----------
// Eine Suche für alles: Orte auf der Karte, Zeilen und Unterlisten der 100-%-Liste, Radiosender und Titel.
// Der Index entsteht beim ersten Tippen und verfällt mit jedem Neuzeichnen (Sprache, Spoiler, Kapitel, Pins).
const GEWICHT = { county: 4, stadt: 3, gewaesser: 1, insel: 1, viertel: 1, gebiet: 1, poi: 0 };
let suchIndex = null;
const artWorte = (arten) => (arten || []).map((a) => `${a} ${ARTWORTE[a.replace(/[^a-z]/g, '')] ?? ''}`).join(' ');
const artNamen = (ids) => (ids || []).map((a) => `${artMit(a).name_de} ${artMit(a).name_en}`).join(' ');
function suchEintraege() {
  if (suchIndex) return suchIndex;
  const { karte, strassen, checkliste, radio } = zustand.daten; const p = aktiv(); const st = stand();
  const namen = karte.labels.map((l) => ({
    gruppe: 'karte', art: 'name', name: l.text, typ: l.typ, x: l.x, y: l.y, county: l.county, gewicht: GEWICHT[l.typ] ?? 0,
    zusatz: `${t('t_' + l.typ)} ${county(l.county)?.name ?? ''}`
  }));
  const pins = sichtbarePins().map((x) => ({
    gruppe: 'karte', art: 'pin', id: x.id, kat: x.kat, name: x.name, x: x.x, y: x.y, county: x.county, gewicht: 2,
    zusatz: `${x.kat === 'eigen' ? `${pinArt(x.art)[sprache]} ${x.notiz || ''}` : `${feld(kategorie(x.kat), 'name')} ${feld(x, 'lage') ?? ''} ${feld(x, 'text') ?? ''} ${zustand.spoilerfrei ? '' : (feld(x, 'geheim') ?? '')} ${artWorte(x.arten)} ${artNamen(x.artIds)}`} ${KATWORTE[x.kat] ?? ''} ${x.versteck ? VERSTECKWORTE : ''} ${county(x.county)?.name ?? ''}`
  }));
  const gtadb = sichtbareCommunity().map((o) => ({
    gruppe: 'karte', art: 'gtadb', id: o.id, kat: o.kat, name: o.name, suchname: o.namenlos ? '' : undefined, x: o.x, y: o.y, county: o.county, gewicht: o.namenlos ? 0 : 1,
    namenlos: o.namenlos, lage: lageText(o), artText: artText((o.art || []).filter((a) => !/^(enterable|closed|retail|public)$/.test(a)).slice(0, 2)),
    zusatz: `${lageText(o)} ${artText(o.art)} ${artWorte(o.art)} ${artNamen(o.artIds)} ${feld(kategorie(o.kat), 'name')} ${KATWORTE[o.kat] ?? ''} ${o.versteck ? VERSTECKWORTE : ''} ${county(o.county)?.name ?? ''}`
  }));
  const wege = strassen.strassen.map((s) => ({
    gruppe: 'karte', art: 'strasse', id: s.id, name: s.name, x: s.x, y: s.y, county: s.county, gewicht: s.ungefaehr ? 0 : 2, strasse: s,
    zusatz: `${t(s.fern ? 't_fern' : 't_strasse')} ${s.gebiet ?? ''} ${county(s.county)?.name ?? ''}`
  }));
  const zeilen = checkliste.gruppen.flatMap((g) => g.zeilen.flatMap((z) => {
    // ohne Gewicht: Trifft nur der Hinweistext einer Zeile, steht sie hinter Orten, deren Art das Suchwort ist
    const sicht = sichtbareHinweise(z, zustand.spoilerfrei, st);
    const text = sicht.teile.map((h) => h[sprache] ?? h.de).join(' ');
    const kopf = { gruppe: 'liste', art: 'zeile', id: z.id, name: feld(z, 'name'), gewicht: 0, wert: zeileStand(z, p), zeile: z, zusatz: `${z.name_de} ${z.name_en} ${text} ${feld(g, 'name')}${g.id === 'erkundung' ? ' sammelobjekt sammelobjekte collectible collectibles' : ''}` };
    const unter = sicht.unterliste.map((u) => ({ gruppe: 'liste', art: 'zeile', id: z.id, name: unterName(u), gewicht: 0, in: feld(z, 'name'), zusatz: `${u.name} ${u.name_en ?? ''} ${feld(u, 'info') ?? ''} ${feld(z, 'name')}` }));
    return [kopf, ...unter];
  }));
  const funk = radio.sender.flatMap((s) => [
    { gruppe: 'radio', art: 'sender', name: s.name, gewicht: 3, sender: s, zusatz: `${feld(s, 'genre')} ${feld(s, 'hosts')} radio radiosender sender station` },
    ...s.titel.map((ti, nr) => ({ gruppe: 'radio', art: 'titel', name: `${ti[0]}: ${ti[1]}`, sender: s, nr, zusatz: s.name }))
  ]);
  // Wissen zu Ladenketten je Art: was es im Spiel gibt, auch wenn die Karte die Läden nicht alle kennt
  const wissen = (zustand.daten.orte.ketten ?? []).filter((w) => !istVerborgen(w, null, zustand.spoilerfrei, st)).map((w) => ({
    gruppe: 'wissen', art: 'wissen', name: feld(w, 'name'), gewicht: 5, wissen: w, zusatz: `${w.name_de} ${w.name_en} ${artWorte(w.arten)} ${feld(w, 'text')}`
  }));
  // Reiter Nachschlagen: Ausrüstung, Sammlung, Aktivitäten, Herausforderungen und Fluchtwissen, ohne was Spoilerfrei verbirgt
  const ns = zustand.daten.nachschlagen;
  const nach = ns.bereiche.flatMap((b) => nachschlagenSicht(ns, b.id, zustand.spoilerfrei, st).sichtbar.map((e) => {
    const g = ns.gruppen.find((x) => x.id === e.gruppe);
    return {
      gruppe: 'nach', art: 'nach', id: e.id, name: unterName(e), gewicht: 0, eintrag: e, bereich: feld(b, 'name'), in: g ? feld(g, 'name') : null,
      zusatz: `${e.name} ${e.name_en ?? ''} ${e.stichworte ?? ''} ${feld(e, 'text')} ${feld(e, 'zusatz') ?? ''} ${b.name_de} ${b.name_en} ${g ? `${g.name_de} ${g.name_en}` : ''} ${BEREICHWORTE[b.id] ?? ''}`
    };
  }));
  // Fahrzeuge (Name, Hersteller, Klasse, Vorbild) und Cheats (Name, Wirkung); beide öffnen ein Fenster
  const fahrzeuge = sichtbareFahrzeuge().map((f) => ({
    gruppe: 'fahrzeug', art: 'fahrzeug', id: f.id, name: fzName(f), gewicht: 0, fahrzeug: f,
    zusatz: `${f.name} ${f.name_en ?? ''} ${f.klasse} ${KLASSE_DE[f.klasse] ?? ''} ${f.vorbild ?? ''} ${t('fz_' + f.bereich)} fahrzeug fahrzeuge vehicle vehicles`
  }));
  const cheats = zustand.daten.cheats.cheats.map((x) => ({ gruppe: 'cheat', art: 'cheat', id: x.id, name: x.name, gewicht: 1, cheat: x, zusatz: `${x.wirkung_de ?? ''} ${x.wirkung_en ?? ''} cheat cheats code` }));
  suchIndex = [...pins, ...namen, ...wege, ...gtadb, ...zeilen, ...funk, ...wissen, ...nach, ...fahrzeuge, ...cheats];
  return suchIndex;
}

// Die zwei Zeilen eines Treffers: Name und was es ist
function trefferText(e) {
  const { gitter } = zustand.daten.karte; const wo = () => `${county(e.county)?.name ?? t('ohneCounty')} · ${planquadrat(e.x, e.y, gitter)}`;
  if (e.art === 'strasse') return [e.name, `${t(e.strasse.fern ? 't_fern' : 't_strasse')} · ${county(e.county)?.name ?? t('ohneCounty')} · ${e.strasse.ungefaehr ? t('lageUnbekannt') : planquadrat(e.x, e.y, gitter)}`];
  if (e.art === 'name') return [e.name, `${t('t_' + e.typ)} · ${wo()}`];
  if (e.art === 'zeile') {
    const z = e.zeile; const w = e.wert;
    return [e.name, e.in ? `${t('tabListe')} · ${e.in}` : `${t('tabListe')} · ${z.art === 'haken' ? t(w.erfuellt ? 'erledigt' : 'offen') : `${zahl(w.wert)} / ${zahl(z.noetig)}${z.art === 'geld' ? ' $' : ''}`}`];
  }
  if (e.art === 'wissen') return [e.name, feld(e.wissen, 'text').slice(0, 90).replace(/\s+\S*$/, '') + ' …'];
  if (e.art === 'nach') return [e.name, [e.bereich, e.in, feld(e.eintrag, 'text').slice(0, 70).replace(/\s+\S*$/, '') + ' …'].filter(Boolean).join(' · ')];
  if (e.art === 'sender') return [e.name, `${t('radioSender')} · ${feld(e.sender, 'genre')}`];
  if (e.art === 'fahrzeug') {
    const f = e.fahrzeug; const tempo = f.vmax_kmh != null ? tempoTeile(f)[0] : f.werte?.tempo != null ? `${t('fzWert_tempo')} ${wert1(f.werte.tempo)}` : null;
    return [e.name, [t('fz_' + f.bereich), klasseName(f.klasse), tempo].filter(Boolean).join(' · ')];
  }
  if (e.art === 'cheat') return [e.name, `Cheat · ${e.cheat.code ?? t('cheatOhneCode')}`];
  if (e.art === 'titel') return [e.sender.titel[e.nr][1], `${e.sender.titel[e.nr][0]} · ${e.sender.name}`];
  if (e.art === 'gtadb') return [e.name, `${e.namenlos ? feld(kategorie(e.kat), 'name') : (e.artText || feld(kategorie(e.kat), 'name'))} · ${e.lage || county(e.county)?.name || t('ohneCounty')} · ${planquadrat(e.x, e.y, gitter)}`];
  return [e.name, `${e.kat === 'eigen' ? t('t_pin') : feld(kategorie(e.kat), 'name')} · ${wo()}`];
}

// Auf dem Handy liegt die Karte unter der Suche: zu ihr rollen, wenn sie nicht ganz im Bild ist
function karteInsBild() {
  const r = $('.karte-rahmen').getBoundingClientRect();
  if (r.top < 0 || r.top > innerHeight * 0.5) $('.karte-rahmen').scrollIntoView({ block: 'start', behavior: ROLLEN });
}

async function zeileZeigen(id) {
  zustand.tab = 'liste'; zustand.offeneZeile = id; await speicher.einstellungSchreiben('tab', 'liste'); allesZeichnen();
  const ziel = document.querySelector(`[data-zeile="${CSS.escape(id)}"]`);
  if (!ziel) return;
  ziel.classList.add('gefunden'); ziel.scrollIntoView({ block: 'center', behavior: ROLLEN });
}

function fensterZeigen(...inhalt) {
  $('#fenster-inhalt').replaceChildren(...inhalt.filter(Boolean));
  const fenster = $('#fenster');
  if (!fenster.open) fenster.showModal();
  $('#fenster-inhalt').scrollTop = 0;
  return fenster;
}

function wissenZeigen(w) {
  const n = zustand.daten.gtadb.orte.filter((o) => o.art.some((a) => w.arten.includes(a))).length;
  fensterZeigen(
    el('h2', { id: 'fenster-titel', text: feld(w, 'name') }),
    el('p', { text: feld(w, 'text') }),
    el('p', { class: 'leise-text', text: t('wissenKarte', { n: zahl(n) }) }),
    aufKarteKnopf(artenAus(w.arten), () => $('#fenster').close()),
    el('p', { class: 'leise-text', text: t('wissenStand', { stand: datum(zustand.daten.orte.stand) }) }));
}

function radioZeigen(s, nr) {
  const { radio } = zustand.daten;
  const liste = s.titel.length ? el('ol', { class: 'radio-titel' }, s.titel.map((ti, i) => el('li', { class: i === nr ? 'gefunden' : null },
    el('span', { class: 'treffer-name', text: ti[1] }), el('span', { class: 'treffer-zusatz', text: ti[0] })))) : null;
  const fenster = fensterZeigen(
    el('h2', { id: 'fenster-titel', text: s.name }),
    el('p', { text: feld(s, 'genre') }),
    el('p', { class: 'leise-text', text: `${t('radioHosts')}: ${feld(s, 'hosts')}` }),
    feld(s, 'hinweis') ? el('p', { class: 'leise-text', text: feld(s, 'hinweis') }) : null,
    el('h3', { class: 'unterkopf', text: s.titel.length ? t('radioTitel', { n: zahl(s.titel.length) }) : t('radioOhneTitel') }),
    liste,
    el('p', { class: 'leise-text quelle' }, t('quelleGtadb') + ' ', quellenLink('rockstargames.com/VI/credits', radio.link), ', ' + t('radioAbgleich', { stand: datum(radio.stand) })));
  liste?.querySelector('.gefunden')?.scrollIntoView({ block: 'nearest' });
}

// Orte, die zu einem Treffer aus der 100-%-Liste oder aus Nachschlagen gehören: bei einem Eintrag einer Unterliste der
// gleichnamige Ort, sonst alle Orte der Arten, die zur Zeile oder zum Eintrag gehören (ARTEN_ZU)
function orteZuTreffer(e) {
  const gleich = e.art === 'zeile' && e.in ? sichtbarePins().filter((p) => p.kat !== 'eigen' && p.name === e.name) : [];
  return gleich.length ? gleich : ARTEN_ZU[e.id] ? orteDerArten(ARTEN_ZU[e.id]) : [];
}

// Jeder Treffer mit einem Ort bleibt auf der Karte mit einem Ring markiert, bis das Suchfeld geleert wird. Blendet ein
// Filter den Ort aus, zeigt die Karte ihn trotzdem (zustand.gesucht); die Filter bleiben, wie sie sind.
function sucheLoesen() { markierungWeg(k); if (zustand.gesucht.size) { zustand.gesucht.clear(); allesZeichnen(); } }
function trefferAnfliegen(e) {
  const vorher = zustand.gesucht.size > 0;
  if (e.art === 'zeile' || e.art === 'nach') {
    const orte = orteZuTreffer(e);
    zustand.gesucht = new Set(orte.map((o) => o.id)); markierungWeg(k);
    (e.art === 'zeile' ? zeileZeigen(e.id) : eintragZeigen(e.id)).then(() => { if (orte.length) { stelleMarkieren(k, orte); ausschnittZeigen(k, orte); } });
    return;
  }
  if (e.art === 'sender' || e.art === 'titel') { sucheLoesen(); radioZeigen(e.sender, e.nr); return; }
  if (e.art === 'wissen') { sucheLoesen(); wissenZeigen(e.wissen); return; }
  if (e.art === 'fahrzeug') { sucheLoesen(); fahrzeugZeigen(e.fahrzeug); return; }
  if (e.art === 'cheat') { sucheLoesen(); cheatsZeigen(e.id); return; }
  karteInsBild();
  if (e.art === 'gtadb' || e.art === 'pin') {
    const oeffnen = e.art === 'gtadb' ? punktOeffnen : pinOeffnen;
    zustand.gesucht = new Set([e.id]);
    if (vorher) allesZeichnen();                         // die vorigen Treffer fallen wieder unter den Filter
    stelleMarkieren(k, [e]);
    if (!oeffnen(k, e.id)) { allesZeichnen(); oeffnen(k, e.id); }
    return;
  }
  sucheLoesen();
  if (e.art === 'strasse') { strasseZeigen(e.strasse); return; }
  const zoom = { county: -1, stadt: 0, gewaesser: 0, insel: 0.5, gebiet: 0.5, viertel: 1, poi: 1 }[e.typ] ?? 0.5;
  stelleMarkieren(k, [e], zoom, (latlng) => ortsnameZeigen(e, latlng));
}

function sucheVerdrahten() {
  const eingabe = $('#suche'); const liste = $('#suche-liste'); const status = $('#suche-status');
  let treffer = []; let aktivIdx = -1;
  const schliessen = () => { liste.hidden = true; eingabe.setAttribute('aria-expanded', 'false'); eingabe.removeAttribute('aria-activedescendant'); aktivIdx = -1; };
  const markieren = (i) => {
    if (!treffer.length) return;
    aktivIdx = i;
    for (const li of liste.querySelectorAll('[role="option"]')) li.setAttribute('aria-selected', String(li.id === `treffer-${i}`));
    const li = liste.querySelector(`#treffer-${i}`);
    if (li) { eingabe.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({ block: 'nearest' }); }
  };
  const waehlen = (i) => {
    const e = treffer[i];
    if (!e) return;
    schliessen(); eingabe.value = trefferText(e)[0]; eingabe.blur(); trefferAnfliegen(e);
  };
  const zeigen = () => {
    const anfrage = eingabe.value.trim();
    const alle = anfrage ? suchen(anfrage, suchEintraege(), 2000) : [];
    // Gruppen in der Reihenfolge ihres besten Treffers
    const gruppen = gruppieren(alle, [...new Set(alle.map((e) => e.gruppe))], 100);
    treffer = gruppen.flatMap((g) => g.treffer);
    let i = 0;
    liste.replaceChildren(...gruppen.flatMap((g) => [
      el('li', { class: 'gruppe', role: 'presentation' }, el('span', { text: t('sg_' + g.gruppe) }), el('span', { class: 'zahl', text: zahl(g.treffer.length + g.weitere) })),
      ...g.treffer.map((e) => {
        const nr = i++; const [name, zusatz] = trefferText(e);
        return el('li', { id: `treffer-${nr}`, role: 'option', 'aria-selected': 'false', onmousedown: (ev) => { ev.preventDefault(); waehlen(nr); } },
          el('span', { class: 'treffer-name', text: name }), el('span', { class: 'treffer-zusatz', text: zusatz }));
      }),
      g.weitere ? el('li', { class: 'leer', role: 'presentation', text: t('weitere', { n: zahl(g.weitere) }) }) : null
    ]).filter(Boolean));
    if (anfrage && !treffer.length) liste.replaceChildren(el('li', { class: 'leer', role: 'option', 'aria-disabled': 'true', text: t('keineTreffer') }));
    liste.hidden = !anfrage; liste.scrollTop = 0;
    // Suchfeld geleert: Ring und Ausnahme vom Filter enden
    if (!anfrage) sucheLoesen();
    eingabe.setAttribute('aria-expanded', String(Boolean(anfrage)));
    status.textContent = anfrage ? (alle.length ? t('treffer', { n: alle.length }) : t('keineTreffer')) : '';
    aktivIdx = -1; eingabe.removeAttribute('aria-activedescendant');
  };
  eingabe.addEventListener('input', zeigen);
  eingabe.addEventListener('focus', () => { if (eingabe.value.trim()) zeigen(); });
  eingabe.addEventListener('blur', () => setTimeout(schliessen, 150));
  eingabe.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); if (liste.hidden) zeigen(); markieren(Math.min(treffer.length - 1, aktivIdx + 1)); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); if (liste.hidden) zeigen(); markieren(Math.max(0, aktivIdx - 1)); }
    else if (ev.key === 'Enter') { ev.preventDefault(); waehlen(aktivIdx >= 0 ? aktivIdx : 0); }
    else if (ev.key === 'Escape') { if (!liste.hidden) { ev.preventDefault(); schliessen(); } else { eingabe.value = ''; zeigen(); } }
  });
}

// Vollbild der Karte: .voll legt die Karte über den ganzen Schirm (geht überall, auch auf dem iPhone),
// das echte Vollbild des Browsers blendet zusätzlich Leisten aus, wo es das gibt. Esc oder der Knopf beenden beides.
function vollbildVerdrahten() {
  const rahmen = $('.karte-rahmen'); const knopf = $('#vollbild');
  const nativ = () => document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
  const setzen = (an) => {
    rahmen.classList.toggle('voll', an); document.documentElement.classList.toggle('karte-voll', an);
    knopf.setAttribute('aria-pressed', String(an));            // fester Name „Karte im Vollbild“, Zustand über aria-pressed
    knopf.dataset.tTitel = an ? 'vollbildAus' : 'vollbild'; knopf.title = t(knopf.dataset.tTitel);
    // Der Rest der Seite liegt unter der Karte: für Tastatur und Vorlesen stumm schalten
    for (const e of document.querySelectorAll('.seite-kopf, .seitenleiste, .seite-fuss')) e.inert = an;
    requestAnimationFrame(() => k.karte.invalidateSize());
  };
  knopf.addEventListener('click', async () => {
    if (rahmen.classList.contains('voll')) {
      if (nativ()) { try { await (document.exitFullscreen ?? document.webkitExitFullscreen).call(document); } catch { /* schon beendet */ } }
      setzen(false);
      return;
    }
    setzen(true);
    const anfordern = rahmen.requestFullscreen ?? rahmen.webkitRequestFullscreen;
    if (anfordern) { try { await anfordern.call(rahmen, { navigationUI: 'hide' }); } catch { /* bleibt bei .voll */ } }
  });
  // Beendet der Browser das Vollbild selbst (Esc, Wischgeste), geht auch .voll weg
  const wechsel = () => { if (!nativ() && rahmen.classList.contains('voll')) setzen(false); };
  document.addEventListener('fullscreenchange', wechsel); document.addEventListener('webkitfullscreenchange', wechsel);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !nativ() && rahmen.classList.contains('voll') && !zustand.setzmodus && !$('#fenster').open) setzen(false); });
  // Höhe des Kopfes für das Tablet-Layout (Karte bis zum unteren Rand)
  const kopf = $('.seite-kopf');
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--kopf-h', `${Math.ceil(kopf.getBoundingClientRect().height)}px`);
    requestAnimationFrame(() => k.karte.invalidateSize());   // die Karte wächst mit, Leaflet muss es wissen
  }).observe(kopf);
}

function steuerungVerdrahten() {
  sucheVerdrahten();
  $('#profil-wahl').addEventListener('change', async (e) => {
    zustand.aktivId = e.target.value; zustand.offeneKapitel = null; markierungWeg(k); zustand.gesucht.clear(); await speicher.einstellungSchreiben('aktivesProfil', zustand.aktivId); k.karte.closePopup(); allesZeichnen();
  });
  // Kapitel des Durchgangs: Spoilerfrei verbirgt alles danach. Abgehakte Missionen späterer Kapitel halten es oben.
  $('#kapitel-wahl').addEventListener('change', async (e) => {
    await profilSichern({ ...aktiv(), kapitel: Number(e.target.value) }); zustand.offeneKapitel = null; markierungWeg(k); zustand.gesucht.clear(); k.karte.closePopup(); allesZeichnen();
  });
  $('#spoiler').addEventListener('click', async () => {
    if (zustand.spoilerfrei && !confirm(t('spoilerFrage', { n: stand() }))) return;
    markierungWeg(k); zustand.gesucht.clear();          // ein Ring dürfte sonst zeigen, wo ein jetzt verborgener Ort liegt
    zustand.spoilerfrei = !zustand.spoilerfrei; await speicher.einstellungSchreiben('spoilerfrei', zustand.spoilerfrei); k.karte.closePopup(); allesZeichnen();
  });
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const zeigeTab = async (name, fokus) => { zustand.tab = name; await speicher.einstellungSchreiben('tab', name); allesZeichnen(); if (fokus) tabs.find((b) => b.dataset.tab === name)?.focus(); };
  for (const b of tabs) {
    b.addEventListener('click', () => zeigeTab(b.dataset.tab));
    b.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(b);
      if (e.key === 'ArrowRight') zeigeTab(tabs[(i + 1) % tabs.length].dataset.tab, true);
      if (e.key === 'ArrowLeft') zeigeTab(tabs[(i + tabs.length - 1) % tabs.length].dataset.tab, true);
    });
  }
  $('#filter-alle').addEventListener('click', () => { filterLeeren(); filterGeaendert(); });
  $('#ganze-karte').addEventListener('click', () => ganzeKarte(k));
  vollbildVerdrahten();
  $('#cheats-knopf').addEventListener('click', () => cheatsZeigen());
  $('#pin-modus').addEventListener('click', () => setzmodus(!zustand.setzmodus));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && zustand.setzmodus) setzmodus(false); });
  $('#pins-teilen').addEventListener('click', pinsTeilen);
  $('#pins-teilen-karte').addEventListener('click', pinsTeilen);
  $('#profil-neu').addEventListener('click', async () => {
    const name = prompt(t('profilName'), `${t('profil')} ${zustand.profile.length + 1}`);
    if (!name) return;
    const p = neuesProfil(name); await speicher.profilSpeichern(p);
    zustand.profile.push(p); zustand.aktivId = p.id; zustand.offeneKapitel = null; await speicher.einstellungSchreiben('aktivesProfil', p.id); allesZeichnen();
  });
  $('#profil-umbenennen').addEventListener('click', async () => {
    const p = aktiv(); const name = prompt(t('profilName'), p.name);
    if (!name) return;
    await profilSichern({ ...p, name: name.slice(0, 40) }); allesZeichnen();
  });
  $('#profil-loeschen').addEventListener('click', async () => {
    const p = aktiv();
    if (!confirm(t('loeschenFrage', { name: p.name }))) return;
    await speicher.profilLoeschen(p.id);
    zustand.profile = zustand.profile.filter((x) => x.id !== p.id);
    if (!zustand.profile.length) { const n = neuesProfil(t('erster')); await speicher.profilSpeichern(n); zustand.profile = [n]; }
    zustand.aktivId = zustand.profile[0].id; zustand.offeneKapitel = null; await speicher.einstellungSchreiben('aktivesProfil', zustand.aktivId); allesZeichnen();
  });
  $('#export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(exportieren(zustand.profile, zustand.pins), null, 1)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `auto-map-fortschritt-${new Date().toISOString().slice(0, 10)}.json` });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#import').addEventListener('click', () => $('#import-datei').click());
  $('#import-datei').addEventListener('change', async (e) => {
    const datei = e.target.files?.[0]; e.target.value = '';
    if (!datei) return;
    try {
      const neu = einlesen(await datei.text());
      zustand.profile = importieren(zustand.profile, neu.profile);
      zustand.pins = pinsZusammenfuehren(zustand.pins, neu.pins);
      for (const p of zustand.profile) await speicher.profilSpeichern(p);
      for (const p of zustand.pins) await speicher.pinSpeichern(p);
      alert(t('importOk', { n: neu.profile.length, p: neu.pins.filter((x) => !x.geloescht).length })); allesZeichnen();
    } catch (fehler) { alert(t('importFehler', { fehler: sprache === 'en' ? (FEHLER_EN[fehler.message] ?? fehler.message) : fehler.message })); }
  });
  const spr = $('#sprache');
  spr.replaceChildren(...sprachen.map((s) => new Option(s.toUpperCase(), s, false, s === sprache)));
  spr.addEventListener('change', async (e) => {
    setzeSprache(e.target.value); await speicher.einstellungSchreiben('sprache', e.target.value); uebersetzeSeite(); k.karte.closePopup(); allesZeichnen(); speicherHinweis();
  });
  // Sehhilfen: Die Leinwand der Karte und die Bilder der Piktogramme lesen ihre Farben einmal aus, darum nach jedem Wechsel neu
  const seh = $('#darstellung');
  const neuFaerben = async () => { seh.value = sehhilfe.eintragVon(sehhilfe.gespeichert()); await zeichenLaden(); allesZeichnen(); };
  seh.value = sehhilfe.eintragVon(sehhilfe.gespeichert());
  seh.addEventListener('change', () => { sehhilfe.waehlen(seh.value); neuFaerben(); });
  sehhilfe.beobachten(neuFaerben);

  // Installieren-Knopf (Muster der Werkstatt): nur sichtbar, wenn der Browser es anbietet
  let angebot = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); angebot = e; $('#installieren').hidden = false; });
  $('#installieren').addEventListener('click', async () => {
    if (!angebot) return; angebot.prompt(); await angebot.userChoice; angebot = null; $('#installieren').hidden = true;
  });
  window.addEventListener('appinstalled', () => { $('#installieren').hidden = true; speicherHinweis(); });
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // Kommt eine neue Fassung an, einmal neu laden, damit nicht die alte Karte stehen bleibt
  const hatteSteuerung = Boolean(navigator.serviceWorker.controller);
  let neuGeladen = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hatteSteuerung && !neuGeladen) { neuGeladen = true; location.reload(); } });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((r) => r.update()).catch((e) => console.warn('Service Worker:', e));
}
// Schreiben in den Gerätespeicher gescheitert (voll oder vom Browser gesperrt): sagen, statt den Haken still zu verlieren
addEventListener('unhandledrejection', (e) => {
  if (!(e.reason instanceof DOMException)) return;
  console.warn('Speicher:', e.reason);
  $('#startfehler').hidden = false; $('#startfehler').textContent = t('speicherFehler');
});
start().catch((e) => {
  console.error(e);
  $('#startfehler').hidden = false; $('#startfehler').textContent = t('ladefehler', { fehler: e.message });
});
