import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { leesSchatting } from "@/lib/tracker/schatting";
import { CATEGORIEEN } from "@/lib/tracker/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Gelijkgehouden met de rest van de app. De SDK hier kent nog geen structured
// outputs, dus de JSON wordt via de systeeminstructie afgedwongen en daarna
// defensief gelezen.
const MODEL = "claude-sonnet-4-6";

const SYSTEM =
  "Je geeft de gemiddelde voedingswaarden PER 100 GRAM (of per 100 ml bij een vloeistof) " +
  "van een ingrediënt. Geef UITSLUITEND geldige JSON terug, geen uitleg, geen markdown. " +
  'Schema: {"naam":"...","eenheid":"g","per100":{"kcal":0,"protein_g":0,"fat_g":0,' +
  '"satfat_g":0,"carbs_g":0,"sugar_g":0,"fiber_g":0,"category":"..."},"toelichting":"één korte zin"}. ' +
  "category kies je uit: " + CATEGORIEEN.join(", ") + ". Gebruik dairy_plain alleen bij zuivel " +
  "zonder toegevoegde suiker, fruit_whole bij vers heel fruit, vegetable bij groente, legume bij " +
  "peulvruchten, nuts_seeds bij noten en zaden, en anders default. " +
  "Ga uit van het onbewerkte product zoals je het in een recept gebruikt. " +
  "Ken je het ingrediënt niet, geef dan {\"naam\":\"\"} terug in plaats van te gokken. " +
  "Namen in het Nederlands.";

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
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM,
      messages: [{ role: "user", content: `Ingrediënt: ${naam.slice(0, 80)}` }],
    });

    const tekst = res.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("\n");

    const schatting = leesSchatting(tekst);
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
