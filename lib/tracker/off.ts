import type { Category, Nutrients, Product } from "./types";

// ---------------------------------------------------------------------------
// Open Food Facts: van hun productformaat naar het onze.
//
// Alle veldnamen worden defensief gelezen. OFF is een crowdsourced database:
// velden ontbreken regelmatig, staan er soms als tekst in ("12,5"), en de
// energie staat nu eens in kcal en dan weer alleen in kJ.
//
// Er wordt nooit een puntwaarde van de bronpagina overgenomen; punten worden
// altijd zelf uit de voedingswaarden berekend.
// ---------------------------------------------------------------------------

export const OFF_BASIS = "https://world.openfoodfacts.org";

// OFF vraagt om een herkenbare User-Agent met contactgegevens.
export const OFF_USER_AGENT =
  "Weekmenuplanner-Tracker/1.0 (https://github.com/harmgiezen149-maker/Weekmenuplanner)";

/** Getal uit een veld dat een number, een string met komma, of niets kan zijn. */
export function offGetal(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const schoon = v.replace(",", ".").trim();
    // Number("") is 0; een leeg veld betekent hier "ontbreekt", geen nul.
    if (schoon === "") return null;
    const n = Number(schoon);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Eerste veld dat een bruikbaar getal oplevert. */
function eerste(n: Record<string, unknown>, sleutels: string[]): number | null {
  for (const s of sleutels) {
    const g = offGetal(n[s]);
    if (g != null) return g;
  }
  return null;
}

const KJ_PER_KCAL = 4.184;

/** Calorieën per 100 g. Valt terug op kJ als kcal ontbreekt. */
export function offKcal(nutriments: Record<string, unknown>): number {
  const kcal = eerste(nutriments, ["energy-kcal_100g", "energy-kcal", "energy_value"]);
  if (kcal != null) return kcal;
  const kj = eerste(nutriments, ["energy-kj_100g", "energy_100g", "energy"]);
  return kj != null ? kj / KJ_PER_KCAL : 0;
}

// Tags die een product veilig in een suikervrije categorie plaatsen. Bewust
// smal gehouden: bij twijfel geldt "default" en telt suiker gewoon mee.
const CATEGORIE_TAGS: { tag: string; categorie: Category }[] = [
  { tag: "en:fresh-fruits", categorie: "fruit_whole" },
  { tag: "en:fruits", categorie: "fruit_whole" },
  { tag: "en:fresh-vegetables", categorie: "vegetable" },
  { tag: "en:vegetables", categorie: "vegetable" },
  { tag: "en:legumes", categorie: "legume" },
  { tag: "en:pulses", categorie: "legume" },
  { tag: "en:beans", categorie: "legume" },
  { tag: "en:lentils", categorie: "legume" },
  { tag: "en:nuts", categorie: "nuts_seeds" },
  { tag: "en:seeds", categorie: "nuts_seeds" },
  { tag: "en:plain-yogurts", categorie: "dairy_plain" },
  { tag: "en:natural-yogurts", categorie: "dairy_plain" },
  { tag: "en:milks", categorie: "dairy_plain" },
  { tag: "en:quarks", categorie: "dairy_plain" },
  { tag: "en:cottage-cheeses", categorie: "dairy_plain" },
  { tag: "en:skyrs", categorie: "dairy_plain" },
];

// Tags die de categorie meteen weer ongedaan maken. Vruchtensap en gedroogd
// fruit hebben geconcentreerde suiker die wél moet meetellen, en alles wat
// gezoet of gearomatiseerd is evengoed.
const UITSLUITEND = [
  "juice", "juices", "nectar", "smoothie", "dried", "candied", "sweetened",
  "flavoured", "flavored", "syrup", "jam", "compote", "desserts",
  "chocolate", "sugared", "confectioner", "sweet-snacks", "biscuits",
];

// Ingrediënten die verraden dat er suiker is toegevoegd. Dan vervalt de
// zuivelaftrek: het document laat die alleen toe als de ingrediëntenlijst
// geen suiker bevat.
const SUIKER_INGREDIENTEN = [
  "sugar", "suiker", "glucose", "fructose", "sucrose", "dextrose",
  "siroop", "syrup", "honing", "honey", "molasses", "maltodextrin",
  "agave", "invertsuiker", "sucre",
];

/**
 * Bepaalt de productcategorie voor de suikercorrectie.
 * Bij elke twijfel "default", zodat suiker liever te veel dan te weinig telt.
 */
export function offCategorie(
  categories_tags: unknown,
  ingredients_text: unknown
): Category {
  const tags = (Array.isArray(categories_tags) ? categories_tags : [])
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.toLowerCase());
  if (tags.length === 0) return "default";

  if (tags.some((t) => UITSLUITEND.some((u) => t.includes(u)))) return "default";

  const treffer = CATEGORIE_TAGS.find((c) => tags.includes(c.tag));
  if (!treffer) return "default";

  if (treffer.categorie === "dairy_plain" && bevatSuiker(ingredients_text)) {
    return "default";
  }
  return treffer.categorie;
}

export function bevatSuiker(ingredients_text: unknown): boolean {
  if (typeof ingredients_text !== "string" || ingredients_text.trim() === "") {
    // Geen ingrediëntenlijst betekent geen bewijs dat er niets is toegevoegd.
    return true;
  }
  const t = ingredients_text.toLowerCase();
  return SUIKER_INGREDIENTEN.some((s) => t.includes(s));
}

