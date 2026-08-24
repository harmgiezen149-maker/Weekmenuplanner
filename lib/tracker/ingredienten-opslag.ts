import { redis } from "../redis";
import type { IngredientBibliotheek } from "./ingredienten";
import { LEGE_BIBLIOTHEEK } from "./ingredienten";

// ---------------------------------------------------------------------------
// Opslag van je eigen ingredientenlijst.
//
// Key: `wl:ingredienten`. Apart gehouden van lib/tracker/data.ts omdat die
// module al lang genoeg is en dit een op zichzelf staand stukje is.
//
// De lijst wordt als een geheel bewaard, niet als losse regels: bij het
// doorrekenen van recepten is hij in zijn geheel nodig, en het gaat om
// tientallen regels. Dan is een lezing beter dan een lezing per ingredient.
// ---------------------------------------------------------------------------

const INGREDIENTEN_KEY = "wl:ingredienten";

export async function getIngredienten(): Promise<IngredientBibliotheek> {
  const b = await redis.get<IngredientBibliotheek>(INGREDIENTEN_KEY);
  if (!b || typeof b !== "object") return LEGE_BIBLIOTHEEK;
  return {
    revisie: Number(b.revisie) || 0,
    producten: b.producten && typeof b.producten === "object" ? b.producten : {},
  };
}

export async function saveIngredienten(b: IngredientBibliotheek): Promise<IngredientBibliotheek> {
  await redis.set(INGREDIENTEN_KEY, b);
  return b;
}
