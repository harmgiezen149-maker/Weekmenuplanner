import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Ontvangt { items: [{ id, naam, hoev, eenheid }] }.
// Geeft terug:
//   samenvoegingen: [{ ids:[...], zeker:boolean, naamKeuzes:[...], voorstelNaam, eenheid }]
//   verpakkingen:  [{ id, zeker:boolean, huidig, voorstel }]
// "zeker=true" mag automatisch toegepast worden; "zeker=false" vraagt bevestiging.
export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  const body = await req.json();
  let items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ samenvoegingen: [], verpakkingen: [] });
  }
  // Begrens de invoer: bij extreem lange lijsten blijft de uitvoer anders niet
  // binnen de limiet. 80 artikelen is ruim voldoende voor een weekboodschap.
  items = items.slice(0, 80);
  if (!key) {
    return NextResponse.json({ samenvoegingen: [], verpakkingen: [], geenKey: true });
  }

  const client = new Anthropic({ apiKey: key });

  const systeem =
    "Je helpt een boodschappenlijst op te schonen. Je krijgt een lijst met artikelen (id, naam, hoeveelheid, eenheid). " +
    "Doe TWEE dingen:\n" +
    "1) SAMENVOEGEN: vind artikelen die hetzelfde product zijn maar los vermeld staan (bijv. 'ui' en 'uien', of 'knoflook' en 'teentje knoflook', of hetzelfde product met verschillende eenheden). " +
    "Groepeer die. Geef per groep de ids, of je ZEKER bent dat het hetzelfde is (zeker=true) of dat het twijfelachtig is (zeker=false), " +
    "een lijst met de betrokken originele namen (naamKeuzes), een voorgestelde naam voor op de lijst (voorstelNaam), en de meest logische gemeenschappelijke eenheid (eenheid, mag leeg zijn). " +
    "Groepeer NOOIT verschillende producten samen (ui en prei zijn NIET hetzelfde). Artikelen die uniek zijn laat je weg.\n" +
    "2) VERPAKKINGEN: artikelen met een receptmatige eenheid zoals theelepel/tl, eetlepel/el, gram/g, milliliter/ml, snufje, teentje zijn in de winkel vaak niet zo te koop. " +
    "Stel voor die artikelen een normale winkelverpakking voor (bijv. '2 tl bakpoeder' -> '1 zakje bakpoeder', '30 g boter' -> '1 pak boter', '100 ml melk' -> '1 pak melk'). " +
    "Geef per artikel het id, of je ZEKER bent (zeker=true) of twijfelachtig (zeker=false), de huidige weergave (huidig) en het voorstel (voorstel, korte tekst zoals '1 zakje bakpoeder'). " +
    "Sla artikelen over die al in winkelverpakking staan (stuks, pak, zakje, blik, pot, bos, etc.).\n" +
    'Geef UITSLUITEND geldige JSON terug, geen uitleg, geen markdown, in de vorm: ' +
    '{"samenvoegingen":[{"ids":["..."],"zeker":true,"naamKeuzes":["..."],"voorstelNaam":"...","eenheid":"..."}],' +
    '"verpakkingen":[{"id":"...","zeker":true,"huidig":"...","voorstel":"..."}]}';

  const lijst = items
    .map((it: any) => `- id=${it.id} | ${it.hoev ?? ""} ${it.eenheid ?? ""} ${it.naam}`.replace(/\s+/g, " ").trim())
    .join("\n");

  try {
    // Ruime uitvoerlimiet: bij lange lijsten worden de suggesties anders
    // halverwege afgekapt en faalt het JSON-parsen.
    const vraag = { role: "user" as const, content: "Artikelen:\n" + lijst };
    const maak = () =>
      client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        system: systeem + " Houd de JSON compact: geen onnodige spaties of regeleindes.",
        messages: [vraag],
      });

    // Eén automatische herkansing bij een tijdelijke API-fout (bijv. overbelast).
    let res;
    try {
      res = await maak();
    } catch {
      await new Promise((r) => setTimeout(r, 1200));
      res = await maak();
    }

    const text = res.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text).join("\n")
      .replace(/```json|```/g, "").trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("AI gaf geen bruikbare JSON terug");
    let parsed: any;
    try {
      parsed = JSON.parse(text.slice(start, end + 1));
    } catch {
      throw new Error("AI-antwoord was onvolledig (lijst mogelijk te lang)");
    }

    const geldigeIds = new Set(items.map((it: any) => it.id));
    // Valideer samenvoegingen: alleen bestaande ids, minstens 2 per groep.
    const samenvoegingen = Array.isArray(parsed.samenvoegingen)
      ? parsed.samenvoegingen
          .map((g: any) => ({
            ids: Array.isArray(g.ids) ? g.ids.filter((id: string) => geldigeIds.has(id)) : [],
            zeker: !!g.zeker,
            naamKeuzes: Array.isArray(g.naamKeuzes) ? g.naamKeuzes : [],
            voorstelNaam: typeof g.voorstelNaam === "string" ? g.voorstelNaam : "",
            eenheid: typeof g.eenheid === "string" ? g.eenheid : "",
          }))
          .filter((g: any) => g.ids.length >= 2)
      : [];
    // Valideer verpakkingen: alleen bestaande ids.
    const verpakkingen = Array.isArray(parsed.verpakkingen)
      ? parsed.verpakkingen
          .filter((v: any) => geldigeIds.has(v.id) && typeof v.voorstel === "string" && v.voorstel.trim())
          .map((v: any) => ({ id: v.id, zeker: !!v.zeker, huidig: v.huidig || "", voorstel: v.voorstel.trim() }))
      : [];

    return NextResponse.json({ samenvoegingen, verpakkingen });
  } catch (e: any) {
    return NextResponse.json({ samenvoegingen: [], verpakkingen: [], error: e?.message || "onbekend" }, { status: 500 });
  }
}
