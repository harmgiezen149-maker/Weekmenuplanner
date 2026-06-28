export const KEUKENS = [
  "Italiaans", "Grieks", "Frans", "Aziatisch", "Mexicaans",
  "Hollands", "Midden-Oosters", "Indiaas", "Overig",
] as const;

export const HOOFDINGREDIENTEN = [
  "Vis", "Vlees", "Kip", "Vegetarisch", "Vegan", "Pasta", "Rijst", "Soep",
] as const;

export const MOEILIJKHEDEN = ["Makkelijk", "Gemiddeld", "Pittig werk"] as const;

export const DAGEN = [
  "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag",
] as const;

export const WINKELS = ["Lidl", "Jumbo", "AH", "Anders"] as const;

// Beginwaarde voor een nieuw item: nog geen winkel toegewezen.
export const GEEN_WINKEL = "";

export interface Ingredient {
  naam: string;
  hoev: number;
  eenheid: string;
}

export interface Recept {
  id: string;
  titel: string;
  keuken: string;
  hoofd: string;
  moeilijkheid: string;
  tijd: number;
  score: number;
  personen: number;
  ingredienten: Ingredient[];
  bereiding: string;
}

// Weekplanning: per dagnaam een slot met recept + gekozen personen.
export type WeekSlot = { recipeId: string; personen: number };
export type Week = Record<string, WeekSlot>;

export interface WeekState {
  startDag: number; // 0 = Maandag
  slots: Week;
}

// Boodschappenlijst: één bewerkbare, opgeslagen lijst.
// Items kunnen uit het weekmenu komen (bron: "week") of handmatig zijn (bron: "hand").
export interface BoodschapItem {
  id: string;
  naam: string;
  hoev: number;
  eenheid: string;
  winkel: string; // een van WINKELS
  gedaan: boolean;
}

export interface Boodschappen {
  items: BoodschapItem[];
}
