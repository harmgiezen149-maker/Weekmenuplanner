import { test } from "node:test";
import assert from "node:assert/strict";
import {
  onderdelenUitRegels, ingredientenUitOnderdelen, standaardNaam,
} from "./samenstellen.ts";
import { telComponentenOp } from "./maaltijd.ts";
import type { Entry, MaaltijdComponent, Nutrients } from "./types.ts";

function waarden(over: Partial<Nutrients> = {}): Nutrients {
  return {
    kcal: 100, protein_g: 5, fat_g: 3, satfat_g: 1,
    carbs_g: 12, sugar_g: 4, fiber_g: 2, category: "default", ...over,
  };
}

function regel(over: Partial<Entry> = {}): Entry {
  return {
    id: "e", ts: 1, meal: "ontbijt", source: "search", name: "Iets",
    amount: 100, unit: "g", grams: 100, nutrients: waarden(), points_raw: 3, ...over,
  };
}

function onderdeel(naam: string, grams: number, over: Partial<MaaltijdComponent> = {}): MaaltijdComponent {
  return {
    id: `id-${naam}`, name: naam, amount: grams, unit: "g", grams,
    nutrients: waarden(), points_raw: 2, ...over,
  };
}

test("losse regels worden onderdelen, zonder hun id", () => {
  const uit = onderdelenUitRegels([
    regel({ name: "Kwark", grams: 150 }),
    regel({ name: "Banaan", grams: 120, brand: "AH" }),
  ]);
  assert.equal(uit.length, 2);
  assert.equal(uit[0].name, "Kwark");
  assert.equal(uit[1].brand, "AH");
  assert.equal("id" in uit[0], false);
});

test("een samengestelde regel wordt uitgeklapt", () => {
  const uit = onderdelenUitRegels([
    regel({
      name: "Standaard ontbijt", unit: "portie", amount: 1,
      components: [onderdeel("havermout", 60), onderdeel("melk", 240)],
    }),
    regel({ name: "Koffie", grams: 200 }),
  ]);
  assert.deepEqual(uit.map((c) => c.name), ["havermout", "melk", "Koffie"]);
});

test("uitklappen houdt de punten gelijk aan wat er op de dag stond", () => {
  // De suikercorrectie hangt aan de categorie van elk onderdeel apart. Zou de
  // maaltijd de regel als één onderdeel bewaren, dan zou de melksuiker in de
  // yoghurt hier alsnog gaan meetellen.
  const onderdelen = [
    onderdeel("yoghurt", 200, { nutrients: waarden({ sugar_g: 9, category: "dairy_plain" }) }),
    onderdeel("muesli", 60, { nutrients: waarden({ sugar_g: 8 }) }),
  ];
  const gelogd = regel({ name: "Ontbijt", components: onderdelen });
  const uit = onderdelenUitRegels([gelogd]);

  const voor = telComponentenOp(onderdelen);
  const na = telComponentenOp(uit.map((c, n) => ({ ...c, id: String(n) })));
  assert.equal(na.points_raw, voor.points_raw);
});

test("ingrediënten voor het kookboek staan in gram", () => {
  const uit = ingredientenUitOnderdelen(onderdelenUitRegels([
    regel({ name: "Volkorenbrood", amount: 3, unit: "× snee", grams: 105 }),
    regel({ name: "Melk", amount: 200, unit: "ml", grams: 200 }),
  ]));
  assert.deepEqual(uit, [
    { naam: "Volkorenbrood", hoev: 105, eenheid: "g" },
    { naam: "Melk", hoev: 200, eenheid: "ml" },
  ]);
});

test("hetzelfde product twee keer wordt één ingrediënt", () => {
  const uit = ingredientenUitOnderdelen(onderdelenUitRegels([
    regel({ name: "Kaas", grams: 20 }),
    regel({ name: "kaas", grams: 20 }),
  ]));
  assert.deepEqual(uit, [{ naam: "Kaas", hoev: 40, eenheid: "g" }]);
});

test("de naam begint bij de regel zelf, of anders bij het eetmoment", () => {
  assert.equal(standaardNaam([regel({ name: "Havermout" })], "Ontbijt"), "Havermout");
  assert.equal(standaardNaam([regel(), regel()], "Ontbijt"), "Ontbijt");
  assert.equal(standaardNaam([], "Lunch"), "Lunch");
});
