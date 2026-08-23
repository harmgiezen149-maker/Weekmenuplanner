import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ingredientNaarGram, schoonIngredient, matchIngredient, matchNaarComponent,
  berekenReceptPunten, receptVingerafdruk,
} from "./recept.ts";
import { toonPunten } from "./points.ts";

// -- omrekenen ---------------------------------------------------------------

test("gram en milliliter gaan een op een", () => {
  assert.equal(ingredientNaarGram(250, "g").grams, 250);
  assert.equal(ingredientNaarGram(200, "ml").grams, 200);
  assert.equal(ingredientNaarGram(1.5, "kg").grams, 1500);
  assert.equal(ingredientNaarGram(250, "g").onzeker, false);
});

test("huishoudelijke maten worden geschat", () => {
  assert.equal(ingredientNaarGram(2, "el").grams, 30);
  assert.equal(ingredientNaarGram(1, "tl").grams, 5);
  assert.equal(ingredientNaarGram(3, "tenen").grams, 15);
  assert.equal(ingredientNaarGram(1, "blik").grams, 400);
  assert.equal(ingredientNaarGram(2, "sneetjes").grams, 70);
});

test("een stuk gebruikt de portiegrootte van het gevonden product", () => {
  const banaan = matchIngredient("banaan", 2, "stuk");
  assert.ok(banaan.product);
  // Basisproduct banaan heeft een portie van 120 g per stuk.
  assert.equal(banaan.omrekening.grams, 240);
  assert.equal(banaan.omrekening.onzeker, false);
  assert.match(banaan.omrekening.aanname, /120 g/);
});

test("zonder bekende portiegrootte valt een stuk terug op 100 g, en dat is onzeker", () => {
  const r = ingredientNaarGram(1, "stuk");
  assert.equal(r.grams, 100);
  assert.equal(r.onzeker, true);
});

test("een onbekende maat wordt gemeld in plaats van stilzwijgend geraden", () => {
  const r = ingredientNaarGram(1, "vleugje");
  assert.equal(r.onzeker, true);
  assert.match(r.aanname, /onbekende maat/);
});

// -- namen opschonen ---------------------------------------------------------

test("bereidingswoorden en haakjes gaan eruit", () => {
  assert.equal(schoonIngredient("verse spinazie"), "spinazie");
  assert.equal(schoonIngredient("gesnipperde ui"), "ui");
  assert.equal(schoonIngredient("kipfilet (in blokjes)"), "kipfilet");
  assert.equal(schoonIngredient("magere kwark"), "kwark");
  assert.equal(schoonIngredient("Broccoli, in roosjes"), "broccoli");
});

// -- matchen -----------------------------------------------------------------

test("gewone ingredienten worden herkend", () => {
  for (const [naam, verwacht] of [
    ["kipfilet", "Kipfilet, rauw"],
    ["broccoli", "Broccoli"],
    ["olijfolie", "Olijfolie"],
    ["verse spinazie", "Spinazie"],
  ] as const) {
    const m = matchIngredient(naam, 100, "g");
    assert.equal(m.product?.name, verwacht, naam);
    assert.equal(m.overgeslagen, false);
  }
});

test("een onbekend ingredient wordt overgeslagen in plaats van geraden", () => {
  const m = matchIngredient("harissa", 1, "el");
  assert.equal(m.product, null);
  assert.equal(m.overgeslagen, true);
  assert.equal(matchNaarComponent(m), null);
});

test("een match levert een onderdeel met zijn eigen categorie op", () => {
  const c = matchNaarComponent(matchIngredient("broccoli", 300, "g"));
  assert.ok(c);
  assert.equal(c.grams, 300);
  assert.equal(c.nutrients.category, "vegetable");
  assert.ok(Math.abs(c.nutrients.kcal - 102) < 0.01); // 34 kcal per 100 g
});

// -- hele recepten -----------------------------------------------------------

const KIP_BROCCOLI = [
  { naam: "kipfilet", hoev: 500, eenheid: "g" },
  { naam: "broccoli", hoev: 400, eenheid: "g" },
  { naam: "zilvervliesrijst", hoev: 600, eenheid: "g" },
  { naam: "olijfolie", hoev: 2, eenheid: "el" },
  { naam: "harissa", hoev: 1, eenheid: "el" },
];

test("een recept wordt per portie doorgerekend", () => {
  const r = berekenReceptPunten(KIP_BROCCOLI, 4);
  assert.equal(r.personen, 4);
  assert.equal(r.componenten.length, 4); // harissa valt af
  assert.deepEqual(r.nietHerkend, ["harissa"]);
  assert.ok(r.perPortiePunten > 0);
  // Vier porties samen zijn het hele recept.
  const heel = r.componenten.reduce((s, c) => s + c.points_raw, 0);
  assert.ok(Math.abs(r.perPortiePunten * 4 - heel) < 1e-9);
});

test("meer personen betekent minder punten per portie", () => {
  const voorTwee = berekenReceptPunten(KIP_BROCCOLI, 2);
  const voorVier = berekenReceptPunten(KIP_BROCCOLI, 4);
  assert.ok(Math.abs(voorTwee.perPortiePunten - 2 * voorVier.perPortiePunten) < 1e-9);
});

test("de suikercorrectie blijft per ingredient gelden", () => {
  // Broccoli levert geen suikerpunten op ondanks 1,7 g suiker per 100 g.
  const alleenBroccoli = berekenReceptPunten([{ naam: "broccoli", hoev: 400, eenheid: "g" }], 4);
  assert.equal(alleenBroccoli.componenten[0].nutrients.category, "vegetable");
  assert.equal(toonPunten(alleenBroccoli.perPortiePunten, 1), 0);
});

test("een onzinnig aantal personen wordt een", () => {
  for (const p of [0, -3, NaN]) {
    assert.equal(berekenReceptPunten(KIP_BROCCOLI, p as number).personen, 1);
  }
});

test("een leeg recept geeft nul zonder te klappen", () => {
  const r = berekenReceptPunten([], 4);
  assert.equal(r.perPortiePunten, 0);
  assert.equal(r.componenten.length, 0);
  assert.deepEqual(r.nietHerkend, []);
});

test("onzekere aannames worden apart gemeld", () => {
  const r = berekenReceptPunten([
    { naam: "kipfilet", hoev: 500, eenheid: "g" },
    { naam: "ui", hoev: 2, eenheid: "vleugje" },
  ], 2);
  assert.ok(r.onzeker.includes("ui"), "onbekende maat hoort gemeld te worden");
  assert.ok(!r.onzeker.includes("kipfilet"));
});

// -- cache-invalidatie -------------------------------------------------------

test("de vingerafdruk verandert zodra het recept verandert", () => {
  const basis = receptVingerafdruk(KIP_BROCCOLI, 4);
  assert.equal(receptVingerafdruk(KIP_BROCCOLI, 4), basis, "gelijk recept, gelijke afdruk");
  assert.notEqual(receptVingerafdruk(KIP_BROCCOLI, 2), basis, "ander aantal personen");
  assert.notEqual(
    receptVingerafdruk([...KIP_BROCCOLI, { naam: "citroen", hoev: 1, eenheid: "stuk" }], 4),
    basis, "extra ingredient"
  );
  assert.notEqual(
    receptVingerafdruk(KIP_BROCCOLI.map((i) => i.naam === "kipfilet" ? { ...i, hoev: 600 } : i), 4),
    basis, "andere hoeveelheid"
  );
});
