import Anthropic from "@anthropic-ai/sdk";
import { schatIngredient } from "./schat-model.ts";
import { metIngredient } from "./ingredienten.ts";
import type { IngredientBibliotheek } from "./ingredienten";
import type { Schatting } from "./schatting";

// ---------------------------------------------------------------------------
// Een reeks ingredienten in één keer laten schatten.
//
// Staat los van de routes omdat twee plekken het nodig hebben — het aanvullen
// van één recept en het bijwerken van het hele kookboek — en twee kopieën van
// deze lus onvermijdelijk uit elkaar lopen.
//
// Wat het model niet kent blijft onbekend en wordt met naam teruggemeld. Daar
// wordt niet naar geraden: een verzonnen voedingswaarde is erger dan een
// ontbrekende, want je ziet er niets aan.
// ---------------------------------------------------------------------------

/** Tegelijk lopende modelaanroepen. Snel genoeg, en niet meteen tegen een
 *  snelheidslimiet aan. */
export const TEGELIJK = 4;

export interface BulkUitslag {
  gelukt: { naam: string; product: string; toelichting?: string }[];
  mislukt: { naam: string; reden: string }[];
  /** De bijgewerkte lijst. Gelijk aan de invoer als er niets gelukt is. */
  bib: IngredientBibliotheek;
}

/**
 * Schat de gegeven namen en zet ze in de lijst.
 *
 * De lijst wordt als geheel teruggegeven en niet per schatting bijgewerkt: hij
 * wordt ook als geheel bewaard, dus twee schrijfacties door elkaar zouden
 * elkaars werk overschrijven.
 */
export async function schatReeks(
  client: Anthropic,
  bib: IngredientBibliotheek,
  namen: string[]
): Promise<BulkUitslag> {
  const uitkomsten = await inGroepjes(namen, TEGELIJK, async (naam) => {
    try {
      return { naam, schatting: await schatIngredient(client, naam), reden: "" };
    } catch (e) {
      const traag = e instanceof Anthropic.RateLimitError;
      return { naam, schatting: null, reden: traag ? "even te druk" : "schatten mislukt" };
    }
  });

  let nieuw = bib;
  const gelukt: BulkUitslag["gelukt"] = [];
  const mislukt: BulkUitslag["mislukt"] = [];

  for (const u of uitkomsten) {
    if (!u.schatting) {
      mislukt.push({ naam: u.naam, reden: u.reden || "niet herkend door het model" });
      continue;
    }
    nieuw = metIngredient(nieuw, u.naam, naarProduct(u.naam, u.schatting));
    gelukt.push({
      naam: u.naam,
      product: u.schatting.naam,
      ...(u.schatting.toelichting ? { toelichting: u.schatting.toelichting } : {}),
    });
  }

  return { gelukt, mislukt, bib: nieuw };
}

export function naarProduct(naam: string, s: Schatting) {
  return {
    id: naam,
    name: s.naam.slice(0, 80),
    // Gemerkt als schatting, niet als eigen invoer: deze getallen heeft
    // niemand nagekeken en dat hoort zichtbaar te blijven.
    bron: "schatting" as const,
    eenheid: s.eenheid,
    per100: s.per100,
  };
}

/**
 * Doet het werk in groepjes van `n` tegelijk, met het resultaat in dezelfde
 * volgorde als de invoer.
 */
export async function inGroepjes<T, R>(
  items: T[],
  n: number,
  doe: (item: T) => Promise<R>
): Promise<R[]> {
  const uit: R[] = [];
  for (let i = 0; i < items.length; i += n) {
    uit.push(...await Promise.all(items.slice(i, i + n).map(doe)));
  }
  return uit;
}
