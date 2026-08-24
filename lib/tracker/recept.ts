import type { MaaltijdComponent, Nutrients, Product } from "./types";
import { rawPoints } from "./points.ts";
import { zoekMetScore } from "./basisproducten.ts";
import type { IngredientBibliotheek } from "./ingredienten";

// ---------------------------------------------------------------------------
// Van een kookboekrecept naar punten per portie.
//
// Twee stappen die allebei kunnen mislukken, en dat mag de gebruiker zien:
//   1. de hoeveelheid omrekenen naar gram ("2 el olijfolie" is 30 g);
//   2. het ingredient herkennen als een product met voedingswaarden.
//
// Wat niet herkend wordt telt niet mee en wordt apart gemeld. Liever een
// puntenaantal met een zichtbare kanttekening dan een getal dat doet alsof
// het klopt.
//
// Er wordt nooit een puntwaarde van een bron overgenomen; alles komt uit de
// eigen formule.
// ---------------------------------------------------------------------------

/**
 * Gewicht in gram voor huishoudelijke maten. Ruwe schattingen — daarom staat
 * bij elk ingredient wat er is aangenomen, zodat je het kunt bijstellen.
 */
const MAAT_IN_GRAM: Record<string, number> = {
  g: 1, gr: 1, gram: 1,
  kg: 1000,
  ml: 1, cl: 10, dl: 100, l: 1000, liter: 1000,
  el: 15, eetlepel: 15, eetlepels: 15, "e.l.": 15,
  tl: 5, theelepel: 5, theelepels: 5, "t.l.": 5,
  snufje: 1, mespunt: 2,
  teen: 5, tenen: 5, teentje: 5, teentjes: 5,
  blik: 400, blikje: 400,
  pak: 500, pakje: 250,
  bosje: 30, bos: 30,
  plak: 20, plakje: 20, plakken: 20, plakjes: 20,
  snee: 35, sneetje: 35, sneetjes: 35, sneden: 35,
  handje: 25, hand: 25,
  bol: 125, krop: 300, struik: 400,
  scheut: 15, scheutje: 10,
};

/** Eenheden die "per stuk" betekenen: dan telt de portiegrootte van het product. */
const STUK_EENHEDEN = ["", "st", "st.", "stuk", "stuks", "x", "stuk(s)"];

export interface Omrekening {
  grams: number;
  /** Hoe het gewicht tot stand kwam, voor in de uitleg. */
  aanname: string;
  /** Onbekende eenheid: de gebruiker moet er even naar kijken. */
  onzeker: boolean;
}

/** Rekent hoeveelheid plus eenheid om naar gram, met het product als hulp. */
export function ingredientNaarGram(
  hoev: number,
  eenheid: string,
  product?: Product
): Omrekening {
  const aantal = Number.isFinite(hoev) && hoev > 0 ? hoev : 1;
  const e = (eenheid || "").trim().toLowerCase();

  if (STUK_EENHEDEN.includes(e)) {
    const perStuk = product?.portie?.grams;
    return perStuk != null
      ? { grams: aantal * perStuk, aanname: `${aantal} × ${product!.portie!.label} (${perStuk} g)`, onzeker: false }
      : { grams: aantal * 100, aanname: `${aantal} stuk, aangenomen 100 g per stuk`, onzeker: true };
  }

  const factor = MAAT_IN_GRAM[e];
  if (factor != null) {
    const grams = aantal * factor;
    const exact = e === "g" || e === "gram" || e === "gr" || e === "ml";
    return {
      grams,
      aanname: exact ? `${grams} ${e}` : `${aantal} ${eenheid} ≈ ${Math.round(grams)} g`,
      onzeker: false,
    };
  }

  return {
    grams: aantal * 100,
    aanname: `${aantal} ${eenheid}: onbekende maat, aangenomen 100 g`,
    onzeker: true,
  };
}

/**
 * Maakt een ingredientnaam geschikt om op te zoeken: haakjes eruit, en de
 * bereidingswoorden die er in een recept omheen staan.
 */
