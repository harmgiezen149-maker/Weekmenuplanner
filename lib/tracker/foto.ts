import { CATEGORIEEN } from "./types.ts";
import type { Category } from "./types";

// ---------------------------------------------------------------------------
// Foto-schatting: het antwoord van het model omzetten naar bruikbare items.
//
// Er is geen schemagarantie — de SDK in dit project kent nog geen structured
// outputs, dus de JSON wordt via de systeeminstructie afgedwongen en hier
// defensief gelezen. Alles wat niet klopt wordt rechtgezet of valt af; een
// halve schatting is beter dan een regel vol onzin.
// ---------------------------------------------------------------------------

export interface FotoItem {
  name: string;
  amount: number;
  unit: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  satfat_g: number;
  carbs_g: number;
  sugar_g: number;
  added_sugar_g: number;
  fiber_g: number;
  category: Category;
  confidence: "hoog" | "midden" | "laag";
}

/**
 * Leest de items uit het antwoord. Er is geen schemagarantie, dus alles wordt
 * gecontroleerd: onzin wordt nul, een onbekende categorie wordt default, en
 * een item zonder naam of zonder calorieen valt af.
 */
export function leesItems(tekst: string): FotoItem[] {
  const schoon = tekst.replace(/```json|```/g, "").trim();
  const start = schoon.indexOf("{");
  const eind = schoon.lastIndexOf("}");
  if (start < 0 || eind <= start) return [];

  let data: unknown;
  try {
    data = JSON.parse(schoon.slice(start, eind + 1));
  } catch {
    return [];
  }

  const rauw = (data as { items?: unknown })?.items;
  if (!Array.isArray(rauw)) return [];

  return rauw
    .map((i: Record<string, unknown>): FotoItem => ({
      name: String(i?.name ?? "").trim().slice(0, 80),
      amount: nummer(i?.amount, 100),
      unit: String(i?.unit ?? "g").trim().slice(0, 12) || "g",
      kcal: nummer(i?.kcal, 0),
      protein_g: nummer(i?.protein_g, 0),
      fat_g: nummer(i?.fat_g, 0),
      satfat_g: nummer(i?.satfat_g, 0),
      carbs_g: nummer(i?.carbs_g, 0),
      sugar_g: nummer(i?.sugar_g, 0),
      added_sugar_g: nummer(i?.added_sugar_g, 0),
      fiber_g: nummer(i?.fiber_g, 0),
      category: CATEGORIEEN.includes(i?.category as Category) ? (i.category as Category) : "default",
      confidence: i?.confidence === "hoog" || i?.confidence === "laag" ? i.confidence : "midden",
    }))
    .filter((i) => i.name.length > 0 && i.kcal > 0)
    .slice(0, 12);
}

function nummer(v: unknown, standaard: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : standaard;
}