/** Dranken worden in ml gelogd, de rest in gram. */
export function offEenheid(categories_tags: unknown): "g" | "ml" {
  const tags = (Array.isArray(categories_tags) ? categories_tags : [])
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.toLowerCase());
  return tags.some((t) => t.includes("beverage") || t.includes("drink") || t.includes("water"))
    ? "ml"
    : "g";
}

/** Standaardportie in gram, als OFF er een kent en die plausibel is. */
export function offPortie(p: Record<string, unknown>): { grams: number; label: string } | undefined {
  const grams = offGetal(p.serving_quantity);
  if (grams == null || grams <= 0 || grams > 2000) return undefined;
  const label = typeof p.serving_size === "string" && p.serving_size.trim() !== ""
    ? p.serving_size.trim()
    : `${Math.round(grams)} g`;
  return { grams, label };
}

/**
 * Zet één OFF-product om. Geeft null terug als er zo weinig bruikbaars in
 * staat dat loggen zinloos zou zijn — dan is handmatig invullen beter dan
 * een regel vol nullen.
 */
export function offNaarProduct(p: Record<string, unknown> | null | undefined): Product | null {
  if (!p) return null;

  const nutriments = (p.nutriments ?? {}) as Record<string, unknown>;
  const naam = tekst(p.product_name) || tekst(p.generic_name) || tekst(p.abbreviated_product_name);
  const code = tekst(p.code);
  if (!naam || !code) return null;

  const kcal = offKcal(nutriments);
  const eiwit = eerste(nutriments, ["proteins_100g", "proteins"]);
  const vet = eerste(nutriments, ["fat_100g", "fat"]);

  // Zonder calorieën én zonder macro's valt er niets te berekenen.
  if (kcal <= 0 && eiwit == null && vet == null) return null;

  const categorie = offCategorie(p.categories_tags, p.ingredients_text);

  const per100: Nutrients = {
    kcal,
    protein_g: eiwit ?? 0,
    fat_g: vet ?? 0,
    satfat_g: eerste(nutriments, ["saturated-fat_100g", "saturated-fat"]) ?? 0,
    carbs_g: eerste(nutriments, ["carbohydrates_100g", "carbohydrates"]) ?? 0,
    sugar_g: eerste(nutriments, ["sugars_100g", "sugars"]) ?? 0,
    fiber_g: eerste(nutriments, ["fiber_100g", "fiber"]) ?? 0,
    category: categorie,
  };

  return {
    id: code,
    name: naam,
    ...(tekst(p.brands) ? { brand: tekst(p.brands).split(",")[0].trim() } : {}),
    bron: "off",
    eenheid: offEenheid(p.categories_tags),
    per100,
    ...(offPortie(p) ? { portie: offPortie(p) } : {}),
    barcode: code,
  };
}

function tekst(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// ---------------------------------------------------------------------------
// Netwerk
// ---------------------------------------------------------------------------

const VELDEN = [
  "code", "product_name", "generic_name", "abbreviated_product_name", "brands",
  "quantity", "serving_size", "serving_quantity", "categories_tags",
  "ingredients_text", "nutriments",
].join(",");

async function haal(url: string, timeoutMs = 8000): Promise<unknown> {
  const stop = AbortSignal.timeout(timeoutMs);
  const res = await fetch(url, {
    headers: { "User-Agent": OFF_USER_AGENT, Accept: "application/json" },
    signal: stop,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Open Food Facts gaf status ${res.status}`);
  return res.json();
}

/** Eén product op streepjescode. null als OFF het niet kent. */
export async function offProduct(barcode: string): Promise<Product | null> {
  const url = `${OFF_BASIS}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${VELDEN}`;
  const data = (await haal(url)) as { status?: number; product?: Record<string, unknown> };
  if (!data || data.status !== 1) return null;
  return offNaarProduct(data.product);
}

/**
 * Zoeken op naam. OFF heeft twee zoek-endpoints naast elkaar: het nieuwe
 * search-a-licious en het oude cgi/search.pl. Het nieuwe wordt eerst
 * geprobeerd, met het oude als terugval, zodat een wijziging aan één van
 * beide de zoekfunctie niet meteen omlegt.
 */
export async function offZoek(term: string, limiet = 20): Promise<Product[]> {
  const q = term.trim();
  if (q.length < 2) return [];

  try {
    const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}` +
      `&page_size=${limiet}&fields=${VELDEN}&countries_tags_en=Netherlands`;
    const data = (await haal(url)) as { hits?: Record<string, unknown>[] };
    const treffers = Array.isArray(data?.hits) ? data.hits : [];
    const producten = treffers.map(offNaarProduct).filter((p): p is Product => p !== null);
    if (producten.length > 0) return producten;
  } catch {
    // Val stil terug op het oude endpoint.
  }

  const oud = `${OFF_BASIS}/cgi/search.pl?search_terms=${encodeURIComponent(q)}` +
    `&search_simple=1&action=process&json=1&page_size=${limiet}` +
    `&countries_tags=netherlands&fields=${VELDEN}`;
  const data = (await haal(oud)) as { products?: Record<string, unknown>[] };
  const lijst = Array.isArray(data?.products) ? data.products : [];
  return lijst.map(offNaarProduct).filter((p): p is Product => p !== null);
}
