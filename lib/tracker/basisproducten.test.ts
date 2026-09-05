import { test } from "node:test";
import assert from "node:assert/strict";
import { BASISPRODUCTEN, MET_ALCOHOL, zoekBasisproducten } from "./basisproducten.ts";
import { rawPoints, toonPunten } from "./points.ts";
import type { Nutrients, Product } from "./types.ts";

/** Punten voor de standaardportie van een product. */
function portiePunten(p: Product): number {
  const grams = p.portie?.grams ?? 100;
  const f = grams / 100;
  const n: Nutrients = {
    ...p.per100,
    kcal: p.per100.kcal * f, protein_g: p.per100.protein_g * f, fat_g: p.per100.fat_g * f,
    satfat_g: p.per100.satfat_g * f, carbs_g: p.per100.carbs_g * f,
    sugar_g: p.per100.sugar_g * f, fiber_g: p.per100.fiber_g * f,
  };
  return toonPunten(rawPoints(n, grams), 1);
}

function vind(id: string): Product {
  const p = BASISPRODUCTEN.find((x) => x.id === `basis:${id}`);
  assert.ok(p, `basisproduct ${id} ontbreekt`);
  return p;
}

test("de lijst is intern consistent", () => {
  const ids = new Set<string>();
  for (const p of BASISPRODUCTEN) {
    assert.equal(ids.has(p.id), false, `dubbele id: ${p.id}`);
    ids.add(p.id);
    assert.ok(p.name.length > 0);
    assert.equal(p.bron, "basis");
    assert.ok(p.eenheid === "g" || p.eenheid === "ml");
    // Suiker kan nooit meer zijn dan de koolhydraten, verzadigd vet niet meer
    // dan het totale vet. Vangt tikfouten in de tabel.
    assert.ok(p.per100.sugar_g <= p.per100.carbs_g + 0.01, `${p.name}: suiker boven koolhydraten`);
    assert.ok(p.per100.satfat_g <= p.per100.fat_g + 0.01, `${p.name}: verzadigd vet boven totaal vet`);
    // Calorieen moeten ruwweg kloppen met de macro's (4/4/9 kcal per gram).
    // Bij alcohol niet: die levert 7 kcal per gram en staat niet bij de macro's.
    if (!MET_ALCOHOL.has(p.id)) {
      const uitMacros = 4 * p.per100.protein_g + 4 * p.per100.carbs_g + 9 * p.per100.fat_g;
      const speling = Math.max(30, uitMacros * 0.3);
      assert.ok(
        Math.abs(uitMacros - p.per100.kcal) <= speling,
        `${p.name}: ${p.per100.kcal} kcal past niet bij de macro's (${Math.round(uitMacros)})`
      );
    }
  }
});

test("waterrijke groente komt per 100 g op nul uit", () => {
  for (const id of ["broccoli", "tomaat", "komkommer", "spinazie",
                    "courgette", "bloemkool", "sperziebonen"]) {
    const p = vind(id);
    assert.equal(toonPunten(rawPoints(p.per100, 100), 1), 0, `${id} zou 0 punten moeten zijn`);
  }
});

test("zoetere groente kost wel een punt per 100 g", () => {
  // Belangrijk om te weten: "groente is gratis" gaat niet overal op. De suiker
  // van wortel, ui en paprika telt niet mee, maar hun calorieen wel, en die
  // duwen de som net over de halve punt. De formule kent bewust geen lijst met
  // gratis producten, dus dit is geen uitzondering maar het gevolg daarvan.
  for (const id of ["paprika", "ui", "wortel"]) {
    assert.equal(toonPunten(rawPoints(vind(id).per100, 100), 1), 1, `${id}`);
  }
});

test("een flinke portie groente kan tot een punt oplopen", () => {
  // De formule is lineair: bij 150 g tikt ook broccoli over de halve punt heen.
  assert.equal(portiePunten(vind("broccoli")), 1);
  // Waterige groente blijft ook per portie op nul.
  assert.equal(portiePunten(vind("komkommer")), 0);
  assert.equal(portiePunten(vind("tomaat")), 0);
});

