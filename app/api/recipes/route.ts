import { NextRequest, NextResponse } from "next/server";
import { getAllRecepten, saveRecept, newId } from "@/lib/data";
import type { Recept } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const recepten = await getAllRecepten();
  return NextResponse.json(recepten);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<Recept>;
  const recept: Recept = {
    id: body.id || newId(),
    titel: body.titel || "Naamloos recept",
    keuken: body.keuken || "Overig",
    hoofd: body.hoofd || "Vlees",
    moeilijkheid: body.moeilijkheid || "Makkelijk",
    tijd: Number(body.tijd) || 30,
    score: Number(body.score) || 0,
    personen: Number(body.personen) || 4,
    ingredienten: Array.isArray(body.ingredienten) ? body.ingredienten : [],
    bereiding: body.bereiding || "",
  };
  await saveRecept(recept);
  return NextResponse.json(recept, { status: 201 });
}
