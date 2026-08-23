import { NextRequest, NextResponse } from "next/server";
import {
  getDay, addEntry, updateEntry, deleteEntry, geldigeDatum, nieuwId,
  noteerRecent, entryNaarTemplate,
} from "@/lib/tracker/data";
import { naarGram, rawPoints } from "@/lib/tracker/points";
import { CATEGORIEEN, MAALTIJDEN_TRACKER } from "@/lib/tracker/types";

const BRONNEN: EntrySource[] = ["barcode", "search", "manual", "photo", "link", "recipe", "favorite"];
import type { Category, Entry, EntrySource, Maaltijd, Nutrients } from "@/lib/tracker/types";

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
  const nutrients = leesNutrients(body?.nutrients ?? body);
  const amount = nummer(body?.amount, 100);
  const unit = String(body?.unit ?? "g").trim() || "g";
  const grams = nummer(body?.grams, naarGram(amount, unit));

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
    points_raw: rawPoints(nutrients, grams),
    ...(body?.note ? { note: String(body.note).slice(0, 300) } : {}),
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
