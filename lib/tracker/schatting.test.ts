import { test } from "node:test";
import assert from "node:assert/strict";
import { leesSchatting } from "./schatting.ts";

const GOED = JSON.stringify({
  naam: "Harissa",
  eenheid: "g",
  per100: {
    kcal: 90, protein_g: 3, fat_g: 5, satfat_g: 0.7,
    carbs_g: 8, sugar_g: 4, fiber_g: 3, category: "default",
  },
  toelichting: "Pittige pasta van rode peper en olie.",
});

test("een net antwoord wordt overgenomen", () => {
  const s = leesSchatting(GOED);
  assert.ok(s);
  assert.equal(s.naam, "Harissa");
  assert.equal(s.eenheid, "g");
  assert.equal(s.per100.kcal, 90);
  assert.equal(s.per100.satfat_g, 0.7);
  assert.match(s.toelichting ?? "", /peper/);
});

test("fences en omringende tekst zijn geen probleem", () => {
  assert.ok(leesSchatting("```json\n" + GOED + "\n```"));
  assert.ok(leesSchatting("Hier is mijn schatting:\n" + GOED + "\nKlopt dit?"));
});

test("onbruikbare antwoorden geven null in plaats van een fout", () => {
  assert.equal(leesSchatting(""), null);
  assert.equal(leesSchatting("Dat ingrediënt ken ik niet."), null);
  assert.equal(leesSchatting("{kapot"), null);
  assert.equal(leesSchatting(JSON.stringify({ naam: "" })), null);
  assert.equal(leesSchatting(JSON.stringify({ naam: "Iets", per100: { kcal: 0 } })), null);
});

test("een onbekende categorie valt terug op default", () => {
  const s = leesSchatting(JSON.stringify({
    naam: "Iets", per100: { kcal: 100, category: "verzonnen" },
  }));
  assert.equal(s?.per100.category, "default");
});

test("ontbrekende velden worden nul", () => {
  const s = leesSchatting(JSON.stringify({ naam: "Karig", per100: { kcal: 50 } }));
  assert.ok(s);
  assert.equal(s.per100.protein_g, 0);
  assert.equal(s.per100.fiber_g, 0);
});

test("onmogelijke combinaties worden rechtgezet", () => {
  // Verzadigd vet kan niet boven het totale vet uitkomen, suiker niet boven
  // de koolhydraten. Zulke antwoorden komen voor en horen niet door te lekken.
  const s = leesSchatting(JSON.stringify({
    naam: "Raar",
    per100: { kcal: 200, fat_g: 5, satfat_g: 40, carbs_g: 3, sugar_g: 30 },
  }));
  assert.ok(s);
  assert.equal(s.per100.satfat_g, 5);
  assert.equal(s.per100.sugar_g, 3);
});

test("negatieve en absurde getallen worden begrensd", () => {
  const s = leesSchatting(JSON.stringify({
    naam: "Raar", per100: { kcal: 100, protein_g: -5, fiber_g: 99999 },
  }));
  assert.equal(s?.per100.protein_g, 0);
  assert.equal(s?.per100.fiber_g, 1000);
});

test("een vloeistof houdt milliliter", () => {
  const s = leesSchatting(JSON.stringify({
    naam: "Sojasaus", eenheid: "ml", per100: { kcal: 53 },
  }));
  assert.equal(s?.eenheid, "ml");
});
