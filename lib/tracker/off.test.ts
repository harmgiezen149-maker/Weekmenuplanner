import { test } from "node:test";
import assert from "node:assert/strict";
import {
  offGetal, offKcal, offCategorie, bevatSuiker, offEenheid, offPortie, offNaarProduct,
} from "./off.ts";
import { rawPoints, toonPunten } from "./points.ts";
import type { Nutrients } from "./types.ts";

// Vormen zoals Open Food Facts ze levert. OFF is crowdsourced: velden
// ontbreken, staan als tekst in het JSON, en energie is er niet altijd in kcal.

test("getallen worden ook als tekst en met komma gelezen", () => {
  assert.equal(offGetal(12.5), 12.5);
  assert.equal(offGetal("12,5"), 12.5);
  assert.equal(offGetal(" 8 "), 8);
  assert.equal(offGetal(""), null);
  assert.equal(offGetal(undefined), null);
  assert.equal(offGetal("onzin"), null);
  assert.equal(offGetal(NaN), null);
});

test("energie valt terug op kilojoules als kcal ontbreekt", () => {
  assert.equal(offKcal({ "energy-kcal_100g": 250 }), 250);
  // 1046 kJ / 4,184 = 250 kcal
  assert.ok(Math.abs(offKcal({ "energy_100g": 1046 }) - 250) < 0.5);
  assert.equal(offKcal({}), 0);
  // kcal wint als beide er staan
  assert.equal(offKcal({ "energy-kcal_100g": 100, "energy_100g": 9999 }), 100);
});

// -- categoriebepaling -------------------------------------------------------

test("verse groente en fruit krijgen hun eigen categorie", () => {
  assert.equal(offCategorie(["en:plant-based-foods", "en:fresh-vegetables"], ""), "vegetable");
  assert.equal(offCategorie(["en:fruits"], ""), "fruit_whole");
  assert.equal(offCategorie(["en:legumes", "en:lentils"], ""), "legume");
  assert.equal(offCategorie(["en:nuts"], ""), "nuts_seeds");
});

test("sap, gedroogd en gezoet vallen terug op default", () => {
  // Vruchtensuiker in sap is geconcentreerd en moet gewoon meetellen.
  assert.equal(offCategorie(["en:fruits", "en:fruit-juices"], ""), "default");
  assert.equal(offCategorie(["en:fruits", "en:dried-fruits"], ""), "default");
  assert.equal(offCategorie(["en:plain-yogurts", "en:sweetened-yogurts"], "melk"), "default");
});

test("zuivel krijgt de lactose-aftrek alleen zonder suiker in de ingredienten", () => {
  assert.equal(offCategorie(["en:plain-yogurts"], "Magere melk, zuursels"), "dairy_plain");
  assert.equal(offCategorie(["en:plain-yogurts"], "Magere melk, suiker, zuursels"), "default");
  assert.equal(offCategorie(["en:quarks"], "Magere melk, glucosestroop"), "default");
  // Geen ingredientenlijst is geen bewijs: dan geen aftrek.
  assert.equal(offCategorie(["en:plain-yogurts"], ""), "default");
  assert.equal(offCategorie(["en:plain-yogurts"], undefined), "default");
});

test("onbekende of lege categorieen leveren default op", () => {
  assert.equal(offCategorie([], ""), "default");
  assert.equal(offCategorie(undefined, ""), "default");
  assert.equal(offCategorie(["en:snacks", "en:chips"], ""), "default");
  assert.equal(offCategorie("geen array", ""), "default");
});

test("bevatSuiker herkent de gangbare schrijfwijzen", () => {
  assert.equal(bevatSuiker("Melk, suiker"), true);
  assert.equal(bevatSuiker("Milk, sugar"), true);
  assert.equal(bevatSuiker("Melk, glucose-fructosestroop"), true);
  assert.equal(bevatSuiker("Honing"), true);
  assert.equal(bevatSuiker("Magere melk, zuursels"), false);
});

// -- eenheid en portie -------------------------------------------------------

test("dranken worden in milliliter gelogd", () => {
  assert.equal(offEenheid(["en:beverages", "en:sodas"]), "ml");
  assert.equal(offEenheid(["en:waters"]), "ml");
  assert.equal(offEenheid(["en:cheeses"]), "g");
  assert.equal(offEenheid(undefined), "g");
});

test("een portie wordt alleen overgenomen als hij plausibel is", () => {
  assert.deepEqual(offPortie({ serving_quantity: 30, serving_size: "30 g (2 koekjes)" }),
    { grams: 30, label: "30 g (2 koekjes)" });
  assert.deepEqual(offPortie({ serving_quantity: "25" }), { grams: 25, label: "25 g" });
  assert.equal(offPortie({}), undefined);
  assert.equal(offPortie({ serving_quantity: 0 }), undefined);
  assert.equal(offPortie({ serving_quantity: -5 }), undefined);
  assert.equal(offPortie({ serving_quantity: 99999 }), undefined); // onzin
});

// -- volledige omzetting -----------------------------------------------------

