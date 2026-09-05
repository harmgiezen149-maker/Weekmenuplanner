import { ingredientNaarGram, normaliseerEenheid } from "./tracker/recept.ts";
import type { Ingredient } from "./types";

// ---------------------------------------------------------------------------
// Ingrediënten waarvan de maat niets zegt.
//
// "Peper en zout — naar smaak" staat in half het internet, en het is een prima
// instructie voor een kok. Voor de puntentelling is het niets: er valt geen
// gram van te maken, dus het ingredient valt stilzwijgend buiten het totaal.
// Er wordt met opzet niet naar 100 g teruggevallen — bij olie zou dat een
// recept in zijn eentje verdubbelen — maar een gat dat niemand ziet is ook geen
// oplossing.
//
// Vandaar dit lijstje: bij het opslaan van een recept wordt gevraagd wat je
// ermee bedoelt, één keer, met een voorstel erbij.
// ---------------------------------------------------------------------------

export interface Onleesbaar {
  /** Plaats in de ingrediëntenlijst van het recept. */
  index: number;
  naam: string;
  /** De maat zoals hij er staat: "naar smaak", "flinke scheut", "".  */
  eenheid: string;
  hoev: number;
  /** Wat de app zou invullen als je niets doet. */
  voorstel: { hoev: number; eenheid: string };
}

/**
 * Zinnen die vaak als eenheid in een recept staan, met wat ze in de praktijk
 * betekenen. Ruim aan de lage kant gekozen: een te hoge aanname kost punten die
 * je niet gegeten hebt, en dat is erger dan een te lage.
 */
const VOORSTELLEN: { patroon: RegExp; hoev: number; eenheid: string }[] = [
  { patroon: /naar smaak|naar eigen smaak|indien gewenst|optioneel/, hoev: 1, eenheid: "snufje" },
  { patroon: /scheut|straal|gulp/, hoev: 1, eenheid: "el" },
  { patroon: /beetje|wat |vleugje|tikkeltje|zweempje/, hoev: 1, eenheid: "snufje" },
  { patroon: /flink|royaal|ruim/, hoev: 2, eenheid: "el" },
  { patroon: /hand|greep/, hoev: 1, eenheid: "handje" },
  { patroon: /snee|sneetje|boterham/, hoev: 1, eenheid: "snee" },
  { patroon: /bodem|laagje/, hoev: 2, eenheid: "el" },
  { patroon: /pluk|takje|blaadje/, hoev: 1, eenheid: "takje" },
];

/** Waar de app op terugvalt als de tekst nergens op lijkt. */
export const STANDAARD_VOORSTEL = { hoev: 1, eenheid: "snufje" };

/**
 * Welke ingrediënten een maat hebben waar niets van te maken valt.
 *
 * Er wordt gerekend met dezelfde functie als de puntentelling, zodat deze lijst
 * precies de ingrediënten bevat die anders buiten het totaal vallen — geen
 * ingredient meer en geen minder.
 */
export function onleesbareMaten(ingredienten: Pick<Ingredient, "naam" | "hoev" | "eenheid">[]): Onleesbaar[] {
  const uit: Onleesbaar[] = [];

  ingredienten.forEach((i, index) => {
    const naam = (i.naam ?? "").trim();
    if (naam === "") return;
    if (!ingredientNaarGram(Number(i.hoev), i.eenheid ?? "").onbekend) return;

    uit.push({
      index,
      naam,
      eenheid: (i.eenheid ?? "").trim(),
      hoev: Number(i.hoev) || 0,
      voorstel: voorstelVoor(i.eenheid ?? "", naam),
    });
  });

  return uit;
}

/**
 * Wat de app voorstelt bij zo'n maat.
 *
 * De naam telt mee, want de maat zelf is soms leeg terwijl het ingredient het
 * verraadt ("olijfolie naar smaak" komt ook binnen als naam "olijfolie naar
 * smaak" met een lege eenheid).
 */
export function voorstelVoor(eenheid: string, naam = ""): { hoev: number; eenheid: string } {
  const tekst = `${normaliseerEenheid(eenheid)} ${naam.toLowerCase()}`;
  for (const v of VOORSTELLEN) {
    if (v.patroon.test(tekst)) return { hoev: v.hoev, eenheid: v.eenheid };
  }
  return { ...STANDAARD_VOORSTEL };
}

/**
 * De ingrediëntenlijst met de aangevulde maten erin.
 *
 * Een keuze zonder eenheid betekent "laat maar weg": het ingredient blijft in
 * het recept staan zoals het was, want in de bereiding hoort peper en zout
 * gewoon thuis — het telt alleen niet mee in de punten.
 */
export function metAangevuldeMaten<T extends Pick<Ingredient, "naam" | "hoev" | "eenheid">>(
  ingredienten: T[],
  keuzes: Record<number, { hoev: number; eenheid: string } | null>
): T[] {
  return ingredienten.map((i, index) => {
    const keuze = keuzes[index];
    if (!keuze || !keuze.eenheid.trim()) return i;
    return { ...i, hoev: keuze.hoev, eenheid: keuze.eenheid.trim() };
  });
}
