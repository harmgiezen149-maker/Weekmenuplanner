import { NextRequest, NextResponse } from "next/server";
import { addActiviteit, deleteActiviteit, geldigeDatum, getProfile, nieuwId } from "@/lib/tracker/data";
import { activiteitPunten, vindActiviteit } from "@/lib/tracker/activiteit";
import { bmr, leeftijd } from "@/lib/tracker/budget";
import type { Activity } from "@/lib/tracker/types";

export const dynamic = "force-dynamic";

/**
 * Legt een activiteit vast. De punten worden hier berekend uit het profiel:
 * verbranding hangt af van je gewicht, en de rustverbranding die eraf gaat
 * van je basaal metabolisme.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const datum = body?.datum;
  if (!geldigeDatum(datum)) {
    return NextResponse.json({ error: "Ongeldige datum" }, { status: 400 });
  }

  const soort = vindActiviteit(String(body?.soort ?? ""));
  if (!soort) {
    return NextResponse.json({ error: "Onbekende activiteit" }, { status: 400 });
  }

  const minuten = Number(body?.minuten);
  if (!Number.isFinite(minuten) || minuten <= 0 || minuten > 600) {
    return NextResponse.json({ error: "Vul een duur tussen 1 en 600 minuten in" }, { status: 400 });
  }

  const profiel = await getProfile();
  if (!profiel) {
    return NextResponse.json({ error: "Vul eerst je profiel in" }, { status: 400 });
  }

  const basaal = bmr(
    profiel.sex, profiel.current_weight_kg, profiel.height_cm,
    leeftijd(profiel.birthdate)
  );

  const activiteit: Activity = {
    id: nieuwId(),
    ts: Date.now(),
    name: soort.naam,
    met: soort.met,
    minutes: minuten,
    // Onafgerond opslaan zou hier niets toevoegen: bewegingspunten worden niet
    // opgeteld bij het eten maar bij het budget, en dat is al een heel getal.
    points: activiteitPunten(soort.met, profiel.current_weight_kg, minuten, basaal, profiel.points_scale),
  };

  return NextResponse.json(await addActiviteit(datum, activiteit), { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const datum = req.nextUrl.searchParams.get("datum");
  const id = req.nextUrl.searchParams.get("id");
  if (!geldigeDatum(datum)) return NextResponse.json({ error: "Ongeldige datum" }, { status: 400 });
  if (!id) return NextResponse.json({ error: "id is verplicht" }, { status: 400 });
  return NextResponse.json(await deleteActiviteit(datum, id));
}
