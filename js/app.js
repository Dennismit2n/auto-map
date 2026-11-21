import { ladeDaten } from './daten.js';
import {
  neuesProfil, umschalten, istGefunden, setzeZaehler, zeileStand, checklisteStand, istVerborgen, missionsName,
  passtZumFilter, zaehlen, zaehlenJeCounty, naechstesOffenes, neuerPin, exportieren, einlesen, importieren, pinsZusammenfuehren
} from './fortschritt.js';
import { planquadrat, entfernungText, countyVon, innerhalb } from './geo.js';
import * as speicher from './speicher.js';
import { alleProvider } from './provider.js';
import { t, feld, zahl, sprache, setzeSprache, uebersetzeSeite, sprachen, pinArten } from './i18n.js';
import { karteAnlegen, strassenZeichnen, pinsZeichnen, punkteZeichnen, punktOeffnen, positionZeigen, popupZeigen, hinfliegen, ganzeKarte, pinOeffnen, stelleMarkieren } from './karte.js';
import { suchen } from './suche.js';

const $ = (sel) => document.querySelector(sel);
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
  filter: { countys: new Set(), kategorien: new Set() }, offeneKapitel: null
};
let k;
const aktiv = () => zustand.profile.find((p) => p.id === zustand.aktivId);
const kategorie = (id) => zustand.daten.orte.kategorien.find((x) => x.id === id);
const county = (id) => zustand.daten.karte.countys.find((c) => c.id === id);
const pinArt = (id) => pinArten.find((a) => a.id === id) ?? pinArten.at(-1);

// Alle Pins, die gerade sichtbar sein dürfen: feste Orte (ohne Verborgenes) und eigene Pins.
// Community-Orte (gtadb, Mapheist) ohne das, was der Spoiler-Schalter verbirgt
function sichtbareCommunity() { return zustand.daten.community.filter((o) => !istVerborgen(o, kategorie(o.kat), zustand.spoilerfrei)); }

function sichtbarePins() {
  const { orte } = zustand.daten;
  const fest = orte.orte.filter((o) => !istVerborgen(o, kategorie(o.kat), zustand.spoilerfrei))
    .map((o) => (sprache === 'en' && o.name_en ? { ...o, name: o.name_en } : o));
  const eigene = zustand.pins.filter((p) => !p.geloescht).map((p) => ({ ...p, name: p.name || pinArt(p.art)[sprache] }));
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
  if (f) zustand.filter = { countys: new Set(f.countys || []), kategorien: new Set(f.kategorien || []) };
  const pos = await speicher.einstellungLesen('position');
  zustand.position = pos && innerhalb(pos.x, pos.y, zustand.daten.karte) ? pos : null;
  zustand.spoilerfrei = (await speicher.einstellungLesen('spoilerfrei')) !== false;   // Standard: spoilerfrei
  zustand.tab = (await speicher.einstellungLesen('tab')) || 'karte';

  k = await karteAnlegen($('#karte'), zustand.daten.karte, { onKlick: kartenKlick });
  strassenZeichnen(k, zustand.daten.strassen.strassen);
  steuerungVerdrahten();
  allesZeichnen();
  speicherHinweis();
}

