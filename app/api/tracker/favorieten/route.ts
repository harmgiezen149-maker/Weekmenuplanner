import { NextRequest, NextResponse } from "next/server";
import { getFavorieten, addFavoriet, deleteFavoriet, getRecent, nieuwId } from "@/lib/tracker/data";
import { naarGram, rawPoints } from "@/lib/tracker/points";
import { CATEGORIEEN } from "@/lib/tracker/types";
import type { Category, FoodTemplate, Nutrients } from "@/lib/tracker/types";

export const dynamic = "force-dynamic";

// Favorieten en recent komen in één antwoord: het invoerscherm toont ze samen
// bovenaan en heeft ze allebei tegelijk nodig.
export async function GET() {
  const [favorieten, recent] = await Promise.all([getFavorieten(), getRecent()]);
  return NextResponse.json({ favorieten, recent });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const naam = String(body?.name ?? "").trim();
  if (!naam) return NextResponse.json({ error: "Naam is verplicht" }, { status: 400 });

  const nutrients = leesNutrients(body?.nutrients ?? body);
  const amount = nummer(body?.amount, 100);
  const unit = String(body?.unit ?? "g").trim() || "g";
  const grams = nummer(body?.grams, naarGram(amount, unit));

  const favoriet: FoodTemplate = {
    id: nieuwId(),
    name: naam,
    ...(body?.brand ? { brand: String(body.brand).slice(0, 80) } : {}),
    source: "favorite",
    amount,
    unit,
    grams,
    nutrients,
    points_raw: rawPoints(nutrients, grams),
    ...(body?.ref ? { ref: String(body.ref).slice(0, 64) } : {}),
    last_used: Date.now(),
  };

  return NextResponse.json({ favorieten: await addFavoriet(favoriet) }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is verplicht" }, { status: 400 });
  return NextResponse.json({ favorieten: await deleteFavoriet(id) });
}

function leesNutrients(n: any): Nutrients {
  const categorie: Category = CATEGORIEEN.includes(n?.category) ? n.category : "default";
  const toegevoegd = n?.added_sugar_g;
  return {
    kcal: nummer(n?.kcal, 0),
    protein_g: nummer(n?.protein_g, 0),
    fat_g: nummer(n?.fat_g, 0),
    satfat_g: nummer(n?.satfat_g, 0),
    carbs_g: nummer(n?.carbs_g, 0),
    sugar_g: nummer(n?.sugar_g, 0),
    fiber_g: nummer(n?.fiber_g, 0),
    ...(toegevoegd == null || toegevoegd === "" ? {} : { added_sugar_g: nummer(toegevoegd, 0) }),
    category: categorie,
  };
}

function nummer(v: unknown, standaard: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : standaard;
}
