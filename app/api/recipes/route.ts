import { NextRequest, NextResponse } from "next/server";
import { getAllRecepten, saveRecept, newId } from "@/lib/data";
import type { Recept } from "@/lib/types";
import { zonderFoto, zonderFotos, nieuweFotoWaarde } from "@/lib/receptfotos";

export const dynamic = "force-dynamic";

export async function GET() {
  const recepten = await getAllRecepten();
  // Zonder de foto's. Met foto's erin was dit antwoord ruim tien megabyte, en
  // dat bij elke keer dat de app opengaat. Elke foto heeft nu zijn eigen
  // adres: /api/recipes/<id>/foto.
  return NextResponse.json(zonderFotos(recepten));
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<Recept>;
  const recept: Recept = {
    id: body.id || newId(),
    titel: body.titel || "Naamloos recept",
    keuken: body.keuken || "Overig",
    hoofd: body.hoofd || "Vlees",
    maaltijd: body.maaltijd || "Avondeten",
    moeilijkheid: body.moeilijkheid || "Makkelijk",
    tijd: Number(body.tijd) || 30,
    score: Number(body.score) || 0,
    personen: Number(body.personen) || 4,
    gegeten: Number(body.gegeten) || 0,
    // Een nieuw recept heeft nog geen foto om te bewaren, dus is er ook niets
    // te beschermen: alleen een echte data-URL komt erin.
    afbeelding: nieuweFotoWaarde(body.afbeelding, ""),
    ingredienten: Array.isArray(body.ingredienten) ? body.ingredienten : [],
    bereiding: body.bereiding || "",
  };
  await saveRecept(recept);
  // Ook terug zonder de foto: het scherm zet dit antwoord rechtstreeks in de
  // receptenlijst, en daar hoort geen data-URL in te belanden.
  return NextResponse.json(zonderFoto(recept), { status: 201 });
}
