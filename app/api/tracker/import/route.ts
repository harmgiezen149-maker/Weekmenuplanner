import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { berekenReceptPunten } from "@/lib/tracker/recept";
import { leesUrl, leesPersonen, striptags, uitJsonLd, uitHtml } from "@/lib/tracker/link";
import type { RuwRecept } from "@/lib/tracker/link";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-6";

const SYSTEM =
  "Je haalt het recept uit de tekst van een webpagina en geeft UITSLUITEND geldige JSON terug, " +
  "geen uitleg, geen markdown. Schema: " +
  '{"titel":"...","personen":4,"ingredienten":[{"naam":"...","hoev":0,"eenheid":"..."}]}. ' +
  "hoev is een getal, eenheid is g, ml, el, tl, stuk, teen, blik of leeg. " +
  "Neem GEEN puntenaantal, calorieën of andere voedingswaarden van de pagina over — " +
  "alleen de ingrediënten en het aantal personen. Namen in het Nederlands.";

/**
 * Importeert een recept van een gedeelde link.
 *
 * Drie stappen, in deze volgorde: eerst het JSON-LD Recipe-blok dat veel
 * receptsites meeleveren (dat is gestructureerd en exact), dan een eenvoudige
 * HTML-analyse, en pas als laatste het model op de platte tekst.
 *
 * De punten worden altijd zelf berekend uit de ingrediënten. Een puntwaarde
 * die op de bronpagina staat wordt nooit overgenomen.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  // De iOS-Shortcut post met een token, omdat die buiten de browsersessie om
  // werkt. Vanuit de app zelf komt er geen token mee en is dat ook niet nodig.
  const verwachtToken = process.env.TRACKER_IMPORT_TOKEN;
  const meegegeven = req.headers.get("x-tracker-token") ?? body?.token;
  if (meegegeven != null && verwachtToken && meegegeven !== verwachtToken) {
    return NextResponse.json({ error: "Ongeldig token" }, { status: 401 });
  }

  const url = leesUrl(body?.url ?? body?.text ?? "");
  if (!url) {
    return NextResponse.json(
      { error: "Geen bruikbare link gevonden. Plak de volledige URL van de receptpagina." },
      { status: 400 }
    );
  }

  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Weekmenuplanner-Tracker/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(String(res.status));
    html = (await res.text()).slice(0, 400_000);
  } catch {
    return NextResponse.json(
      { error: "De pagina kon niet worden opgehaald. Controleer de link." },
      { status: 502 }
    );
  }

  let recept = uitJsonLd(html);
  let bron: "json-ld" | "html" | "model" = "json-ld";

  if (!recept) {
    recept = uitHtml(html);
    bron = "html";
  }

  if (!recept && process.env.ANTHROPIC_API_KEY) {
    recept = await uitModel(html, process.env.ANTHROPIC_API_KEY);
    bron = "model";
  }

  if (!recept || recept.ingredienten.length === 0) {
    return NextResponse.json(
      { error: "Op deze pagina kon geen recept worden herkend. Voeg het handmatig toe." },
      { status: 422 }
    );
  }

  // Punten altijd zelf berekenen uit de ingrediënten.
  const punten = berekenReceptPunten(recept.ingredienten, recept.personen);

  return NextResponse.json({ recept, punten, bron, url });
}

// ---------------------------------------------------------------------------

/** Laatste redmiddel: het model op de platte tekst van de pagina. */
async function uitModel(html: string, key: string): Promise<RuwRecept | null> {
  const tekst = striptags(html).slice(0, 20_000);
  try {
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM,
      messages: [{ role: "user", content: tekst }],
    });
    const uit = res.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text).join("\n")
      .replace(/```json|```/g, "").trim();
    const start = uit.indexOf("{");
    const eind = uit.lastIndexOf("}");
    if (start < 0 || eind <= start) return null;

    const data = JSON.parse(uit.slice(start, eind + 1));
    const lijst = Array.isArray(data?.ingredienten) ? data.ingredienten : [];
    return {
      titel: String(data?.titel ?? "Geïmporteerd recept").slice(0, 120),
      personen: leesPersonen(data?.personen),
      ingredienten: lijst.map((i: Record<string, unknown>) => ({
        naam: String(i?.naam ?? "").trim().slice(0, 80),
        hoev: Number(i?.hoev) > 0 ? Number(i.hoev) : 1,
        eenheid: String(i?.eenheid ?? "").trim().slice(0, 16),
      })).filter((i: { naam: string }) => i.naam.length > 0),
    };
  } catch {
    return null;
  }
}
