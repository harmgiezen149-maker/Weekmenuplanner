import { NextRequest, NextResponse } from "next/server";
import {
  getDay, addEntry, updateEntry, deleteEntry, geldigeDatum, nieuwId,
  noteerRecent, entryNaarTemplate,
} from "@/lib/tracker/data";
import { naarGram, rawPoints } from "@/lib/tracker/points";
import { telComponentenOp } from "@/lib/tracker/maaltijd";
import { CATEGORIEEN, MAALTIJDEN_TRACKER } from "@/lib/tracker/types";

const BRONNEN: EntrySource[] = ["barcode", "search", "manual", "photo", "link", "recipe", "favorite", "meal"];
import type { Category, Entry, EntrySource, Maaltijd, MaaltijdComponent, Nutrients } from "@/lib/tracker/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ datum: string }> };

const fout = (bericht: string, status = 400) => NextResponse.json({ error: bericht }, { status });

export async function GET(_req: NextRequest, { params }: Params) {
  const { datum } = await params;
  if (!geldigeDatum(datum)) return fout("Ongeldige datum");
  return NextResponse.json(await getDay(datum));
}

// Nieuwe regel. De punten worden hier berekend, niet door de client
// aangeleverd: zo staat er maar één formule in de app.
export async function POST(req: NextRequest, { params }: Params) {
  const { datum } = await params;
  if (!geldigeDatum(datum)) return fout("Ongeldige datum");

  const body = await req.json();
  const naam = String(body?.name ?? "").trim();
  if (!naam) return fout("Naam is verplicht");

  const entry = bouwEntry(body, naam);
  const dag = await addEntry(datum, entry);

  // De regel staat in het logboek; de recente lijst is alleen een hulpmiddel
  // om hem terug te vinden. Faalt dat, dan is de regel niet minder opgeslagen.
  await noteerRecent(entryNaarTemplate(entry)).catch(() => {});

  return NextResponse.json(dag, { status: 201 });
}

// Bestaande regel bijwerken. Voedingswaarden worden opnieuw doorgerekend.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { datum } = await params;
  if (!geldigeDatum(datum)) return fout("Ongeldige datum");

  const body = await req.json();
  const id = String(body?.id ?? "");
  if (!id) return fout("id is verplicht");

  const naam = String(body?.name ?? "").trim();
  if (!naam) return fout("Naam is verplicht");

  const { id: _weg, ts: _ookWeg, ...rest } = bouwEntry(body, naam);
  return NextResponse.json(await updateEntry(datum, id, rest));
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { datum } = await params;
  if (!geldigeDatum(datum)) return fout("Ongeldige datum");

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return fout("id is verplicht");
  return NextResponse.json(await deleteEntry(datum, id));
}

// ---------------------------------------------------------------------------

function bouwEntry(body: any, naam: string): Entry {
  const componenten = leesComponenten(body?.components);

  // Bij een samengestelde maaltijd of een recept zijn de punten de SOM van de
  // onderdelen, niet een herberekening over de opgetelde voedingswaarden. De
  // suikercorrectie hangt namelijk aan de categorie van elk onderdeel apart:
  // de melksuiker in een glas melk telt niet mee, de suiker in havermout wel.
  // Eerst optellen en dan pas rekenen maakt zo'n ontbijt drie punten duurder.
  const samengesteld = componenten != null && componenten.length > 0;
  const totaal = samengesteld ? telComponentenOp(componenten!) : null;

  const nutrients = totaal ? totaal.nutrients : leesNutrients(body?.nutrients ?? body);
  const amount = nummer(body?.amount, totaal ? totaal.grams : 100);
  const unit = String(body?.unit ?? (totaal ? "g" : "g")).trim() || "g";
  const grams = nummer(body?.grams, totaal ? totaal.grams : naarGram(amount, unit));

  return {
    id: nieuwId(),
    ts: Number.isFinite(Number(body?.ts)) ? Number(body.ts) : Date.now(),
    meal: MAALTIJDEN_TRACKER.includes(body?.meal) ? (body.meal as Maaltijd) : "snack",
    source: BRONNEN.includes(body?.source) ? (body.source as EntrySource) : "manual",
    name: naam,
    ...(body?.brand ? { brand: String(body.brand).slice(0, 80) } : {}),
    amount,
    unit,
    grams,
    nutrients,
    points_raw: totaal ? totaal.points_raw : rawPoints(nutrients, grams),
    ...(body?.note ? { note: String(body.note).slice(0, 300) } : {}),
    ...(body?.ref ? { ref: String(body.ref).slice(0, 64) } : {}),
    ...(samengesteld ? { components: componenten! } : {}),
  };
}

/** Onderdelen van een maaltijd of recept; de punten worden hier herrekend. */
function leesComponenten(rauw: unknown): MaaltijdComponent[] | null {
  if (!Array.isArray(rauw) || rauw.length === 0) return null;
  return rauw.map((c: any) => {
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
  });
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
