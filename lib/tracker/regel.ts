import { schaalComponenten } from "./maaltijd.ts";
import { naamUitStukEenheid } from "./portie.ts";
import { nl } from "./datum.ts";
import type { Entry, Nutrients } from "./types";

// ---------------------------------------------------------------------------
// Een gelogde regel achteraf op een ander aantal zetten.
//
// Je logt één ei en eet er twee. Dat achteraf rechtzetten moest tot nu toe met
// wissen en opnieuw invoeren, inclusief het opzoeken van het product. Hier
// staat wat "een aantal" bij zo'n regel betekent — dat verschilt per soort
// regel — en hoe de regel meeschaalt.
// ---------------------------------------------------------------------------

/**
 * Waar het aantal bij deze regel over gaat.
 *
 * - `porties`: een recept of een vaste maaltijd; het aantal is het aantal
 *   porties, en halve porties komen echt voor.
 * - `stuks`: per stuk gelogd ("3 × snee") of in porties ("1 portie"); het
 *   aantal staat al in de regel en wordt gewoon bijgesteld.
 * - `keer`: alles wat in grammen of milliliters staat. Daar is geen stuk om
 *   te tellen, dus telt het aantal hoe vaak de gelogde hoeveelheid meetelt:
 *   twee keer 55 gram ei.
 */
export type Aantalsoort = "porties" | "stuks" | "keer";

export interface Aantalvak {
  soort: Aantalsoort;
  /** Wat er in het veld staat zolang je niets verandert. */
  waarde: number;
  /** Stapgrootte van de min- en de plusknop. */
  stap: number;
  label: string;
  /** Waar één eenheid voor staat: "portie", "snee", "55 g". */
  eenheid: string;
}

/** Eenheden die zelf al een aantal zijn, dus geen vermenigvuldiging nodig hebben. */
const TELEENHEDEN = /^(portie|porties|stuk|stuks)$/i;

export function aantalvak(e: Entry): Aantalvak {
  const amount = e.amount > 0 ? e.amount : 1;

  if ((e.components?.length ?? 0) > 0) {
    return {
      soort: "porties", waarde: amount, stap: 0.5,
      label: "Aantal porties", eenheid: "portie",
    };
  }

  const stuk = naamUitStukEenheid(e.unit);
  if (stuk) {
    return { soort: "stuks", waarde: amount, stap: 1, label: "Aantal", eenheid: stuk };
  }

  if (TELEENHEDEN.test(e.unit.trim())) {
    return {
      soort: "stuks", waarde: amount, stap: 1, label: "Aantal",
      eenheid: e.unit.trim().toLowerCase().replace(/s$/, ""),
    };
  }

  // Grammen en milliliters: het aantal is een vermenigvuldiging van wat er
  // staat. "2" betekent hier twee keer 55 gram, niet twee gram.
  return {
    soort: "keer", waarde: 1, stap: 1, label: "Aantal keer",
    eenheid: `${nl(e.amount)} ${e.unit}`.trim(),
  };
}

/**
 * Met hoeveel de regel mee moet schalen als er `nieuw` in het veld staat.
 *
 * Bij grammen is het veld zelf al de factor; bij stuks en porties is het de
 * verhouding met wat er stond.
 */
export function factorVoor(vak: Aantalvak, nieuw: number): number {
  if (!Number.isFinite(nieuw) || nieuw <= 0) return 1;
  if (vak.soort === "keer") return nieuw;
  return vak.waarde > 0 ? nieuw / vak.waarde : 1;
}

/**
 * De regel zoals hij er na het schalen uitziet, klaar om als PATCH te sturen.
 *
 * De punten zitten er niet bij: die worden op de server opnieuw uitgerekend,
 * zodat er ook hier maar één formule in de app staat. Onderdelen gaan wel mee
 * en geschaald, want bij een samengestelde regel is de puntensom de som van de
 * onderdelen.
 */
export function schaalEntry(e: Entry, factor: number): Record<string, unknown> {
  const f = Number.isFinite(factor) && factor > 0 ? factor : 1;
  const amount = rond(e.amount * f);

  return {
    id: e.id,
    name: e.name,
    ...(e.brand ? { brand: e.brand } : {}),
    meal: e.meal,
    source: e.source,
    amount,
    unit: meervoud(e.unit, amount),
    grams: rond(e.grams * f),
    nutrients: schaalNutrients(e.nutrients, f),
    ...(e.components && e.components.length > 0
      ? { components: schaalComponenten(e.components, f) }
      : {}),
    ...(e.note ? { note: e.note } : {}),
    ...(e.ref ? { ref: e.ref } : {}),
  };
}

export function schaalNutrients(n: Nutrients, factor: number): Nutrients {
  return {
    ...n,
    kcal: n.kcal * factor,
    protein_g: n.protein_g * factor,
    fat_g: n.fat_g * factor,
    satfat_g: n.satfat_g * factor,
    carbs_g: n.carbs_g * factor,
    sugar_g: n.sugar_g * factor,
    fiber_g: n.fiber_g * factor,
    ...(n.added_sugar_g != null ? { added_sugar_g: n.added_sugar_g * factor } : {}),
  };
}

/** "1 portie" en "2 porties" — alleen bij deze ene eenheid, die vaak voorkomt. */
function meervoud(eenheid: string, aantal: number): string {
  const e = eenheid.trim();
  if (!/^porties?$/i.test(e)) return eenheid;
  return aantal === 1 ? "portie" : "porties";
}

/** Twee decimalen; anders levert een derde portie een sliert cijfers op. */
function rond(n: number): number {
  return Math.round(n * 100) / 100;
}
