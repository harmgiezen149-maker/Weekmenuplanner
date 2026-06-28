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
  const body = await req.json();

  // Proxy: haal een externe afbeelding op als data-URL (omzeilt CORS in de browser).
  // Heeft geen Anthropic-key nodig.
  if (body.type === "afbeelding-proxy") {
    try {
      const r = await fetch(body.url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!r.ok) throw new Error("status " + r.status);
      const type = r.headers.get("content-type") || "image/jpeg";
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 8_000_000) throw new Error("afbeelding te groot");
      return NextResponse.json({ dataUrl: `data:${type};base64,${buf.toString("base64")}` });
    } catch (e: any) {
      return NextResponse.json({ error: "Kon afbeelding niet ophalen: " + (e?.message || "onbekend") }, { status: 500 });
    }
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY ontbreekt. Zet deze in je omgeving om foto/link-import te gebruiken." },
      { status: 503 }
    );
  }

  const client = new Anthropic({ apiKey: key });

  try {
    let content: Anthropic.MessageParam["content"];

    if (body.type === "foto") {
      content = [
        { type: "image", source: { type: "base64", media_type: body.mediaType, data: body.data } },
        { type: "text", text: "Lees dit recept van de foto en geef het als JSON volgens het schema." },
      ];
    } else if (body.type === "link") {
      const res = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: SYSTEM,
        tools: [{ type: "web_fetch_20250910", name: "web_fetch", max_uses: 3 } as any],
        messages: [
          { role: "user", content: `Haal het recept op van deze pagina en geef het als JSON volgens het schema: ${body.url}` },
        ],
      });
      const text = res.content
        .filter((c): c is Anthropic.TextBlock => c.type === "text")
        .map((c) => c.text)
        .join("\n");
      const recept = parseJson(text);
      // Probeer daarnaast afbeeldings-URL's uit de pagina te halen.
      const afbeeldingen = await haalAfbeeldingen(body.url).catch(() => []);
      return NextResponse.json({ recept, afbeeldingen });
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
    return NextResponse.json({ recept: parseJson(text) });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Kon het recept niet uitlezen: " + (e?.message || "onbekende fout") },
      { status: 500 }
    );
  }
}

// Haalt kandidaat-afbeeldingen uit een receptpagina: eerst de og:image (meestal
// de hoofdfoto van het gerecht), daarna grote <img>-bronnen. Max 8, geabsolueerd.
async function haalAfbeeldingen(pageUrl: string): Promise<string[]> {
  const r = await fetch(pageUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  const html = await r.text();
  const urls: string[] = [];

  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (og?.[1]) urls.push(og[1]);

  const imgRe = /<img[^>]+src=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html)) && urls.length < 30) {
    const src = m[1];
    if (/\.(jpe?g|png|webp)(\?|$)/i.test(src)) urls.push(src);
  }

  const absoluut = urls
    .map((u) => { try { return new URL(u, pageUrl).href; } catch { return null; } })
    .filter((u): u is string => !!u && u.startsWith("http"));

  // ontdubbel, behoud volgorde, max 8
  return [...new Set(absoluut)].slice(0, 8);
}
