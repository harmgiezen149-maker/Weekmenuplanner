import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dagIndex, weekStart, weekDatums, vatWeekSamen, dagenTeGaan, moetWegen,
} from "./week.ts";
import type { Day, Entry, Nutrients } from "./types.ts";

const ZONDAG = 6; // onze telling: 0 = maandag
const MAANDAG = 0;

// 2026-08-23 is een zondag.
test("dagIndex telt maandag als nul en zondag als zes", () => {
  assert.equal(dagIndex("2026-08-23"), 6); // zondag
  assert.equal(dagIndex("2026-08-24"), 0); // maandag
  assert.equal(dagIndex("2026-08-28"), 4); // vrijdag
});

test("de week begint op de weegdag", () => {
  // Weegdag zondag: 23 augustus is zelf een zondag en dus de start.
  assert.equal(weekStart("2026-08-23", ZONDAG), "2026-08-23");
  assert.equal(weekStart("2026-08-26", ZONDAG), "2026-08-23");
  assert.equal(weekStart("2026-08-29", ZONDAG), "2026-08-23");
  // De dag erna begint een nieuwe week.
  assert.equal(weekStart("2026-08-30", ZONDAG), "2026-08-30");
});

test("een andere weegdag verschuift de hele week mee", () => {
  assert.equal(weekStart("2026-08-26", MAANDAG), "2026-08-24");
  assert.equal(weekStart("2026-08-23", MAANDAG), "2026-08-17"); // zondag hoort nog bij de vorige
  assert.equal(weekStart("2026-08-26", 2), "2026-08-26"); // 26 augustus is zelf de woensdag
});

test("een week telt zeven opeenvolgende dagen", () => {
  const d = weekDatums("2026-08-26", ZONDAG);
  assert.equal(d.length, 7);
  assert.equal(d[0], "2026-08-23");
  assert.equal(d[6], "2026-08-29");
  assert.deepEqual(d, [...d].sort());
});

test("de week loopt door over een maandgrens heen", () => {
  const d = weekDatums("2026-09-01", ZONDAG);
  assert.equal(d[0], "2026-08-30");
  assert.equal(d[6], "2026-09-05");
});

test("dagenTeGaan telt de huidige dag mee", () => {
  assert.equal(dagenTeGaan("2026-08-23", ZONDAG), 7); // weegdag zelf
  assert.equal(dagenTeGaan("2026-08-24", ZONDAG), 6);
  assert.equal(dagenTeGaan("2026-08-29", ZONDAG), 1); // laatste dag
});

test("wegen hoeft alleen op de weegdag, en maar een keer", () => {
  assert.equal(moetWegen("2026-08-23", ZONDAG, null), true);
  assert.equal(moetWegen("2026-08-23", ZONDAG, "2026-08-16"), true);
  assert.equal(moetWegen("2026-08-23", ZONDAG, "2026-08-23"), false); // al gewogen
  assert.equal(moetWegen("2026-08-24", ZONDAG, null), false); // geen weegdag
});

// -- weeksamenvatting --------------------------------------------------------

const PROFIEL = { daily_budget: 40, points_scale: 1, weekly_buffer: 28, weigh_day: ZONDAG };

function nut(kcal: number): Nutrients {
  return { kcal, protein_g: 0, fat_g: 0, satfat_g: 0, carbs_g: 0, sugar_g: 0, fiber_g: 0 };
}

/** Een dag met precies dit aantal punten (0,024 punt per kcal). */
function dag(datum: string, punten: number): Day {
  const kcal = punten / 0.024;
  const e: Entry = {
    id: "x", ts: 0, meal: "diner", source: "manual", name: "test",
    amount: 100, unit: "g", grams: 100, nutrients: nut(kcal), points_raw: punten,
  };
  return {
    date: datum, entries: [e], activity: [],
    totals: { points_raw: punten, kcal, protein_g: 0, fat_g: 0, satfat_g: 0, carbs_g: 0, sugar_g: 0, fiber_g: 0 },
    buffer_used: 0,
  };
}

test("een lege week levert nulls en geen gemiddelde op", () => {
  const s = vatWeekSamen([], PROFIEL, "2026-08-26");
  assert.equal(s.start, "2026-08-23");
  assert.equal(s.eind, "2026-08-29");
  assert.equal(s.dagen.length, 7);
  assert.equal(s.gelogdeDagen, 0);
  assert.equal(s.gemiddeldePunten, null);
  assert.equal(s.bufferGebruikt, 0);
  assert.equal(s.bufferRest, 28);
});

test("dagen zonder logging blijven buiten het gemiddelde", () => {
  // Drie dagen gelogd, vier niet. Het gemiddelde deelt door drie, niet door zeven.
  const s = vatWeekSamen(
    [dag("2026-08-23", 30), dag("2026-08-24", 40), dag("2026-08-25", 50)],
    PROFIEL, "2026-08-26"
  );
  assert.equal(s.gelogdeDagen, 3);
  assert.equal(s.totaalPunten, 120);
  assert.equal(s.gemiddeldePunten, 40);
  // Zou een lege dag als nul tellen, dan was het gemiddelde ruim 17 geweest.
  assert.notEqual(s.gemiddeldePunten, 120 / 7);
});

