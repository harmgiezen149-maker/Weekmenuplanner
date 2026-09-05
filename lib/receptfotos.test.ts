import { test } from "node:test";
import assert from "node:assert/strict";
import { fotoPad, zonderFoto, nieuweFotoWaarde, leesDataUrl } from "./receptfotos.ts";
import type { Recept } from "./types.ts";

const RECEPT: Recept = {
  id: "r1", titel: "Lasagne", keuken: "Italiaans", hoofd: "Pasta",
  maaltijd: "Avondeten", moeilijkheid: "Gemiddeld", tijd: 60, score: 0,
  personen: 4, gegeten: 0, afbeelding: "data:image/jpeg;base64,AAAA",
  ingredienten: [], bereiding: "",
};

test("de foto gaat eruit en de vlag erin", () => {
  const uit = zonderFoto(RECEPT);
  assert.equal(uit.afbeelding, "");
  assert.equal(uit.heeftFoto, true);
  // De rest blijft ongemoeid.
  assert.equal(uit.titel, "Lasagne");
  assert.equal(uit.personen, 4);
});

test("een recept zonder foto krijgt de vlag op onwaar", () => {
  assert.equal(zonderFoto({ ...RECEPT, afbeelding: "" }).heeftFoto, false);
});

test("het adres van de foto", () => {
  assert.equal(fotoPad("r1"), "/api/recipes/r1/foto");
  assert.equal(fotoPad("a b"), "/api/recipes/a%20b/foto");
});

test("opslaan overschrijft de foto niet met zijn eigen adres", () => {
  // Dit is het geval waar het om draait: het formulier kreeg het pad te zien
  // en stuurt het ongewijzigd terug. Zou dat opgeslagen worden, dan was de
  // foto weg.
  assert.equal(nieuweFotoWaarde("/api/recipes/r1/foto", "data:image/jpeg;base64,AAAA"),
    "data:image/jpeg;base64,AAAA");
});

test("een nieuwe foto vervangt de oude, en leeg wist hem", () => {
  assert.equal(nieuweFotoWaarde("data:image/png;base64,BBBB", "data:image/jpeg;base64,AAAA"),
    "data:image/png;base64,BBBB");
  assert.equal(nieuweFotoWaarde("", "data:image/jpeg;base64,AAAA"), "");
});

test("een veld dat niet meekomt laat de foto staan", () => {
  assert.equal(nieuweFotoWaarde(undefined, "data:image/jpeg;base64,AAAA"),
    "data:image/jpeg;base64,AAAA");
  assert.equal(nieuweFotoWaarde(null, "data:image/jpeg;base64,AAAA"),
    "data:image/jpeg;base64,AAAA");
});

test("een data-url valt uiteen in soort en bytes", () => {
  const uit = leesDataUrl("data:image/png;base64," + Buffer.from("hallo").toString("base64"));
  assert.equal(uit?.type, "image/png");
  assert.equal(uit?.bytes.toString("utf8"), "hallo");
});

test("wat geen bruikbare data-url is levert niets op", () => {
  assert.equal(leesDataUrl(""), null);
  assert.equal(leesDataUrl("/api/recipes/r1/foto"), null);
  assert.equal(leesDataUrl("data:image/png;base64,"), null);
});
