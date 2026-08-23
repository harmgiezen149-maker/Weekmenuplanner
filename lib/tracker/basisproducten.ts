import type { Category, Product } from "./types";

// ---------------------------------------------------------------------------
// Eigen basislijst met onbewerkte Nederlandse producten.
//
// Open Food Facts draait om verpakte artikelen met een streepjescode en is
// juist zwak in wat je dagelijks het vaakst logt: een ei, gekookte rijst, een
// stuk kipfilet. Deze lijst vult dat gat aan.
//
// Waarden zijn per 100 g of 100 ml, in de gebruikelijke bereidingsvorm
// (rijst en pasta gekookt, vlees en vis rauw). Aanvullen mag: één regel
// erbij is genoeg, de zoekfunctie pikt hem vanzelf op.
// ---------------------------------------------------------------------------

interface BasisRegel {
  id: string;
  naam: string;
  /** Extra woorden waarop gezocht kan worden. */
  ook?: string[];
  eenheid?: "g" | "ml";
  categorie?: Category;
  /** [kcal, eiwit, vet, verzadigd vet, koolhydraten, suiker, vezels] per 100. */
  w: [number, number, number, number, number, number, number];
  /**
   * Bevat alcohol. Alcohol levert 7 kcal per gram maar telt niet mee in de
   * macro's, dus voor deze regels kloppen de calorieen bewust niet met de som
   * van eiwit, vet en koolhydraten. De punten kloppen wel: die rekenen op kcal.
   */
  alcohol?: boolean;
  portie?: { grams: number; label: string };
}

