// Woher Position und Fortschritt kommen. Heute nur von Hand. Die Schnittstelle steht schon,
// damit spätere Quellen (Trophäen, PC-Brücke) ohne Umbau dazukommen.
//
// Ein Provider hat: id, name (Textschlüssel), text (Textschlüssel), aktiv, und später optional
//   fortschritt() -> Promise<[{id, an, zeit}]>   (z. B. aus Trophäen)
//   position(rueckruf) -> abmelden()             (z. B. aus einer PC-Brücke)

export const alleProvider = [
  { id: 'manuell', name: 'provManuell', text: 'provManuellText', aktiv: true },
  { id: 'trophaeen', name: 'provTrophaeen', text: 'provTrophaeenText', aktiv: false },
  { id: 'pc-bruecke', name: 'provPc', text: 'provPcText', aktiv: false }
];
