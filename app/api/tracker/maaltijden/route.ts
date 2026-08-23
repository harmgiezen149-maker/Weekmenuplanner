import { NextRequest, NextResponse } from "next/server";
import {
  getMaaltijden, saveMaaltijd, deleteMaaltijd, nieuwId,
} from "@/lib/tracker/data";
import { rawPoints } from "@/lib/tracker/points";
import { CATEGORIEEN, MAALTIJDEN_TRACKER } from "@/lib/tracker/types";
import type { Category, Maaltijd, MaaltijdComponent, Maaltijdsjabloon, Nutrients } from "@/lib/tracker/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ maaltijden: await getMaaltijden() });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const naam = String(body?.name ?? "").trim();
  if (!naam) return NextResponse.json({ error: "Geef de maaltijd een naam" }, { status: 400 });

  const rauw = Array.isArray(body?.components) ? body.components : [];
  if (rauw.length === 0) {
    return NextResponse.json({ error: "Een maaltijd heeft minstens één onderdeel" }, { status: 400 });
  }

  // De punten per onderdeel worden hier berekend, niet door de client
  // aangeleverd, en nadrukkelijk niet over de opgetelde voedingswaarden: de
  // suikercorrectie hangt aan de categorie van elk onderdeel apart.
  const components: MaaltijdComponent[] = rauw.map(leesComponent);

  const maaltijd: Maaltijdsjabloon = {
    id: typeof body?.id === "string" && body.id ? body.id : nieuwId(),
    name: naam.slice(0, 80),
    meal: MAALTIJDEN_TRACKER.includes(body?.meal) ? (body.meal as Maaltijd) : "ontbijt",
    components,
    created_at: Number(body?.created_at) || Date.now(),
    last_used: Date.now(),
  };

  return NextResponse.json({ maaltijden: await saveMaaltijd(maaltijd) }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is verplicht" }, { status: 400 });
  return NextResponse.json({ maaltijden: await deleteMaaltijd(id) });
}

function leesComponent(c: any): MaaltijdComponent {
  const nutrients = leesNutrients(c?.nutrients ?? c);
  const grams = nummer(c?.grams, nummer(c?.amount, 100));
  return {
    id: typeof c?.id === "string" && c.id ? c.id : nieuwId(),
    name: String(c?.name ?? "Onderdeel").slice(0, 80),
    ...(c?.brand ? { brand: String(c.brand).slice(0, 80) } : {}),
    amount: nummer(c?.amount, grams),
    unit: String(c?.unit ?? "g").trim() || "g",
    grams,
    nutrients,
    points_raw: rawPoints(nutrients, grams),
  };
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
