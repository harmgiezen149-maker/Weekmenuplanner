import type { MaaltijdComponent, Nutrients } from "./types";
import { rawPoints } from "./points.ts";

// ---------------------------------------------------------------------------
// Samengestelde maaltijden.
//
// Belangrijkste regel: de punten van een maaltijd zijn de SOM van de punten
// per onderdeel, niet een herberekening over de opgetelde voedingswaarden.
//
// Dat is geen detail. De suikercorrectie hangt aan de categorie van het
// onderdeel: de melksuiker in een glas melk telt niet mee, de suiker van een
// banaan ook niet, maar die van havermout wel. Tel je eerst alles op en pas je
// daarna één categorie toe, dan komt datzelfde ontbijt op 12 punten uit in
// plaats van 9.
// ---------------------------------------------------------------------------

/** Punten voor één onderdeel, met zijn eigen categorie en portiegrootte. */
export function componentPunten(c: Pick<MaaltijdComponent, "nutrients" | "grams">): number {
  return rawPoints(c.nutrients, c.grams);
}

export interface MaaltijdTotaal {
  points_raw: number;
  grams: number;
  nutrients: Nutrients;
}

/**
 * Telt de onderdelen van een maaltijd op.
 *
 * De voedingswaarden worden gewoon gesommeerd — die zijn optelbaar. De punten
 * niet: die komen per onderdeel binnen en worden alleen bij elkaar geteld.
 */
export function telComponentenOp(componenten: MaaltijdComponent[]): MaaltijdTotaal {
  const nutrients: Nutrients = {
    kcal: 0, protein_g: 0, fat_g: 0, satfat_g: 0,
    carbs_g: 0, sugar_g: 0, fiber_g: 0, category: "default",
  };
  let points_raw = 0;
  let grams = 0;

  for (const c of componenten) {
    nutrients.kcal += c.nutrients.kcal;
    nutrients.protein_g += c.nutrients.protein_g;
    nutrients.fat_g += c.nutrients.fat_g;
    nutrients.satfat_g += c.nutrients.satfat_g;
    nutrients.carbs_g += c.nutrients.carbs_g;
    nutrients.sugar_g += c.nutrients.sugar_g;
    nutrients.fiber_g += c.nutrients.fiber_g;
    points_raw += c.points_raw;
    grams += c.grams;
  }

  return { points_raw, grams, nutrients };
}

/**
 * Schaalt een maaltijd naar een deel van het geheel, bijvoorbeeld één portie
 * van een recept voor vier personen. Punten en voedingswaarden schalen
 * allebei lineair, dus de suikercorrectie per onderdeel blijft overeind.
 */
export function schaalComponenten(
  componenten: MaaltijdComponent[],
  factor: number
): MaaltijdComponent[] {
  if (!Number.isFinite(factor) || factor <= 0) return componenten;
  return componenten.map((c) => ({
    ...c,
    amount: c.amount * factor,
    grams: c.grams * factor,
    points_raw: c.points_raw * factor,
    nutrients: {
      ...c.nutrients,
      kcal: c.nutrients.kcal * factor,
      protein_g: c.nutrients.protein_g * factor,
      fat_g: c.nutrients.fat_g * factor,
      satfat_g: c.nutrients.satfat_g * factor,
      carbs_g: c.nutrients.carbs_g * factor,
      sugar_g: c.nutrients.sugar_g * factor,
      fiber_g: c.nutrients.fiber_g * factor,
      ...(c.nutrients.added_sugar_g != null
        ? { added_sugar_g: c.nutrients.added_sugar_g * factor }
        : {}),
    },
  }));
}
