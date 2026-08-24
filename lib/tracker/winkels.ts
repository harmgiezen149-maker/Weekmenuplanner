import type { Category, Nutrients, Product } from "./types";

// ---------------------------------------------------------------------------
// Productgegevens van Nederlandse supermarkten.
//
// Open Food Facts dekt huismerken van AH, Jumbo en Lidl slecht: scan je een
// pak AH-kwark, dan staat die er vaak simpelweg niet in. Deze module probeert
// daarna de webshops zelf.
//
// Drie dingen om te weten:
//
//  1. Dit zijn ONOFFICIELE endpoints. Ze kunnen zonder aankondiging wijzigen.
//     Alles faalt daarom stil: lukt het niet, dan valt de app terug op
//     handmatige invoer, precies zoals daarvoor.
//  2. De endpoints staan bewust bij elkaar in WINKELS, zodat een gewijzigde
//     URL op één plek te repareren is.
//  3. Deze webshops zijn geen voedingsdatabases. Voedingswaarden staan er niet
//     altijd in. Zit er te weinig in om punten mee te berekenen, dan telt het
//     als "niet gevonden" en is handmatig invullen alsnog de weg.
// ---------------------------------------------------------------------------

/** Getal uit "12,5 g", "12.5", 12.5 of "< 0,5 g". */
export function winkelGetal(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;

  const schoon = v
    .replace(/^[<>~≈±]\s*/, "")      // "< 0,5 g" telt als 0,5
    .replace(/\s*(g|gram|mg|kcal|kj|kJ|ml)\b.*$/i, "")
    .replace(",", ".")
    .trim();
  if (schoon === "") return null;

  const n = Number(schoon);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Milligrammen komen soms voor bij zout en vezels. */
function naarGram(v: unknown): number | null {
  const n = winkelGetal(v);
  if (n == null) return null;
  return typeof v === "string" && /\bmg\b/i.test(v) ? n / 1000 : n;
}

const KJ_PER_KCAL = 4.184;

/**
 * Zoekt een voedingswaarde in een lijst van naam-waardeparen, zoals webshops
 * die leveren. De namen verschillen per winkel en per product, dus er wordt op
 * meerdere schrijfwijzen gezocht.
 */
export function uitVoedingstabel(
  rijen: { naam: string; waarde: unknown }[],
  zoektermen: string[]
): number | null {
  for (const term of zoektermen) {
    const rij = rijen.find((r) => r.naam.toLowerCase().includes(term));
    if (rij) {
      const g = naarGram(rij.waarde);
      if (g != null) return g;
    }
  }
  return null;
}

/**
 * Zet een voedingstabel om naar ons model. Geeft null als er te weinig in
 * staat om punten mee te berekenen.
 */
export function tabelNaarNutrients(
  rijen: { naam: string; waarde: unknown }[]
): Nutrients | null {
  let kcal = uitVoedingstabel(rijen, ["energie (kcal)", "kcal", "calorie"]);
  if (kcal == null) {
    const kj = uitVoedingstabel(rijen, ["kj", "kilojoule", "energie"]);
    if (kj != null) kcal = kj / KJ_PER_KCAL;
  }

  const eiwit = uitVoedingstabel(rijen, ["eiwit", "protein"]);
  const vet = uitVoedingstabel(rijen, ["vet", "fat"]);

  // Zonder calorieen en zonder macro's valt er niets te berekenen.
  if ((kcal == null || kcal <= 0) && eiwit == null && vet == null) return null;

  return {
    kcal: kcal ?? 0,
    protein_g: eiwit ?? 0,
    fat_g: vet ?? 0,
    satfat_g: uitVoedingstabel(rijen, ["verzadigd", "saturated"]) ?? 0,
    carbs_g: uitVoedingstabel(rijen, ["koolhydra", "carbohydrate"]) ?? 0,
    sugar_g: uitVoedingstabel(rijen, ["suiker", "sugar"]) ?? 0,
    fiber_g: uitVoedingstabel(rijen, ["vezel", "fibre", "fiber"]) ?? 0,
    category: "default",
  };
}

/** Portiegrootte uit een tekst als "Per 100 g" of "500 g". */
export function leesGewicht(tekst: unknown): number | null {
  if (typeof tekst !== "string") return null;
  const m = /([\d.,]+)\s*(kg|g|ml|l)\b/i.exec(tekst);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  const eenheid = m[2].toLowerCase();
  return eenheid === "kg" || eenheid === "l" ? n * 1000 : n;
}

// ---------------------------------------------------------------------------
// De winkels
// ---------------------------------------------------------------------------

export interface WinkelBron {
  id: string;
  naam: string;
  /** Zoekt een streepjescode op en levert een product, of null. */
  zoek(barcode: string, haal: Haler): Promise<Product | null>;
}

/** Losgekoppeld van fetch zodat de omzetting testbaar blijft. */
export type Haler = (url: string, opties?: RequestInit) => Promise<unknown>;

export const AH: WinkelBron = {
  id: "ah",
  naam: "Albert Heijn",
  async zoek(barcode, haal) {
    // De AH-app haalt eerst een anoniem token op; daarna is de zoekdienst open.
    const auth = (await haal("https://api.ah.nl/mobile-auth/v1/auth/token/anonymous", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: "appie" }),
    })) as { access_token?: string };
    if (!auth?.access_token) return null;

    const kop = { Authorization: `Bearer ${auth.access_token}` };
    const treffers = (await haal(
      `https://api.ah.nl/mobile-services/product/search/v2?query=${encodeURIComponent(barcode)}&size=1`,
      { headers: kop }
    )) as { products?: Record<string, unknown>[] };

    const kop1 = treffers?.products?.[0];
    if (!kop1) return null;

    const webshopId = kop1.webshopId ?? kop1.id;
    if (webshopId == null) return null;

    const detail = (await haal(
      `https://api.ah.nl/mobile-services/product/detail/v4/fir/${webshopId}`,
      { headers: kop }
    )) as Record<string, unknown>;

    return uitAhDetail(detail, kop1, barcode);
  },
};

