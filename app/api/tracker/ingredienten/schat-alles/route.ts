import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getIngredienten, saveIngredienten } from "@/lib/tracker/ingredienten-opslag";
import { teSchatten, alleIngredienten } from "@/lib/tracker/ingredienten";
import { schatReeks } from "@/lib/tracker/schat-bulk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  const uitslag = await schatReeks(new Anthropic({ apiKey: key }), bib, namen);
  if (uitslag.gelukt.length > 0) await saveIngredienten(uitslag.bib);

  return NextResponse.json({
    gelukt: uitslag.gelukt,
    mislukt: uitslag.mislukt,
    overgeslagen,
    ingredienten: alleIngredienten(uitslag.bib),
    revisie: uitslag.bib.revisie,
  });
}
