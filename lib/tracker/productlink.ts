import type { Nutrients, Product } from "./types";
import { tabelNaarNutrients, leesGewicht, winkelGetal } from "./winkels.ts";
import { striptags } from "./link.ts";

// ---------------------------------------------------------------------------
// Een product uit een webshoppagina halen.
//
// Plak de link van een productpagina en de app leest naam, merk, streepjescode
// en voedingswaarden eruit. Drie stappen, van exact naar geraden:
//
//   1. Het schema.org Product-blok dat de meeste webshops meeleveren. Dat is
//      gestructureerd, en bevat vaak gtin13 — de streepjescode. Daarmee belandt
//      het product meteen in de scannerbibliotheek.
//   2. De voedingstabel uit de HTML.
//   3. Het model op de platte tekst.
//
// Prijzen, bonusteksten en aanbevolen dagelijkse hoeveelheden worden genegeerd:
// alleen naam, merk, streepjescode, verpakkingsgrootte en de voedingswaarden
// per 100 doen ertoe. Punten komen altijd uit de eigen formule.
// ---------------------------------------------------------------------------

export interface RuwProduct {
  naam: string;
  merk?: string;
  /** Streepjescode, als de pagina die prijsgeeft. */
  barcode?: string;
  /** Inhoud van de verpakking in gram of ml. */
  verpakking?: number;
  eenheid: "g" | "ml";
  per100: Nutrients;
}

/** Haalt de tracking-parameters van een productlink af. */
export function schoneUrl(url: string): string {
  try {
    const u = new URL(url);
    const weg = [...u.searchParams.keys()].filter((k) =>
      /^(utm_|gad_|gbraid|gclid|channable|ju_subth|srsltid|_gl)/i.test(k) || k === "utm_id"
    );
    for (const k of weg) u.searchParams.delete(k);
    return u.toString().replace(/\?$/, "");
  } catch {
    return url;
  }
}

/** Dranken worden in milliliter gelogd, de rest in gram. */
export function eenheidVoor(naam: string, verpakkingTekst?: string): "g" | "ml" {
  const t = `${naam} ${verpakkingTekst ?? ""}`.toLowerCase();
  if (/\b\d+([.,]\d+)?\s*(ml|cl|l|liter)\b/.test(t)) return "ml";
  return /\b(water|sap|limonade|frisdrank|cola|melk|drank|thee|koffie|bier|wijn|smoothie)\b/.test(t)
    ? "ml"
    : "g";
}

// -- stap 1: schema.org Product ---------------------------------------------

/** Zet geneste JSON-LD (@graph, arrays) om in een platte lijst objecten. */
function platgeslagen(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.flatMap(platgeslagen);
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const graph = o["@graph"];
    return Array.isArray(graph) ? [o, ...graph.flatMap(platgeslagen)] : [o];
  }
  return [];
}

function isType(k: Record<string, unknown>, gezocht: string): boolean {
  const t = k["@type"];
  return Array.isArray(t)
    ? t.some((x) => String(x).toLowerCase() === gezocht)
    : String(t ?? "").toLowerCase() === gezocht;
}

/**
 * Voedingswaarden uit een schema.org NutritionInformation-blok.
 * De veldnamen liggen daar vast, in tegenstelling tot een HTML-tabel.
 */
export function uitNutritionInformation(n: Record<string, unknown>): Nutrients | null {
  const rijen = [
    { naam: "energie (kcal)", waarde: n.calories },
    { naam: "eiwit", waarde: n.proteinContent },
    { naam: "vet", waarde: n.fatContent },
    { naam: "verzadigd", waarde: n.saturatedFatContent },
    { naam: "koolhydraten", waarde: n.carbohydrateContent },
    { naam: "suiker", waarde: n.sugarContent },
    { naam: "vezel", waarde: n.fiberContent },
  ].filter((r) => r.waarde != null);

  return rijen.length > 0 ? tabelNaarNutrients(rijen) : null;
}

