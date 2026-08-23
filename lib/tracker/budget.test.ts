import { test } from "node:test";
import assert from "node:assert/strict";
import {
  leeftijd, bmr, tdee, doelAfnamePerWeek, berekenBudget, dagbudgetPunten,
  eiwitDoelGram, budgetVerouderd, MAX_AFNAME_FRACTIE, MAX_AFNAME_KG,
} from "./budget.ts";
import type { Profile } from "./types.ts";

type BudgetInvoer = Pick<Profile,
  "sex" | "birthdate" | "height_cm" | "activity_factor" |
  "current_weight_kg" | "goal_weight_kg" | "points_scale">;

const PEILDATUM = new Date("2026-08-23T12:00:00");

function profiel(p: Partial<BudgetInvoer> = {}): BudgetInvoer {
  return {
    sex: "man", birthdate: "1980-05-10", height_cm: 183,
    activity_factor: 1.375, current_weight_kg: 95, goal_weight_kg: 82,
    points_scale: 1.0, ...p,
  };
}

test("leeftijd telt een verjaardag pas mee als die geweest is", () => {
  assert.equal(leeftijd("1980-05-10", PEILDATUM), 46); // jarig geweest
  assert.equal(leeftijd("1980-12-01", PEILDATUM), 45); // nog niet jarig
  assert.equal(leeftijd("1980-08-23", PEILDATUM), 46); // vandaag jarig
  assert.equal(leeftijd("onzin", PEILDATUM), 0);
});

test("Mifflin-St Jeor rekent per geslacht anders", () => {
  // man: 10*95 + 6.25*183 - 5*46 + 5 = 950 + 1143.75 - 230 + 5
  assert.equal(bmr("man", 95, 183, 46), 1868.75);
  // vrouw: dezelfde basis, maar -161 in plaats van +5
  assert.equal(bmr("vrouw", 95, 183, 46), 1868.75 - 166);
});

test("onderhoud is het basaal metabolisme maal de activiteitsfactor", () => {
  assert.equal(tdee(1800, 1.55), 2790);
});

// -- grens 1: afvaltempo -----------------------------------------------------

test("de wekelijkse afname blijft altijd binnen een half procent lichaamsgewicht", () => {
  for (const kg of [50, 60, 75, 80, 95, 110, 140, 180, 220]) {
    const afname = doelAfnamePerWeek(kg);
    assert.ok(
      afname <= MAX_AFNAME_FRACTIE * kg + 1e-9,
      `${kg} kg: afname ${afname} overschrijdt 0,5%`
    );
    assert.ok(afname <= MAX_AFNAME_KG + 1e-9, `${kg} kg: afname ${afname} boven het plafond`);
  }
});

test("boven 150 kg kapt het absolute plafond het tempo af", () => {
  assert.equal(doelAfnamePerWeek(100), 0.5);
  assert.equal(doelAfnamePerWeek(150), 0.75);
  assert.equal(doelAfnamePerWeek(200), 0.75); // niet 1,0
});

test("het tempo schaalt mee omlaag naarmate het gewicht daalt", () => {
  const zwaar = berekenBudget(profiel({ current_weight_kg: 110 }), PEILDATUM);
  const lichter = berekenBudget(profiel({ current_weight_kg: 88 }), PEILDATUM);
  assert.ok(lichter.afnamePerWeekKg < zwaar.afnamePerWeekKg);
});

// -- grens 2: nooit onder het basaal metabolisme -----------------------------

test("het doel zakt nooit onder het basaal metabolisme", () => {
  // Zittend, klein en licht: het tekort zou het doel onder het BMR duwen.
  const r = berekenBudget(
    profiel({ sex: "vrouw", height_cm: 158, current_weight_kg: 58, goal_weight_kg: 45, activity_factor: 1.2 }),
    PEILDATUM
  );
  assert.ok(r.doelKcal >= r.bmr);
  assert.equal(r.doelKcal, r.bmr);
  assert.equal(r.begrensdDoorBmr, true);
});

test("ook bij een streefgewicht ver onder het huidige blijft het doel op of boven het BMR", () => {
  const varianten: BudgetInvoer[] = [
    profiel({ current_weight_kg: 60, goal_weight_kg: 40, activity_factor: 1.2 }),
    profiel({ sex: "vrouw", current_weight_kg: 52, goal_weight_kg: 35, height_cm: 150, activity_factor: 1.2 }),
    profiel({ current_weight_kg: 200, goal_weight_kg: 70, activity_factor: 1.2 }),
    profiel({ current_weight_kg: 95, goal_weight_kg: 1, activity_factor: 1.725 }),
  ];
  for (const v of varianten) {
    const r = berekenBudget(v, PEILDATUM);
    assert.ok(r.doelKcal >= r.bmr, `doel ${r.doelKcal} onder BMR ${r.bmr}`);
    assert.ok(r.dagbudgetPunten > 0);
  }
});

test("het streefgewicht zelf verandert het tempo niet, alleen of er nog een tekort is", () => {
  const ver = berekenBudget(profiel({ goal_weight_kg: 60 }), PEILDATUM);
  const dichtbij = berekenBudget(profiel({ goal_weight_kg: 94 }), PEILDATUM);
  assert.equal(ver.afnamePerWeekKg, dichtbij.afnamePerWeekKg);
});

test("op of onder het streefgewicht valt het tekort weg", () => {
  const r = berekenBudget(profiel({ current_weight_kg: 82, goal_weight_kg: 82 }), PEILDATUM);
  assert.equal(r.opOnderhoud, true);
  assert.equal(r.afnamePerWeekKg, 0);
  assert.equal(r.doelKcal, r.tdee);
});

// -- van kcal naar punten ----------------------------------------------------

test("een dag van ongeveer 1800 kcal landt rond de 40 punten", () => {
  assert.equal(dagbudgetPunten(1800, 1.0), 43);
  assert.equal(dagbudgetPunten(1800, 0.75), 32);
});

test("het volledige budget van een realistisch profiel is bruikbaar", () => {
  const r = berekenBudget(profiel(), PEILDATUM);
  // 95 kg, 183 cm, 46 jaar, licht actief -> BMR 1868,75, onderhoud 2569,5
  assert.equal(r.bmr, 1868.75);
  assert.ok(Math.abs(r.tdee - 2569.53) < 0.05);
  assert.ok(Math.abs(r.afnamePerWeekKg - 0.475) < 1e-9); // 0,5% van 95
  assert.ok(Math.abs(r.tekortPerDagKcal - 522.5) < 0.01);
  assert.ok(Math.abs(r.doelKcal - 2047.03) < 0.05);
  assert.equal(r.dagbudgetPunten, 49);
  assert.equal(r.begrensdDoorBmr, false);
});

// -- overige -----------------------------------------------------------------

test("eiwitdoel volgt het streefgewicht", () => {
  assert.equal(eiwitDoelGram(82), 131);
  assert.equal(eiwitDoelGram(70, 1.2), 84);
});

test("het budget veroudert pas bij meer dan een kilo verschil", () => {
  assert.equal(budgetVerouderd({ current_weight_kg: 95, budget_basis_weight_kg: 95 }), false);
  assert.equal(budgetVerouderd({ current_weight_kg: 94.2, budget_basis_weight_kg: 95 }), false);
  assert.equal(budgetVerouderd({ current_weight_kg: 93.5, budget_basis_weight_kg: 95 }), true);
  assert.equal(budgetVerouderd({ current_weight_kg: 96.5, budget_basis_weight_kg: 95 }), true);
});
