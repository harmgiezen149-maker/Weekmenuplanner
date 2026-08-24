// ---------------------------------------------------------------------------
// Voedings- en gewichtstracker — datamodel.
//
// Alle Redis-keys van deze module staan onder de prefix `wl:`. De bestaande
// kookboek-keys (recipe:*, week:current, boodschappen:current, ...) worden
// nergens aangeraakt.
// ---------------------------------------------------------------------------

// Productcategorie. Bepaalt hoeveel van de totale suiker als "van nature
// aanwezig" wordt afgetrokken; zie lib/tracker/points.ts.
export const CATEGORIEEN = [
  "default",
  "dairy_plain",
  "fruit_whole",
  "vegetable",
  "legume",
  "nuts_seeds",
] as const;
export type Category = (typeof CATEGORIEEN)[number];

// Nederlandse labels voor de categoriekeuze in het invoerformulier.
export const CATEGORIE_LABEL: Record<Category, string> = {
  default: "Geen bijzonderheden",
  dairy_plain: "Zuivel zonder toegevoegde suiker",
  fruit_whole: "Vers fruit",
  vegetable: "Groente",
  legume: "Peulvruchten",
  nuts_seeds: "Noten & zaden",
};

// Voedingswaarden. Altijd absoluut voor de gelogde hoeveelheid, niet per 100 g.
// added_sugar_g is optioneel: is die bekend (handmatig of uit de foto-schatting),
// dan wint hij van de categorie-aftrek.
export interface Nutrients {
  kcal: number;
  protein_g: number;
  fat_g: number;
  satfat_g: number;
  carbs_g: number;
  sugar_g: number;
  fiber_g: number;
  added_sugar_g?: number | null;
  category?: Category;
}

export const LEGE_NUTRIENTS: Nutrients = {
  kcal: 0, protein_g: 0, fat_g: 0, satfat_g: 0,
  carbs_g: 0, sugar_g: 0, fiber_g: 0, category: "default",
};

export const MAALTIJDEN_TRACKER = ["ontbijt", "lunch", "diner", "snack"] as const;
export type Maaltijd = (typeof MAALTIJDEN_TRACKER)[number];

export const MAALTIJD_LABEL: Record<Maaltijd, string> = {
  ontbijt: "Ontbijt", lunch: "Lunch", diner: "Diner", snack: "Snack",
};

// Waar een regel vandaan komt. Fase 1 gebruikt alleen 'manual'; de rest is
// alvast vastgelegd zodat het datamodel niet hoeft te wijzigen.
export type EntrySource =
  | "barcode" | "search" | "manual" | "photo" | "link" | "recipe" | "favorite" | "meal";

export interface Entry {
  id: string;
  ts: number;
  meal: Maaltijd;
  source: EntrySource;
  name: string;
  brand?: string;
  amount: number;
  unit: string;
  // Massa-equivalent van de gelogde hoeveelheid in gram. Nodig om de
  // categorie-aftrek voor suiker mee te schalen (die staat per 100 g).
  grams: number;
  nutrients: Nutrients;
  // Onafgerond en zonder points_scale. Zo verandert een andere schaal met
  // terugwerkende kracht het hele logboek zonder herberekening.
  points_raw: number;
  note?: string;
  ref?: string;
  /**
   * Onderdelen, als deze regel uit een samengestelde maaltijd of een recept
   * komt. points_raw van de regel is de som van de componenten, niet een
   * herberekening over de opgetelde voedingswaarden — zie lib/tracker/maaltijd.ts.
   */
  components?: MaaltijdComponent[];
}

// ---------------------------------------------------------------------------
// Samengestelde maaltijden: een vast ontbijt, een lunch met brood en beleg.
// ---------------------------------------------------------------------------

/** Eén onderdeel van een samengestelde maaltijd, met zijn eigen punten. */
export interface MaaltijdComponent {
  id: string;
  name: string;
  brand?: string;
  amount: number;
  unit: string;
  grams: number;
  /** Absoluut voor deze hoeveelheid. */
  nutrients: Nutrients;
  /** Onafgerond en schaalvrij, met de eigen categorie van dit onderdeel. */
  points_raw: number;
}

export interface Maaltijdsjabloon {
  id: string;
  name: string;
  /** Bij welke maaltijd deze standaard hoort. */
  meal: Maaltijd;
  components: MaaltijdComponent[];
  created_at: number;
  last_used: number;
}

