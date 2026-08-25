import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { schatIngredient } from "@/lib/tracker/schat-model";
import { getIngredienten, saveIngredienten } from "@/lib/tracker/ingredienten-opslag";
import { metIngredient, teSchatten, alleIngredienten } from "@/lib/tracker/ingredienten";
import type { IngredientBibliotheek } from "@/lib/tracker/ingredienten";
import type { Schatting } from "@/lib/tracker/schatting";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Tegelijk lopende modelaanroepen. Genoeg om snel te zijn, laag genoeg om
 *  niet meteen tegen een snelheidslimiet aan te lopen. */
const TEGELIJK = 4;

/** Bovengrens per druk op de knop; een recept met meer ingredienten doe je
 *  in twee rondes. */
const MAX = 25;

/**
 * Vult in één keer alle nog onbekende ingredienten van een recept aan.
 *
 * Anders dan bij het losse schatten worden deze waarden meteen bewaard — dat
 * is de hele winst van de knop. Ze worden daarom gemerkt als `schatting`, en
 * de aanroeper krijgt terug wát er is ingevuld, zodat de gebruiker het na kan
 * lopen en per ingredient kan bijstellen.
 *
 * Wat het model niet kent blijft onbekend en wordt met naam teruggemeld; daar
 * wordt niet naar geraden.
 */
export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Zonder ANTHROPIC_API_KEY werkt schatten niet; zelf invullen wel." },
      { status: 503 }
    );
  }

  const body = await req.json();
  const gevraagd = Array.isArray(body?.namen) ? body.namen : [];
  if (gevraagd.length === 0) {
    return NextResponse.json({ error: "Geen ingredienten meegegeven" }, { status: 400 });
  }

  const bib = await getIngredienten();
  const namen = teSchatten(bib, gevraagd, MAX);
  const overgeslagen = Math.max(0, gevraagd.length - namen.length);

  if (namen.length === 0) {
    return NextResponse.json({
      gelukt: [], mislukt: [], overgeslagen,
      ingredienten: alleIngredienten(bib), revisie: bib.revisie,
    });
  }

  const client = new Anthropic({ apiKey: key });
  const uitkomsten = await inGroepjes(namen, TEGELIJK, async (naam) => {
    try {
      return { naam, schatting: await schatIngredient(client, naam) };
    } catch (e) {
      const traag = e instanceof Anthropic.RateLimitError;
      return {
        naam,
        schatting: null,
        reden: traag ? "even te druk" : "schatten mislukt",
      };
    }
  });

  // Alles in één keer wegschrijven. Per schatting opslaan zou betekenen dat
  // twee gelijktijdige schrijfacties elkaars lijst overschrijven, want de
  // lijst wordt als geheel bewaard.
  let nieuw: IngredientBibliotheek = bib;
  const gelukt: { naam: string; product: string; toelichting?: string }[] = [];
  const mislukt: { naam: string; reden: string }[] = [];

  for (const u of uitkomsten) {
    if (!u.schatting) {
      mislukt.push({ naam: u.naam, reden: u.reden ?? "niet herkend door het model" });
      continue;
    }
    nieuw = metIngredient(nieuw, u.naam, naarProduct(u.naam, u.schatting));
    gelukt.push({
      naam: u.naam,
      product: u.schatting.naam,
      ...(u.schatting.toelichting ? { toelichting: u.schatting.toelichting } : {}),
    });
  }

  if (gelukt.length > 0) await saveIngredienten(nieuw);

  return NextResponse.json({
    gelukt, mislukt, overgeslagen,
    ingredienten: alleIngredienten(nieuw),
    revisie: nieuw.revisie,
  });
}

function naarProduct(naam: string, s: Schatting) {
  return {
    id: naam,
    name: s.naam.slice(0, 80),
    // Gemerkt als schatting, niet als eigen invoer: deze getallen heeft
    // niemand nagekeken en dat hoort zichtbaar te blijven.
    bron: "schatting" as const,
    eenheid: s.eenheid,
    per100: s.per100,
  };
}

/**
 * Doet het werk in groepjes van `n` tegelijk, met het resultaat in dezelfde
 * volgorde als de invoer.
 */
async function inGroepjes<T, R>(
  items: T[],
  n: number,
  doe: (item: T) => Promise<R>
): Promise<R[]> {
  const uit: R[] = [];
  for (let i = 0; i < items.length; i += n) {
    uit.push(...await Promise.all(items.slice(i, i + n).map(doe)));
  }
  return uit;
}
