import { test } from "node:test";
import assert from "node:assert/strict";
import { rawPoints, toonPunten, calcPoints, effectiveSugar, berekenTotalen, naarGram } from "./points.ts";
import type { Nutrients, Entry, Category } from "./types.ts";

function n(p: Partial<Nutrients>): Nutrients {
  return {
    kcal: 0, protein_g: 0, fat_g: 0, satfat_g: 0,
    carbs_g: 0, sugar_g: 0, fiber_g: 0, category: "default", ...p,
  };
}

// De testset uit het overdrachtsdocument, sectie 4.4. Deze zeven gevallen
// leggen het puntenniveau vast: wijzigt een coëfficiënt, dan valt dat hier om.
const TESTSET: { naam: string; nutrients: Nutrients; grams: number; verwacht: number }[] = [
  {
    naam: "Kipfilet 100 g",
    nutrients: n({ kcal: 110, satfat_g: 0.5, sugar_g: 0, protein_g: 23, fiber_g: 0 }),
    grams: 100, verwacht: 1,
  },
  {
    naam: "Broccoli 100 g",
    nutrients: n({ kcal: 34, satfat_g: 0, sugar_g: 1.7, protein_g: 2.8, fiber_g: 2.6, category: "vegetable" }),
    grams: 100, verwacht: 0,
  },
  {
    naam: "Griekse yoghurt 0% 150 g",
    nutrients: n({ kcal: 90, satfat_g: 0, sugar_g: 6, protein_g: 15, fiber_g: 0, category: "dairy_plain" }),
    grams: 150, verwacht: 1,
  },
  {
    naam: "Avocado 100 g",
    nutrients: n({ kcal: 160, satfat_g: 2, sugar_g: 0.7, protein_g: 2, fiber_g: 7, category: "fruit_whole" }),
    grams: 100, verwacht: 4,
  },
  {
    naam: "Koekje 150 kcal",
    nutrients: n({ kcal: 150, satfat_g: 5, sugar_g: 12, protein_g: 2, fiber_g: 0.5 }),
    grams: 30, verwacht: 6,
  },
  {
    naam: "Volkorenbrood 1 snee",
    nutrients: n({ kcal: 90, satfat_g: 0.2, sugar_g: 1, protein_g: 4, fiber_g: 2.5 }),
    grams: 35, verwacht: 2,
  },
  {
    naam: "Pils 250 ml",
    nutrients: n({ kcal: 105, satfat_g: 0, sugar_g: 0, protein_g: 1, fiber_g: 0 }),
    grams: 250, verwacht: 2,
  },
];

test("testset 4.4: alle zeven gevallen geven de verwachte punten", async (t) => {
  for (const g of TESTSET) {
    await t.test(g.naam, () => {
      assert.equal(calcPoints(g.nutrients, g.grams, 1), g.verwacht);
    });
  }
});

test("groente en magere eiwitbronnen komen vanzelf op nul uit", () => {
  const groentes: Nutrients[] = [
    n({ kcal: 18, sugar_g: 2.6, protein_g: 0.9, fiber_g: 1.2, category: "vegetable" }), // tomaat
    n({ kcal: 16, sugar_g: 1.7, protein_g: 0.7, fiber_g: 0.5, category: "vegetable" }), // courgette
    n({ kcal: 23, sugar_g: 0.4, protein_g: 2.9, fiber_g: 2.2, category: "vegetable" }), // spinazie
  ];
  for (const g of groentes) assert.equal(calcPoints(g, 100, 1), 0);
});

test("punten worden nooit negatief", () => {
  const eiwitbom = n({ kcal: 100, protein_g: 40, fiber_g: 20 });
  assert.ok(rawPoints(eiwitbom, 100) < 0, "raw mag wel negatief zijn");
  assert.equal(calcPoints(eiwitbom, 100, 1), 0);
});

test("points_scale verschuift het niveau zonder de opgeslagen waarde te raken", () => {
  const koekje = TESTSET[4];
  const raw = rawPoints(koekje.nutrients, koekje.grams);
  assert.equal(toonPunten(raw, 1.0), 6);
  assert.equal(toonPunten(raw, 0.75), 4);
  // raw zelf is schaalvrij: dezelfde opgeslagen waarde voedt beide weergaven.
  assert.equal(raw, rawPoints(koekje.nutrients, koekje.grams));
});

// -- effectieve suiker -------------------------------------------------------

