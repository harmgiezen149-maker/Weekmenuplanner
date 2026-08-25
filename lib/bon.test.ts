import { strict as assert } from "node:assert";
import { test } from "node:test";
import { herkenWinkel, isProductregel, leesBon } from "./bon.ts";

test("een gewone bon wordt uitgelezen", () => {
  const bon = leesBon(JSON.stringify({
    winkel: "Albert Heijn", datum: "2026-08-25",
    regels: [
      { naam: "Halfvolle melk", aantal: 2, eenheid: "l", prijs: 2.38 },
      { naam: "Volkorenbrood", aantal: 1, eenheid: "stuk", prijs: 1.79 },
    ],
  }));
  assert.equal(bon.winkel, "AH");
  assert.equal(bon.datum, "2026-08-25");
  assert.equal(bon.regels.length, 2);
  assert.equal(bon.regels[0].prijs, 2.38);
});

test("regels die geen product zijn vallen af", () => {
  // Zonder deze zeef belandt "TOTAAL 43,71" als artikel in je voorraad.
  for (const naam of [
    "TOTAAL", "Subtotaal", "Statiegeld", "BONUS KORTING", "PIN", "Te betalen",
    "Emballage retour", "BTW 9%", "21,45", "Aantal artikelen 14", "Afronding",
  ]) {
    assert.equal(isProductregel(naam), false, naam);
  }
});

test("producten met een lastig woord erin blijven staan", () => {
  // "bonbons" mag niet sneuvelen op "bon", "actievlees" niet op "actie".
  for (const naam of ["Bonbons", "Bonensoep", "Totaalbrood", "Pindakaas", "Rode bieten"]) {
    assert.equal(isProductregel(naam), true, naam);
  }
});

test("de zeef werkt ook op het eindresultaat", () => {
  const bon = leesBon(JSON.stringify({
    winkel: "Jumbo", datum: "2026-08-25",
    regels: [
      { naam: "Appels", aantal: 6, eenheid: "stuk", prijs: 2.5 },
      { naam: "STATIEGELD", aantal: 1, eenheid: "stuk", prijs: 0.25 },
      { naam: "TOTAAL", aantal: 1, eenheid: "stuk", prijs: 2.75 },
    ],
  }));
  assert.deepEqual(bon.regels.map((r) => r.naam), ["Appels"]);
});

test("onleesbare of ontbrekende velden worden opgevangen", () => {
  const bon = leesBon(JSON.stringify({
    regels: [
      { naam: "Kaas" },
      { naam: "", aantal: 2 },
      { aantal: 3 },
      "onzin",
      { naam: "Yoghurt", aantal: -4, prijs: "onleesbaar" },
    ],
  }));
  assert.deepEqual(bon.regels.map((r) => r.naam), ["Kaas", "Yoghurt"]);
  assert.equal(bon.regels[0].aantal, 1);
  assert.equal(bon.regels[0].eenheid, "stuk");
  assert.equal(bon.regels[0].prijs, null);
  assert.equal(bon.regels[1].aantal, 1);
  assert.equal(bon.regels[1].prijs, null);
});

test("alleen een afdeling die de app kent komt door", () => {
  // Een verzonnen afdeling zou de sortering op looproute stilletjes breken.
  const bon = leesBon(JSON.stringify({
    regels: [
      { naam: "Melk", gebied: "Zuivel & koeling" },
      { naam: "Kruiden", gebied: "Specerijenhoek" },
      { naam: "Brood" },
    ],
  }));
  assert.equal(bon.regels[0].gebied, "Zuivel & koeling");
  assert.equal(bon.regels[1].gebied, "");
  assert.equal(bon.regels[2].gebied, "");
});

test("een prijs met een euroteken of komma wordt gelezen", () => {
  const bon = leesBon(JSON.stringify({
    regels: [{ naam: "Kip", prijs: "€ 6,49" }, { naam: "Rijst", prijs: "1.29" }],
  }));
  assert.equal(bon.regels[0].prijs, 6.49);
  assert.equal(bon.regels[1].prijs, 1.29);
});

test("een absurd bedrag telt als niet gelezen", () => {
  // Een misgelezen bon levert eerder 4371 dan 43,71 op; dan liever niets.
  const bon = leesBon(JSON.stringify({ regels: [{ naam: "Koffie", prijs: 4371 }] }));
  assert.equal(bon.regels[0].prijs, null);
});

test("een antwoord met tekst of markdown eromheen wordt toch gelezen", () => {
  const bon = leesBon('Hier is de bon:\n```json\n{"regels":[{"naam":"Ei","aantal":10}]}\n```\n');
  assert.equal(bon.regels.length, 1);
  assert.equal(bon.regels[0].aantal, 10);
});

test("onzin levert een lege bon op in plaats van een fout", () => {
  for (const t of ["", "geen idee", "{kapot", "null"]) {
    assert.deepEqual(leesBon(t).regels, [], t);
  }
});

test("winkelnamen worden teruggebracht tot wat de app kent", () => {
  assert.equal(herkenWinkel("Albert Heijn 1234"), "AH");
  assert.equal(herkenWinkel("AH to go"), "AH");
  assert.equal(herkenWinkel("JUMBO Supermarkten"), "Jumbo");
  assert.equal(herkenWinkel("Lidl Nederland"), "Lidl");
  assert.equal(herkenWinkel("Poiesz"), "");
});