const REGELS: BasisRegel[] = [
  // -- graan, brood en aardappel --
  { id: "brood-volkoren", naam: "Volkorenbrood", ook: ["snee", "boterham"],
    w: [236, 9.0, 3.2, 0.7, 38.0, 3.0, 6.5], portie: { grams: 35, label: "1 snee" } },
  { id: "brood-wit", naam: "Witbrood", ook: ["snee", "boterham"],
    w: [265, 8.5, 3.0, 0.7, 47.0, 4.0, 2.5], portie: { grams: 35, label: "1 snee" } },
  { id: "rijst-wit", naam: "Witte rijst, gekookt", ook: ["basmati", "jasmijn"],
    w: [130, 2.7, 0.3, 0.1, 28.0, 0.1, 0.4], portie: { grams: 180, label: "1 opscheplepel" } },
  { id: "rijst-zilvervlies", naam: "Zilvervliesrijst, gekookt", ook: ["bruine rijst"],
    w: [123, 2.7, 1.0, 0.2, 25.6, 0.4, 1.6], portie: { grams: 180, label: "1 opscheplepel" } },
  { id: "pasta", naam: "Pasta, gekookt", ook: ["spaghetti", "penne", "macaroni"],
    w: [158, 5.8, 0.9, 0.2, 31.0, 0.6, 1.8], portie: { grams: 180, label: "1 portie" } },
  { id: "pasta-volkoren", naam: "Volkorenpasta, gekookt",
    w: [124, 5.0, 0.5, 0.1, 26.0, 0.6, 3.9], portie: { grams: 180, label: "1 portie" } },
  { id: "aardappel", naam: "Aardappel, gekookt", ook: ["krieltjes"],
    w: [87, 1.9, 0.1, 0.0, 20.0, 0.9, 1.8], portie: { grams: 150, label: "3 middelgrote" } },
  { id: "couscous", naam: "Couscous, gekookt",
    w: [112, 3.8, 0.2, 0.0, 23.2, 0.1, 1.4], portie: { grams: 150, label: "1 portie" } },
  { id: "havermout", naam: "Havermout, droog", ook: ["oatmeal", "pap"],
    w: [379, 13.0, 6.5, 1.1, 67.0, 1.0, 10.0], portie: { grams: 40, label: "1 portie" } },

  // -- vlees, vis en ei --
  { id: "kipfilet", naam: "Kipfilet, rauw", ook: ["kip"],
    w: [110, 23.0, 1.5, 0.5, 0, 0, 0], portie: { grams: 120, label: "1 filet" } },
  { id: "kipdij", naam: "Kipdijfilet, rauw",
    w: [148, 19.0, 8.0, 2.2, 0, 0, 0], portie: { grams: 120, label: "1 portie" } },
  { id: "gehakt-mager", naam: "Rundergehakt, mager, rauw",
    w: [175, 20.0, 10.0, 4.0, 0, 0, 0], portie: { grams: 100, label: "1 portie" } },
  { id: "gehakt-half", naam: "Half-om-halfgehakt, rauw",
    w: [242, 17.0, 19.0, 8.0, 0, 0, 0], portie: { grams: 100, label: "1 portie" } },
  { id: "biefstuk", naam: "Biefstuk, rauw",
    w: [124, 21.5, 4.0, 1.6, 0, 0, 0], portie: { grams: 125, label: "1 stuk" } },
  { id: "zalm", naam: "Zalmfilet, rauw",
    w: [208, 20.0, 13.0, 3.1, 0, 0, 0], portie: { grams: 125, label: "1 filet" } },
  { id: "kabeljauw", naam: "Kabeljauw, rauw", ook: ["witvis"],
    w: [82, 18.0, 0.7, 0.1, 0, 0, 0], portie: { grams: 125, label: "1 filet" } },
  { id: "tonijn-water", naam: "Tonijn in water, uitgelekt",
    w: [116, 26.0, 1.0, 0.3, 0, 0, 0], portie: { grams: 145, label: "1 blik" } },
  { id: "ei", naam: "Ei", ook: ["eieren", "gekookt ei", "gebakken ei"],
    w: [143, 12.6, 9.5, 3.1, 0.7, 0.4, 0], portie: { grams: 55, label: "1 ei" } },

  // -- zuivel --
  { id: "melk-halfvol", naam: "Halfvolle melk", eenheid: "ml", categorie: "dairy_plain",
    w: [47, 3.5, 1.5, 1.0, 4.7, 4.7, 0], portie: { grams: 200, label: "1 glas" } },
  { id: "melk-mager", naam: "Magere melk", eenheid: "ml", categorie: "dairy_plain",
    w: [35, 3.5, 0.1, 0.1, 4.9, 4.9, 0], portie: { grams: 200, label: "1 glas" } },
  { id: "kwark-mager", naam: "Magere kwark", categorie: "dairy_plain",
    w: [47, 9.4, 0.2, 0.1, 3.9, 3.9, 0], portie: { grams: 150, label: "1 bakje" } },
  { id: "yoghurt-grieks-0", naam: "Griekse yoghurt 0%", categorie: "dairy_plain",
    w: [57, 10.0, 0.4, 0.1, 3.6, 3.6, 0], portie: { grams: 150, label: "1 bakje" } },
  { id: "yoghurt-mager", naam: "Magere yoghurt", categorie: "dairy_plain",
    w: [41, 4.1, 0.1, 0.1, 5.6, 5.6, 0], portie: { grams: 150, label: "1 bakje" } },
  { id: "kaas-48", naam: "Goudse kaas 48+", ook: ["jong belegen", "plak kaas"],
    w: [356, 25.0, 28.0, 18.0, 0, 0, 0], portie: { grams: 20, label: "1 plak" } },
  { id: "kaas-30", naam: "Kaas 30+", ook: ["magere kaas"],
    w: [275, 30.0, 17.0, 11.0, 0, 0, 0], portie: { grams: 20, label: "1 plak" } },
  { id: "boter", naam: "Roomboter",
    w: [717, 0.9, 81.0, 51.0, 0.1, 0.1, 0], portie: { grams: 10, label: "1 eetlepel" } },

  // -- groente --
  { id: "broccoli", naam: "Broccoli", categorie: "vegetable",
    w: [34, 2.8, 0.4, 0.0, 7.0, 1.7, 2.6], portie: { grams: 150, label: "1 portie" } },
  { id: "tomaat", naam: "Tomaat", categorie: "vegetable",
    w: [18, 0.9, 0.2, 0.0, 3.9, 2.6, 1.2], portie: { grams: 120, label: "1 stuk" } },
  { id: "komkommer", naam: "Komkommer", categorie: "vegetable",
    w: [15, 0.7, 0.1, 0.0, 3.6, 1.7, 0.5], portie: { grams: 100, label: "1 portie" } },
  { id: "sperziebonen", naam: "Sperziebonen", categorie: "vegetable",
    w: [31, 1.8, 0.2, 0.0, 7.0, 3.3, 2.7], portie: { grams: 150, label: "1 portie" } },
  { id: "wortel", naam: "Wortel", ook: ["worteltjes"], categorie: "vegetable",
    w: [41, 0.9, 0.2, 0.0, 10.0, 4.7, 2.8], portie: { grams: 150, label: "1 portie" } },
  { id: "spinazie", naam: "Spinazie", categorie: "vegetable",
    w: [23, 2.9, 0.4, 0.1, 3.6, 0.4, 2.2], portie: { grams: 150, label: "1 portie" } },
  { id: "paprika", naam: "Paprika", categorie: "vegetable",
    w: [31, 1.0, 0.3, 0.0, 6.0, 4.2, 2.1], portie: { grams: 120, label: "1 stuk" } },
  { id: "ui", naam: "Ui", categorie: "vegetable",
    w: [40, 1.1, 0.1, 0.0, 9.3, 4.2, 1.7], portie: { grams: 80, label: "1 stuk" } },
  { id: "bloemkool", naam: "Bloemkool", categorie: "vegetable",
    w: [25, 1.9, 0.3, 0.1, 5.0, 1.9, 2.0], portie: { grams: 150, label: "1 portie" } },
  { id: "courgette", naam: "Courgette", categorie: "vegetable",
    w: [16, 0.7, 0.1, 0.0, 3.6, 1.7, 0.5], portie: { grams: 150, label: "1 portie" } },

  // -- fruit --
  { id: "banaan", naam: "Banaan", categorie: "fruit_whole",
    w: [89, 1.1, 0.3, 0.1, 23.0, 12.0, 2.6], portie: { grams: 120, label: "1 stuk" } },
  { id: "appel", naam: "Appel", categorie: "fruit_whole",
    w: [52, 0.3, 0.2, 0.0, 14.0, 10.0, 2.4], portie: { grams: 150, label: "1 stuk" } },
  { id: "sinaasappel", naam: "Sinaasappel", categorie: "fruit_whole",
    w: [47, 0.9, 0.1, 0.0, 12.0, 9.0, 2.4], portie: { grams: 150, label: "1 stuk" } },
  { id: "blauwe-bessen", naam: "Blauwe bessen", categorie: "fruit_whole",
    w: [57, 0.7, 0.3, 0.0, 14.0, 10.0, 2.4], portie: { grams: 100, label: "1 bakje" } },
  { id: "avocado", naam: "Avocado", categorie: "fruit_whole",
    w: [160, 2.0, 15.0, 2.1, 9.0, 0.7, 7.0], portie: { grams: 150, label: "1 halve" } },

  // -- peulvruchten en noten --
  { id: "bruine-bonen", naam: "Bruine bonen, gekookt", categorie: "legume",
    w: [127, 8.7, 0.5, 0.1, 23.0, 0.3, 6.4], portie: { grams: 150, label: "1 portie" } },
  { id: "kikkererwten", naam: "Kikkererwten, gekookt", categorie: "legume",
    w: [164, 8.9, 2.6, 0.3, 27.0, 4.8, 7.6], portie: { grams: 150, label: "1 portie" } },
  { id: "linzen", naam: "Linzen, gekookt", categorie: "legume",
    w: [116, 9.0, 0.4, 0.1, 20.0, 1.8, 7.9], portie: { grams: 150, label: "1 portie" } },
  { id: "amandelen", naam: "Amandelen", categorie: "nuts_seeds",
    w: [579, 21.0, 50.0, 3.8, 22.0, 4.4, 12.5], portie: { grams: 25, label: "1 handje" } },
  { id: "walnoten", naam: "Walnoten", categorie: "nuts_seeds",
    w: [654, 15.0, 65.0, 6.1, 14.0, 2.6, 6.7], portie: { grams: 25, label: "1 handje" } },
  { id: "pindakaas", naam: "Pindakaas",
    w: [588, 25.0, 50.0, 10.0, 20.0, 9.0, 8.0], portie: { grams: 15, label: "1 mespunt" } },

  // -- olie en dranken --
  { id: "olijfolie", naam: "Olijfolie", eenheid: "ml",
    w: [900, 0, 100.0, 14.0, 0, 0, 0], portie: { grams: 10, label: "1 eetlepel" } },
  { id: "bier-pils", naam: "Pils", ook: ["bier"], eenheid: "ml", alcohol: true,
    w: [43, 0.5, 0, 0, 3.6, 0, 0], portie: { grams: 250, label: "1 glas" } },
  { id: "wijn-rood", naam: "Rode wijn", eenheid: "ml", alcohol: true,
    w: [85, 0.1, 0, 0, 2.6, 0.6, 0], portie: { grams: 150, label: "1 glas" } },
  { id: "wijn-wit", naam: "Witte wijn", eenheid: "ml", alcohol: true,
    w: [82, 0.1, 0, 0, 2.6, 1.0, 0], portie: { grams: 150, label: "1 glas" } },
];

