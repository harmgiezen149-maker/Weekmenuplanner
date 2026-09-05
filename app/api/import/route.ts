import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { KEUKENS, HOOFDINGREDIENTEN, MOEILIJKHEDEN, MAALTIJDEN } from "@/lib/types";
import { haalAfbeeldingen } from "@/lib/afbeeldingen";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM =
  "Je extraheert recepten en geeft UITSLUITEND geldige JSON terug, geen uitleg, geen markdown. " +
  'Schema: {"titel":string,"keuken":string,"hoofd":string,"maaltijd":string,"moeilijkheid":string,"tijd":number,' +
  '"personen":number,"ingredienten":[{"naam":string,"hoev":number,"eenheid":string}],"bereiding":string}. ' +
  "keuken kies uit: " + KEUKENS.join(", ") + ". hoofd kies uit: " + HOOFDINGREDIENTEN.join(", ") +
  ". maaltijd kies uit: " + MAALTIJDEN.join(", ") +
  ". moeilijkheid kies uit: " + MOEILIJKHEDEN.join(", ") + ". tijd in minuten. Alles in het Nederlands.";

// Bij een link kan het model de pagina zelf zien, en dus ook de foto van het
// gerecht. Dat is de enige bron die er nog is als de pagina onze eigen fetch
// weigert — vandaar dat we er expliciet om vragen, en alleen hier: op een foto
// van een tijdschriftpagina valt niets te linken.
const SYSTEM_LINK =
  SYSTEM +
  ' Voeg één extra veld toe: "afbeelding" met de volledige url van de foto van het ' +
  "gerecht op deze pagina (og:image of de hoofdfoto van het recept). Weet je die niet " +
  "zeker, laat het veld dan leeg. Verzin nooit een url.";

// Een bord eten is geen recept: er staat niet bij wat erin zit, hoeveel er in
// de pan ging of hoe lang het op het vuur stond. Wat het model hier doet is
// reconstrueren, en dat mag het weten — de instructie vraagt om herkenbare
// ingrediënten met redelijke hoeveelheden, niet om een precieze uitslag.
//
// Twee personen, niet één: een recept voor één is zelden waar iemand naar
// zoekt, en de gebruiker past het aantal daarna toch aan in het formulier.
const SYSTEM_BORD =
  SYSTEM +
  " Je krijgt een foto van een OPGEDIEND BORD, geen recept. Reconstrueer welk gerecht dit is " +
  "en hoe je het maakt. Noem alleen ingrediënten die je op het bord kunt zien of die " +
  "onmisbaar zijn voor dit gerecht; verzin geen merken, garneringen of bijgerechten die er " +
  "niet liggen. Geef de hoeveelheden voor 2 personen en zet personen op 2. " +
  "De bereiding is een korte, praktische werkwijze in een paar zinnen. " +
  "Kun je het gerecht niet plaatsen, kies dan een titel die beschrijft wat je ziet, " +
  "bijvoorbeeld \"Pasta met tomatensaus en spinazie\".";

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

  // Alleen de kandidaat-foto's van een pagina, zonder het recept erbij. Voor
  // schermen die het recept al hebben en er nog een foto bij zoeken — de
  // tracker-import bijvoorbeeld. Kost geen modelaanroep en dus ook geen key.
  if (body.type === "afbeeldingen") {
    const afbeeldingen = await haalAfbeeldingen(String(body.url || "")).catch(() => []);
    return NextResponse.json({ afbeeldingen });
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

    if (body.type === "foto" || body.type === "bord") {
      // Eén of meerdere foto's (recept kan over meerdere tijdschriftpagina's staan).
      const fotos: { mediaType: string; data: string }[] =
        Array.isArray(body.fotos) && body.fotos.length
          ? body.fotos
          : [{ mediaType: body.mediaType, data: body.data }];
      const geldigeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
      type BeeldType = (typeof geldigeTypes)[number];
      const naarBeeldType = (t: string): BeeldType =>
        (geldigeTypes as readonly string[]).includes(t) ? (t as BeeldType) : "image/jpeg";
      content = [
        ...fotos.map((f): Anthropic.ImageBlockParam => ({
          type: "image",
          source: { type: "base64", media_type: naarBeeldType(f.mediaType), data: f.data },
        })),
        {
          type: "text",
          text: body.type === "bord"
            ? "Dit is een foto van een opgediend bord. Wat is dit voor gerecht en hoe maak je het? Geef het als JSON volgens het schema."
            : fotos.length > 1
              ? "Lees het recept van deze foto's. Het recept staat verspreid over meerdere pagina's; combineer alles tot één volledig recept en geef het als JSON volgens het schema."
              : "Lees dit recept van de foto en geef het als JSON volgens het schema.",
        } as Anthropic.TextBlockParam,
      ];
    } else if (body.type === "link") {
      const res = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: SYSTEM_LINK,
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

      // De foto-url die het model op de pagina zag hoort niet in het recept:
      // daar staat straks de foto zelf, als data-url. Hier is het een kandidaat
      // als alle andere — en een belangrijke, want het model haalt de pagina op
      // langs een andere weg dan wij en komt soms binnen waar wij een 403 krijgen.
      const vanModel = typeof recept?.afbeelding === "string" ? recept.afbeelding.trim() : "";
      delete recept.afbeelding;

      const vanPagina = await haalAfbeeldingen(body.url).catch(() => []);
      const afbeeldingen = [...new Set(
        [vanModel, ...vanPagina].filter((u) => u.startsWith("http"))
      )].slice(0, 8);

      return NextResponse.json({ recept, afbeeldingen });
    } else {
      return NextResponse.json({ error: "Onbekend import-type" }, { status: 400 });
    }

    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: body.type === "bord" ? SYSTEM_BORD : SYSTEM,
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
