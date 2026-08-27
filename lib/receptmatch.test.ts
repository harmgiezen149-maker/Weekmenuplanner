import { strict as assert } from "node:assert";
import { test } from "node:test";
import { scoorRecept, woorden, zoekRecept } from "./receptmatch.ts";
import type { Recept } from "./types.ts";

function recept(titel: string, ingredienten: string[] = [], maaltijd = "Avondeten"): Recept {
  return {
    id: titel, titel, keuken: "Italiaans", hoofd: "Pasta", maaltijd,
    moeilijkheid: "Makkelijk", tijd: 30, score: 3, personen: 4, gegeten: 0, afbeelding: "",
    ingredienten: ingredienten.map((naam) => ({ naam, hoev: 1, eenheid: "stuk" })),
    bereiding: "",
  };
}

const KOOKBOEK = [
  recept("Pastasalade met feta en olijven", ["pasta", "feta", "olijven", "tomaat"]),
  recept("Tortellini met roomsaus", ["tortellini", "room", "kaas"]),
  recept("Lasagne met spinazie en gehakt", ["spinazie", "gehakt", "lasagnebladen", "tomaat"]),
  recept("Tomatensoep", ["tomaat", "ui", "bouillon"]),
  recept("Kip met rijst en broccoli", ["kipfilet", "rijst", "broccoli"]),
  recept("Yoghurt met muesli", ["yoghurt", "muesli"], "Ontbijt"),
];

test("losse woorden worden gefilterd op wat onderscheidt", () => {
  assert.deepEqual(woorden("Pasta met feta en olijven"), ["pasta", "feta", "olijven"]);
  assert.deepEqual(woorden(""), []);
});

test("een titel die er los geschreven staat wordt gevonden", () => {
  // Op het briefje "pasta salade", in het kookboek "Pastasalade".
  const uit = zoekRecept("pasta salade", KOOKBOEK);
  assert.equal(uit.zekerheid, "zeker");
  assert.equal(uit.beste?.recept.titel, "Pastasalade met feta en olijven");
});

test("één woord dat een recept eenduidig aanwijst is genoeg", () => {
  const uit = zoekRecept("tortellini", KOOKBOEK);
  assert.equal(uit.zekerheid, "zeker");
  assert.equal(uit.beste?.recept.titel, "Tortellini met roomsaus");
});

test("een rijtje ingrediënten wijst naar het gerecht, maar met een vraag erbij", () => {
  // "spinazie, gehakt, pasta" is geen titel; de app hoort te vragen of dit
  // bedoeld werd in plaats van het stilletjes in te vullen.
  const uit = zoekRecept("spinazie, gehakt, pasta", KOOKBOEK);
  assert.notEqual(uit.zekerheid, "niets");
  assert.equal(uit.beste?.recept.titel, "Lasagne met spinazie en gehakt");
});

test("staat er niets dat erop lijkt, dan zegt de app dat ook", () => {
  const uit = zoekRecept("bapao van de toko", KOOKBOEK);
  assert.equal(uit.zekerheid, "niets");
  assert.equal(uit.beste, null);
});

test("een lege regel levert niets op", () => {
  const uit = zoekRecept("   ", KOOKBOEK);
  assert.equal(uit.zekerheid, "niets");
  assert.equal(uit.alternatieven.length, 0);
});

test("twee die vlak bij elkaar liggen leveren een vraag op, geen keuze", () => {
  // Een app die bij twijfel toch invult zet stilletjes het verkeerde gerecht
  // op woensdag, en dat merk je pas in de winkel.
  const dubbel = [recept("Tomatensoep", ["tomaat"]), recept("Tomatensaus", ["tomaat"])];
  const uit = zoekRecept("tomaten", dubbel);
  assert.equal(uit.zekerheid, "misschien");
  assert.equal(uit.alternatieven.length, 2);
});

test("een ontbijtrecept wint nooit van een avondgerecht", () => {
  // Een weekmenu gaat over avondeten.
  const uit = zoekRecept("yoghurt muesli", KOOKBOEK);
  assert.equal(uit.beste?.recept.maaltijd !== "Ontbijt" || uit.beste === null, true);
});

test("zonder avondgerechten wordt er wel in de rest gezocht", () => {
  const alleenOntbijt = [recept("Yoghurt met muesli", ["yoghurt"], "Ontbijt")];
  assert.equal(zoekRecept("yoghurt", alleenOntbijt).beste?.recept.titel, "Yoghurt met muesli");
});

test("de alternatieven staan op volgorde van hoe goed ze passen", () => {
  const uit = zoekRecept("tomaat", KOOKBOEK);
  const scores = uit.alternatieven.map((a) => a.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
});

test("een langer briefje wint niet vanzelf van een korter", () => {
  // Zonder delen door het aantal gezochte woorden scoort elk lang stuk tekst
  // hoog, ongeacht hoe goed het past.
  const kort = scoorRecept("tortellini", KOOKBOEK[1]);
  const lang = scoorRecept("tortellini met van alles en nog wat erbij vandaag", KOOKBOEK[1]);
  assert.ok(kort > lang, `${kort} hoort hoger te zijn dan ${lang}`);
});
