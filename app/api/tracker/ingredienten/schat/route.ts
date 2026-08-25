import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { schatIngredient } from "@/lib/tracker/schat-model";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Schat de voedingswaarden van één ingrediënt.
 *
 * Bedoeld om het invullen te versnellen, niet om het over te nemen: het
 * antwoord komt in een bewerkbaar formulier terecht en wordt pas bewaard nadat
 * de gebruiker het heeft nagekeken.
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
  const naam = String(body?.naam ?? "").trim();
  if (naam.length < 2) {
    return NextResponse.json({ error: "Geef een ingrediëntnaam op" }, { status: 400 });
  }

  try {
    const schatting = await schatIngredient(new Anthropic({ apiKey: key }), naam);
    if (!schatting) {
      return NextResponse.json(
        { error: `Geen betrouwbare schatting voor "${naam}". Vul de waarden zelf in.` },
        { status: 422 }
      );
    }
    return NextResponse.json({ schatting });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Even te druk. Probeer het zo nog eens." }, { status: 429 });
    }
    return NextResponse.json(
      { error: "Schatten mislukt. Vul de waarden zelf in." },
      { status: 502 }
    );
  }
}
