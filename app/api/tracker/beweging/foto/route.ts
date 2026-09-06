import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { leesFotoActiviteiten } from "@/lib/tracker/beweging-foto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Model gelijkgehouden met de rest van de app.
const MODEL = "claude-sonnet-4-6";

const SYSTEM =
  "Je leest een screenshot van een overzicht van sportactiviteiten, bijvoorbeeld uit Garmin " +
  "Connect, Strava of Health Connect. Geef UITSLUITEND geldige JSON terug, geen uitleg, geen " +
  'markdown. Schema: {"activiteiten":[{"naam":"...","datum":"DD-MM-JJJJ","duur":"UU:MM:SS"}]}. ' +
  "Neem elke activiteit over die je op de foto ziet, ook als je de sport zelf niet herkent — geef " +
  "dan gewoon de naam over zoals hij op het scherm staat. naam is de titel van de activiteit " +
  "(bijvoorbeeld 'Renkum Wandelen' of 'Kracht'), niet een locatie of icoon apart. datum staat er " +
  "meestal bij in de vorm dag-maand-jaar; zie je geen datum, laat het veld dan leeg — verzin er " +
  "geen. duur is de trainingstijd zoals op het scherm staat (bijvoorbeeld '1:11:24' of '58:04'), " +
  "nooit de afstand of een ander getal. Heeft een activiteit geen duur, sla die rij dan over.";

/**
 * Leest een screenshot van een bewegingsoverzicht uit en levert er dezelfde
 * tekst voor terug als een geplakte lijst.
 *
 * Er wordt hier bewust niets geboekt: het antwoord komt terug in het plakveld,
 * zodat je het kunt nakijken en aanvullen voor je op Inlezen drukt. Precies
 * zoals bij elke andere import in deze app — een import is een startpunt, geen
 * eindresultaat.
 */
export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error: "ANTHROPIC_API_KEY ontbreekt. Zonder die sleutel werkt het inlezen van een " +
          "screenshot niet; plakken of handmatig invoeren wel.",
      },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const ruw: unknown[] = Array.isArray(body?.fotos) && body.fotos.length
    ? body.fotos
    : [body?.afbeelding];

  const beelden: { mediaType: string; data: string }[] = [];
  for (const dataUrl of ruw) {
    const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(String(dataUrl ?? ""));
    if (!match) continue;
    const [, mediaType, base64] = match;
    if (base64.length > 7_000_000) {
      return NextResponse.json({ error: "Een van de foto's is te groot" }, { status: 400 });
    }
    beelden.push({ mediaType, data: base64 });
  }
  if (beelden.length === 0) {
    return NextResponse.json({ error: "Geen bruikbare afbeelding ontvangen" }, { status: 400 });
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
          ...beelden.map((b): Anthropic.ImageBlockParam => ({
            type: "image",
            source: { type: "base64", media_type: b.mediaType as "image/jpeg", data: b.data },
          })),
          {
            type: "text",
            text: beelden.length > 1
              ? "Dit zijn meerdere screenshots van hetzelfde overzicht, na elkaar gescrold. Neem " +
                "alle activiteiten over de foto's heen over en laat het weg als dezelfde " +
                "activiteit op meer dan één foto staat."
              : "Welke activiteiten staan er op deze foto?",
          },
        ],
      }],
    });

    const tekst = res.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("\n");

    const regels = leesFotoActiviteiten(tekst);
    if (!regels) {
      return NextResponse.json(
        {
          error: "Er waren op deze foto geen activiteiten te herkennen. Probeer een andere " +
            "foto, of plak de lijst met de hand.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ tekst: regels });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Even te druk. Probeer het zo nog eens." }, { status: 429 });
    }
    if (e instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "De ANTHROPIC_API_KEY wordt niet geaccepteerd." }, { status: 401 });
    }
    return NextResponse.json(
      { error: "De foto kon niet worden verwerkt. Plak de lijst met de hand." },
      { status: 502 }
    );
  }
}
