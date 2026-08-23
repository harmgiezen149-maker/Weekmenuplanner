import { test } from "node:test";
import assert from "node:assert/strict";
import { componentPunten, telComponentenOp, schaalComponenten } from "./maaltijd.ts";
import { rawPoints, toonPunten } from "./points.ts";
import type { Category, MaaltijdComponent, Nutrients } from "./types.ts";

function comp(
  naam: string, grams: number, categorie: Category, n: Partial<Nutrients>
): MaaltijdComponent {
  const nutrients: Nutrients = {
    kcal: 0, protein_g: 0, fat_g: 0, satfat_g: 0,
    carbs_g: 0, sugar_g: 0, fiber_g: 0, category: categorie, ...n,
  };
  return {
    id: naam, name: naam, amount: grams, unit: "g", grams, nutrients,
    points_raw: rawPoints(nutrients, grams),
  };
}

// Een standaardontbijt: havermout, halfvolle melk en een banaan. Drie
// onderdelen met drie verschillende suikerregels.
const ONTBIJT: MaaltijdComponent[] = [
  comp("Havermout 60 g", 60, "default",
    { kcal: 227.4, protein_g: 7.8, fat_g: 3.9, satfat_g: 0.66, carbs_g: 40.2, sugar_g: 0.6, fiber_g: 6 }),
  comp("Halfvolle melk 200 ml", 200, "dairy_plain",
    { kcal: 94, protein_g: 7, fat_g: 3, satfat_g: 2, carbs_g: 9.4, sugar_g: 9.4, fiber_g: 0 }),
  comp("Banaan 120 g", 120, "fruit_whole",
    { kcal: 106.8, protein_g: 1.32, fat_g: 0.36, satfat_g: 0.12, carbs_g: 27.6, sugar_g: 14.4, fiber_g: 3.12 }),
];

test("de punten van een maaltijd zijn de som van de onderdelen", () => {
  const totaal = telComponentenOp(ONTBIJT);
  const losseSom = ONTBIJT.reduce((s, c) => s + c.points_raw, 0);
  assert.ok(Math.abs(totaal.points_raw - losseSom) < 1e-9);
  assert.equal(toonPunten(totaal.points_raw, 1), 9);
});

test("eerst optellen en dan pas rekenen geeft een ander, te hoog antwoord", () => {
  // Dit is precies de fout die de opzet moet voorkomen: tel je de
  // voedingswaarden op en pas je daarna een enkele categorie toe, dan tellen
  // de melksuiker en de fruitsuiker alsnog mee.
  const totaal = telComponentenOp(ONTBIJT);
  const naief = rawPoints({ ...totaal.nutrients, category: "default" }, totaal.grams);

  assert.equal(toonPunten(totaal.points_raw, 1), 9);
  assert.equal(toonPunten(naief, 1), 12);
  assert.ok(naief > totaal.points_raw, "de naieve berekening valt altijd hoger of gelijk uit");
});

test("voedingswaarden worden wel gewoon opgeteld", () => {
  const t = telComponentenOp(ONTBIJT);
  assert.ok(Math.abs(t.nutrients.kcal - 428.2) < 0.001);
  assert.ok(Math.abs(t.nutrients.protein_g - 16.12) < 0.001);
  assert.ok(Math.abs(t.nutrients.fiber_g - 9.12) < 0.001);
  assert.equal(t.grams, 380);
});

test("een lege maaltijd is nul", () => {
  const t = telComponentenOp([]);
  assert.equal(t.points_raw, 0);
  assert.equal(t.grams, 0);
  assert.equal(t.nutrients.kcal, 0);
});

test("componentPunten rekent met de eigen categorie van het onderdeel", () => {
  const melk = ONTBIJT[1];
  assert.ok(Math.abs(componentPunten(melk) - melk.points_raw) < 1e-9);
  // Zonder de zuivelcategorie zou dezelfde melk duurder zijn.
  const zonder = { ...melk, nutrients: { ...melk.nutrients, category: "default" as const } };
  assert.ok(componentPunten(zonder) > componentPunten(melk));
});

// -- schalen -----------------------------------------------------------------

test("een recept voor vier delen netjes door vier", () => {
  const perPortie = schaalComponenten(ONTBIJT, 0.25);
  const heel = telComponentenOp(ONTBIJT);
  const deel = telComponentenOp(perPortie);

  assert.ok(Math.abs(deel.points_raw - heel.points_raw / 4) < 1e-9);
  assert.ok(Math.abs(deel.nutrients.kcal - heel.nutrients.kcal / 4) < 1e-9);
  assert.ok(Math.abs(deel.grams - heel.grams / 4) < 1e-9);
});

test("schalen laat de suikercorrectie per onderdeel intact", () => {
  // Twee halve porties horen samen precies een hele portie te zijn. Zou de
  // aftrek niet meeschalen, dan klopte dat niet.
  const half = schaalComponenten(ONTBIJT, 0.5);
  const heel = telComponentenOp(ONTBIJT);
  const tweeHalve = telComponentenOp(half).points_raw * 2;
  assert.ok(Math.abs(tweeHalve - heel.points_raw) < 1e-9);
});

test("een onzinnige schaalfactor laat de maaltijd ongemoeid", () => {
  assert.deepEqual(schaalComponenten(ONTBIJT, 0), ONTBIJT);
  assert.deepEqual(schaalComponenten(ONTBIJT, -1), ONTBIJT);
  assert.deepEqual(schaalComponenten(ONTBIJT, NaN), ONTBIJT);
});

test("de categorie van een onderdeel blijft bij het schalen behouden", () => {
  const geschaald = schaalComponenten(ONTBIJT, 0.5);
  assert.equal(geschaald[1].nutrients.category, "dairy_plain");
  assert.equal(geschaald[2].nutrients.category, "fruit_whole");
});
