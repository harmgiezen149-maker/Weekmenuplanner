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

    // Zoeken: vind receptpagina's op internet voor een gerechtnaam en geef
    // een lijst keuzeopties terug: [{ titel, url, bron, omschrijving }].
    if (body.type === "zoek") {
      const res = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system:
          "Je zoekt recepten op internet voor een gerechtnaam. Zoek naar Nederlandstalige receptpagina's " +
          "(bijv. ah.nl, jumbo.com, leukerecepten.nl, 24kitchen.nl, smulweb.nl) en anders goede Engelstalige. " +
          "Geef 4 tot 6 opties terug als UITSLUITEND geldige JSON, geen uitleg, geen markdown: " +
          '{"opties":[{"titel":"...","url":"https://...","bron":"naam van de site","omschrijving":"één korte zin"}]}. ' +
          "Gebruik alleen url's die je daadwerkelijk in de zoekresultaten hebt gezien, verzin er geen.",
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 } as any],
        messages: [{ role: "user", content: `Zoek recepten voor: ${body.query}` }],
      });
      const text = res.content
        .filter((c): c is Anthropic.TextBlock => c.type === "text")
        .map((c) => c.text).join("\n")
        .replace(/```json|```/g, "").trim();
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      const parsed = JSON.parse(text.slice(start, end + 1));
      const opties = Array.isArray(parsed.opties)
        ? parsed.opties
            .filter((o: any) => typeof o.url === "string" && o.url.startsWith("http") && typeof o.titel === "string")
            .slice(0, 6)
            .map((o: any) => ({ titel: o.titel, url: o.url, bron: o.bron || "", omschrijving: o.omschrijving || "" }))
        : [];
      return NextResponse.json({ opties });
    }

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

// Haalt kandidaat-afbeeldingen uit een receptpagina. Bronnen op volgorde van
// betrouwbaarheid: og:image/twitter-meta, JSON-LD (schema.org Recipe), en
// <img>-tags inclusief lazy-loading-varianten. Max 8, geabsolueerd.
async function haalAfbeeldingen(pageUrl: string): Promise<string[]> {
  const r = await fetch(pageUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "nl,en;q=0.8",
    },
    redirect: "follow",
  });
  const html = await r.text();
  const urls: string[] = [];
  const duw = (u?: string | null) => { if (u && typeof u === "string") urls.push(u.trim()); };

  // 1) Meta-tags: og:image (beide attribuut-volgordes), secure_url, twitter:image.
  //    Dit is vrijwel altijd de hoofdfoto van het gerecht.
  const metaRes = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/gi,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/gi,
  ];
  for (const re of metaRes) {
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(html))) duw(mm[1]);
  }

  // 2) JSON-LD (schema.org Recipe): "image" als string, array of object — dit is
  //    op receptsites de betrouwbaarste bron voor de gerechtfoto.
  const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let ld: RegExpExecArray | null;
  while ((ld = ldRe.exec(html))) {
    try {
      const data = JSON.parse(ld[1]);
      const nodes = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
      for (const node of nodes) {
        const img = node?.image;
        if (!img) continue;
        if (typeof img === "string") duw(img);
        else if (Array.isArray(img)) img.forEach((i: any) => duw(typeof i === "string" ? i : i?.url));
        else if (typeof img === "object") duw(img.url);
      }
    } catch { /* ongeldig JSON-LD overslaan */ }
  }

  // 3) <img>-tags: src, data-src en srcset (lazy loading), alleen echte fotoformaten.
  const imgRes = [
    /<img[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)["']/gi,
    /<img[^>]+srcset=["']([^"'\s,]+)/gi,
  ];
  for (const re of imgRes) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && urls.length < 60) {
      const src = m[1];
      if (/\.(jpe?g|png|webp)(\?|$)/i.test(src)) duw(src);
    }
  }

  const absoluut = urls
    .map((u) => { try { return new URL(u, pageUrl).href; } catch { return null; } })
    .filter((u): u is string => !!u && u.startsWith("http"))
    // filter duidelijke niet-gerechtplaatjes weg
    .filter((u) => !/logo|icon|sprite|avatar|placeholder|favicon|\.svg/i.test(u));

  // ontdubbel, behoud volgorde (meta/JSON-LD eerst = hoofdfoto vooraan), max 8
  return [...new Set(absoluut)].slice(0, 8);
}
