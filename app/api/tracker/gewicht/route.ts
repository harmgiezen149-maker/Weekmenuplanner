import { NextRequest, NextResponse } from "next/server";
import {
  getWegingen, saveWeging, deleteWeging, verwerkWeging, getProfile, geldigeDatum, datumSleutel,
  getWegingNotitie,
} from "@/lib/tracker/data";
import { metTrend, huidigeTrend, voortgang, tempoPerWeek, GRENZEN } from "@/lib/tracker/gewicht";
import type { Weging } from "@/lib/tracker/gewicht";
import { moetWegen } from "@/lib/tracker/week";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await bouwAntwoord());
}

/**
 * Buiten deze grenzen gaat het om een typefout, en die hoort niet in de
 * trendlijn terecht te komen.
 */
function foutInGewicht(kg: number): string | null {
  const { min, max } = GRENZEN.kg;
  return Number.isFinite(kg) && kg >= min && kg <= max
    ? null
    : `Vul een gewicht tussen ${min} en ${max} kg in`;
}

type Samenstelling = Pick<Weging, "vet_pct" | "spier_kg" | "vocht_pct">;

/**
 * De metingen van een weegschaal met lichaamsanalyse, uit de aanvraag.
 *
 * Alles optioneel: een leeg veld betekent "niet gemeten" en wordt niet bewaard.
 * Wat er wél staat moet binnen zijn bereik vallen — een vetpercentage van 380
 * is een verschoven komma, geen meting, en die zou de reeks jarenlang scheef
 * trekken.
 *
 * Spiermassa mag als percentage binnenkomen (`spier_eenheid: "pct"`). Die twee
 * reeksen overlappen bijna volledig — 38 kan 38 kilo zijn of 38 procent van je
 * gewicht — dus het scherm zegt welke van de twee het is en hier wordt het
 * omgerekend. In de opslag staat altijd kilo.
 *
 * `basis` is wat er al stond, bij het aanpassen van een bestaande weging. Een
 * veld dat helemaal niet meegestuurd wordt blijft dan staan; een veld dat leeg
 * meekomt wordt gewist. Zonder dat onderscheid zou het corrigeren van een
 * gewicht je vetpercentage van die dag weggooien.
 */
function leesSamenstelling(
  body: unknown, kg: number, basis: Samenstelling = {}
): Samenstelling | { fout: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const uit: Samenstelling = {};

  for (const veld of ["vet_pct", "vocht_pct"] as const) {
    if (b[veld] === undefined) {
      if (basis[veld] != null) uit[veld] = basis[veld];
      continue;
    }
    if (b[veld] === null || b[veld] === "") continue;
    const n = Number(b[veld]);
    const { min, max } = GRENZEN[veld];
    if (!Number.isFinite(n) || n < min || n > max) {
      const naam = veld === "vet_pct" ? "vetpercentage" : "vochtgehalte";
      return { fout: `Vul een ${naam} tussen ${min} en ${max}% in` };
    }
    uit[veld] = rond(n);
  }

  if (b.spier === undefined && b.spier_kg === undefined) {
    if (basis.spier_kg != null) uit.spier_kg = basis.spier_kg;
  } else if (b.spier != null && b.spier !== "") {
    const n = Number(b.spier);
    const procent = b.spier_eenheid === "pct";
    const { min, max } = procent ? GRENZEN.spier_pct : GRENZEN.spier_kg;
    if (!Number.isFinite(n) || n < min || n > max) {
      return {
        fout: procent
          ? `Vul een spiermassa tussen ${min} en ${max}% in`
          : `Vul een spiermassa tussen ${min} en ${max} kg in`,
      };
    }
    uit.spier_kg = rond(procent ? (kg * n) / 100 : n);
  }

  return uit;
}

/** Eén decimaal; meer nauwkeurigheid dan een weegschaal geeft is schijn. */
function rond(n: number): number {
  return Math.round(n * 10) / 10;
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

  const samenstelling = leesSamenstelling(body, kg);
  if ("fout" in samenstelling) {
    return NextResponse.json({ error: samenstelling.fout }, { status: 400 });
  }

  const note = typeof body?.note === "string" ? body.note.slice(0, 200) : undefined;
  const wegingen = await saveWeging(datum, kg, note, samenstelling);

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
  const oud = bestaand.find((w) => w.date === van);
  const samenstelling = leesSamenstelling(body, kg, {
    ...(oud?.vet_pct != null ? { vet_pct: oud.vet_pct } : {}),
    ...(oud?.spier_kg != null ? { spier_kg: oud.spier_kg } : {}),
    ...(oud?.vocht_pct != null ? { vocht_pct: oud.vocht_pct } : {}),
  });
  if ("fout" in samenstelling) {
    return NextResponse.json({ error: samenstelling.fout }, { status: 400 });
  }

  const note = typeof body?.note === "string"
    ? body.note.slice(0, 200)
    : await getWegingNotitie(van);

  if (naar !== van) await deleteWeging(van);
  const wegingen = await saveWeging(naar, kg, note, samenstelling);

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