test("bekende porties geven de verwachte punten", () => {
  assert.equal(portiePunten(vind("kipfilet")), 1);   // 120 g filet
  assert.equal(portiePunten(vind("ei")), 2);          // 1 ei
  assert.equal(portiePunten(vind("brood-volkoren")), 2); // 1 snee
  assert.equal(portiePunten(vind("bier-pils")), 2);   // 1 glas van 250 ml
  assert.equal(portiePunten(vind("olijfolie")), 2);   // 1 eetlepel
  assert.equal(portiePunten(vind("banaan")), 2);      // 1 stuk
});

test("magere eiwitbronnen zijn goedkoop, vet en suiker duur", () => {
  assert.ok(portiePunten(vind("kwark-mager")) <= 1);
  assert.ok(portiePunten(vind("kabeljauw")) <= 1);
  assert.ok(portiePunten(vind("boter")) >= 2);
  assert.ok(portiePunten(vind("kaas-48")) >= 2);
});

// -- zoeken ------------------------------------------------------------------

test("een exacte naam staat bovenaan", () => {
  assert.equal(zoekBasisproducten("banaan")[0].name, "Banaan");
  assert.equal(zoekBasisproducten("ei")[0].name, "Ei");
  assert.equal(zoekBasisproducten("broccoli")[0].name, "Broccoli");
});

test("zoeken gaat op begin van de naam voor treffers in het midden", () => {
  const r = zoekBasisproducten("kip");
  assert.ok(r.length >= 2);
  assert.equal(r[0].name, "Kipfilet, rauw");
});

test("trefwoorden vinden wat de naam niet zegt", () => {
  assert.ok(zoekBasisproducten("boterham").some((p) => p.name.includes("brood")));
  assert.ok(zoekBasisproducten("bier").some((p) => p.name === "Pils"));
  assert.ok(zoekBasisproducten("spaghetti").some((p) => p.name.startsWith("Pasta")));
  assert.ok(zoekBasisproducten("bruine rijst").some((p) => p.name.startsWith("Zilvervlies")));
});

test("zoeken is ongevoelig voor hoofdletters en accenten", () => {
  assert.equal(zoekBasisproducten("BANAAN")[0].name, "Banaan");
  assert.equal(zoekBasisproducten("  Appel ")[0].name, "Appel");
  assert.ok(zoekBasisproducten("kikkererwten").length > 0);
});

test("zonder treffer komt er een lege lijst terug", () => {
  assert.deepEqual(zoekBasisproducten("zwaardvisragout"), []);
  assert.deepEqual(zoekBasisproducten(""), []);
});

test("het aantal resultaten is begrensd", () => {
  assert.ok(zoekBasisproducten("e", 5).length <= 5);
});

test("de meelsoorten staan er los in", () => {
  // Een baksel bestaat voor het grootste deel uit meel; valt dat buiten de
  // telling, dan is het recept eigenlijk niet doorgerekend. De verschillen
  // zijn te groot om er een voor de rest te laten staan.
  assert.equal(zoekBasisproducten("volkorenmeel")[0].name, "Volkorenmeel");
  assert.equal(zoekBasisproducten("havermeel")[0].name, "Havermeel");
  assert.equal(zoekBasisproducten("boekweitmeel")[0].name, "Boekweitmeel");
  assert.equal(zoekBasisproducten("amandelmeel")[0].name, "Amandelmeel");
  assert.equal(zoekBasisproducten("speltmeel")[0].name, "Speltmeel");
  assert.equal(zoekBasisproducten("roggemeel")[0].name, "Roggemeel");
  assert.equal(zoekBasisproducten("maïzena")[0].name, "Maizena");

  // Amandelmeel is bijna twee keer zo zwaar als tarwebloem; zou het als bloem
  // tellen, dan klopt er niets van de punten.
  assert.ok(vind("amandelmeel").per100.kcal > vind("bloem").per100.kcal * 1.5);
  // De suiker in amandelen is die van de amandel zelf.
  assert.equal(vind("amandelmeel").per100.category, "nuts_seeds");
  // Havermeel is gemalen havermout en heeft dus dezelfde waarden.
  assert.deepEqual(vind("havermeel").per100.kcal, vind("havermout").per100.kcal);
});

test("een woord dat precies klopt wint van een naam die er alleen mee begint", () => {
  // "bloem" gaf eerder Bloemkool: die naam begint er toevallig mee. Bakken met
  // bloemkool is niet wat je bedoelde.
  assert.equal(zoekBasisproducten("bloem")[0].name, "Tarwebloem");
  assert.equal(zoekBasisproducten("bloemkool")[0].name, "Bloemkool");
});
