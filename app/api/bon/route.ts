import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { leesBon } from "@/lib/bon";
import type { BonRegel } from "@/lib/bon";
import { neemBonOp } from "@/lib/prijsboek";
import { WINKELGEBIEDEN } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Model gelijkgehouden met de rest van de app. De SDK in dit project (0.32.x)
// kent nog geen structured outputs, dus de JSON wordt via de systeeminstructie
// afgedwongen en in lib/bon.ts defensief gelezen.
const MODEL = "claude-sonnet-4-6";

const BON_SYSTEM =
  "Je leest een Nederlandse kassabon van een supermarkt. Geef UITSLUITEND geldige JSON terug, " +
  "geen uitleg, geen markdown. Schema: " +
  '{"winkel":"AH|Jumbo|Lidl|","datum":"YYYY-MM-DD","regels":[{"naam":"...","aantal":1,' +
  '"eenheid":"stuk","prijs":0.00,"gebied":"..."}]}. ' +
  "naam is de gewone Nederlandse productnaam, niet de afkorting van de kassa: " +
  "'AH BASIS H-MELK 1L' wordt 'halfvolle melk'. Laat het merk weg tenzij het echt het product " +
  "bepaalt. prijs is wat er voor die regel is betaald, in euro, na korting. " +
  "LAAT WEG: statiegeld, emballage, kortingsregels, bonusregels, subtotaal, totaal, btw, " +
  "pinbetaling, spaarzegels en alles wat geen product is. " +
  "gebied kies je uit: " + WINKELGEBIEDEN.filter(Boolean).join(", ") + ". " +
  "Kun je de datum niet lezen, geef dan een lege string.";

const PRODUCT_SYSTEM =
  "Je ziet een foto van een of meer producten uit een huishouden. Geef UITSLUITEND geldige JSON " +
  "terug, geen uitleg, geen markdown. Schema: " +
  '{"winkel":"","datum":"","regels":[{"naam":"...","aantal":1,"eenheid":"stuk","prijs":null,' +
  '"gebied":"..."}]}. ' +
  "naam is de gewone Nederlandse productnaam zoals je hem op een boodschappenlijst zou " +
  "schrijven — 'afwasmiddel', niet 'Dreft Platinum 750ml'. aantal is hoeveel je er ziet. " +
  "prijs laat je altijd null. " +
  "gebied kies je uit: " + WINKELGEBIEDEN.filter(Boolean).join(", ") + ".";

/**
 * Leest een kassabon of een productfoto.
 *
 * Het antwoord is nadrukkelijk een VOORSTEL: de client toont het met vinkjes en
 * slaat pas op wat je aanvinkt. Een verkeerd gelezen regel hoort niet
 * ongemerkt in je voorraad of je prijsboek te belanden.
 */
export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY ontbreekt. Zonder die sleutel werkt het lezen van een bon niet; handmatig toevoegen wel." },
      { status: 503 }
    );
  }

  const body = await req.json();
  const soort = body?.soort === "product" ? "product" : "bon";
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
      max_tokens: 3000,
      system: soort === "bon" ? BON_SYSTEM : PRODUCT_SYSTEM,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType as "image/jpeg", data: base64 },
          },
          {
            type: "text",
            text: soort === "bon"
              ? "Welke producten staan er op deze bon?"
              : "Welke producten zie je op deze foto?",
          },
        ],
      }],
    });

    const tekst = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text).join("");
    const bon = leesBon(tekst);

    if (bon.regels.length === 0) {
      return NextResponse.json(
        {
          error: soort === "bon"
            ? "Geen producten kunnen lezen. Probeer een rechtere foto met de hele bon in beeld."
            : "Geen producten kunnen herkennen op deze foto.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json(bon);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Het lezen van de foto ging mis" },
      { status: 502 }
    );
  }
}

/**
 * Neemt de prijzen van een bevestigde bon op in het prijsboek.
 *
 * Apart van het lezen: pas nadat jij de regels hebt nagekeken gaan ze het boek
 * in. Een misgelezen prijs zou anders maandenlang je ramingen scheeftrekken.
 */
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const regels = Array.isArray(body?.regels) ? (body.regels as BonRegel[]) : [];
  if (regels.length === 0) {
    return NextResponse.json({ error: "Geen regels ontvangen" }, { status: 400 });
  }
  const datum = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.datum ?? ""))
    ? String(body.datum)
    : new Date().toISOString().slice(0, 10);

  const { opgenomen } = await neemBonOp(regels, String(body?.winkel ?? ""), datum);
  return NextResponse.json({ opgenomen });
}
