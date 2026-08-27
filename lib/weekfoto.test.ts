import { strict as assert } from "node:assert";
import { test } from "node:test";
import { herkenDag, leesWeekfoto } from "./weekfoto.ts";
import { zoekRecept } from "./receptmatch.ts";
import type { Recept } from "./types";

test("afkortingen van een briefje worden herkend", () => {
  assert.equal(herkenDag("ma"), "Maandag");
  assert.equal(herkenDag("Di"), "Dinsdag");
  assert.equal(herkenDag("wo."), "Woensdag");
  assert.equal(herkenDag("do:"), "Donderdag");
  assert.equal(herkenDag("vrijdag"), "Vrijdag");
  assert.equal(herkenDag("ZA"), "Zaterdag");
  assert.equal(herkenDag("zo"), "Zondag");
});

test("wat geen dag is telt niet als dag", () => {
  for (const w of ["", "  ", "pasta", "x", "12"]) {
    assert.equal(herkenDag(w), null, w);
  }
});

test("een gelezen briefje levert altijd zeven dagen op", () => {
  // Lege dagen zijn geen ontbrekende regels maar informatie: er valt nog iets
  // in te vullen, en dat hoort zichtbaar te zijn.
  const dagen = leesWeekfoto(JSON.stringify({
    dagen: [{ dag: "za", gerecht: "pasta salade" }, { dag: "ma", gerecht: "tortellini" }],
  }));
  assert.equal(dagen.length, 7);
  assert.deepEqual(dagen.map((d) => d.dag),
    ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"]);
  assert.equal(dagen.find((d) => d.dag === "Zaterdag")?.tekst, "pasta salade");
  assert.equal(dagen.find((d) => d.dag === "Dinsdag")?.tekst, "");
});

test("het briefje uit de praktijk wordt gelezen", () => {
  const dagen = leesWeekfoto(JSON.stringify({
    dagen: [
      { dag: "vr", gerecht: "" },
      { dag: "za", gerecht: "pasta salade" },
      { dag: "zo", gerecht: "" },
      { dag: "ma", gerecht: "tortellini" },
      { dag: "di", gerecht: "" },
      { dag: "wo", gerecht: "spinazie, gehakt, pasta" },
      { dag: "do", gerecht: "tomaten" },
    ],
  }));
  const bij = (d: string) => dagen.find((x) => x.dag === d)?.tekst;
  assert.equal(bij("Zaterdag"), "pasta salade");
  assert.equal(bij("Maandag"), "tortellini");
  assert.equal(bij("Woensdag"), "spinazie, gehakt, pasta");
  assert.equal(bij("Donderdag"), "tomaten");
  assert.equal(bij("Vrijdag"), "");
});

test("een tweede lege regel wist de eerste niet", () => {
  const dagen = leesWeekfoto(JSON.stringify({
    dagen: [{ dag: "wo", gerecht: "tortellini" }, { dag: "wo", gerecht: "" }],
  }));
  assert.equal(dagen.find((d) => d.dag === "Woensdag")?.tekst, "tortellini");
});

test("een kale lijst zonder omhulsel wordt ook gelezen", () => {
  const dagen = leesWeekfoto('[{"dag":"ma","gerecht":"soep"}]');
  assert.equal(dagen.find((d) => d.dag === "Maandag")?.tekst, "soep");
});

test("tekst of markdown eromheen maakt niet uit", () => {
  const dagen = leesWeekfoto('Hier:\n```json\n{"dagen":[{"dag":"do","gerecht":"vis"}]}\n```');
  assert.equal(dagen.find((d) => d.dag === "Donderdag")?.tekst, "vis");
});

test("onzin levert zeven lege dagen op in plaats van een fout", () => {
  for (const t of ["", "geen idee", "{kapot", "null"]) {
    const dagen = leesWeekfoto(t);
    assert.equal(dagen.length, 7, t);
    assert.equal(dagen.every((d) => d.tekst === ""), true, t);
  }
});

test("het briefje van een echte week: lezen en koppelen in één keer", () => {
  // Precies wat er op het papieren briefje stond: drie dagen leeg, één naam die
  // los geschreven is, één rijtje ingrediënten en één gerecht dat nog niet in
  // het kookboek staat.
  const antwoord = JSON.stringify({
    dagen: [
      { dag: "vr", gerecht: "" },
      { dag: "za", gerecht: "pasta salade" },
      { dag: "zo", gerecht: "" },
      { dag: "ma", gerecht: "tortellini" },
      { dag: "di", gerecht: "" },
      { dag: "wo", gerecht: "spinazie, gehakt, pasta" },
      { dag: "do", gerecht: "tomaten" },
    ],
  });

  const recepten = [
    receptje("r1", "Pastasalade met feta en olijven", ["pasta", "feta", "olijven"]),
    receptje("r2", "Tortellini met spinazie en ricotta", ["tortellini", "spinazie", "ricotta"]),
  ];

  const dagen = leesWeekfoto(antwoord);
  const per = new Map(dagen.map((d) => [d.dag, d.tekst]));
  assert.equal(dagen.length, 7);
  assert.equal(per.get("Vrijdag"), "");
  assert.equal(per.get("Woensdag"), "spinazie, gehakt, pasta");

  // Een losgeschreven naam wordt zonder vragen gevonden.
  assert.equal(zoekRecept(per.get("Zaterdag")!, recepten).zekerheid, "zeker");
  // Een rijtje ingrediënten past op meer dan één recept: dat is een vraag.
  assert.equal(zoekRecept(per.get("Woensdag")!, recepten).zekerheid, "misschien");
  // En wat er niet is, wordt niet verzonnen.
  assert.equal(zoekRecept(per.get("Donderdag")!, recepten).zekerheid, "niets");
});

function receptje(id: string, titel: string, ingredienten: string[]): Recept {
  return {
    id, titel, keuken: "Italiaans", hoofd: "Vegetarisch", maaltijd: "Avondeten",
    moeilijkheid: "Makkelijk", tijd: 25, score: 4, personen: 4, gegeten: 0, afbeelding: "",
    bereiding: "", ingredienten: ingredienten.map((naam) => ({ naam, hoev: 1, eenheid: "stuk" })),
  };
}
