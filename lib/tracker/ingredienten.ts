import type { Product } from "./types";
import { schoonIngredient } from "./recept.ts";

// ---------------------------------------------------------------------------
// Je eigen ingrediëntenlijst.
//
// De ingebouwde basislijst kent de gewone dingen, maar niet harissa, tahin of
// het kruidenmengsel dat jij toevallig gebruikt. Wat daar ontbreekt vul je één
// keer aan, en dat geldt daarna voor élk recept waar het in zit — de sleutel is
// de genormaliseerde naam van het ingrediënt, niet het recept.
//
// De lijst staat als één blok in Redis. Bij het doorrekenen van de recepten is
// hij in zijn geheel nodig, en het gaat om tientallen regels; dan is één lezen
// beter dan een lezing per ingrediënt.
// ---------------------------------------------------------------------------

export interface IngredientBibliotheek {
  /**
   * Loopt op bij elke wijziging. Zit in de vingerafdruk van een recept, zodat
   * doorgerekende recepten opnieuw worden berekend zodra je iets aanvult.
   * Zonder dit zou een aangevuld ingrediënt pas meetellen na een wijziging aan
   * het recept zelf.
   */
  revisie: number;
  producten: Record<string, Product>;
}

export const LEGE_BIBLIOTHEEK: IngredientBibliotheek = { revisie: 0, producten: {} };

/**
 * Sleutel voor een ingrediëntnaam. Bereidingswoorden en accenten gaan eraf,
 * zodat "verse spinazie", "Spinazie" en "spinazie, gewassen" dezelfde regel
 * treffen.
 */
export function ingredientSleutel(naam: string): string {
  return schoonIngredient(naam)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Zoekt een ingrediënt in de eigen lijst.
 *
 * Eerst op de exacte sleutel. Levert dat niets op, dan telt een regel waarvan
 * de sleutel volledig in de gezochte naam voorkomt: wie "harissa" heeft
 * ingevuld, wil dat ook terugzien bij "harissa pasta". Van meerdere zulke
 * treffers wint de langste, want die is het meest specifiek.
 */
export function zoekEigenIngredient(
  bib: IngredientBibliotheek,
  naam: string
): Product | null {
  const sleutel = ingredientSleutel(naam);
  if (sleutel === "") return null;

  const exact = bib.producten[sleutel];
  if (exact) return exact;

  const woorden = ` ${sleutel} `;
  let beste: { sleutel: string; product: Product } | null = null;
  for (const [k, p] of Object.entries(bib.producten)) {
    if (k.length < 3) continue;
    if (!woorden.includes(` ${k} `) && !sleutel.startsWith(`${k} `) && !sleutel.endsWith(` ${k}`)) {
      continue;
    }
    if (!beste || k.length > beste.sleutel.length) beste = { sleutel: k, product: p };
  }
  return beste?.product ?? null;
}

/** Zet een aangevuld ingrediënt in de lijst en hoogt de revisie op. */
export function metIngredient(
  bib: IngredientBibliotheek,
  naam: string,
  product: Product
): IngredientBibliotheek {
  const sleutel = ingredientSleutel(naam);
  if (sleutel === "") return bib;
  return {
    revisie: bib.revisie + 1,
    producten: { ...bib.producten, [sleutel]: { ...product, id: `eigen:${sleutel}` } },
  };
}

export function zonderIngredient(
  bib: IngredientBibliotheek,
  sleutel: string
): IngredientBibliotheek {
  if (!(sleutel in bib.producten)) return bib;
  const producten = { ...bib.producten };
  delete producten[sleutel];
  return { revisie: bib.revisie + 1, producten };
}

/** Alle regels, op naam gesorteerd, voor het beheerscherm. */
export function alleIngredienten(
  bib: IngredientBibliotheek
): { sleutel: string; product: Product }[] {
  return Object.entries(bib.producten)
    .map(([sleutel, product]) => ({ sleutel, product }))
    .sort((a, b) => a.product.name.localeCompare(b.product.name));
}

/**
 * Welke namen uit een recept nog een schatting nodig hebben.
 *
 * Haalt eruit wat de eigen lijst al kent, gooit dubbelen weg (twee recepten
 * schrijven "verse spinazie" en "spinazie", dat is één schatting waard) en
 * begrenst het aantal, zodat één druk op de knop nooit een onbeperkt aantal
 * modelaanroepen wordt.
 *
 * De eerste van een groep dubbelen wint, want dat is hoe hij in het recept
 * staat en dus wat de gebruiker terugziet.
 */
export function teSchatten(
  bib: IngredientBibliotheek,
  namen: string[],
  max = 25
): string[] {
  const uit: string[] = [];
  const gezien = new Set<string>();

  for (const ruw of namen) {
    const naam = String(ruw ?? "").trim();
    const sleutel = ingredientSleutel(naam);
    if (sleutel === "" || gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    if (zoekEigenIngredient(bib, naam)) continue;
    uit.push(naam);
    if (uit.length >= max) break;
  }

  return uit;
}
