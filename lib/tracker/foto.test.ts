import { test } from "node:test";
import assert from "node:assert/strict";
import { leesItems } from "./foto.ts";

const GOED = JSON.stringify({
  items: [
    { name: "Gegrilde kipfilet", amount: 150, unit: "g", kcal: 165, protein_g: 34.5,
      fat_g: 2.3, satfat_g: 0.8, carbs_g: 0, sugar_g: 0, added_sugar_g: 0, fiber_g: 0,
      category: "default", confidence: "hoog" },
    { name: "Gestoomde broccoli", amount: 200, unit: "g", kcal: 68, protein_g: 5.6,
      fat_g: 0.8, satfat_g: 0, carbs_g: 14, sugar_g: 3.4, added_sugar_g: 0, fiber_g: 5.2,
      category: "vegetable", confidence: "midden" },
  ],
});

test("een net antwoord wordt volledig overgenomen", () => {
  const items = leesItems(GOED);
  assert.equal(items.length, 2);
  assert.equal(items[0].name, "Gegrilde kipfilet");
  assert.equal(items[0].amount, 150);
  assert.equal(items[0].confidence, "hoog");
  assert.equal(items[1].category, "vegetable");
  assert.equal(items[1].fiber_g, 5.2);
});

test("markdown-fences eromheen zijn geen probleem", () => {
  assert.equal(leesItems("```json\n" + GOED + "\n```").length, 2);
  assert.equal(leesItems("```\n" + GOED + "\n```").length, 2);
});

test("tekst voor en na de JSON wordt genegeerd", () => {
  const met = `Hier is mijn schatting van het bord:\n\n${GOED}\n\nLaat me weten of dit klopt!`;
  assert.equal(leesItems(met).length, 2);
});

test("onbruikbare antwoorden geven een lege lijst in plaats van een fout", () => {
  assert.deepEqual(leesItems(""), []);
  assert.deepEqual(leesItems("Sorry, ik zie geen eten op deze foto."), []);
  assert.deepEqual(leesItems("{ dit is geen geldige json"), []);
  assert.deepEqual(leesItems("{}"), []);
  assert.deepEqual(leesItems(JSON.stringify({ items: "geen array" })), []);
  assert.deepEqual(leesItems(JSON.stringify({ resultaat: [] })), []);
});

test("een onbekende categorie valt terug op default", () => {
  const items = leesItems(JSON.stringify({
    items: [{ name: "Iets", kcal: 100, category: "verzonnen" }],
  }));
  assert.equal(items[0].category, "default");
});

test("een onbekende zekerheid wordt midden", () => {
  const items = leesItems(JSON.stringify({
    items: [{ name: "Iets", kcal: 100, confidence: "heel erg zeker" }],
  }));
  assert.equal(items[0].confidence, "midden");
});

test("ontbrekende velden worden nul, niet undefined", () => {
  const items = leesItems(JSON.stringify({ items: [{ name: "Karig", kcal: 50 }] }));
  assert.equal(items.length, 1);
  assert.equal(items[0].protein_g, 0);
  assert.equal(items[0].satfat_g, 0);
  assert.equal(items[0].added_sugar_g, 0);
  assert.equal(items[0].amount, 100); // standaardhoeveelheid
  assert.equal(items[0].unit, "g");
});

test("negatieve en onzinnige getallen worden rechtgezet", () => {
  const items = leesItems(JSON.stringify({
    items: [{ name: "Raar", kcal: 200, protein_g: -5, fat_g: "veel", fiber_g: null }],
  }));
  assert.equal(items[0].protein_g, 0);
  assert.equal(items[0].fat_g, 0);
  assert.equal(items[0].fiber_g, 0);
});

test("items zonder naam of zonder calorieen vallen af", () => {
  const items = leesItems(JSON.stringify({
    items: [
      { name: "", kcal: 100 },
      { name: "Bord", kcal: 0 },
      { name: "Goed", kcal: 120 },
    ],
  }));
  assert.equal(items.length, 1);
  assert.equal(items[0].name, "Goed");
});

test("er komen nooit meer dan twaalf items terug", () => {
  const veel = { items: Array.from({ length: 30 }, (_, i) => ({ name: `Item ${i}`, kcal: 50 })) };
  assert.equal(leesItems(JSON.stringify(veel)).length, 12);
});

test("belachelijk lange namen worden afgekapt", () => {
  const items = leesItems(JSON.stringify({
    items: [{ name: "x".repeat(500), kcal: 100 }],
  }));
  assert.ok(items[0].name.length <= 80);
});
