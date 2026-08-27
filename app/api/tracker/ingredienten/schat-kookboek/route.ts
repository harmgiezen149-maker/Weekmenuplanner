import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAllRecepten } from "@/lib/data";
import { berekenReceptPunten } from "@/lib/tracker/recept";
import { getIngredienten, saveIngredienten } from "@/lib/tracker/ingredienten-opslag";
import { teSchatten, ingredientSleutel } from "@/lib/tracker/ingredienten";
import type { IngredientBibliotheek } from "@/lib/tracker/ingredienten";
import { schatReeks } from "@/lib/tracker/schat-bulk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Hoeveel ingredienten er per ronde geschat worden.
 *
 * Vier tegelijk, dus een ronde is ongeveer vijf slagen. Ruim binnen de
 * uitvoertijd van de route, en klein genoeg dat het scherm tussendoor kan
 * laten zien hoe ver het is. Het scherm roept net zo lang opnieuw aan tot er
 * niets meer bijkomt.
 */
const PER_RONDE = 20;

/**
 * Vult de gaten in het hele kookboek in één ronde tegelijk.
 *
 * Het paneel "recepten tellen nog niet alles mee" wees tot nu toe alleen aan
 * wáár de gaten zaten; je moest ze recept voor recept openen om ze te dichten.
 * Bij zestig recepten is dat werk dat niemand doet, en dan blijven de punten
 * structureel te laag.
 *
 * Welke ingredienten buiten de telling vallen wordt hier opnieuw bepaald en
 * niet door het scherm aangeleverd: het scherm kent per recept hoogstens de
 * eerste paar gaten, en dat is precies het verschil tussen "de gaten dichten"
 * en "de eerste zes dichten".
 *
 * Een maat die niet te lezen is ("een scheutje olie") wordt hier niet
 * aangeraakt. Dat is geen ontbrekend product maar een onleesbare hoeveelheid,
 * en die valt niet te schatten zonder te raden wat jij bedoelde.
 */
export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Zonder ANTHROPIC_API_KEY werkt schatten niet; zelf invullen wel." },
      { status: 503 }
    );
  }

  // Namen waar een vorige ronde al op stukliep. Zonder deze lijst zou een
  // ronde vol namen die het model niet kent de hele bewerking stilzetten,
  // terwijl er honderd bruikbare namen achter staan te wachten.
  const body = await req.json().catch(() => ({}));
  const overslaan = new Set(
    (Array.isArray(body?.overslaan) ? body.overslaan : [])
      .slice(0, 500)
      .map((n: unknown) => ingredientSleutel(String(n ?? "")))
  );

  const [recepten, bib] = await Promise.all([getAllRecepten(), getIngredienten()]);
  const { onbekend, maatOnbekend } = gaten(recepten, bib);

  // teSchatten ontdubbelt op sleutel: "verse spinazie" en "spinazie" zijn één
  // schatting waard.
  const alles = teSchatten(bib, onbekend, Number.MAX_SAFE_INTEGER)
    .filter((naam) => !overslaan.has(ingredientSleutel(naam)));
  const ronde = alles.slice(0, PER_RONDE);

  if (ronde.length === 0) {
    return NextResponse.json({
      gelukt: [], mislukt: [], resterend: 0, maatOnbekend: maatOnbekend.length,
    });
  }

  const uitslag = await schatReeks(new Anthropic({ apiKey: key }), bib, ronde);
  if (uitslag.gelukt.length > 0) await saveIngredienten(uitslag.bib);

  // Opnieuw tellen met de bijgewerkte lijst erbij. Een ingredient dat nu wél
  // bekend is kan alsnog een onleesbare maat hebben ("een vleugje saffraan");
  // dat gat verschijnt dus pas na deze ronde, en de telling van vóór het
  // schatten zou het missen.
  const maten = uitslag.gelukt.length > 0
    ? gaten(recepten, uitslag.bib).maatOnbekend.length
    : maatOnbekend.length;

  return NextResponse.json({
    gelukt: uitslag.gelukt,
    mislukt: uitslag.mislukt,
    // Wat er na deze ronde nog over is, de mislukte namen niet meegeteld —
    // die komen via `overslaan` niet meer terug.
    resterend: Math.max(0, alles.length - uitslag.gelukt.length - uitslag.mislukt.length),
    maatOnbekend: maten,
  });
}

/**
 * Welke ingredienten uit het kookboek buiten de puntentelling vallen.
 *
 * Zelfde regel als waarmee de punten berekend worden, want anders zou deze
 * knop iets anders dichten dan het paneel aanwijst.
 */
function gaten(
  recepten: { ingredienten: { naam: string; hoev: number; eenheid: string }[]; personen: number }[],
  bib: IngredientBibliotheek
): { onbekend: string[]; maatOnbekend: string[] } {
  const onbekend: string[] = [];
  const maatOnbekend: string[] = [];

  for (const r of recepten) {
    const ingredienten = r.ingredienten.map((i) => ({
      naam: i.naam, hoev: i.hoev, eenheid: i.eenheid,
    }));
    if (ingredienten.length === 0) continue;
    const berekend = berekenReceptPunten(ingredienten, r.personen, {}, bib);
    onbekend.push(...berekend.nietHerkend);
    maatOnbekend.push(...(berekend.maatOnbekend ?? []));
  }

  return { onbekend, maatOnbekend };
}