export const JUMBO: WinkelBron = {
  id: "jumbo",
  naam: "Jumbo",
  async zoek(barcode, haal) {
    const treffers = (await haal(
      `https://mobileapi.jumbo.com/v17/products?q=${encodeURIComponent(barcode)}&limit=1`
    )) as { products?: { data?: Record<string, unknown>[] } };

    const kop1 = treffers?.products?.data?.[0];
    if (!kop1) return null;

    const detail = (await haal(
      `https://mobileapi.jumbo.com/v17/products/${kop1.id}`
    )) as { product?: { data?: Record<string, unknown> } };

    return uitJumboDetail(detail?.product?.data ?? kop1, barcode);
  },
};

/** Lidl heeft geen bruikbare productdienst; die zit er daarom niet bij. */
export const WINKELS: WinkelBron[] = [AH, JUMBO];

// ---------------------------------------------------------------------------
// Omzetting per winkel — apart gehouden zodat het zonder netwerk te testen is.
// ---------------------------------------------------------------------------

export function uitAhDetail(
  detail: Record<string, unknown>,
  kop: Record<string, unknown>,
  barcode: string
): Product | null {
  const groepen = (detail?.nutritionalInformation ?? []) as Record<string, unknown>[];
  const rijen: { naam: string; waarde: unknown }[] = [];

  for (const g of Array.isArray(groepen) ? groepen : []) {
    const lijst = (g?.nutrients ?? g?.values ?? []) as Record<string, unknown>[];
    for (const n of Array.isArray(lijst) ? lijst : []) {
      const naam = String(n?.name ?? n?.label ?? "");
      const waarde = n?.value ?? n?.amount ?? n?.quantity;
      if (naam) rijen.push({ naam, waarde });
    }
  }

  const nutrients = tabelNaarNutrients(rijen);
  const naam = String(kop?.title ?? detail?.title ?? "").trim();
  if (!nutrients || !naam) return null;

  return {
    id: barcode,
    name: naam.slice(0, 120),
    brand: "Albert Heijn",
    bron: "winkel",
    eenheid: "g",
    per100: nutrients,
    ...(leesGewicht(kop?.salesUnitSize) ? { portie: { grams: leesGewicht(kop.salesUnitSize)!, label: String(kop.salesUnitSize) } } : {}),
    barcode,
  };
}

export function uitJumboDetail(
  data: Record<string, unknown>,
  barcode: string
): Product | null {
  const tabel = (data?.nutritionalInformation ?? []) as Record<string, unknown>[];
  const rijen: { naam: string; waarde: unknown }[] = [];

  for (const blok of Array.isArray(tabel) ? tabel : []) {
    const lijst = (blok?.nutritionalData ?? blok?.entries ?? []) as Record<string, unknown>[];
    const bron = Array.isArray(lijst) ? lijst : [];
    for (const n of bron) {
      const naam = String(n?.name ?? n?.label ?? "");
      const waarde = n?.valuePer100g ?? n?.value ?? n?.amount;
      if (naam) rijen.push({ naam, waarde });
    }
  }

  const nutrients = tabelNaarNutrients(rijen);
  const naam = String(data?.title ?? "").trim();
  if (!nutrients || !naam) return null;

  return {
    id: barcode,
    name: naam.slice(0, 120),
    brand: "Jumbo",
    bron: "winkel",
    eenheid: "g",
    per100: nutrients,
    ...(leesGewicht(data?.quantity) ? { portie: { grams: leesGewicht(data.quantity)!, label: String(data.quantity) } } : {}),
    barcode,
  };
}

/**
 * Probeert alle winkels achter elkaar. De eerste die een bruikbaar product
 * oplevert wint; een winkel die faalt of niets weet wordt overgeslagen.
 */
export async function zoekBijWinkels(barcode: string, haal: Haler): Promise<Product | null> {
  for (const winkel of WINKELS) {
    try {
      const p = await winkel.zoek(barcode, haal);
      if (p) return p;
    } catch {
      // Onofficiele endpoints mogen omvallen zonder de app mee te nemen.
    }
  }
  return null;
}

/** De standaard-haler: JSON over https, met een korte tijdslimiet. */
export function maakHaler(timeoutMs = 8000): Haler {
  return async (url, opties) => {
    const res = await fetch(url, {
      ...opties,
      headers: {
        Accept: "application/json",
        "User-Agent": "Weekmenuplanner-Tracker/1.0",
        ...(opties?.headers ?? {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return res.json();
  };
}

/** Alleen om de categorie later handmatig te kunnen zetten. */
export const WINKEL_CATEGORIE: Category = "default";