// ---------- Zeichnen ----------
function allesZeichnen() {
  const fokus = document.activeElement?.dataset?.fokus;
  filterBereinigen();
  const p = aktiv(); const pins = sichtbarePins();
  const ziel = naechstesOffenes(pins, p, zustand.filter, zustand.position);
  pinsZeichnen(k, {
    profil: p, zielId: ziel?.pin.id,
    pins: pins.filter((x) => passtZumFilter(x, zustand.filter)).map((x) => ({
      ...x, zeichen: x.kat === 'eigen' ? 'P' : kategorie(x.kat).zeichen, farbe: county(x.county)?.farbe ?? '--vc-akzent-lavendel', popup: (zu) => pinPopup(x, zu)
    }))
  });
  punkteZeichnen(k, {
    orte: sichtbareCommunity().filter((o) => passtZumFilter(o, zustand.filter)),
    farbeVon: (o) => county(o.county)?.farbe ?? '--vc-akzent-lavendel', popup: punktPopup, buendelTitel: (n) => t('buendel', { n: zahl(n) })
  });
  positionZeigen(k, zustand.position, t('meinePosition'));
  kopfZeichnen(); tabsZeichnen();
  kartenTabZeichnen(pins, ziel); listeZeichnen(); missionenZeichnen(); datenZeichnen();
  if (fokus) document.querySelector(`[data-fokus="${CSS.escape(fokus)}"]`)?.focus();
}

// Verborgene Kategorien dürfen nicht als Filter hängen bleiben
function filterBereinigen() {
  for (const id of [...zustand.filter.kategorien]) {
    const kat = kategorie(id);
    if (!kat || (zustand.spoilerfrei && kat.spoiler)) zustand.filter.kategorien.delete(id);
  }
}

function kopfZeichnen() {
  $('#profil-wahl').replaceChildren(...zustand.profile.map((p) => new Option(p.name, p.id, false, p.id === zustand.aktivId)));
  const s = $('#spoiler');
  s.setAttribute('aria-pressed', String(zustand.spoilerfrei));
  s.classList.toggle('frei', zustand.spoilerfrei);
  s.title = t(zustand.spoilerfrei ? 'spoilerTitelFrei' : 'spoilerTitelAn');
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
  for (const kap of zustand.daten.missionen.kapitel) for (const m of kap.missionen) { gesamt++; if (istGefunden(p, m.id)) fertig++; }
  return { gesamt, fertig };
}

function chip({ text, an, farbe, anzahl, onKlick, fokus }) {
  return el('button', { type: 'button', class: `chip${farbe ? ' county-chip' : ''}`, 'aria-pressed': String(an), style: farbe ? `--ort:var(${farbe})` : null, onclick: onKlick, 'data-fokus': fokus },
    farbe ? el('span', { class: 'farbe', 'aria-hidden': 'true' }) : null, el('span', { class: 'name', text }), anzahl ? el('span', { class: 'anzahl', text: anzahl }) : null);
}

async function filterGeaendert() {
  await speicher.einstellungSchreiben('filter', { countys: [...zustand.filter.countys], kategorien: [...zustand.filter.kategorien] });
  allesZeichnen();
}
const wechsel = (menge, id) => { if (menge.has(id)) menge.delete(id); else menge.add(id); filterGeaendert(); };

function kartenTabZeichnen(pins, ziel) {
  const p = aktiv(); const { karte, orte, checkliste } = zustand.daten; const f = zustand.filter;
  const z = zaehlen(pins, p, f); const cl = checklisteStand(checkliste, p); const ms = missionsStand(p);
  $('#uebersicht').replaceChildren(
    gurt(`${z.gefunden} / ${z.gesamt}`, z.gesamt ? z.gefunden / z.gesamt : 0, t('orte')),
    gurt(`${cl.erfuellt} / ${cl.gesamt}`, cl.prozent / 100, t('zeilen')),
    gurt(`${ms.fertig} / ${ms.gesamt}`, ms.gesamt ? ms.fertig / ms.gesamt : 0, t('missionen')));

  const je = zaehlenJeCounty(pins.filter((x) => !f.kategorien.size || f.kategorien.has(x.kat)), p);
  $('#county-chips').replaceChildren(...karte.countys.map((c) => chip({
    text: c.name, an: f.countys.has(c.id), farbe: c.farbe, fokus: `county-${c.id}`,
    anzahl: `${je[c.id]?.gefunden ?? 0}/${je[c.id]?.gesamt ?? 0}`, onKlick: () => wechsel(f.countys, c.id)
  })));
  $('#kategorien-chips').replaceChildren(...orte.kategorien.filter((x) => !(zustand.spoilerfrei && x.spoiler)).map((x) => chip({
    text: `${x.zeichen} · ${feld(x, 'name')}`, an: f.kategorien.has(x.id), fokus: `kat-${x.id}`, onKlick: () => wechsel(f.kategorien, x.id)
  })));
  $('#filter-alle').hidden = !f.countys.size && !f.kategorien.size;

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
  const hinweis = [feld(z, 'hinweis'), zustand.spoilerfrei ? null : feld(z, 'spoilerhinweis')].filter(Boolean).join(' ');
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
  return el('div', { class: `zeile${s.erfuellt ? ' erfuellt' : ''}` },
    el('div', { class: 'zeile-kopf' }, el('span', { class: 'zeile-name', text: `${s.erfuellt ? '✓ ' : ''}${feld(z, 'name')}` }), el('span', { class: 'zeile-zahl', text: ziel + zusatz })),
    hinweis ? el('p', { class: 'leise-text', text: hinweis }) : null, bedienung);
}

