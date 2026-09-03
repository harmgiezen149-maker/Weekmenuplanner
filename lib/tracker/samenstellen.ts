import type { Entry, Maaltijd, MaaltijdComponent } from "./types";

// ---------------------------------------------------------------------------
// Van een gelogd eetmoment een vaste maaltijd of een recept maken.
//
// Wat je vanochtend at is de beste beschrijving van je vaste ontbijt die er
// bestaat: het staat er al, met hoeveelheden en al. Tot nu toe moest je het
// in de maaltijdbouwer nóg een keer bij elkaar zoeken.
// ---------------------------------------------------------------------------

/** Een onderdeel zonder id; de server deelt de ids uit. */
export type Onderdeel = Omit<MaaltijdComponent, "id">;

/** De maaltijdnamen van de tracker naar die van het kookboek. */
export const KOOKBOEK_MAALTIJD: Record<Maaltijd, string> = {
  ontbijt: "Ontbijt", lunch: "Lunch", diner: "Avondeten", snack: "Toetje",
};

/**
 * De onderdelen van een eetmoment.
 *
 * Een regel die zelf al uit onderdelen bestaat — een recept, een vaste
 * maaltijd — wordt uitgeklapt in plaats van als één onderdeel overgenomen.
 * Dat is geen cosmetiek: de punten van zo'n regel zijn de SOM van de
 * onderdelen, elk met zijn eigen categorie. Zou je de regel als één onderdeel
 * bewaren, dan rekent de server hem opnieuw uit over de opgetelde
 * voedingswaarden en telt de melksuiker in de yoghurt ineens wél mee.
 */
export function onderdelenUitRegels(regels: Entry[]): Onderdeel[] {
  const uit: Onderdeel[] = [];

  for (const e of regels) {
    if (e.components && e.components.length > 0) {
      for (const c of e.components) {
        const { id: _zonder, ...rest } = c;
        uit.push(rest);
      }
      continue;
    }
    uit.push({
      name: e.name,
      ...(e.brand ? { brand: e.brand } : {}),
      amount: e.amount,
      unit: e.unit,
      grams: e.grams,
      nutrients: e.nutrients,
      points_raw: e.points_raw,
    });
  }

  return uit;
}

/**
 * Dezelfde onderdelen als ingrediëntenregels voor het kookboek.
 *
 * In grammen, ook als er "3 × snee" gelogd stond: het kookboek rekent zijn
 * punten uit over hoeveelheden die het kan matchen met producten, en een
 * zelfbedachte stukseenheid herkent het niet. Twee keer hetzelfde product in
 * één maaltijd wordt één regel — een boodschappenlijst met twee keer "melk"
 * erop is een lijst waar je overheen leest.
 */
export function ingredientenUitOnderdelen(
  onderdelen: Onderdeel[]
): { naam: string; hoev: number; eenheid: string }[] {
  const samen = new Map<string, { naam: string; hoev: number; eenheid: string }>();

  for (const c of onderdelen) {
    const eenheid = c.unit.trim().toLowerCase() === "ml" ? "ml" : "g";
    const sleutel = `${c.name.trim().toLowerCase()}|${eenheid}`;
    const bestaand = samen.get(sleutel);
    if (bestaand) {
      bestaand.hoev = rond(bestaand.hoev + c.grams);
      continue;
    }
    samen.set(sleutel, { naam: c.name.trim(), hoev: rond(c.grams), eenheid });
  }

  return [...samen.values()];
}

/**
 * Een naam om mee te beginnen. Bij één regel is die regel de naam; bij meer
 * weet alleen jij hoe het geheel heet, en is "Lunch" een eerlijker startpunt
 * dan een opsomming van vier producten.
 */
export function standaardNaam(regels: Entry[], maaltijdLabel: string): string {
  if (regels.length === 1) return regels[0].name.slice(0, 80);
  return maaltijdLabel;
}

function rond(n: number): number {
  return Math.round(n * 100) / 100;
}
