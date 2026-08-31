import { test } from "node:test";
import assert from "node:assert/strict";
import { aantalvak, factorVoor, schaalEntry } from "./regel.ts";
import type { Entry, MaaltijdComponent, Nutrients } from "./types.ts";

const WAARDEN: Nutrients = {
  kcal: 79, protein_g: 7, fat_g: 5.5, satfat_g: 1.6,
  carbs_g: 0.4, sugar_g: 0.2, fiber_g: 0, category: "default",
};

function regel(over: Partial<Entry> = {}): Entry {
  return {
    id: "e1", ts: 1, meal: "lunch", source: "search", name: "Ei",
    amount: 55, unit: "g", grams: 55, nutrients: WAARDEN, points_raw: 2.4,
    ...over,
  };
}

function onderdeel(naam: string, grams: number): MaaltijdComponent {
  return {
    id: naam, name: naam, amount: grams, unit: "g", grams,
    nutrients: { ...WAARDEN, kcal: 100 }, points_raw: 3,
  };
}

test("bij grammen telt het aantal hoe vaak de hoeveelheid meetelt", () => {
  const vak = aantalvak(regel());
  assert.equal(vak.soort, "keer");
  assert.equal(vak.waarde, 1);
  assert.equal(vak.eenheid, "55 g");
  // Twee eieren: twee keer de gelogde 55 gram.
  assert.equal(factorVoor(vak, 2), 2);

  const nieuw = schaalEntry(regel(), 2);
  assert.equal(nieuw.amount, 110);
  assert.equal(nieuw.grams, 110);
  assert.equal((nieuw.nutrients as Nutrients).kcal, 158);
  assert.equal(nieuw.unit, "g");
});

test("bij stuks staat het aantal al in de regel", () => {
  const e = regel({ name: "Volkorenbrood", amount: 3, unit: "× snee", grams: 105 });
  const vak = aantalvak(e);
  assert.equal(vak.soort, "stuks");
  assert.equal(vak.waarde, 3);
  assert.equal(vak.eenheid, "snee");

  // Van drie naar vier sneetjes is niet vier keer zoveel.
  const f = factorVoor(vak, 4);
  const nieuw = schaalEntry(e, f);
  assert.equal(nieuw.amount, 4);
  assert.equal(nieuw.grams, 140);
});

test("een samengestelde regel schaalt met zijn onderdelen mee", () => {
  const e = regel({
    name: "Standaard ontbijt", amount: 1, unit: "portie", grams: 300,
    source: "meal", components: [onderdeel("havermout", 60), onderdeel("melk", 240)],
  });
  const vak = aantalvak(e);
  assert.equal(vak.soort, "porties");
  assert.equal(vak.stap, 0.5);

  const nieuw = schaalEntry(e, factorVoor(vak, 2));
  assert.equal(nieuw.amount, 2);
  assert.equal(nieuw.unit, "porties");
  const c = nieuw.components as MaaltijdComponent[];
  assert.equal(c[0].grams, 120);
  assert.equal(c[1].grams, 480);
});

test("een halve portie terug naar een hele", () => {
  const e = regel({
    name: "Tonijnschotel", amount: 0.5, unit: "porties", grams: 200,
    source: "recipe", components: [onderdeel("tonijn", 100)],
  });
  const nieuw = schaalEntry(e, factorVoor(aantalvak(e), 1));
  assert.equal(nieuw.amount, 1);
  assert.equal(nieuw.unit, "portie");
  assert.equal(nieuw.grams, 400);
});

test("een onzinnig aantal verandert niets", () => {
  const vak = aantalvak(regel());
  assert.equal(factorVoor(vak, 0), 1);
  assert.equal(factorVoor(vak, -3), 1);
  assert.equal(factorVoor(vak, NaN), 1);
  assert.equal(schaalEntry(regel(), 0).grams, 55);
});

test("de punten gaan niet mee: die rekent de server opnieuw uit", () => {
  const nieuw = schaalEntry(regel(), 2);
  assert.equal("points_raw" in nieuw, false);
  assert.equal(nieuw.id, "e1");
  assert.equal(nieuw.meal, "lunch");
});