test("categorie-aftrek schaalt mee met de portiegrootte", () => {
  const yoghurt = n({ sugar_g: 6, category: "dairy_plain" });
  // 100 g: 5 g aftrek -> 1 g effectief. 150 g bevat 6 g suiker bij 7,5 g aftrek -> 0.
  assert.equal(effectiveSugar(n({ sugar_g: 5, category: "dairy_plain" }), 100), 0);
  assert.equal(effectiveSugar(yoghurt, 150), 0);
  // Een dubbele portie mag per gram niet duurder worden dan een enkele.
  const enkel = rawPoints(n({ kcal: 60, sugar_g: 4, protein_g: 10, category: "dairy_plain" }), 100);
  const dubbel = rawPoints(n({ kcal: 120, sugar_g: 8, protein_g: 20, category: "dairy_plain" }), 200);
  assert.ok(Math.abs(dubbel - 2 * enkel) < 1e-9);
});

test("toegevoegde suiker wint van de categorie-aftrek", () => {
  const gezoeteYoghurt = n({ sugar_g: 14, added_sugar_g: 9, category: "dairy_plain" });
  assert.equal(effectiveSugar(gezoeteYoghurt, 150), 9);
});

test("fruit, peulvruchten en noten tellen hun eigen suiker niet mee", () => {
  const cats: Category[] = ["fruit_whole", "legume", "nuts_seeds", "vegetable"];
  for (const c of cats) assert.equal(effectiveSugar(n({ sugar_g: 15, category: c }), 100), 0);
  // Zonder categorie telt suiker gewoon mee.
  assert.equal(effectiveSugar(n({ sugar_g: 15 }), 100), 15);
});

// -- eenheden ----------------------------------------------------------------

test("naarGram rekent de gangbare eenheden om", () => {
  assert.equal(naarGram(150, "g"), 150);
  assert.equal(naarGram(250, "ml"), 250);
  assert.equal(naarGram(1.5, "kg"), 1500);
  assert.equal(naarGram(2, "stuk"), 200); // onbekend: 100 g per eenheid
});

// -- dagtotalen --------------------------------------------------------------

function entry(nut: Nutrients, grams: number): Entry {
  return {
    id: Math.random().toString(36).slice(2), ts: 0, meal: "diner", source: "manual",
    name: "test", amount: grams, unit: "g", grams, nutrients: nut,
    points_raw: rawPoints(nut, grams),
  };
}

test("dagtotaal wordt op points_raw gerekend, niet op afgeronde regels", () => {
  // Tien regels van elk 0,4 punt: afgerond is elke regel 0, samen zijn ze 4.
  const klein = n({ kcal: 20 }); // raw = 0,48
  const entries = Array.from({ length: 10 }, () => entry(klein, 100));
  const totalen = berekenTotalen(entries);

  const somVanAfgerond = entries.reduce((s, e) => s + toonPunten(e.points_raw, 1), 0);
  assert.equal(somVanAfgerond, 0, "elke losse regel rondt naar nul af");
  assert.equal(toonPunten(totalen.points_raw, 1), 5, "het dagtotaal telt ze wel");
});

test("bij een realistische dag wijkt het totaal hooguit 1 punt af van de som van de regels", () => {
  const entries = TESTSET.map((g) => entry(g.nutrients, g.grams));
  const totalen = berekenTotalen(entries);
  const totaal = toonPunten(totalen.points_raw, 1);
  const somVanAfgerond = entries.reduce((s, e) => s + toonPunten(e.points_raw, 1), 0);
  assert.ok(
    Math.abs(totaal - somVanAfgerond) <= 1,
    `totaal ${totaal} versus som van regels ${somVanAfgerond}`
  );
});

test("dagtotalen tellen ook de macro's op", () => {
  const totalen = berekenTotalen([
    entry(n({ kcal: 100, protein_g: 10, fat_g: 5, satfat_g: 2, carbs_g: 3, sugar_g: 1, fiber_g: 4 }), 100),
    entry(n({ kcal: 250, protein_g: 20, fat_g: 8, satfat_g: 3, carbs_g: 7, sugar_g: 2, fiber_g: 1 }), 100),
  ]);
  assert.equal(totalen.kcal, 350);
  assert.equal(totalen.protein_g, 30);
  assert.equal(totalen.satfat_g, 5);
  assert.equal(totalen.fiber_g, 5);
});

test("een lege dag geeft nul op alle velden", () => {
  const t = berekenTotalen([]);
  assert.equal(t.points_raw, 0);
  assert.equal(t.kcal, 0);
  assert.equal(toonPunten(t.points_raw, 1), 0);
});
