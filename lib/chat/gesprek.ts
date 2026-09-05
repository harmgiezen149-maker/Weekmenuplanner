import type { Voorstel } from "./voorstellen.ts";

// ---------------------------------------------------------------------------
// Hoe een gesprek eruitziet, en de regels die geen database nodig hebben.
//
// Los van opslag.ts zodat dit te testen is zonder Redis: de vorm van een id en
// wat een bruikbare titel is zijn precies de dingen die stilletjes verkeerd
// gaan.
// ---------------------------------------------------------------------------

export interface Bron {
  titel: string;
  url: string;
}

export interface ChatBericht {
  rol: "mens" | "bot";
  tekst: string;
  ts: number;
  /** Alleen bij een botbericht dat het web heeft geraadpleegd. */
  bronnen?: Bron[];
  /** Kaartjes die op bevestiging wachten. */
  voorstellen?: Voorstel[];
}

export interface Gesprek {
  id: string;
  titel: string;
  bijgewerkt: number;
  berichten: ChatBericht[];
}

/** Zoveel berichten blijven per gesprek staan; ouder verdwijnt vooraan. */
export const BERICHTEN_MAX = 60;

/** Zoveel gesprekken blijven bewaard. */
export const GESPREKKEN_MAX = 20;

/**
 * Zoveel beurten gaan er terug het model in. Genoeg voor de draad van een
 * gesprek, weinig genoeg om de kosten voorspelbaar te houden.
 */
export const GESCHIEDENIS = 12;

/**
 * Een titel uit de eerste vraag. Niet slim, wel gratis: de eerste zin, en als
 * die te kort is om iets te zeggen ("Hoi?") de hele vraag.
 */
export function titelUit(vraag: string): string {
  const schoon = vraag.replace(/\s+/g, " ").trim();
  const eerste = (schoon.split(/[.?!]/)[0] ?? "").trim();
  const titel = (eerste.length >= 12 ? eerste : schoon).slice(0, 50).trim();
  return titel || "Nieuw gesprek";
}

/** Ids komen van de client terug; alleen onze eigen vorm wordt geaccepteerd. */
export function geldigId(id: unknown): id is string {
  return typeof id === "string" && /^[a-z0-9]{6,32}$/.test(id);
}

export function nieuwGesprekId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
