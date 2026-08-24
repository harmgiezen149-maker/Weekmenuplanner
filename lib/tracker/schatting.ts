import { CATEGORIEEN } from "./types.ts";
import type { Category, Nutrients } from "./types";

// ---------------------------------------------------------------------------
// Het antwoord van een geschat ingredient uitlezen.
//
// Zeven getallen opzoeken per ontbrekend ingredient is veel werk, dus er is een
// knop die een schatting vraagt. Het antwoord is nadrukkelijk een voorstel: het
// komt in een bewerkbaar formulier en wordt pas bewaard nadat je het hebt
// nagekeken.
//
// Er is geen schemagarantie, dus alles wordt gecontroleerd. Losse module zodat
// het zonder netwerk te testen is.
// ---------------------------------------------------------------------------

export interface Schatting {
  naam: string;
  eenheid: "g" | "ml";
  per100: Nutrients;
  /** Korte toelichting van waar de schatting op gebaseerd is. */
  toelichting?: string;
}

export function leesSchatting(tekst: string): Schatting | null {
  const schoon = tekst.replace(/```json|```/g, "").trim();
  const start = schoon.indexOf("{");
  const eind = schoon.lastIndexOf("}");
  if (start < 0 || eind <= start) return null;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(schoon.slice(start, eind + 1));
  } catch {
    return null;
  }

  const naam = String(data?.naam ?? "").trim();
  const per100rauw = (data?.per100 ?? data) as Record<string, unknown>;
  const kcal = nummer(per100rauw?.kcal);

  // Zonder naam of zonder calorieen valt er niets mee te beginnen.
  if (!naam || kcal <= 0) return null;

  const categorie = CATEGORIEEN.includes(per100rauw?.category as Category)
    ? (per100rauw.category as Category)
    : "default";

  const per100: Nutrients = {
    kcal,
    protein_g: nummer(per100rauw?.protein_g),
    fat_g: nummer(per100rauw?.fat_g),
    satfat_g: nummer(per100rauw?.satfat_g),
    carbs_g: nummer(per100rauw?.carbs_g),
    sugar_g: nummer(per100rauw?.sugar_g),
    fiber_g: nummer(per100rauw?.fiber_g),
    category: categorie,
  };

  // Onmogelijke combinaties rechtzetten in plaats van doorlaten.
  if (per100.satfat_g > per100.fat_g) per100.satfat_g = per100.fat_g;
  if (per100.sugar_g > per100.carbs_g) per100.sugar_g = per100.carbs_g;

  return {
    naam: naam.slice(0, 80),
    eenheid: data?.eenheid === "ml" ? "ml" : "g",
    per100,
    ...(data?.toelichting ? { toelichting: String(data.toelichting).slice(0, 200) } : {}),
  };
}

function nummer(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 1000) : 0;
}
