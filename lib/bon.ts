import { WINKELGEBIEDEN } from "./types.ts";

// ---------------------------------------------------------------------------
// Een kassabon lezen.
//
// Het antwoord van het model wordt hier defensief uitgepakt: er is geen
// schemagarantie, dus alles wordt gecontroleerd en wat niet klopt valt af. Een
// halve bon is bruikbaar, een bon vol onzin niet.
//
// De tweede taak van deze module is het wegfilteren van alles wat op een bon
// staat maar geen product is: statiegeld, korting, subtotaal, pinbetaling. Het
// model wordt gevraagd die weg te laten, maar één gemiste regel zou als
// "TOTAAL, € 43,71" in je voorraad belanden. Twee zeven achter elkaar dus.
// ---------------------------------------------------------------------------

export interface BonRegel {
  naam: string;
  aantal: number;
  eenheid: string;
  /** Wat er voor deze regel is betaald, in euro. Null als het niet leesbaar was. */
  prijs: number | null;
  /** Winkelafdeling, als het model er een herkende. Leeg als hij niet klopt. */
  gebied: string;
}

export interface BonResultaat {
  winkel: string;
  datum: string;
  regels: BonRegel[];
}

/**
 * Woorden die een regel diskwalificeren als product. Op woordgrens getoetst,
 * zodat "bonbons" niet sneuvelt op "bon" en "totaalbrood" niet op "totaal".
 */
const GEEN_PRODUCT = [
  "totaal", "subtotaal", "te betalen", "betaald", "contant", "pin", "pinnen",
  "korting", "bonus", "actie", "voordeel", "spaarzegel", "zegel", "airmiles",
  "statiegeld", "emballage", "retour", "toeslag", "btw", "b.t.w",
  "kassabon", "bedankt", "aantal artikelen", "transactie", "terminal",
  "afgerond", "afronding", "wisselgeld", "cadeaukaart", "bonuskaart",
];

export function isProductregel(naam: string): boolean {
  const n = naam.toLowerCase().trim();
  if (n.length < 2) return false;
  // Een regel die alleen uit cijfers, valuta en leestekens bestaat is geen product.
  if (!/[a-z]/.test(n)) return false;
  return !GEEN_PRODUCT.some((w) => new RegExp(`(^|[^a-z])${escape(w)}([^a-z]|$)`, "i").test(n));
}

function escape(w: string): string {
  return w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Leest het antwoord van het model. Geeft altijd een bruikbaar resultaat terug. */
export function leesBon(tekst: string): BonResultaat {
  const data = pakJson(tekst);
  if (!data) return { winkel: "", datum: "", regels: [] };

  const ruw = Array.isArray((data as { regels?: unknown }).regels)
    ? (data as { regels: unknown[] }).regels
    : [];

  const regels: BonRegel[] = [];
  for (const r of ruw) {
    if (!r || typeof r !== "object") continue;
    const item = r as Record<string, unknown>;
    const naam = String(item.naam ?? "").trim();
    if (!naam || !isProductregel(naam)) continue;

    regels.push({
      naam: naam.slice(0, 80),
      aantal: positiefGetal(item.aantal, 1),
      eenheid: String(item.eenheid ?? "stuk").trim().toLowerCase().slice(0, 16) || "stuk",
      prijs: prijsOfNiets(item.prijs),
      gebied: geldigGebied(String(item.gebied ?? "")),
    });
  }

  return {
    winkel: herkenWinkel(String((data as { winkel?: unknown }).winkel ?? "")),
    datum: geldigeDatum(String((data as { datum?: unknown }).datum ?? "")),
    regels,
  };
}

function pakJson(tekst: string): unknown {
  const schoon = String(tekst || "").replace(/```json|```/g, "").trim();
  const start = schoon.indexOf("{");
  const eind = schoon.lastIndexOf("}");
  if (start < 0 || eind <= start) return null;
  try {
    return JSON.parse(schoon.slice(start, eind + 1));
  } catch {
    return null;
  }
}

function positiefGetal(v: unknown, standaard: number): number {
  const n = Number(String(v ?? "").toString().replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return standaard;
  // Meer dan honderd stuks van hetzelfde op één bon is vrijwel zeker een
  // verkeerd gelezen prijs of gewicht.
  return n > 100 ? standaard : Math.round(n * 1000) / 1000;
}

/**
 * Een prijs in euro. Nul telt hier als "niet gelezen": een gratis product komt
 * op een kassabon niet voor, een misgelezen bedrag wel.
 */
function prijsOfNiets(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^\d,.-]/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0 || n > 500) return null;
  return Math.round(n * 100) / 100;
}

/** Losse schrijfwijzen terugbrengen tot de winkels die de app kent. */
export function herkenWinkel(ruw: string): string {
  const n = ruw.toLowerCase();
  if (/albert\s*heijn|\bah\b/.test(n)) return "AH";
  if (/jumbo/.test(n)) return "Jumbo";
  if (/lidl/.test(n)) return "Lidl";
  return "";
}

/**
 * Alleen een afdeling die de app kent. Een verzonnen afdeling zou de sortering
 * op looproute stilletjes breken, dus die wordt leeg — dan valt hij onder
 * "geen afdeling" en zie je dat er iets ontbreekt.
 */
function geldigGebied(ruw: string): string {
  const n = ruw.trim();
  return (WINKELGEBIEDEN as readonly string[]).includes(n) ? n : "";
}

function geldigeDatum(ruw: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(ruw) ? ruw : "";
}
