import { NextRequest, NextResponse } from "next/server";
import {
  getWegingen, saveWeging, deleteWeging, verwerkWeging, getProfile, geldigeDatum, datumSleutel,
} from "@/lib/tracker/data";
import { metTrend, huidigeTrend, voortgang, tempoPerWeek } from "@/lib/tracker/gewicht";
import { moetWegen } from "@/lib/tracker/week";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await bouwAntwoord());
}

/** Nieuwe weging. Vervangt een bestaande weging op dezelfde dag. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const datum = geldigeDatum(body?.date) ? body.date : datumSleutel();
  const kg = Number(body?.kg);

  if (!Number.isFinite(kg) || kg < 20 || kg > 400) {
    return NextResponse.json({ error: "Vul een gewicht tussen 20 en 400 kg in" }, { status: 400 });
  }

  const note = typeof body?.note === "string" ? body.note.slice(0, 200) : undefined;
  const wegingen = await saveWeging(datum, kg, note);

  // Het budget volgt de trend, niet de losse meting.
  const trend = huidigeTrend(wegingen);
  const { herberekend } = trend != null
    ? await verwerkWeging(trend)
    : { herberekend: false };

  return NextResponse.json({ ...(await bouwAntwoord()), herberekend }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const datum = req.nextUrl.searchParams.get("datum");
  if (!geldigeDatum(datum)) {
    return NextResponse.json({ error: "Ongeldige datum" }, { status: 400 });
  }
  const wegingen = await deleteWeging(datum);
  const trend = huidigeTrend(wegingen);
  if (trend != null) await verwerkWeging(trend);
  return NextResponse.json(await bouwAntwoord());
}

async function bouwAntwoord() {
  const [wegingen, profiel] = await Promise.all([getWegingen(), getProfile()]);
  const reeks = metTrend(wegingen);
  const laatste = reeks.length > 0 ? reeks[reeks.length - 1] : null;
  const vandaag = datumSleutel();

  return {
    wegingen: reeks,
    profiel,
    tempoPerWeek: tempoPerWeek(wegingen),
    voortgang: profiel && laatste
      ? voortgang(profiel.start_weight_kg, laatste.trend_kg, profiel.goal_weight_kg)
      : null,
    moetWegen: profiel
      ? moetWegen(vandaag, profiel.weigh_day, laatste?.date ?? null)
      : false,
  };
}
