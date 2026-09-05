// ---------------------------------------------------------------------------
// Een recept uit een gedeelde webpagina halen.
//
// Drie stappen, van exact naar geraden: eerst het schema.org Recipe-blok dat
// veel receptsites in hun HTML meeleveren, dan een eenvoudige analyse van de
// ingredientenlijst, en pas als laatste het model op de platte tekst.
//
// Er wordt nooit een puntwaarde, calorie of andere voedingswaarde van de
// bronpagina overgenomen — alleen de ingredienten en het aantal personen.
// De punten komen altijd uit de eigen formule.
// ---------------------------------------------------------------------------

export interface RuwRecept {
  titel: string;
  personen: number;
  ingredienten: { naam: string; hoev: number; eenheid: string }[];
  /**
   * De bereidingswijze, als de pagina die gestructureerd meelevert.
   *
   * Alleen voor het kookboek: de tracker doet er niets mee. Voedingswaarden
   * worden nog steeds nooit overgenomen — dit is de werkwijze, geen getal.
   */
  bereiding?: string;
}

/** Haalt de eerste http(s)-link uit een gedeelde tekst. */
export function leesUrl(invoer: string): string | null {
  const tekst = String(invoer ?? "").trim();
  const match = /https?:\/\/[^\s"'<>]+/i.exec(tekst);
  if (!match) return null;
  try {
    const u = new URL(match[0]);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Het schema.org Recipe-blok dat de meeste receptsites meeleveren. */
export function uitJsonLd(html: string): RuwRecept | null {
  const blokken = [...html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )];

  for (const blok of blokken) {
    let data: unknown;
    try { data = JSON.parse(blok[1].trim()); } catch { continue; }

    const kandidaten = platgeslagen(data);
    for (const k of kandidaten) {
      const type = (k as { "@type"?: unknown })["@type"];
      const isRecept = Array.isArray(type)
        ? type.some((t) => String(t).toLowerCase() === "recipe")
        : String(type ?? "").toLowerCase() === "recipe";
      if (!isRecept) continue;

      const rauw = (k as { recipeIngredient?: unknown; ingredients?: unknown });
      const lijst = Array.isArray(rauw.recipeIngredient) ? rauw.recipeIngredient
        : Array.isArray(rauw.ingredients) ? rauw.ingredients : [];
      if (lijst.length === 0) continue;

      const bereiding = leesBereiding((k as { recipeInstructions?: unknown }).recipeInstructions);
      return {
        titel: String((k as { name?: unknown }).name ?? "Geïmporteerd recept").slice(0, 120),
        personen: leesPersonen((k as { recipeYield?: unknown }).recipeYield),
        ingredienten: lijst
          .map((r: unknown) => ontleedIngredient(String(r)))
          .filter((i): i is RuwRecept["ingredienten"][number] => i !== null),
        ...(bereiding ? { bereiding } : {}),
      };
    }
  }
  return null;
}

/**
 * De bereidingswijze uit een JSON-LD-blok.
 *
 * Sites schrijven dit op vier manieren op: één lange tekst, een lijst zinnen,
 * een lijst HowToStep-objecten, of secties met stappen erin. Alle vier komen
 * hier uit op genummerde regels.
 */
export function leesBereiding(rauw: unknown): string {
  const stappen = verzamelStappen(rauw).filter((s) => s !== "");
  if (stappen.length === 0) return "";
  if (stappen.length === 1) return stappen[0].slice(0, 4000);
  return stappen.map((s, i) => `${i + 1}. ${s}`).join("\n").slice(0, 4000);
}

function verzamelStappen(rauw: unknown): string[] {
  if (typeof rauw === "string") return [zin(rauw)];
  if (Array.isArray(rauw)) return rauw.flatMap(verzamelStappen);
  if (rauw && typeof rauw === "object") {
    const o = rauw as Record<string, unknown>;
    // Een sectie ("Voor de saus") bevat zijn stappen in itemListElement.
    if (Array.isArray(o.itemListElement)) return verzamelStappen(o.itemListElement);
    if (typeof o.text === "string") return [zin(o.text)];
    if (typeof o.name === "string") return [zin(o.name)];
  }
  return [];
}

/**
 * Tags eruit, en de spatie die daarvoor in de plaats komt weer weg als er een
 * leesteken achteraan stond: "Kook de <b>pasta</b>." wordt anders "pasta .".
 */
function zin(html: string): string {
  return striptags(html).replace(/\s+([.,;:!?])/g, "$1").trim();
}

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

/** Terugval: ingrediënten uit lijstelementen met een herkenbare class. */
export function uitHtml(html: string): RuwRecept | null {
  const regels = [...html.matchAll(
    /<li[^>]*class=["'][^"']*ingredient[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi
  )].map((m) => striptags(m[1]));

  if (regels.length < 2) return null;

  const titel = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  return {
    titel: titel ? striptags(titel).slice(0, 120) : "Geïmporteerd recept",
    personen: 4,
    ingredienten: regels
      .map(ontleedIngredient)
      .filter((i): i is RuwRecept["ingredienten"][number] => i !== null),
  };
}

/** "200 g bloem" of "2 el olijfolie" uit elkaar halen. */
export function ontleedIngredient(regel: string): RuwRecept["ingredienten"][number] | null {
  const schoon = regel.replace(/\s+/g, " ").trim();
  if (schoon.length === 0 || schoon.length > 120) return null;

  // Breuken zoals ½ komen op receptsites veel voor.
  const genormaliseerd = schoon
    .replace(/½/g, "0.5").replace(/¼/g, "0.25").replace(/¾/g, "0.75").replace(/⅓/g, "0.33");

  const m = /^([\d.,]+)\s*([a-zA-Zà-ž.]+)?\s+(.+)$/.exec(genormaliseerd);
  if (!m) return { naam: schoon.slice(0, 80), hoev: 1, eenheid: "" };

  const hoev = Number(m[1].replace(",", "."));
  const mogelijkeEenheid = (m[2] ?? "").toLowerCase().replace(/\.$/, "");
  const EENHEDEN = ["g", "gr", "gram", "kg", "ml", "cl", "dl", "l", "liter", "el", "tl",
    "eetlepel", "eetlepels", "theelepel", "theelepels", "teen", "tenen", "blik", "blikje",
    "pak", "pakje", "bosje", "snee", "sneetjes", "plak", "plakjes", "stuk", "stuks", "handje"];

  if (EENHEDEN.includes(mogelijkeEenheid)) {
    return { naam: m[3].trim().slice(0, 80), hoev: hoev > 0 ? hoev : 1, eenheid: mogelijkeEenheid };
  }
  // Geen herkenbare eenheid: het tweede woord hoort bij de naam.
  return {
    naam: `${m[2] ?? ""} ${m[3]}`.trim().slice(0, 80),
    hoev: hoev > 0 ? hoev : 1,
    eenheid: "",
  };
}

export function leesPersonen(v: unknown): number {
  const tekst = Array.isArray(v) ? String(v[0] ?? "") : String(v ?? "");
  const m = /\d+/.exec(tekst);
  const n = m ? Number(m[0]) : NaN;
  return Number.isFinite(n) && n > 0 && n <= 50 ? n : 4;
}

export function striptags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
