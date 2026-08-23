import type { Geslacht, Profile } from "./types";
import { COEF } from "./points.ts";

// ---------------------------------------------------------------------------
// Budgetberekening: van lichaamsgegevens naar een dagbudget in punten.
// ---------------------------------------------------------------------------

// Energie-inhoud van een kilo lichaamsvet, in kcal. Vuistregel.
const KCAL_PER_KG_VET = 7700;

// Harde grenzen aan het afvaltempo.
export const MAX_AFNAME_FRACTIE = 0.005; // per week, van het huidige gewicht
export const MAX_AFNAME_KG = 0.75; // per week, absoluut plafond

/** Leeftijd in hele jaren op de peildatum. */
export function leeftijd(birthdate: string, op: Date = new Date()): number {
  const g = new Date(birthdate + "T00:00:00");
  if (Number.isNaN(g.getTime())) return 0;
  let jaar = op.getFullYear() - g.getFullYear();
  const maandVerschil = op.getMonth() - g.getMonth();
  if (maandVerschil < 0 || (maandVerschil === 0 && op.getDate() < g.getDate())) jaar--;
  return Math.max(0, jaar);
}

/** Basaal metabolisme volgens Mifflin-St Jeor. */
export function bmr(sex: Geslacht, gewichtKg: number, lengteCm: number, jaren: number): number {
  const basis = 10 * gewichtKg + 6.25 * lengteCm - 5 * jaren;
  return sex === "man" ? basis + 5 : basis - 161;
}

/** Onderhoudsbehoefte: basaal metabolisme maal de activiteitsfactor. */
export function tdee(bmrKcal: number, activiteitsfactor: number): number {
  return bmrKcal * activiteitsfactor;
}

/**
 * Beoogde afname per week in kilo. Hangt aan het huidige gewicht, dus het
 * tempo schaalt vanzelf mee naar beneden — geen vast getal dat na tien kilo
 * te scherp wordt.
 */
export function doelAfnamePerWeek(huidigGewichtKg: number): number {
  return Math.min(MAX_AFNAME_FRACTIE * huidigGewichtKg, MAX_AFNAME_KG);
}

export interface BudgetResultaat {
  jaren: number;
  bmr: number;
  tdee: number;
  afnamePerWeekKg: number;
  tekortPerDagKcal: number;
  doelKcal: number;
  dagbudgetPunten: number;
  /** Waar het doel op het basaal metabolisme is afgekapt. */
  begrensdDoorBmr: boolean;
  /** Op streefgewicht of eronder: geen tekort meer, alleen onderhoud. */
  opOnderhoud: boolean;
}

/**
 * Berekent het dagbudget uit een profiel.
 *
 * Twee harde grenzen worden hier afgedwongen:
 *   1. het tekort is nooit groter dan een half procent lichaamsgewicht per week;
 *   2. het doel zakt nooit onder het basaal metabolisme.
 *
 * Is het streefgewicht bereikt, dan valt het tekort weg en wordt het budget
 * gelijk aan de onderhoudsbehoefte.
 */
export function berekenBudget(
  p: Pick<Profile,
    "sex" | "birthdate" | "height_cm" | "activity_factor" |
    "current_weight_kg" | "goal_weight_kg" | "points_scale">,
  op: Date = new Date()
): BudgetResultaat {
  const jaren = leeftijd(p.birthdate, op);
  const basaal = bmr(p.sex, p.current_weight_kg, p.height_cm, jaren);
  const onderhoud = tdee(basaal, p.activity_factor);

  const opOnderhoud = p.current_weight_kg <= p.goal_weight_kg;
  const afnamePerWeekKg = opOnderhoud ? 0 : doelAfnamePerWeek(p.current_weight_kg);
  const tekortPerDagKcal = (afnamePerWeekKg * KCAL_PER_KG_VET) / 7;

  const ongeremd = onderhoud - tekortPerDagKcal;
  const doelKcal = Math.max(ongeremd, basaal);

  return {
    jaren,
    bmr: basaal,
    tdee: onderhoud,
    afnamePerWeekKg,
    tekortPerDagKcal,
    doelKcal,
    dagbudgetPunten: dagbudgetPunten(doelKcal, p.points_scale),
    begrensdDoorBmr: ongeremd < basaal,
    opOnderhoud,
  };
}

/** Van kcal naar punten. Dezelfde caloriecoëfficiënt als de puntenformule. */
export function dagbudgetPunten(doelKcal: number, scale = 1): number {
  return Math.max(0, Math.round(COEF.kcal * doelKcal * scale));
}

/** Eiwitrichtlijn: gram per dag, afgeleid van het streefgewicht. */
export function eiwitDoelGram(streefgewichtKg: number, perKg = 1.6): number {
  return Math.round(streefgewichtKg * perKg);
}

/**
 * Of het budget herberekend moet worden. Pas vanaf 1 kg afwijking van het
 * gewicht waarop het huidige budget rust, zodat dagelijkse vochtschommelingen
 * het budget niet elke keer verzetten.
 */
export function budgetVerouderd(p: Pick<Profile, "current_weight_kg" | "budget_basis_weight_kg">): boolean {
  return Math.abs(p.current_weight_kg - p.budget_basis_weight_kg) > 1;
}
