import type { Category, Nutrients, Entry, DayTotals } from "./types";

// ---------------------------------------------------------------------------
// De puntenformule.
//
// Eigen, transparante formule. Calorieën, verzadigd vet en effectieve suiker
// maken een product duurder; eiwit en vezels maken het goedkoper. Daardoor
// komen groente en magere eiwitbronnen vanzelf op nul uit, zonder dat er een
// aparte lijst met gratis producten nodig is.
// ---------------------------------------------------------------------------

export const COEF = {
  kcal: 0.024,
  satfat: 0.2, // verzadigd vet, g
  sugar: 0.1, // effectieve suiker, g
  protein: 0.075, // eiwit, g
  fiber: 0.05, // vezels, g
} as const;

// Aftrek voor van nature aanwezige suiker, in gram per 100 g product.
// EU-etiketten en Open Food Facts geven alleen totale suikers, dus inclusief
// lactose en fruitsuiker. Zonder deze correctie wordt magere kwark onterecht
// duur. De waarde 99 betekent in de praktijk "alles is intrinsiek".
export const INTRINSIC_SUGAR: Record<Category, number> = {
  default: 0,
  dairy_plain: 5.0,
  fruit_whole: 99,
  vegetable: 99,
  legume: 99,
  nuts_seeds: 99,
};

/**
 * Effectieve suiker in gram voor de gelogde hoeveelheid.
 *
 * `grams` is het massa-equivalent van die hoeveelheid. De aftrek in
 * INTRINSIC_SUGAR staat per 100 g en wordt daarom meegeschaald: 150 g magere
 * yoghurt krijgt 7,5 g aftrek, niet 5 g. Rekenen we dat niet mee, dan wordt
 * een grotere portie per gram steeds duurder — precies het probleem dat deze
 * correctie moet oplossen.
 */
export function effectiveSugar(n: Nutrients, grams = 100): number {
  if (n.added_sugar_g != null) return Math.max(0, n.added_sugar_g);
  const per100 = INTRINSIC_SUGAR[n.category ?? "default"] ?? 0;
  const intrinsiek = per100 * (grams / 100);
  return Math.max(0, n.sugar_g - intrinsiek);
}

/**
 * Onafgeronde punten voor de gelogde hoeveelheid, zonder points_scale.
 *
 * Deze waarde gaat de database in. De schaal en de afronding komen er pas bij
 * de weergave overheen (zie `toonPunten`), zodat afrondingsfouten zich niet
 * opstapelen over een dag met tien regels en zodat een andere schaal het hele
 * logboek meteen meeneemt.
 */
export function rawPoints(n: Nutrients, grams = 100): number {
  return (
    COEF.kcal * n.kcal +
    COEF.satfat * n.satfat_g +
    COEF.sugar * effectiveSugar(n, grams) -
    COEF.protein * n.protein_g -
    COEF.fiber * n.fiber_g
  );
}

/** Punten zoals ze op het scherm komen: geschaald, afgerond, nooit negatief. */
export function toonPunten(raw: number, scale = 1): number {
  return Math.max(0, Math.round(raw * scale));
}

/** Rechtstreeks van voedingswaarden naar zichtbare punten. */
export function calcPoints(n: Nutrients, grams = 100, scale = 1): number {
  return toonPunten(rawPoints(n, grams), scale);
}

/**
 * Massa-equivalent in gram voor een hoeveelheid + eenheid.
 * Alleen nodig voor de suikercorrectie, dus een ruwe schatting volstaat.
 * Onbekende eenheden (stuk, portie) vallen terug op 100 g per eenheid, wat
 * neerkomt op "pas de aftrek per 100 g één keer toe".
 */
export function naarGram(amount: number, unit: string): number {
  const u = (unit || "").trim().toLowerCase();
  const a = Number.isFinite(amount) ? amount : 0;
  if (u === "g" || u === "gram" || u === "ml") return a;
  if (u === "kg" || u === "l" || u === "liter") return a * 1000;
  return a * 100;
}

/** Telt alle regels van een dag op. Rekent op points_raw, niet op afgeronde punten. */
export function berekenTotalen(entries: Entry[]): DayTotals {
  return entries.reduce<DayTotals>(
    (t, e) => ({
      points_raw: t.points_raw + e.points_raw,
      kcal: t.kcal + e.nutrients.kcal,
      protein_g: t.protein_g + e.nutrients.protein_g,
      fat_g: t.fat_g + e.nutrients.fat_g,
      satfat_g: t.satfat_g + e.nutrients.satfat_g,
      carbs_g: t.carbs_g + e.nutrients.carbs_g,
      sugar_g: t.sugar_g + e.nutrients.sugar_g,
      fiber_g: t.fiber_g + e.nutrients.fiber_g,
    }),
    { points_raw: 0, kcal: 0, protein_g: 0, fat_g: 0, satfat_g: 0, carbs_g: 0, sugar_g: 0, fiber_g: 0 }
  );
}