export function schoonIngredient(naam: string): string {
  return (naam || "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(verse?|gesnipperde?|gehakte?|geraspte?|fijngesneden|grofgesneden|gedroogde?|gemalen|gekookte?|rauwe?|biologische?|magere?|volle?|halfvolle?|kleine?|grote?|middelgrote?)\b/g, " ")
    .replace(/[,;].*$/, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface IngredientMatch {
  /** Zoals het in het recept staat. */
  ingredient: string;
  hoev: number;
  eenheid: string;
  /** Het gekozen product, of null als er niets herkend is. */
  product: Product | null;
  /** 0 tot 100; onder de 50 is het een gok. */
  score: number;
  omrekening: Omrekening;
  /** Doet niet mee in de puntentelling. */
  overgeslagen: boolean;
}

/**
 * Zoekt bij één ingredient het beste product.
 *
 * Je eigen aangevulde lijst gaat voor de ingebouwde basislijst: heb je zelf
 * ingevuld wat "tahin" is, dan is dat het antwoord, ook als de basislijst
 * toevallig iets zou vinden dat erop lijkt.
 */
export function matchIngredient(
  naam: string,
  hoev: number,
  eenheid: string,
  eigen?: IngredientBibliotheek
): IngredientMatch {
  if (eigen) {
    // Losgekoppeld geimporteerd zodat deze module puur blijft en zonder
    // bibliotheek precies werkt zoals hij deed.
    const uitEigen = zoekEigen(eigen, naam);
    if (uitEigen) {
      return {
        ingredient: naam,
        hoev,
        eenheid,
        product: uitEigen,
        score: 100,
        omrekening: ingredientNaarGram(hoev, eenheid, uitEigen),
        overgeslagen: false,
      };
    }
  }

  const term = schoonIngredient(naam);
  const treffers = term.length >= 2 ? zoekMetScore(term, 1) : [];
  const beste = treffers[0];

  const product = beste?.product ?? null;
  const omrekening = ingredientNaarGram(hoev, eenheid, product ?? undefined);

  return {
    ingredient: naam,
    hoev,
    eenheid,
    product,
    score: beste?.score ?? 0,
    omrekening,
    overgeslagen: product == null,
  };
}

/** Maakt van een match een maaltijdonderdeel met eigen punten. */
export function matchNaarComponent(m: IngredientMatch): MaaltijdComponent | null {
  if (!m.product || m.overgeslagen) return null;

  const f = m.omrekening.grams / 100;
  const per100 = m.product.per100;
  const nutrients: Nutrients = {
    kcal: per100.kcal * f,
    protein_g: per100.protein_g * f,
    fat_g: per100.fat_g * f,
    satfat_g: per100.satfat_g * f,
    carbs_g: per100.carbs_g * f,
    sugar_g: per100.sugar_g * f,
    fiber_g: per100.fiber_g * f,
    category: per100.category,
  };

  return {
    id: m.ingredient,
    name: m.product.name,
    amount: m.omrekening.grams,
    unit: m.product.eenheid,
    grams: m.omrekening.grams,
    nutrients,
    points_raw: rawPoints(nutrients, m.omrekening.grams),
  };
}

export interface ReceptPunten {
  /** Per portie, onafgerond en schaalvrij. */
  perPortiePunten: number;
  perPortieNutrients: Nutrients;
  componenten: MaaltijdComponent[];
  matches: IngredientMatch[];
  personen: number;
  /** Ingredienten die niet herkend zijn en dus niet meetellen. */
  nietHerkend: string[];
  /** Herkend, maar met lage zekerheid. Waard om na te kijken. */
  onzeker: string[];
}

/**
 * Rekent een recept door naar punten per portie.
 *
 * De onderdelen behouden hun eigen categorie, zodat de suikercorrectie per
 * ingredient blijft gelden. Pas daarna wordt door het aantal personen gedeeld.
 */
export function berekenReceptPunten(
  ingredienten: { naam: string; hoev: number; eenheid: string }[],
  personen: number,
  overschrijvingen: Record<string, IngredientMatch> = {},
  eigen?: IngredientBibliotheek
): ReceptPunten {
  const delen = Number.isFinite(personen) && personen > 0 ? personen : 1;

  const matches = ingredienten.map((i) =>
    overschrijvingen[i.naam] ?? matchIngredient(i.naam, i.hoev, i.eenheid, eigen)
  );

  const componenten = matches
    .map(matchNaarComponent)
    .filter((c): c is MaaltijdComponent => c !== null);

  const totaalPunten = componenten.reduce((s, c) => s + c.points_raw, 0);
  const totaal: Nutrients = {
    kcal: 0, protein_g: 0, fat_g: 0, satfat_g: 0,
    carbs_g: 0, sugar_g: 0, fiber_g: 0, category: "default",
  };
  for (const c of componenten) {
    totaal.kcal += c.nutrients.kcal;
    totaal.protein_g += c.nutrients.protein_g;
    totaal.fat_g += c.nutrients.fat_g;
    totaal.satfat_g += c.nutrients.satfat_g;
    totaal.carbs_g += c.nutrients.carbs_g;
    totaal.sugar_g += c.nutrients.sugar_g;
    totaal.fiber_g += c.nutrients.fiber_g;
  }

  const deel = (v: number) => v / delen;

  return {
    perPortiePunten: totaalPunten / delen,
    perPortieNutrients: {
      kcal: deel(totaal.kcal),
      protein_g: deel(totaal.protein_g),
      fat_g: deel(totaal.fat_g),
      satfat_g: deel(totaal.satfat_g),
      carbs_g: deel(totaal.carbs_g),
      sugar_g: deel(totaal.sugar_g),
      fiber_g: deel(totaal.fiber_g),
      category: "default",
    },
    componenten,
    matches,
    personen: delen,
    nietHerkend: matches.filter((m) => m.overgeslagen).map((m) => m.ingredient),
    onzeker: matches
      .filter((m) => !m.overgeslagen && (m.score < 50 || m.omrekening.onzeker))
      .map((m) => m.ingredient),
  };
}

/**
 * Vingerafdruk van een recept. Verandert er iets aan de ingredienten of het
 * aantal personen, dan verandert deze mee en vervalt de cache vanzelf.
 *
 * De revisie van je eigen ingredientenlijst telt mee. Vul je een ontbrekend
 * ingredient aan, dan verschuift de afdruk van elk recept en wordt alles
 * opnieuw doorgerekend — anders zou je aanvulling pas meetellen na een
 * wijziging aan het recept zelf.
 */
export function receptVingerafdruk(
  ingredienten: { naam: string; hoev: number; eenheid: string }[],
  personen: number,
  eigenRevisie = 0
): string {
  const tekst = ingredienten
    .map((i) => `${i.naam}|${i.hoev}|${i.eenheid}`)
    .join("~") + `#${personen}@${eigenRevisie}`;
  let h = 2166136261;
  for (let i = 0; i < tekst.length; i++) {
    h ^= tekst.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

// ingredienten.ts leunt op schoonIngredient uit deze module; daarom wordt de
// zoekfunctie hier onderaan binnengehaald in plaats van bovenaan.
import { zoekEigenIngredient as zoekEigen } from "./ingredienten.ts";
