import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ingredientSleutel, zoekEigenIngredient, metIngredient, zonderIngredient,
  alleIngredienten, LEGE_BIBLIOTHEEK,
} from "./ingredienten.ts";
import { matchIngredient, berekenReceptPunten, receptVingerafdruk } from "./recept.ts";
import { toonPunten } from "./points.ts";
import type { Product } from "./types.ts";

function product(naam: string, kcal: number, extra: Partial<Product["per100"]> = {}): Product {
  return {
    id: naam, name: naam, bron: "eigen", eenheid: "g",
    per100: {
      kcal, protein_g: 0, fat_g: 0, satfat_g: 0,
      carbs_g: 0, sugar_g: 0, fiber_g: 0, category: "default", ...extra,
    },
  };
}

// -- de sleutel --------------------------------------------------------------

test("bereidingswoorden en leestekens verdwijnen uit de sleutel", () => {
  assert.equal(ingredientSleutel("verse spinazie"), "spinazie");
  assert.equal(ingredientSleutel("Broccoli, in roosjes"), "broccoli");
  assert.equal(ingredientSleutel("kipfilet (in blokjes)"), "kipfilet");
  assert.equal(ingredientSleutel("  HARISSA  "), "harissa");
});

test("verschillende schrijfwijzen komen op dezelfde sleutel uit", () => {
  const varianten = ["Spinazie", "verse spinazie", "spinazie", "Spinazie, gewassen"];
  const sleutels = new Set(varianten.map(ingredientSleutel));
  assert.equal(sleutels.size, 1, [...sleutels].join(" / "));
});

test("een lege naam levert een lege sleutel", () => {
  assert.equal(ingredientSleutel(""), "");
  assert.equal(ingredientSleutel("   "), "");
});

// -- opzoeken ----------------------------------------------------------------

const BIB = metIngredient(
  metIngredient(LEGE_BIBLIOTHEEK, "harissa", product("Harissa", 90, { fat_g: 5, satfat_g: 0.7 })),
  "tahin", product("Tahin", 595, { fat_g: 54, satfat_g: 7.6, protein_g: 17 })
);

test("een aangevuld ingredient wordt gevonden", () => {
  assert.equal(zoekEigenIngredient(BIB, "harissa")?.name, "Harissa");
  assert.equal(zoekEigenIngredient(BIB, "Harissa")?.name, "Harissa");
  assert.equal(zoekEigenIngredient(BIB, "tahin")?.name, "Tahin");
});

test("een langere naam die de aanvulling bevat telt ook", () => {
  // Wie harissa invult wil dat ook terugzien bij "harissa pasta".
  assert.equal(zoekEigenIngredient(BIB, "harissa pasta")?.name, "Harissa");
  assert.equal(zoekEigenIngredient(BIB, "rode harissa")?.name, "Harissa");
});

test("van meerdere treffers wint de meest specifieke", () => {
  const bib = metIngredient(BIB, "harissa pasta", product("Harissa pasta", 120));
  assert.equal(zoekEigenIngredient(bib, "harissa pasta")?.name, "Harissa pasta");
  assert.equal(zoekEigenIngredient(bib, "harissa")?.name, "Harissa");
});

test("een onbekend ingredient geeft null", () => {
  assert.equal(zoekEigenIngredient(BIB, "sumak"), null);
  assert.equal(zoekEigenIngredient(LEGE_BIBLIOTHEEK, "harissa"), null);
  assert.equal(zoekEigenIngredient(BIB, ""), null);
});

test("een toevallige lettercombinatie is geen treffer", () => {
  // "tahin" zit niet in "spinazie", ook al lijken losse letters erop.
  assert.equal(zoekEigenIngredient(BIB, "spinazie"), null);
});

// -- beheer ------------------------------------------------------------------

test("de revisie loopt op bij elke wijziging", () => {
  assert.equal(LEGE_BIBLIOTHEEK.revisie, 0);
  const een = metIngredient(LEGE_BIBLIOTHEEK, "harissa", product("Harissa", 90));
  assert.equal(een.revisie, 1);
  const twee = metIngredient(een, "tahin", product("Tahin", 595));
  assert.equal(twee.revisie, 2);
  assert.equal(zonderIngredient(twee, "harissa").revisie, 3);
});

test("verwijderen van iets wat er niet staat verandert niets", () => {
  const zelfde = zonderIngredient(BIB, "bestaat-niet");
  assert.equal(zelfde.revisie, BIB.revisie);
});

test("bijwerken vervangt in plaats van te verdubbelen", () => {
  const bij = metIngredient(BIB, "harissa", product("Harissa mild", 70));
  assert.equal(Object.keys(bij.producten).length, Object.keys(BIB.producten).length);
  assert.equal(zoekEigenIngredient(bij, "harissa")?.name, "Harissa mild");
});

test("de lijst komt op naam gesorteerd terug", () => {
  const namen = alleIngredienten(BIB).map((x) => x.product.name);
  assert.deepEqual(namen, [...namen].sort());
});

// -- doorwerking in recepten -------------------------------------------------

const RECEPT = [
  { naam: "kipfilet", hoev: 500, eenheid: "g" },
  { naam: "harissa", hoev: 1, eenheid: "el" },
];

test("zonder aanvulling blijft het ingredient overgeslagen", () => {
  const r = berekenReceptPunten(RECEPT, 4);
  assert.deepEqual(r.nietHerkend, ["harissa"]);
  assert.equal(r.componenten.length, 1);
});

test("na aanvullen telt het ingredient mee", () => {
  const r = berekenReceptPunten(RECEPT, 4, {}, BIB);
  assert.deepEqual(r.nietHerkend, []);
  assert.equal(r.componenten.length, 2);
  // 1 el harissa is 15 g; die telt nu mee in de punten.
  const zonder = berekenReceptPunten(RECEPT, 4);
  assert.ok(r.perPortiePunten > zonder.perPortiePunten);
});

test("de eigen lijst gaat voor de basislijst", () => {
  // "broccoli" staat in de basislijst; een eigen regel wint.
  const bib = metIngredient(LEGE_BIBLIOTHEEK, "broccoli", product("Mijn broccoli", 999));
  const m = matchIngredient("broccoli", 100, "g", bib);
  assert.equal(m.product?.name, "Mijn broccoli");
  assert.equal(m.score, 100);
  assert.equal(matchIngredient("broccoli", 100, "g").product?.name, "Broccoli");
});

test("een aanvulling geldt voor elk recept waar het in zit", () => {
  const anderRecept = [
    { naam: "kikkererwten", hoev: 400, eenheid: "g" },
    { naam: "harissa", hoev: 2, eenheid: "el" },
  ];
  assert.deepEqual(berekenReceptPunten(anderRecept, 2, {}, BIB).nietHerkend, []);
});

// -- cache-invalidatie -------------------------------------------------------

test("een aanvulling verschuift de vingerafdruk van elk recept", () => {
  const voor = receptVingerafdruk(RECEPT, 4, BIB.revisie);
  const na = receptVingerafdruk(RECEPT, 4, BIB.revisie + 1);
  assert.notEqual(voor, na, "anders zou de aanvulling pas na een receptwijziging meetellen");
});

test("zonder wijziging blijft de vingerafdruk gelijk", () => {
  assert.equal(
    receptVingerafdruk(RECEPT, 4, BIB.revisie),
    receptVingerafdruk(RECEPT, 4, BIB.revisie)
  );
});

test("de oude aanroep zonder revisie blijft werken", () => {
  assert.equal(receptVingerafdruk(RECEPT, 4), receptVingerafdruk(RECEPT, 4, 0));
});