// Bewegingspunten (fase 5). Het veld staat er nu al zodat opgeslagen dagen
// straks niet gemigreerd hoeven te worden.
export interface Activity {
  id: string;
  ts: number;
  name: string;
  met: number;
  minutes: number;
  points: number;
}

export interface DayTotals {
  points_raw: number;
  kcal: number;
  protein_g: number;
  fat_g: number;
  satfat_g: number;
  carbs_g: number;
  sugar_g: number;
  fiber_g: number;
}

export const LEGE_TOTALS: DayTotals = {
  points_raw: 0, kcal: 0, protein_g: 0, fat_g: 0,
  satfat_g: 0, carbs_g: 0, sugar_g: 0, fiber_g: 0,
};

export interface Day {
  date: string; // YYYY-MM-DD
  entries: Entry[];
  activity: Activity[];
  totals: DayTotals;
  buffer_used: number;
}

// ---------------------------------------------------------------------------
// Producten: het tussenformaat tussen een bron (Open Food Facts, de eigen
// basislijst, een favoriet) en een regel in het logboek.
// ---------------------------------------------------------------------------

/**
 * Een product met zijn voedingswaarden per 100 g of ml. Alle zoekbronnen
 * leveren dit formaat op, zodat er maar één weg naar een Entry loopt.
 */
export interface Product {
  id: string;
  name: string;
  brand?: string;
  /** Waar het vandaan komt: de externe productdatabase, de eigen basislijst,
   *  of een eerder bewaarde regel (favoriet of recent). */
  bron: "off" | "basis" | "bewaard" | "winkel" | "eigen";
  /** g voor vaste producten, ml voor dranken. */
  eenheid: "g" | "ml";
  /** Voedingswaarden per 100 g of ml. */
  per100: Nutrients;
  /** Standaardportie, als de bron die kent. */
  portie?: { grams: number; label: string };
  /** Streepjescode, als het product er een heeft. */
  barcode?: string;
}

/**
 * Een bewaard sjabloon: een favoriet of een recent gelogd item. Hetzelfde als
 * een Entry, maar zonder tijdstip en zonder maaltijd — die kies je opnieuw.
 */
export interface FoodTemplate {
  id: string;
  name: string;
  brand?: string;
  source: EntrySource;
  amount: number;
  unit: string;
  grams: number;
  nutrients: Nutrients;
  points_raw: number;
  ref?: string;
  /** Wanneer het sjabloon voor het laatst gebruikt is. */
  last_used: number;
}

/** Zoveel recent gelogde items worden bewaard. */
export const RECENT_MAX = 50;

export type Geslacht = "man" | "vrouw";

export const ACTIVITEITSFACTOREN = [
  { waarde: 1.2, label: "Zittend", uitleg: "Kantoorwerk, weinig beweging" },
  { waarde: 1.375, label: "Licht actief", uitleg: "1 tot 3 keer per week sporten" },
  { waarde: 1.55, label: "Matig actief", uitleg: "3 tot 5 keer per week sporten" },
  { waarde: 1.725, label: "Actief", uitleg: "6 tot 7 keer per week sporten" },
] as const;

export const WEEGDAGEN = [
  "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag",
] as const;

export interface Profile {
  name: string;
  sex: Geslacht;
  birthdate: string; // YYYY-MM-DD
  height_cm: number;
  activity_factor: number;
  start_weight_kg: number;
  // Fase 1 heeft nog geen weeglog; dit veld is de bron van waarheid voor het
  // budget. Vanaf fase 3 schrijft de weegflow hem bij elke weging bij.
  current_weight_kg: number;
  goal_weight_kg: number;
  weigh_day: number; // 0 = maandag ... 6 = zondag
  points_scale: number;
  // Gewicht waarop het opgeslagen dagbudget is gebaseerd. Wijkt het huidige
  // gewicht hier meer dan 1 kg van af, dan wordt het budget herberekend.
  budget_basis_weight_kg: number;
  daily_budget: number;
  weekly_buffer: number;
  // Eiwitstreefwaarde in gram per dag. 0 = niet tonen.
  protein_target_g: number;
  created_at: string;
}

export const STANDAARD_WEEKBUFFER = 28;
export const STANDAARD_POINTS_SCALE = 1.0;
// Eiwitrichtlijn bij afvallen: gram per kg streefgewicht.
export const EIWIT_PER_KG_STREEFGEWICHT = 1.6;
