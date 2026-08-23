import type { Day, Profile } from "./types";
import { toonPunten } from "./points.ts";
import { datumSleutel, verschuifDatum } from "./datum.ts";

// ---------------------------------------------------------------------------
// De trackerweek.
//
// De week loopt van weegdag tot weegdag, niet van maandag tot zondag: op de
// weegdag reset de weekbuffer, en dan hoort daar ook een nieuwe week te
// beginnen. Staat de weegdag op zondag, dan loopt de week zondag tot zaterdag.
//
// Het bufferverbruik wordt afgeleid uit de dagen zelf en nergens apart
// opgeslagen. Zo kan het niet uit de pas gaan lopen met het logboek.
// ---------------------------------------------------------------------------

/** Dagindex in onze telling: 0 = maandag ... 6 = zondag. */
export function dagIndex(datum: string): number {
  const d = new Date(datum + "T12:00:00");
  return (d.getDay() + 6) % 7; // JS telt zondag als 0
}

/** Eerste dag van de trackerweek waar deze datum in valt. */
export function weekStart(datum: string, weegdag: number): string {
  const terug = (dagIndex(datum) - weegdag + 7) % 7;
  return verschuifDatum(datum, -terug);
}

/** De zeven datums van de week waar deze datum in valt, oplopend. */
export function weekDatums(datum: string, weegdag: number): string[] {
  const start = weekStart(datum, weegdag);
  return Array.from({ length: 7 }, (_, i) => verschuifDatum(start, i));
}

export interface DagSamenvatting {
  datum: string;
  punten: number;
  /** Boven het dagbudget, en dus uit de weekbuffer betaald. */
  overBudget: number;
  gelogd: boolean;
}

export interface WeekSamenvatting {
  start: string;
  eind: string;
  dagen: DagSamenvatting[];
  dagbudget: number;
  /** Aantal dagen waarop iets gelogd is. */
  gelogdeDagen: number;
  /** Gemiddelde punten per gelogde dag. Null als er niets gelogd is. */
  gemiddeldePunten: number | null;
  totaalPunten: number;
  bufferTotaal: number;
  bufferGebruikt: number;
  bufferRest: number;
  macros: { kcal: number; protein_g: number; fat_g: number; carbs_g: number; fiber_g: number };
}

/**
 * Vat een week samen.
 *
 * Dagen zonder logging tellen niet mee in het gemiddelde — een dag die je
 * vergat te loggen was geen dag van nul punten. Het aantal gelogde dagen komt
 * er daarom bij te staan, zodat het gemiddelde te wegen is.
 *
 * De weekbuffer wordt aangesproken zodra een dag over het dagbudget gaat. Het
 * dagbudget zelf gaat niet negatief: elke dag begint weer op nul.
 */
export function vatWeekSamen(
  dagen: Day[],
  profiel: Pick<Profile, "daily_budget" | "points_scale" | "weekly_buffer" | "weigh_day">,
  peildatum: string = datumSleutel()
): WeekSamenvatting {
  const datums = weekDatums(peildatum, profiel.weigh_day);
  const perDatum = new Map(dagen.map((d) => [d.date, d]));

  const samenvatting: DagSamenvatting[] = datums.map((datum) => {
    const dag = perDatum.get(datum);
    const gelogd = dag != null && dag.entries.length > 0;
    const punten = dag ? toonPunten(dag.totals.points_raw, profiel.points_scale) : 0;
    return {
      datum,
      punten,
      overBudget: Math.max(0, punten - profiel.daily_budget),
      gelogd,
    };
  });

  const gelogde = samenvatting.filter((d) => d.gelogd);
  const totaalPunten = gelogde.reduce((s, d) => s + d.punten, 0);
  const bufferGebruikt = samenvatting.reduce((s, d) => s + d.overBudget, 0);

  const macros = { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0 };
  for (const datum of datums) {
    const dag = perDatum.get(datum);
    if (!dag) continue;
    macros.kcal += dag.totals.kcal;
    macros.protein_g += dag.totals.protein_g;
    macros.fat_g += dag.totals.fat_g;
    macros.carbs_g += dag.totals.carbs_g;
    macros.fiber_g += dag.totals.fiber_g;
  }

  return {
    start: datums[0],
    eind: datums[6],
    dagen: samenvatting,
    dagbudget: profiel.daily_budget,
    gelogdeDagen: gelogde.length,
    gemiddeldePunten: gelogde.length > 0 ? totaalPunten / gelogde.length : null,
    totaalPunten,
    bufferTotaal: profiel.weekly_buffer,
    bufferGebruikt,
    bufferRest: profiel.weekly_buffer - bufferGebruikt,
    macros,
  };
}

/** Hoeveel dagen van de week er nog te gaan zijn, deze dag meegerekend. */
export function dagenTeGaan(peildatum: string, weegdag: number): number {
  return 7 - ((dagIndex(peildatum) - weegdag + 7) % 7);
}

/** Of er vandaag gewogen hoort te worden en dat nog niet gebeurd is. */
export function moetWegen(
  peildatum: string,
  weegdag: number,
  laatsteWeging: string | null
): boolean {
  if (dagIndex(peildatum) !== weegdag) return false;
  return laatsteWeging !== peildatum;
}
