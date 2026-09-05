import { NextRequest, NextResponse } from "next/server";
import { getRecept, saveRecept, deleteRecept } from "@/lib/data";
import type { Recept } from "@/lib/types";
import { nieuweFotoWaarde, zonderFoto } from "@/lib/receptfotos";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await getRecept(id);
  if (!existing) {
    return NextResponse.json({ error: "Recept niet gevonden" }, { status: 404 });
  }
  const patch = (await req.json()) as Partial<Recept>;
  const updated: Recept = {
    ...existing, ...patch, id,
    // De browser heeft de foto zelf niet meer, alleen het adres ervan. Komt
    // dat adres ongewijzigd terug, dan blijft staan wat er staat — anders
    // overschreef een gewone titelwijziging je foto met een pad.
    afbeelding: nieuweFotoWaarde(patch.afbeelding, existing.afbeelding),
  };
  delete updated.heeftFoto;
  await saveRecept(updated);
  return NextResponse.json(zonderFoto(updated));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteRecept(id);
  return NextResponse.json({ ok: true });
}