// ---------- Missionen ----------
function missionenZeichnen() {
  const p = aktiv(); const { missionen } = zustand.daten; const ms = missionsStand(p);
  if (!zustand.offeneKapitel) {
    const erstes = missionen.kapitel.find((kap) => kap.missionen.some((m) => !istGefunden(p, m.id)));
    zustand.offeneKapitel = new Set(erstes ? [erstes.id] : []);
  }
  const texte = { mission: t('mission'), geschwaerzt: t('geschwaerzt') };
  const teile = [gurt(`${ms.fertig} / ${ms.gesamt}`, ms.gesamt ? ms.fertig / ms.gesamt : 0, t('missionen'))];
  for (const kap of missionen.kapitel) {
    const verborgen = zustand.spoilerfrei && kap.spoiler;
    const fertig = kap.missionen.filter((m) => istGefunden(p, m.id)).length;
    const liste = el('ul', { class: 'missionen' }, kap.missionen.map((m) => {
      const an = istGefunden(p, m.id); const frei = verborgen ? null : feld(m, 'frei');
      return el('li', {},
        el('label', { class: an ? 'fertig' : null },
          el('input', { type: 'checkbox', checked: an, 'data-fokus': `m-${m.id}`, onchange: () => abhaken(m.id) }),
          el('span', { text: missionsName(m, kap, zustand.spoilerfrei, texte) }),
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
      el('a', { href: 'https://creativecommons.org/licenses/by/4.0/', target: '_blank', rel: 'noopener', text: 'CC BY 4.0' }), '. ' + t('gtadbAenderung')),
    el('p', { class: 'leise-text' }, t('kartenbildHinweis') + ' ', quellenLink('gtadb.org', 'https://map.gtadb.org'), ', ', quellenLink('CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'), '. ' + t('kartenbildAenderung')),
    el('p', { class: 'leise-text' }, t('mapheistHinweis', { n: zahl(zustand.daten.mapheist.orte.length) }) + ' ', quellenLink('mapheist.com', 'https://mapheist.com/en/data/'), ', ', quellenLink('CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'), '.'),
    el('p', { class: 'leise-text' }, t('strassenHinweis', { n: zahl(zustand.daten.strassen.strassen.length), m: zahl(zustand.daten.strassen.strassen.filter((s) => !s.ungefaehr).length) }) + ' ', quellenLink('gta.wiki', 'https://gta.wiki/w/List_of_Street_Names'), ', ', quellenLink('CC BY-NC-SA 3.0', 'https://creativecommons.org/licenses/by-nc-sa/3.0/'), '. ' + t('strassenAenderung')));
}

async function speicherHinweis() {
  const dauerhaft = await speicher.dauerhaftAnfragen();
  $('#speicher-hinweis').textContent = t(dauerhaft ? 'speicherDauerhaft' : 'speicherFluechtig');
}

// ---------- Aktionen ----------
async function abhaken(id) { await profilSichern(umschalten(aktiv(), id)); allesZeichnen(); }

function pinPopup(pin, schliessen) {
  const { karte } = zustand.daten; const eigen = pin.kat === 'eigen';
  const teile = [
    el('strong', { class: 'schild popup-titel', text: pin.name }),
    el('p', { class: 'leise-text', text: `${eigen ? pinArt(pin.art)[sprache] : feld(kategorie(pin.kat), 'name')} · ${county(pin.county)?.name ?? t('ohneCounty')} · ${t('planquadrat')} ${planquadrat(pin.x, pin.y, karte.gitter)}` })
  ];
  if (eigen) { if (pin.notiz) teile.push(el('p', { text: pin.notiz })); }
  else {
    teile.push(el('p', { text: feld(pin, 'text') }));
    teile.push(el('p', { class: 'leise-text', text: [feld(pin, 'lage'), pin.ab_kapitel ? `${t('ab')} ${pin.ab_kapitel}` : null, t(pin.genau ? 'genau' : 'ungefaehr')].filter(Boolean).join(' · ') }));
  }
  const reihe = el('div', { class: 'reihe' }, popupKnopf(istGefunden(aktiv(), pin.id) ? t('zuruecknehmen') : t('abhaken'), () => { schliessen(); abhaken(pin.id); }));
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
  if (s.x == null) { ganzeKarte(k); k.karte.once('moveend', () => popupZeigen(k, k.karte.getCenter(), inhalt)); return; }
  const latlng = stelleMarkieren(k, s, s.ungefaehr ? 0 : 1);
  k.karte.once('moveend', () => popupZeigen(k, latlng, inhalt));
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
    quelle,
    el('div', { class: 'reihe' }, popupKnopf(t('hierBinIch'), async () => {
      zustand.position = { x: Math.round(o.x), y: Math.round(o.y) }; await speicher.einstellungSchreiben('position', zustand.position); schliessen(); allesZeichnen();
    })));
}

function kartenKlick(pos, latlng, titel) {
  const { karte } = zustand.daten;
  if (!innerhalb(pos.x, pos.y, karte)) return;
  const inhalt = el('div', { class: 'popup' });
  const start = () => inhalt.replaceChildren(
    titel ? el('strong', { class: 'schild popup-titel', text: titel }) : null,
    el('p', { class: 'leise-text', text: `${t('planquadrat')} ${planquadrat(pos.x, pos.y, karte.gitter)}` }),
    el('div', { class: 'reihe' },
      popupKnopf(t('hierBinIch'), async () => { zustand.position = pos; await speicher.einstellungSchreiben('position', pos); k.karte.closePopup(); allesZeichnen(); }),
      popupKnopf(t('pinSetzen'), formular, 'knopf leise')));
  const formular = () => {
    const art = el('select', { id: 'pin-art' }, pinArten.map((a) => new Option(a[sprache], a.id)));
    const name = el('input', { id: 'pin-name', type: 'text', maxlength: '60', autocomplete: 'off' });
    const notiz = el('textarea', { id: 'pin-notiz', rows: '2', maxlength: '240' });
    inhalt.replaceChildren(
      el('label', { for: 'pin-art', text: t('pinArt') }), art,
      el('label', { for: 'pin-name', text: t('pinName') }), name,
      el('label', { for: 'pin-notiz', text: t('pinNotiz') }), notiz,
      el('div', { class: 'reihe' }, popupKnopf(t('pinSpeichern'), async () => {
        const pin = neuerPin({ ...pos, art: art.value, name: name.value, notiz: notiz.value, county: countyVon(pos.x, pos.y, karte.labels) });
        zustand.pins.push(pin); await speicher.pinSpeichern(pin); k.karte.closePopup(); allesZeichnen();
      })));
    art.focus();
  };
  start();
  popupZeigen(k, latlng, inhalt);
}

// ---------- Suche ----------
const GEWICHT = { county: 4, stadt: 3, gewaesser: 1, insel: 1, viertel: 1, gebiet: 1, poi: 0 };
function suchEintraege() {
  const namen = zustand.daten.karte.labels.map((l) => ({
    art: 'name', name: l.text, typ: l.typ, x: l.x, y: l.y, county: l.county, gewicht: GEWICHT[l.typ] ?? 0,
    zusatz: `${t('t_' + l.typ)} ${county(l.county)?.name ?? ''}`
  }));
  const pins = sichtbarePins().map((p) => ({
    art: 'pin', id: p.id, kat: p.kat, name: p.name, x: p.x, y: p.y, county: p.county, gewicht: 2,
    zusatz: `${p.kat === 'eigen' ? `${pinArt(p.art)[sprache]} ${p.notiz || ''}` : feld(kategorie(p.kat), 'name')} ${county(p.county)?.name ?? ''}`
  }));
  const gtadb = sichtbareCommunity().map((o) => ({
    art: 'gtadb', id: o.id, kat: o.kat, name: o.name, x: o.x, y: o.y, county: o.county, gewicht: 1,
    zusatz: `${lageText(o)} ${artText(o.art)} ${feld(kategorie(o.kat), 'name')} ${county(o.county)?.name ?? ''}`
  }));
  const strassen = zustand.daten.strassen.strassen.map((s) => ({
    art: 'strasse', id: s.id, name: s.name, x: s.x, y: s.y, county: s.county, gewicht: s.ungefaehr ? 0 : 2, strasse: s,
    zusatz: `${t(s.fern ? 't_fern' : 't_strasse')} ${s.gebiet ?? ''} ${county(s.county)?.name ?? ''}`
  }));
  return [...pins, ...namen, ...strassen, ...gtadb];
}

function trefferAnfliegen(e) {
  if (e.art === 'strasse') { strasseZeigen(e.strasse); return; }
  if (e.art === 'gtadb') {
    if (!punktOeffnen(k, e.id)) { zustand.filter.countys.clear(); zustand.filter.kategorien.clear(); filterGeaendert().then(() => punktOeffnen(k, e.id)); }
    return;
  }
  if (e.art === 'pin') {
    if (!pinOeffnen(k, e.id)) {           // vom Filter ausgeblendet: Filter lösen, dann öffnen
      zustand.filter.countys.clear(); zustand.filter.kategorien.clear();
      filterGeaendert().then(() => pinOeffnen(k, e.id));
    }
    return;
  }
  const zoom = { county: -1, stadt: 0, gewaesser: 0, insel: 0.5, gebiet: 0.5, viertel: 1, poi: 1 }[e.typ] ?? 0.5;
  const latlng = stelleMarkieren(k, e, zoom);
  k.karte.once('moveend', () => kartenKlick({ x: e.x, y: e.y }, latlng, e.name));
}

function sucheVerdrahten() {
  const eingabe = $('#suche'); const liste = $('#suche-liste'); const status = $('#suche-status');
  let treffer = []; let aktivIdx = -1;
  const schliessen = () => { liste.hidden = true; eingabe.setAttribute('aria-expanded', 'false'); eingabe.removeAttribute('aria-activedescendant'); aktivIdx = -1; };
  const markieren = (i) => {
    if (!treffer.length) return;
    aktivIdx = i;
    for (const [j, li] of [...liste.children].entries()) li.setAttribute('aria-selected', String(j === i));
    const li = liste.children[i];
    if (li) { eingabe.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({ block: 'nearest' }); }
  };
  const waehlen = (i) => {
    const e = treffer[i];
    if (!e) return;
    schliessen(); eingabe.value = e.name; eingabe.blur(); trefferAnfliegen(e);
  };
  const zeigen = () => {
    const anfrage = eingabe.value.trim();
    treffer = anfrage ? suchen(anfrage, suchEintraege(), 8) : [];
    const gitter = zustand.daten.karte.gitter;
    liste.replaceChildren(...treffer.map((e, i) => el('li', { id: `treffer-${i}`, role: 'option', 'aria-selected': 'false', onmousedown: (ev) => { ev.preventDefault(); waehlen(i); } },
      el('span', { class: 'treffer-name', text: e.name }),
      el('span', { class: 'treffer-zusatz', text: e.art === 'strasse' ? `${t(e.strasse.fern ? 't_fern' : 't_strasse')} · ${county(e.county)?.name ?? t('ohneCounty')} · ${e.strasse.ungefaehr ? t('lageUnbekannt') : planquadrat(e.x, e.y, gitter)}` : `${e.art !== 'name' ? (e.kat === 'eigen' ? t('t_pin') : feld(kategorie(e.kat), 'name')) : t('t_' + e.typ)} · ${county(e.county)?.name ?? t('ohneCounty')} · ${planquadrat(e.x, e.y, gitter)}` }))));
    if (anfrage && !treffer.length) liste.replaceChildren(el('li', { class: 'leer', role: 'option', 'aria-disabled': 'true', text: t('keineTreffer') }));
    liste.hidden = !anfrage;
    eingabe.setAttribute('aria-expanded', String(Boolean(anfrage)));
    status.textContent = anfrage ? (treffer.length ? t('treffer', { n: treffer.length }) : t('keineTreffer')) : '';
    aktivIdx = -1; eingabe.removeAttribute('aria-activedescendant');
  };
  eingabe.addEventListener('input', zeigen);
  eingabe.addEventListener('focus', () => { if (eingabe.value.trim()) zeigen(); });
  eingabe.addEventListener('blur', () => setTimeout(schliessen, 150));
  eingabe.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); if (liste.hidden) zeigen(); markieren(Math.min(treffer.length - 1, aktivIdx + 1)); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); markieren(Math.max(0, aktivIdx - 1)); }
    else if (ev.key === 'Enter') { ev.preventDefault(); waehlen(aktivIdx >= 0 ? aktivIdx : 0); }
    else if (ev.key === 'Escape') { if (!liste.hidden) { ev.preventDefault(); schliessen(); } else eingabe.value = ''; }
  });
}

