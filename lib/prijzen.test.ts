import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  euroTekst, LEEG_PRIJSBOEK, metPrijs, prijsSleutel, raamLijst, zoekPrijs,
} from "./prijzen.ts";
import type { Prijsboek } from "./prijzen.ts";

function prijs(euro: number, over: Partial<{ aantal: number; eenheid: string; winkel: string; datum: string }> = {}) {
  return { euro, aantal: 1, eenheid: "stuk", winkel: "AH", datum: "2026-08-01", ...over };
}

test("merk, verpakking en hoeveelheid gaan van de naam af", () => {
  assert.equal(prijsSleutel("AH Halfvolle melk 1L"), "halfvolle melk");
  assert.equal(prijsSleutel("Jumbo Volkorenbrood 800 g"), "volkorenbrood");
  assert.equal(prijsSleutel("Cola 6x330ml"), "cola");
  assert.equal(prijsSleutel("  Rode  Ui  "), "rode ui");
});

test("een prijs wordt onthouden en teruggevonden", () => {
  const boek = metPrijs(LEEG_PRIJSBOEK, "AH Halfvolle melk 1L", prijs(1.19));
  assert.equal(zoekPrijs(boek, "halfvolle melk")?.euro, 1.19);
});

test("een nieuwere prijs vervangt een oudere, een oudere niet andersom", () => {
  // Een oude bon nascannen hoort de actuele prijs niet terug te draaien.
  let boek = metPrijs(LEEG_PRIJSBOEK, "melk", prijs(1.19, { datum: "2026-08-01" }));
  boek = metPrijs(boek, "melk", prijs(1.35, { datum: "2026-08-20" }));
  assert.equal(zoekPrijs(boek, "melk")?.euro, 1.35);
  boek = metPrijs(boek, "melk", prijs(0.99, { datum: "2026-01-01" }));
  assert.equal(zoekPrijs(boek, "melk")?.euro, 1.35);
});

test("een deel van de naam telt ook, en de langste treffer wint", () => {
  let boek: Prijsboek = metPrijs(LEEG_PRIJSBOEK, "melk", prijs(1.10));
  boek = metPrijs(boek, "halfvolle melk", prijs(1.19));
  assert.equal(zoekPrijs(boek, "verse halfvolle melk")?.euro, 1.19);
  assert.equal(zoekPrijs(boek, "karnemelk"), null, "geen treffer midden in een woord");
});

test("een lege naam levert niets op en vervuilt het boek niet", () => {
  assert.deepEqual(metPrijs(LEEG_PRIJSBOEK, "   ", prijs(2)), LEEG_PRIJSBOEK);
  assert.equal(zoekPrijs(LEEG_PRIJSBOEK, ""), null);
});

test("de raming telt alleen wat bekend is, en zegt hoeveel niet bekend is", () => {
  // Een gemiddelde invullen voor onbekende items zou de raming nauwkeuriger
  // laten lijken dan hij is.
  let boek = metPrijs(LEEG_PRIJSBOEK, "melk", prijs(1.20));
  boek = metPrijs(boek, "brood", prijs(1.80));
  const r = raamLijst(boek, [{ naam: "melk" }, { naam: "brood" }, { naam: "saffraan" }], "2026-08-25");
  assert.equal(r.euro, 3.0);
  assert.equal(r.bekend, 2);
  assert.equal(r.onbekend, 1);
});

test("een groter aantal schaalt de prijs mee", () => {
  const boek = metPrijs(LEEG_PRIJSBOEK, "melk", prijs(1.20, { aantal: 1 }));
  assert.equal(raamLijst(boek, [{ naam: "melk", hoev: 3 }], "2026-08-25").euro, 3.6);
});

test("een absurde factor schaalt niet mee", () => {
  // 500 gram tegen een prijs die per stuk is genoteerd zou anders 600 euro worden.
  const boek = metPrijs(LEEG_PRIJSBOEK, "kaas", prijs(2.50, { aantal: 1 }));
  assert.equal(raamLijst(boek, [{ naam: "kaas", hoev: 500 }], "2026-08-25").euro, 2.5);
});

test("oude prijzen worden geteld als verouderd", () => {
  const boek = metPrijs(LEEG_PRIJSBOEK, "melk", prijs(1.20, { datum: "2026-01-01" }));
  const r = raamLijst(boek, [{ naam: "melk" }], "2026-08-25");
  assert.equal(r.verouderd, 1);
  assert.equal(r.bekend, 1);
});

test("euro's worden geschreven zoals in Nederland", () => {
  assert.equal(euroTekst(3), "€ 3,00");
  assert.equal(euroTekst(12.5), "€ 12,50");
});
