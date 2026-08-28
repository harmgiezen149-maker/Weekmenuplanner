import { NextRequest, NextResponse } from "next/server";
import {
  getWegingen, saveWeging, deleteWeging, verwerkWeging, getProfile, geldigeDatum, datumSleutel,
  getWegingNotitie,
} from "@/lib/tracker/data";
import { metTrend, huidigeTrend, voortgang, tempoPerWeek } from "@/lib/tracker/gewicht";
import { moetWegen } from "@/lib/tracker/week";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await bouwAntwoord());
}

/**
 * Grenzen van een geldig gewicht. Buiten dit bereik gaat het om een typefout,
 * en die hoort niet in de trendlijn terecht te komen.
 */
const MIN_KG = 20;
const MAX_KG = 400;

function foutInGewicht(kg: number): string | null {
  return Number.isFinite(kg) && kg >= MIN_KG && kg <= MAX_KG
    ? null
    : `Vul een gewicht tussen ${MIN_KG} en ${MAX_KG} kg in`;
}

/**
 * Een datum die de trendlijn aankan.
 *
 * Niet in de toekomst: de trend rekent vooruit vanaf de laatste meting, en een
 * weging van volgende week zou die lijn laten kantelen op een getal dat nog
 * niet bestaat.
 */
function foutInDatum(datum: unknown): string | null {
  if (!geldigeDatum(datum)) return "Ongeldige datum";
  if (String(datum) > datumSleutel()) return "Een weging in de toekomst kan niet";
  return null;
}

/** Nieuwe weging. Vervangt een bestaande weging op dezelfde dag. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const datum = body?.date == null ? datumSleutel() : String(body.date);
  const datumFout = foutInDatum(datum);
  if (datumFout) return NextResponse.json({ error: datumFout }, { status: 400 });

  const kg = Number(body?.kg);
  const kgFout = foutInGewicht(kg);
  if (kgFout) return NextResponse.json({ error: kgFout }, { status: 400 });

  const note = typeof body?.note === "string" ? body.note.slice(0, 200) : undefined;
  const wegingen = await saveWeging(datum, kg, note);

  // Het budget volgt de trend, niet de losse meting.
  const trend = huidigeTrend(wegingen);
  const { herberekend } = trend != null
    ? await verwerkWeging(trend)
    : { herberekend: false };

  return NextResponse.json({ ...(await bouwAntwoord()), herberekend }, { status: 201 });
}

/**
 * Een bestaande weging aanpassen: het gewicht, de datum, of allebei.
 *
 * Een datum wijzigen is verhuizen, want de datum ís de sleutel. Staat er op de
 * nieuwe dag al een weging, dan zou die stilletjes verdwijnen — één weging per
 * dag is de regel die de trendlijn eerlijk houdt. Daarom komt daar eerst een
 * 409 terug met wat er in de weg staat, en pas met `vervang: true` gebeurt het
 * echt. Het scherm kan zo vragen in plaats van iets weg te gooien.
 */
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const van = String(body?.van ?? "");
  if (!geldigeDatum(van)) {
    return NextResponse.json({ error: "Ongeldige datum" }, { status: 400 });
  }
  const naar = body?.naar == null ? van : String(body.naar);
  const datumFout = foutInDatum(naar);
  if (datumFout) return NextResponse.json({ error: datumFout }, { status: 400 });

  const kg = Number(body?.kg);
  const kgFout = foutInGewicht(kg);
  if (kgFout) return NextResponse.json({ error: kgFout }, { status: 400 });

  const bestaand = await getWegingen();
  if (!bestaand.some((w) => w.date === van)) {
    return NextResponse.json(
      { error: "Op die datum staat geen weging meer. Ververs de pagina." },
      { status: 404 }
    );
  }

  const botsing = naar !== van ? bestaand.find((w) => w.date === naar) : undefined;
  if (botsing && body?.vervang !== true) {
    return NextResponse.json(
      {
        error: "Op die dag staat al een weging",
        botsing: { datum: botsing.date, kg: botsing.kg },
      },
      { status: 409 }
    );
  }

  // De notitie hoort bij de weging, niet bij de dag: hij verhuist mee tenzij
  // je hem meestuurt.
  const note = typeof body?.note === "string"
    ? body.note.slice(0, 200)
    : await getWegingNotitie(van);

  if (naar !== van) await deleteWeging(van);
  const wegingen = await saveWeging(naar, kg, note);

  const trend = huidigeTrend(wegingen);
  const { herberekend } = trend != null
    ? await verwerkWeging(trend)
    : { herberekend: false };

  return NextResponse.json({ ...(await bouwAntwoord()), herberekend });
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
