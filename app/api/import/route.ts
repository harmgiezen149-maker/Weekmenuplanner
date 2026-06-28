import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { KEUKENS, HOOFDINGREDIENTEN, MOEILIJKHEDEN, MAALTIJDEN } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM =
  "Je extraheert recepten en geeft UITSLUITEND geldige JSON terug, geen uitleg, geen markdown. " +
  'Schema: {"titel":string,"keuken":string,"hoofd":string,"maaltijd":string,"moeilijkheid":string,"tijd":number,' +
  '"personen":number,"ingredienten":[{"naam":string,"hoev":number,"eenheid":string}],"bereiding":string}. ' +
  "keuken kies uit: " + KEUKENS.join(", ") + ". hoofd kies uit: " + HOOFDINGREDIENTEN.join(", ") +
  ". maaltijd kies uit: " + MAALTIJDEN.join(", ") +
  ". moeilijkheid kies uit: " + MOEILIJKHEDEN.join(", ") + ". tijd in minuten. Alles in het Nederlands.";

function parseJson(text: string) {
  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  return JSON.parse(clean.slice(start, end + 1));
}

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY ontbreekt. Zet deze in je omgeving om foto/link-import te gebruiken." },
      { status: 503 }
    );
  }

  const client = new Anthropic({ apiKey: key });

  try {
    const body = await req.json();
    let content: Anthropic.MessageParam["content"];

    if (body.type === "foto") {
      // body: { type, mediaType, data (base64) }
      content = [
        {
          type: "image",
          source: { type: "base64", media_type: body.mediaType, data: body.data },
        },
        { type: "text", text: "Lees dit recept van de foto en geef het als JSON volgens het schema." },
      ];
    } else if (body.type === "link") {
      // body: { type, url } — laat het model de pagina ophalen via de web-fetch tool
      const res = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: SYSTEM,
        tools: [{ type: "web_fetch_20250910", name: "web_fetch", max_uses: 3 } as any],
        messages: [
          {
            role: "user",
            content: `Haal het recept op van deze pagina en geef het als JSON volgens het schema: ${body.url}`,
          },
        ],
      });
      const text = res.content
        .filter((c): c is Anthropic.TextBlock => c.type === "text")
        .map((c) => c.text)
        .join("\n");
      return NextResponse.json(parseJson(text));
    } else {
      return NextResponse.json({ error: "Onbekend import-type" }, { status: 400 });
    }

    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });
    const text = res.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    return NextResponse.json(parseJson(text));
  } catch (e: any) {
    return NextResponse.json(
      { error: "Kon het recept niet uitlezen: " + (e?.message || "onbekende fout") },
      { status: 500 }
    );
  }
}
