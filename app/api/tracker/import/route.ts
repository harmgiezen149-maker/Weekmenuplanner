import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { berekenReceptPunten } from "@/lib/tracker/recept";
import { leesUrl, leesPersonen, striptags, uitJsonLd, uitHtml } from "@/lib/tracker/link";
import type { RuwRecept } from "@/lib/tracker/link";
import {
  uitProductJsonLd, uitVoedingsHtml, lijktOpProduct, naarProduct, schoneUrl,
} from "@/lib/tracker/productlink";
import { saveEigenProduct } from "@/lib/tracker/data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-6";

const PRODUCT_SYSTEM =
  "Je haalt de gegevens van één product uit de tekst van een webshoppagina en geeft " +
  "UITSLUITEND geldige JSON terug, geen uitleg, geen markdown. Schema: " +
  '{"naam":"...","merk":"...","barcode":"","verpakking":"500 g",' +
  '"per100":{"kcal":0,"protein_g":0,"fat_g":0,"satfat_g":0,"carbs_g":0,"sugar_g":0,"fiber_g":0}}. ' +
  "per100 zijn de voedingswaarden PER 100 gram of 100 milliliter, zoals ze in de " +
  "voedingswaardetabel staan. Staat er geen voedingswaardetabel op de pagina, geef dan " +
  '{"naam":""} terug. Neem geen prijzen, bonusteksten of aanbevolen dagelijkse ' +
  "hoeveelheden over. Namen in het Nederlands.";

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

  // Eerst uitzoeken wát dit is. Een productpagina en een receptpagina vragen
  // om een heel andere behandeling, en de gebruiker hoeft dat niet te weten.
  if (lijktOpProduct(html)) {
    const product = await leesProduct(html, url);
    if (product) return NextResponse.json(product);
    // Geen bruikbaar product? Dan alsnog als recept proberen.
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

  return NextResponse.json({ soort: "recept", recept, punten, bron, url });
}

/**
 * Leest een productpagina uit en bewaart het resultaat meteen bij zijn
 * streepjescode, als die op de pagina staat. Zo vindt de scanner het product
 * de volgende keer zelf — importeren via een link vult dezelfde bibliotheek
 * als handmatig invullen na een mislukte scan.
 */
async function leesProduct(html: string, url: string) {
  let ruw = uitProductJsonLd(html);
  let bron: "json-ld" | "html" | "model" = "json-ld";

  if (!ruw) {
    ruw = uitVoedingsHtml(html);
    bron = "html";
  }

  if (!ruw && process.env.ANTHROPIC_API_KEY) {
    ruw = await productUitModel(html, process.env.ANTHROPIC_API_KEY);
    bron = "model";
  }

  if (!ruw) return null;

  const product = naarProduct(ruw, url);
  if (product.barcode) {
    await saveEigenProduct(product.barcode, product).catch(() => {});
  }

  return { soort: "product" as const, product, bron, url: schoneUrl(url) };
}

async function productUitModel(html: string, key: string) {
  const tekst = striptags(html).slice(0, 20_000);
  try {
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: PRODUCT_SYSTEM,
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
    const naam = String(data?.naam ?? "").trim();
    const per100 = data?.per100;
    if (!naam || !per100 || !(Number(per100.kcal) > 0)) return null;

    const getal = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    };
    const barcode = String(data?.barcode ?? "").replace(/\D/g, "");
    const verpakking = leesGewichtTekst(String(data?.verpakking ?? ""));

    return {
      naam: naam.slice(0, 120),
      ...(data?.merk ? { merk: String(data.merk).slice(0, 80) } : {}),
      ...(barcode.length >= 8 && barcode.length <= 14 ? { barcode } : {}),
      ...(verpakking ? { verpakking } : {}),
      eenheid: /\b(ml|cl|liter|l)\b/i.test(String(data?.verpakking ?? "")) ? ("ml" as const) : ("g" as const),
      per100: {
        kcal: getal(per100.kcal),
        protein_g: getal(per100.protein_g),
        fat_g: getal(per100.fat_g),
        satfat_g: getal(per100.satfat_g),
        carbs_g: getal(per100.carbs_g),
        sugar_g: getal(per100.sugar_g),
        fiber_g: getal(per100.fiber_g),
        category: "default" as const,
      },
    };
  } catch {
    return null;
  }
}

function leesGewichtTekst(t: string): number | null {
  const m = /([\d.,]+)\s*(kg|g|ml|cl|l)\b/i.exec(t);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  const e = m[2].toLowerCase();
  return e === "kg" || e === "l" ? n * 1000 : e === "cl" ? n * 10 : n;
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
