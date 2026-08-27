import type { Recept } from "./types";

// ---------------------------------------------------------------------------
// Wat er op het briefje staat koppelen aan een recept uit je kookboek.
//
// Op een briefje staat zelden de titel van een recept. Er staat "pasta salade"
// terwijl het recept "Pastasalade met feta en olijven" heet, of er staat een
// rijtje ingrediënten — "spinazie, gehakt, pasta" — waar je zelf weet welk
// gerecht je bedoelt.
//
// Daarom drie uitkomsten en niet twee. Het verschil tussen "dit is het" en
// "bedoel je dit?" is wat bepaalt of de app iets voor je invult of iets aan je
// vraagt. Een app die bij twijfel toch invult zet stilletjes het verkeerde
// gerecht op woensdag, en dat merk je pas in de winkel.
// ---------------------------------------------------------------------------

export type Zekerheid = "zeker" | "misschien" | "niets";

export interface ReceptTreffer {
  recept: Recept;
  score: number;
}

export interface MatchUitslag {
  zekerheid: Zekerheid;
  /** De beste treffer, als die er is. */
  beste: ReceptTreffer | null;
  /** Een handvol alternatieven om uit te kiezen, beste eerst. */
  alternatieven: ReceptTreffer[];
}

/** Vanaf hier vult de app het zelf in. */
const ZEKER = 70;
/** Hieronder is er niets gevonden dat erop lijkt. */
const MISSCHIEN = 25;

/** Woorden die niets onderscheiden en de score anders opblazen. */
const STOPWOORDEN = new Set([
  "met", "en", "van", "de", "het", "een", "in", "op", "uit", "of", "voor",
  "gerecht", "recept", "maken", "eten", "avondeten", "restjes",
]);

export function woorden(tekst: string): string[] {
  return String(tekst ?? "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length >= 3 && !STOPWOORDEN.has(w));
}

/**
 * Twee woorden die op hetzelfde neerkomen.
 *
 * Op een briefje staat "pasta salade" waar het recept "pastasalade" heet, en
 * "tortellini's" waar het recept "tortellini" zegt. Een harde vergelijking laat
 * die allebei vallen.
 */
function zelfdeWoord(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 5 && b.length >= 5 && (a.startsWith(b) || b.startsWith(a))) return true;
  return false;
}

function bevat(lijst: string[], woord: string): boolean {
  return lijst.some((w) => zelfdeWoord(w, woord));
}

/**
 * Hoe goed past dit recept bij wat er op het briefje staat?
 *
 * De titel weegt het zwaarst: staat er "tortellini" en heet een recept zo, dan
 * is dat het. Ingrediënten tellen half mee, want daarmee vang je het geval
 * waarin je een rijtje boodschappen hebt opgeschreven in plaats van een naam.
 */
export function scoorRecept(tekst: string, r: Recept): number {
  const gezocht = woorden(tekst);
  if (gezocht.length === 0) return 0;

  const titel = woorden(r.titel);
  const samengevoegd = titel.join("");
  const ingredienten = r.ingredienten.flatMap((i) => woorden(i.naam));

  let punten = 0;
  for (const w of gezocht) {
    if (bevat(titel, w)) { punten += 10; continue; }
    // "pasta salade" tegen "Pastasalade": los geschreven op het briefje,
    // aaneen in de titel.
    if (w.length >= 4 && samengevoegd.includes(w)) { punten += 8; continue; }
    if (bevat(ingredienten, w)) { punten += 5; continue; }
  }

  // Delen door het aantal gezochte woorden: anders wint een lang briefje altijd
  // van een kort, ongeacht hoe goed het past.
  const basis = (punten / (gezocht.length * 10)) * 100;

  // Een recept waarvan de hele titel voorkomt is bijna zeker de bedoelde.
  const heleTitel = titel.length > 0 && titel.every((w) => bevat(gezocht, w));
  return Math.round(Math.min(100, heleTitel ? Math.max(basis, 85) : basis));
}

/**
 * Zoekt het bedoelde recept.
 *
 * Alleen avondgerechten, want een weekmenu gaat over avondeten. Zou een
 * ontbijtrecept mogen winnen, dan komt "yoghurt met muesli" op woensdagavond
 * te staan omdat het toevallig het woord "pasta" niet bevat.
 */
export function zoekRecept(tekst: string, recepten: Recept[]): MatchUitslag {
  const schoon = String(tekst ?? "").trim();
  if (!schoon) return { zekerheid: "niets", beste: null, alternatieven: [] };

  const kandidaten = recepten.filter((r) => r.maaltijd === "Avondeten");
  const gescoord = (kandidaten.length > 0 ? kandidaten : recepten)
    .map((recept) => ({ recept, score: scoorRecept(schoon, recept) }))
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score || a.recept.titel.localeCompare(b.recept.titel));

  const beste = gescoord[0] ?? null;
  if (!beste || beste.score < MISSCHIEN) {
    return { zekerheid: "niets", beste: null, alternatieven: gescoord.slice(0, 5) };
  }

  // Twee die vlak bij elkaar liggen is geen zekerheid maar een keuze. Dan hoort
  // de app te vragen, niet te kiezen.
  const tweede = gescoord[1];
  const duidelijk = !tweede || beste.score - tweede.score >= 15;

  return {
    zekerheid: beste.score >= ZEKER && duidelijk ? "zeker" : "misschien",
    beste,
    alternatieven: gescoord.slice(0, 5),
  };
}
