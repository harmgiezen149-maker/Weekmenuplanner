export const KEUKENS = [
  "Italiaans", "Grieks", "Frans", "Aziatisch", "Mexicaans",
  "Hollands", "Midden-Oosters", "Indiaas", "Overig",
] as const;

export const HOOFDINGREDIENTEN = [
  "Vis", "Vlees", "Kip", "Vegetarisch", "Vegan", "Pasta", "Rijst", "Soep",
] as const;

export const MOEILIJKHEDEN = ["Makkelijk", "Gemiddeld", "Pittig werk"] as const;

export const MAALTIJDEN = ["Ontbijt", "Lunch", "Avondeten", "Toetje"] as const;

export const DAGEN = [
  "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag",
] as const;

export const WINKELS = ["Lidl", "Jumbo", "AH", "Anders"] as const;

// Beginwaarde voor een nieuw item: nog geen winkel toegewezen.
export const GEEN_WINKEL = "";

// Standaard winkelgebieden (afdelingen) in een supermarkt. "" = onbekend/overig.
export const WINKELGEBIEDEN = [
  "Groente & fruit",
  "Brood & banket",
  "Vlees & vis",
  "Kaas & vleeswaren",
  "Zuivel & koeling",
  "Diepvries",
  "Conserven & potten",
  "Pasta, rijst & wereldkeuken",
  "Sauzen, olie & kruiden",
  "Ontbijt & beleg",
  "Snoep, koek & chips",
  "Dranken",
  "Non-food",
  "Overig",
] as const;

export const GEEN_GEBIED = "";

export interface Ingredient {
  naam: string;
  hoev: number;
  eenheid: string;
  winkel?: string;  // een van WINKELS, of "" (nog niet toegewezen)
  gebied?: string;  // een van WINKELGEBIEDEN, of "" (nog niet bepaald)
}

export interface Recept {
  id: string;
  titel: string;
  keuken: string;
  hoofd: string;
  maaltijd: string; // Ontbijt, Lunch of Avondeten
  moeilijkheid: string;
  tijd: number;
  score: number;
  personen: number;
  gegeten: number; // hoe vaak dit recept al gegeten is
  afbeelding: string; // data-URL (base64) of lege string
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
// bron "week" = automatisch uit het weekmenu; "hand" = zelf toegevoegd.
export interface BoodschapItem {
  id: string;
  naam: string;
  hoev: number;
  eenheid: string;
  winkel: string; // een van WINKELS, of "" (niet toegewezen)
  gebied: string; // een van WINKELGEBIEDEN, of "" (niet bepaald)
  gedaan: boolean;
  bron: "week" | "hand";
}

export interface Boodschappen {
  items: BoodschapItem[];
}

// Per winkel de volgorde van winkelgebieden (looproute). Een array van gebiednamen.
// Ontbreekt een winkel, dan geldt de standaardvolgorde WINKELGEBIEDEN.
export type GebiedVolgorde = Record<string, string[]>;

// Voorraad: terugkerende generieke artikelen (wasmiddel, aluminiumfolie, ...).
// Worden per afdeling gesorteerd getoond; winkel telt alleen mee zodra je het
// artikel aan de boodschappenlijst toevoegt.
export interface VoorraadArtikel {
  id: string;
  naam: string;
  winkel: string; // een van WINKELS, of "" (niet toegewezen)
  gebied: string; // een van WINKELGEBIEDEN, of "" (niet bepaald)
}

export interface Voorraad {
  items: VoorraadArtikel[];
}
