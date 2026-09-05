import { NextRequest, NextResponse } from "next/server";
import { matchIngredient } from "@/lib/tracker/recept";
import { getIngredienten } from "@/lib/tracker/ingredienten-opslag";

export const dynamic = "force-dynamic";

/** Zoveel namen tegelijk; het scherm biedt er hooguit een handvol aan. */
const MAX = 8;

/**
 * Kijkt of deze namen in de productlijst voorkomen, zonder iets te wijzigen.
 *
 * Nodig omdat het bijstelscherm anders namen voorstelt die het net zo min
 * kent: "volkorenmeel (havermeel)" valt uiteen in "volkorenmeel" en
 * "havermeel", en geen van beide staat in de lijst — dan is zo'n knopje geen
 * hulp maar een omweg. Nu weet het scherm vooraf welke naam iets oplevert.
 *
 * Kost geen modelaanroep: dit is dezelfde matcher als de puntentelling.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const namen = (Array.isArray(body?.namen) ? body.namen : [])
    .slice(0, MAX)
    .map((n: unknown) => String(n ?? "").trim())
    .filter((n: string) => n !== "");

  if (namen.length === 0) return NextResponse.json({ uitslagen: [] });

  const bib = await getIngredienten();

  return NextResponse.json({
    uitslagen: namen.map((naam: string) => {
      // Honderd gram is hier een willekeurige hoeveelheid: het gaat om de
      // vraag of de náám iets oplevert, niet om het gewicht.
      const m = matchIngredient(naam, 100, "g", bib);
      return {
        naam,
        product: m.overgeslagen || !m.product ? null : m.product.name,
      };
    }),
  });
}