const MAGERE_KWARK = {
  code: "8710400045892",
  product_name: "Magere kwark",
  brands: "Albert Heijn, AH",
  categories_tags: ["en:dairies", "en:fermented-foods", "en:quarks"],
  ingredients_text: "Magere melk, zuursel",
  serving_quantity: 150,
  serving_size: "150 g",
  nutriments: {
    "energy-kcal_100g": 47,
    proteins_100g: 9.4,
    fat_100g: 0.2,
    "saturated-fat_100g": 0.1,
    carbohydrates_100g: 3.9,
    sugars_100g: 3.9,
    fiber_100g: 0,
  },
};

test("een compleet product wordt volledig omgezet", () => {
  const p = offNaarProduct(MAGERE_KWARK);
  assert.ok(p);
  assert.equal(p.id, "8710400045892");
  assert.equal(p.name, "Magere kwark");
  assert.equal(p.brand, "Albert Heijn"); // alleen het eerste merk
  assert.equal(p.bron, "off");
  assert.equal(p.eenheid, "g");
  assert.equal(p.barcode, "8710400045892");
  assert.deepEqual(p.portie, { grams: 150, label: "150 g" });
  assert.equal(p.per100.category, "dairy_plain");
  assert.equal(p.per100.kcal, 47);
  assert.equal(p.per100.protein_g, 9.4);
  assert.equal(p.per100.satfat_g, 0.1);
});

/** Voedingswaarden per 100 g omrekenen naar een portie. */
function portieVan(per100: Nutrients, grams: number): Nutrients {
  const f = grams / 100;
  return {
    ...per100,
    kcal: per100.kcal * f, protein_g: per100.protein_g * f, fat_g: per100.fat_g * f,
    satfat_g: per100.satfat_g * f, carbs_g: per100.carbs_g * f,
    sugar_g: per100.sugar_g * f, fiber_g: per100.fiber_g * f,
  };
}

test("de lactose-aftrek haalt de melksuiker uit de berekening", () => {
  const p = offNaarProduct(MAGERE_KWARK)!;
  const portie = portieVan(p.per100, 150);
  const zonder = { ...portie, category: "default" as const };

  // 5,85 g melksuiker in de portie, tegen 0,10 punt per gram.
  assert.ok(Math.abs((rawPoints(zonder, 150) - rawPoints(portie, 150)) - 0.585) < 1e-9);
  // Deze kwark is zo mager dat beide kanten op 1 punt afronden.
  assert.equal(toonPunten(rawPoints(portie, 150), 1), 1);
});

test("bij vollere zuivel scheelt de aftrek een zichtbaar punt", () => {
  const p = offNaarProduct({
    code: "8712345678901",
    product_name: "Griekse yoghurt 10%",
    categories_tags: ["en:dairies", "en:plain-yogurts"],
    ingredients_text: "Gepasteuriseerde melk, room, zuursels",
    nutriments: {
      "energy-kcal_100g": 115, proteins_100g: 5.5, fat_100g: 9.5,
      "saturated-fat_100g": 6.5, carbohydrates_100g: 4, sugars_100g: 4, fiber_100g: 0,
    },
  })!;
  assert.equal(p.per100.category, "dairy_plain");

  const portie = portieVan(p.per100, 150);
  assert.equal(toonPunten(rawPoints(portie, 150), 1), 5);
  assert.equal(toonPunten(rawPoints({ ...portie, category: "default" }, 150), 1), 6);
});

test("producten zonder bruikbare gegevens worden overgeslagen", () => {
  assert.equal(offNaarProduct(null), null);
  assert.equal(offNaarProduct({}), null);
  assert.equal(offNaarProduct({ code: "123" }), null); // geen naam
  assert.equal(offNaarProduct({ product_name: "Iets" }), null); // geen code
  // Naam en code, maar nergens een voedingswaarde: niets te berekenen.
  assert.equal(offNaarProduct({ code: "123", product_name: "Leeg", nutriments: {} }), null);
});

test("ontbrekende macro's worden nul, niet undefined", () => {
  const p = offNaarProduct({
    code: "999", product_name: "Half ingevuld",
    nutriments: { "energy-kcal_100g": 120 },
  });
  assert.ok(p);
  assert.equal(p.per100.protein_g, 0);
  assert.equal(p.per100.satfat_g, 0);
  assert.equal(p.per100.fiber_g, 0);
  assert.equal(p.per100.category, "default");
  // En hij is gewoon door te rekenen.
  assert.equal(toonPunten(rawPoints(p.per100, 100), 1), 3);
});

test("een product met alleen kilojoules en tekstuele getallen komt er door", () => {
  const p = offNaarProduct({
    code: "555", product_name: "Crackers",
    nutriments: { energy_100g: "1673", proteins_100g: "9,5", "saturated-fat_100g": "1,2" },
  });
  assert.ok(p);
  assert.ok(Math.abs(p.per100.kcal - 400) < 1);
  assert.equal(p.per100.protein_g, 9.5);
  assert.equal(p.per100.satfat_g, 1.2);
});

test("een generieke naam wordt gebruikt als product_name ontbreekt", () => {
  const p = offNaarProduct({
    code: "777", generic_name: "Volkoren beschuit",
    nutriments: { "energy-kcal_100g": 380 },
  });
  assert.equal(p?.name, "Volkoren beschuit");
});
