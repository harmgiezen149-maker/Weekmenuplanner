import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIEEN } from "@/lib/tracker/types";
import { leesItems } from "@/lib/tracker/foto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Model gelijkgehouden met de rest van de app. De SDK in dit project
// (0.32.x) kent nog geen structured outputs, dus de JSON wordt afgedwongen
// via de systeeminstructie en daarna defensief gelezen.
const MODEL = "claude-sonnet-4-6";

const SYSTEM =
  "Je schat voedingswaarden van eten op een foto. Geef UITSLUITEND geldige JSON terug, " +
  "geen uitleg, geen markdown, geen tekst eromheen. Schema: " +
  '{"items":[{"name":"...","amount":150,"unit":"g","kcal":0,"protein_g":0,"fat_g":0,' +
  '"satfat_g":0,"carbs_g":0,"sugar_g":0,"added_sugar_g":0,"fiber_g":0,' +
  '"category":"...","confidence":"hoog|midden|laag"}]}. ' +
  "Alle voedingswaarden gelden voor de geschatte hoeveelheid op het bord, niet per 100 g. " +
  "added_sugar_g is alleen de TOEGEVOEGDE suiker; is die er niet, zet hem op 0. " +
  "category kies je uit: " + CATEGORIEEN.join(", ") + ". Gebruik dairy_plain alleen bij " +
  "zuivel zonder toegevoegde suiker, fruit_whole bij vers heel fruit, vegetable bij groente, " +
  "legume bij peulvruchten, nuts_seeds bij noten en zaden, en anders default. " +
  "confidence is laag als je de portiegrootte slecht kunt inschatten. " +
  "Splits het bord op in herkenbare onderdelen. Namen in het Nederlands.";

/**
 * Schat de voedingswaarden van een foto van een bord.
 *
 * Het antwoord is nadrukkelijk een CONCEPT: de client toont het bewerkbaar en
 * slaat pas op nadat de gebruiker het heeft nagekeken. Een schatting uit een
 * foto is een startpunt, geen meting.
 */
export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY ontbreekt. Zonder die sleutel werkt de foto-schatting niet; handmatig invoeren wel." },
      { status: 503 }
    );
  }

  const body = await req.json();
  const dataUrl = String(body?.afbeelding ?? "");
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(dataUrl);
  if (!match) {
    return NextResponse.json({ error: "Geen bruikbare afbeelding ontvangen" }, { status: 400 });
  }

  const [, mediaType, base64] = match;
  if (base64.length > 7_000_000) {
    return NextResponse.json({ error: "De foto is te groot" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: key });

  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType as "image/jpeg", data: base64 },
          },
          {
            type: "text",
            text: body?.notitie
              ? `Wat ligt hier op het bord? Extra informatie van de gebruiker: ${String(body.notitie).slice(0, 300)}`
              : "Wat ligt hier op het bord?",
          },
        ],
      }],
    });

    const tekst = res.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("\n");

    const items = leesItems(tekst);
    if (items.length === 0) {
      return NextResponse.json(
        { error: "Er was op deze foto geen eten te herkennen. Probeer een andere foto of vul het handmatig in." },
        { status: 422 }
      );
    }

    return NextResponse.json({ items });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Even te druk. Probeer het zo nog eens." }, { status: 429 });
    }
    if (e instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "De ANTHROPIC_API_KEY wordt niet geaccepteerd." }, { status: 401 });
    }
    return NextResponse.json(
      { error: "De foto kon niet worden verwerkt. Vul het gerecht handmatig in." },
      { status: 502 }
    );
  }
}
