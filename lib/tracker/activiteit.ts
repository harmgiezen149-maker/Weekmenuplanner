import type { Activity } from "./types";
import { COEF } from "./points.ts";

// ---------------------------------------------------------------------------
// Bewegingspunten.
//
// Verbrandingsschattingen zijn structureel te optimistisch. Twee dempers:
//
//   1. De rustverbranding gaat eraf. Je verbrandt tijdens dat uur wandelen ook
//      de calorieen die je op de bank zou hebben verbruikt; alleen het verschil
//      is extra.
//   2. Er zit een plafond op zes punten per dag. Zonder plafond eet je het
//      tekort weg met een schatting die je niet kunt controleren.
// ---------------------------------------------------------------------------

/** Plafond op het aantal bewegingspunten dat op één dag meetelt. */
export const MAX_BEWEGINGSPUNTEN_PER_DAG = 6;

export interface ActiviteitSoort {
  id: string;
  naam: string;
  /** Metabolic equivalent: hoeveel maal de rustverbranding. */
  met: number;
}

export const ACTIVITEITEN: ActiviteitSoort[] = [
  { id: "wandelen", naam: "Wandelen", met: 3.5 },
  { id: "wandelen-stevig", naam: "Stevig wandelen", met: 5.0 },
  { id: "fietsen-rustig", naam: "Fietsen, rustig", met: 6.0 },
  { id: "fietsen-stevig", naam: "Fietsen, stevig", met: 8.0 },
  { id: "hardlopen", naam: "Hardlopen", met: 9.5 },
  { id: "krachttraining", naam: "Krachttraining", met: 5.0 },
  { id: "tuinieren", naam: "Tuinieren", met: 4.0 },
  { id: "zwemmen", naam: "Zwemmen", met: 7.0 },
];

export function vindActiviteit(id: string): ActiviteitSoort | undefined {
  return ACTIVITEITEN.find((a) => a.id === id);
}

export interface Verbranding {
  /** Totale verbranding tijdens de activiteit. */
  bruttoKcal: number;
  /** Wat je in diezelfde tijd sowieso zou hebben verbrand. */
  rustKcal: number;
  /** Het verschil: dit is wat de activiteit oplevert. */
  nettoKcal: number;
}

/**
 * Verbranding voor een activiteit.
 *
 * `bmr` is het basaal metabolisme per dag; daar wordt het uurdeel van
 * afgetrokken. Zonder die aftrek zou stilzitten ook punten opleveren.
 */
export function berekenVerbranding(
  met: number, gewichtKg: number, minuten: number, bmr: number
): Verbranding {
  const uren = Math.max(0, minuten) / 60;
  const bruttoKcal = met * gewichtKg * uren;
  const rustKcal = (bmr / 24) * uren;
  return {
    bruttoKcal,
    rustKcal,
    nettoKcal: Math.max(0, bruttoKcal - rustKcal),
  };
}

/** Punten voor één activiteit, ongeplafonneerd. */
export function activiteitPunten(
  met: number, gewichtKg: number, minuten: number, bmr: number, scale = 1
): number {
  const { nettoKcal } = berekenVerbranding(met, gewichtKg, minuten, bmr);
  return Math.max(0, Math.round(COEF.kcal * nettoKcal * scale));
}

/**
 * Bewegingspunten van een dag, met het plafond erop.
 *
 * De losse activiteiten houden hun eigen punten; alleen het totaal dat meetelt
 * voor je budget wordt afgetopt. Zo blijft zichtbaar wat je gedaan hebt.
 */
export function dagBewegingspunten(activiteiten: Activity[]): {
  ruw: number;
  meetellend: number;
  afgetopt: boolean;
} {
  const ruw = activiteiten.reduce((s, a) => s + (Number(a.points) || 0), 0);
  const meetellend = Math.min(ruw, MAX_BEWEGINGSPUNTEN_PER_DAG);
  return { ruw, meetellend, afgetopt: ruw > MAX_BEWEGINGSPUNTEN_PER_DAG };
}