test("de weekbuffer wordt alleen aangesproken boven het dagbudget", () => {
  const s = vatWeekSamen(
    [dag("2026-08-23", 45), dag("2026-08-24", 30), dag("2026-08-25", 48)],
    PROFIEL, "2026-08-26"
  );
  // 5 boven budget op dag 1, 8 op dag 3. De zuinige dag levert niets terug.
  assert.equal(s.bufferGebruikt, 13);
  assert.equal(s.bufferRest, 15);
  assert.equal(s.dagen[1].overBudget, 0, "onder budget blijven telt niet negatief mee");
});

test("een dag onder budget compenseert een dag erboven niet", () => {
  const zuinig = vatWeekSamen([dag("2026-08-23", 10), dag("2026-08-24", 50)], PROFIEL, "2026-08-26");
  assert.equal(zuinig.bufferGebruikt, 10); // alleen de overschrijding van dag 2
});

test("de buffer kan opraken en dan negatief resteren", () => {
  const s = vatWeekSamen(
    [dag("2026-08-23", 60), dag("2026-08-24", 60), dag("2026-08-25", 60)],
    PROFIEL, "2026-08-26"
  );
  assert.equal(s.bufferGebruikt, 60); // 3 x 20 boven budget
  assert.equal(s.bufferRest, -32);
});

test("dagen buiten de week tellen niet mee", () => {
  const s = vatWeekSamen(
    [dag("2026-08-22", 40), dag("2026-08-23", 30), dag("2026-08-30", 40)],
    PROFIEL, "2026-08-26"
  );
  assert.equal(s.gelogdeDagen, 1);
  assert.equal(s.totaalPunten, 30);
});

test("de puntenschaal werkt door in de weeksamenvatting", () => {
  const halveSchaal = { ...PROFIEL, points_scale: 0.5, daily_budget: 20 };
  const s = vatWeekSamen([dag("2026-08-23", 40)], halveSchaal, "2026-08-26");
  assert.equal(s.dagen[0].punten, 20);
  assert.equal(s.bufferGebruikt, 0);
});

test("de macro's worden over de hele week opgeteld", () => {
  const s = vatWeekSamen(
    [dag("2026-08-23", 24), dag("2026-08-24", 24)], PROFIEL, "2026-08-26"
  );
  // 24 punten is 1000 kcal, twee dagen dus 2000.
  assert.ok(Math.abs(s.macros.kcal - 2000) < 0.5);
});

// -- bewegingspunten ---------------------------------------------------------

/** Een dag met punten en een activiteit erbij. */
function dagMetBeweging(datum: string, punten: number, bewegingspunten: number): Day {
  const d = dag(datum, punten);
  return {
    ...d,
    activity: [{ id: "a", ts: 0, name: "Wandelen", met: 3.5, minutes: 60, points: bewegingspunten }],
  };
}

test("bewegingspunten verruimen het dagbudget", () => {
  // 52 punten bij een budget van 40 is 12 over; met 5 bewegingspunten nog 7.
  const zonder = vatWeekSamen([dag("2026-08-23", 52)], PROFIEL, "2026-08-26");
  const met = vatWeekSamen([dagMetBeweging("2026-08-23", 52, 5)], PROFIEL, "2026-08-26");
  assert.equal(zonder.dagen[0].overBudget, 12);
  assert.equal(met.dagen[0].overBudget, 7);
  assert.equal(met.dagen[0].bewegingspunten, 5);
});

test("bewegingspunten kunnen een dag helemaal binnen budget trekken", () => {
  const s = vatWeekSamen([dagMetBeweging("2026-08-23", 44, 6)], PROFIEL, "2026-08-26");
  assert.equal(s.dagen[0].overBudget, 0);
  assert.equal(s.bufferGebruikt, 0);
});

test("het dagplafond van zes geldt ook in de weeksamenvatting", () => {
  const s = vatWeekSamen([dagMetBeweging("2026-08-23", 60, 20)], PROFIEL, "2026-08-26");
  assert.equal(s.dagen[0].bewegingspunten, 6, "twintig punten sport telt als zes");
  assert.equal(s.dagen[0].overBudget, 14); // 60 - 40 - 6
});

test("bewegingspunten worden over de week opgeteld", () => {
  const s = vatWeekSamen([
    dagMetBeweging("2026-08-23", 30, 4),
    dagMetBeweging("2026-08-24", 30, 3),
  ], PROFIEL, "2026-08-26");
  assert.equal(s.bewegingspuntenTotaal, 7);
});

test("bewegen zonder te eten levert geen negatieve overschrijding op", () => {
  const s = vatWeekSamen([dagMetBeweging("2026-08-23", 10, 6)], PROFIEL, "2026-08-26");
  assert.equal(s.dagen[0].overBudget, 0);
  assert.equal(s.bufferRest, 28);
});
