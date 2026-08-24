import { NextRequest, NextResponse } from "next/server";
import { getIngredienten, saveIngredienten } from "@/lib/tracker/ingredienten-opslag";
import { metIngredient, zonderIngredient, alleIngredienten } from "@/lib/tracker/ingredienten";
import { CATEGORIEEN } from "@/lib/tracker/types";
import type { Category, Nutrients } from "@/lib/tracker/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const bib = await getIngredienten();
  return NextResponse.json({
    ingredienten: alleIngredienten(bib),
    revisie: bib.revisie,
  });
}

/**
 * Vult één ingrediënt aan. Vanaf dat moment telt het mee in élk recept waar het
 * in voorkomt — de sleutel is de genormaliseerde naam, niet het recept waar je
 * hem invulde.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const naam = String(body?.naam ?? "").trim();
  if (!naam) {
    return NextResponse.json({ error: "Naam is verplicht" }, { status: 400 });
  }

  const per100 = leesNutrients(body?.per100 ?? body);
  if (per100.kcal <= 0 && per100.protein_g <= 0 && per100.fat_g <= 0) {
    return NextResponse.json(
      { error: "Vul minstens de calorieën in, anders valt er niets te berekenen" },
      { status: 400 }
    );
  }

  const bib = await getIngredienten();
  const nieuw = metIngredient(bib, naam, {
    id: naam,
    name: String(body?.weergavenaam ?? naam).slice(0, 80),
    bron: "eigen",
    eenheid: body?.eenheid === "ml" ? "ml" : "g",
    per100,
    ...(Number(body?.portie) > 0
      ? { portie: { grams: Number(body.portie), label: `${Number(body.portie)} g` } }
      : {}),
  });

  await saveIngredienten(nieuw);
  return NextResponse.json({
    ingredienten: alleIngredienten(nieuw),
    revisie: nieuw.revisie,
  }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const sleutel = req.nextUrl.searchParams.get("sleutel");
  if (!sleutel) return NextResponse.json({ error: "sleutel is verplicht" }, { status: 400 });

  const nieuw = zonderIngredient(await getIngredienten(), sleutel);
  await saveIngredienten(nieuw);
  return NextResponse.json({ ingredienten: alleIngredienten(nieuw), revisie: nieuw.revisie });
}

function leesNutrients(n: any): Nutrients {
  const categorie: Category = CATEGORIEEN.includes(n?.category) ? n.category : "default";
  return {
    kcal: nummer(n?.kcal),
    protein_g: nummer(n?.protein_g),
    fat_g: nummer(n?.fat_g),
    satfat_g: nummer(n?.satfat_g),
    carbs_g: nummer(n?.carbs_g),
    sugar_g: nummer(n?.sugar_g),
    fiber_g: nummer(n?.fiber_g),
    category: categorie,
  };
}

function nummer(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