function naarProduct(r: BasisRegel): Product {
  const [kcal, eiwit, vet, verzadigd, koolhydraten, suiker, vezels] = r.w;
  return {
    id: `basis:${r.id}`,
    name: r.naam,
    bron: "basis",
    eenheid: r.eenheid ?? "g",
    per100: {
      kcal, protein_g: eiwit, fat_g: vet, satfat_g: verzadigd,
      carbs_g: koolhydraten, sugar_g: suiker, fiber_g: vezels,
      category: r.categorie ?? "default",
    },
    ...(r.portie ? { portie: r.portie } : {}),
  };
}

export const BASISPRODUCTEN: Product[] = REGELS.map(naarProduct);

/** Id's van producten waarvan de calorieen uit alcohol komen. */
export const MET_ALCOHOL: Set<string> = new Set(
  REGELS.filter((r) => r.alcohol).map((r) => `basis:${r.id}`)
);

/** Zoekterm normaliseren: kleine letters, zonder accenten. */
function normaliseer(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

export interface Treffer {
  product: Product;
  /** 0 tot 100. Onder de 50 is het een gok en hoort de gebruiker het te zien. */
  score: number;
}

/**
 * Zoekt in de basislijst en geeft de score erbij. Wordt gebruikt bij het
 * matchen van receptingredienten, waar zichtbaar moet zijn hoe zeker een
 * match is.
 */
export function zoekMetScore(term: string, limiet = 8): Treffer[] {
  const q = normaliseer(term);
  if (q.length < 1) return [];

  const scores: { p: Product; score: number }[] = [];
  REGELS.forEach((r, i) => {
    const naam = normaliseer(r.naam);
    const woorden = naam.split(/[\s,]+/);
    const extra = (r.ook ?? []).map(normaliseer);

    let score = 0;
    if (naam === q) score = 100;
    else if (naam.startsWith(q)) score = 80;
    else if (woorden.some((w) => w === q)) score = 70;
    else if (extra.some((e) => e === q)) score = 65;
    else if (woorden.some((w) => w.startsWith(q))) score = 50;
    else if (extra.some((e) => e.startsWith(q))) score = 45;
    else if (naam.includes(q)) score = 30;
    else if (extra.some((e) => e.includes(q))) score = 20;

    if (score > 0) scores.push({ p: BASISPRODUCTEN[i], score });
  });

  return scores
    .sort((a, b) =>
      b.score - a.score ||
      a.p.name.length - b.p.name.length ||
      a.p.name.localeCompare(b.p.name))
    .slice(0, limiet)
    .map((s) => ({ product: s.p, score: s.score }));
}

/**
 * Zoekt in de basislijst. Een treffer aan het begin van de naam weegt zwaarder
 * dan een treffer ergens in het midden, zodat "ei" bovenaan het ei geeft en
 * niet de sperziebonen.
 */
export function zoekBasisproducten(term: string, limiet = 8): Product[] {
  return zoekMetScore(term, limiet).map((t) => t.product);
}