export function uitProductJsonLd(html: string): RuwProduct | null {
  const blokken = [...html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )];

  for (const blok of blokken) {
    let data: unknown;
    try { data = JSON.parse(blok[1].trim()); } catch { continue; }

    for (const k of platgeslagen(data)) {
      if (!isType(k, "product")) continue;

      const naam = String(k.name ?? "").trim();
      if (!naam) continue;

      const merkVeld = k.brand;
      const merk = typeof merkVeld === "string"
        ? merkVeld
        : String((merkVeld as { name?: unknown })?.name ?? "").trim();

      const gtin = [k.gtin13, k.gtin, k.gtin14, k.gtin12, k.gtin8, k.sku]
        .map((v) => String(v ?? "").replace(/\D/g, ""))
        .find((v) => v.length >= 8 && v.length <= 14);

      const voeding = k.nutrition as Record<string, unknown> | undefined;
      const per100 = voeding ? uitNutritionInformation(voeding) : null;
      if (!per100) continue; // zonder voedingswaarden valt er niets te rekenen

      const maat = String(k.weight ?? k.size ?? voeding?.servingSize ?? "");
      return {
        naam: naam.slice(0, 120),
        ...(merk ? { merk: merk.slice(0, 80) } : {}),
        ...(gtin ? { barcode: gtin } : {}),
        ...(leesGewicht(maat) ? { verpakking: leesGewicht(maat)! } : {}),
        eenheid: eenheidVoor(naam, maat),
        per100,
      };
    }
  }
  return null;
}

// -- stap 2: de voedingstabel uit de HTML -----------------------------------

/**
 * Leest naam-waardeparen uit een voedingstabel. Werkt op de twee vormen die
 * webshops gebruiken: tabelrijen en definitielijsten.
 */
export function leesVoedingsrijen(html: string): { naam: string; waarde: string }[] {
  const rijen: { naam: string; waarde: string }[] = [];

  for (const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cellen = [...m[1].matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)]
      .map((c) => striptags(c[1]));
    if (cellen.length >= 2 && cellen[0] && cellen[1]) {
      rijen.push({ naam: cellen[0], waarde: cellen[1] });
    }
  }

  const dts = [...html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi)];
  for (const m of dts) {
    const naam = striptags(m[1]);
    const waarde = striptags(m[2]);
    if (naam && waarde) rijen.push({ naam, waarde });
  }

  return rijen;
}

export function uitVoedingsHtml(html: string): RuwProduct | null {
  const rijen = leesVoedingsrijen(html);
  if (rijen.length < 3) return null;

  const per100 = tabelNaarNutrients(rijen);
  if (!per100) return null;

  const titel = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const naam = titel ? striptags(titel).split(/[|–-]/)[0].trim() : "";
  if (!naam) return null;

  // Een los <meta property="product:retailer_item_id"> of gtin komt bij
  // sommige webshops voor.
  const gtin = /(?:gtin1?[0-9]?|barcode|ean)["'\s:>]+(\d{8,14})/i.exec(html)?.[1];

  return {
    naam: naam.slice(0, 120),
    ...(gtin ? { barcode: gtin } : {}),
    eenheid: eenheidVoor(naam),
    per100,
  };
}

// -- omzetten naar een product ----------------------------------------------

export function naarProduct(r: RuwProduct, url: string): Product {
  return {
    id: r.barcode ?? schoneUrl(url),
    name: r.naam,
    ...(r.merk ? { brand: r.merk } : {}),
    bron: "winkel",
    eenheid: r.eenheid,
    per100: r.per100,
    ...(r.verpakking
      ? { portie: { grams: r.verpakking, label: `${r.verpakking} ${r.eenheid}` } }
      : {}),
    ...(r.barcode ? { barcode: r.barcode } : {}),
  };
}

/**
 * Herkent of een link een productpagina is, aan de hand van de HTML.
 * Wordt gebruikt om een geplakte link naar de juiste importroute te sturen.
 */
export function lijktOpProduct(html: string): boolean {
  if (/"@type"\s*:\s*(\[[^\]]*")?Product"/i.test(html)) return true;
  return /(gtin1?[0-9]?|voedingswaarde|nutritional)/i.test(html)
    && !/"@type"\s*:\s*(\[[^\]]*")?Recipe"/i.test(html);
}

/** Alleen voor de tests: de losse getalparser blijft bruikbaar. */
export { winkelGetal };