function steuerungVerdrahten() {
  sucheVerdrahten();
  $('#profil-wahl').addEventListener('change', async (e) => {
    zustand.aktivId = e.target.value; zustand.offeneKapitel = null; await speicher.einstellungSchreiben('aktivesProfil', zustand.aktivId); allesZeichnen();
  });
  $('#spoiler').addEventListener('click', async () => {
    if (zustand.spoilerfrei && !confirm(t('spoilerFrage'))) return;
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
  $('#filter-alle').addEventListener('click', () => { zustand.filter.countys.clear(); zustand.filter.kategorien.clear(); filterGeaendert(); });
  $('#ganze-karte').addEventListener('click', () => ganzeKarte(k));
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
    const a = el('a', { href: URL.createObjectURL(blob), download: `map-plusplus-fortschritt-${new Date().toISOString().slice(0, 10)}.json` });
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
    } catch (fehler) { alert(t('importFehler', { fehler: fehler.message })); }
  });
  const spr = $('#sprache');
  spr.replaceChildren(...sprachen.map((s) => new Option(s.toUpperCase(), s, false, s === sprache)));
  spr.addEventListener('change', async (e) => {
    setzeSprache(e.target.value); await speicher.einstellungSchreiben('sprache', e.target.value); uebersetzeSeite(); k.karte.closePopup(); allesZeichnen(); speicherHinweis();
  });

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
start().catch((e) => {
  console.error(e);
  $('#startfehler').hidden = false; $('#startfehler').textContent = t('ladefehler', { fehler: e.message });
});
