import { test } from "node:test";
import assert from "node:assert/strict";
import { stuknaam, stukEenheid, naamUitStukEenheid } from "./portie.ts";

test("het voorloopgetal verdwijnt uit de stuksnaam", () => {
  assert.equal(stuknaam("1 snee"), "snee");
  assert.equal(stuknaam("1 ei"), "ei");
  assert.equal(stuknaam("2 biscuits"), "biscuits");
  assert.equal(stuknaam("1 opscheplepel"), "opscheplepel");
});

test("een label dat alleen een gewicht is levert geen naam op", () => {
  // "3 × 30 g" bij een regel van 90 gram zou als een tegenspraak lezen.
  assert.equal(stuknaam("30 g"), "stuk");
  assert.equal(stuknaam("250 ml"), "stuk");
  assert.equal(stuknaam("1,5 dl"), "stuk");
});

test("een gewicht tussen haakjes telt niet mee als naam", () => {
  assert.equal(stuknaam("1 portion (30 g)"), "portion");
  assert.equal(stuknaam("(35 g)"), "stuk");
});

test("zonder label blijft het een stuk", () => {
  assert.equal(stuknaam(undefined), "stuk");
  assert.equal(stuknaam(""), "stuk");
  assert.equal(stuknaam("   "), "stuk");
});

test("de eenheid komt met een maalteken in het logboek", () => {
  assert.equal(stukEenheid("snee"), "× snee");
  assert.equal(stukEenheid(""), "× stuk");
});

test("een per stuk gelogde regel is aan zijn eenheid te herkennen", () => {
  assert.equal(naamUitStukEenheid("× snee"), "snee");
  assert.equal(naamUitStukEenheid("×"), "stuk");
  assert.equal(naamUitStukEenheid("g"), null);
  assert.equal(naamUitStukEenheid("porties"), null);
});

test("een uitzinnig lang label wordt afgekapt", () => {
  assert.equal(stuknaam("1 " + "a".repeat(60)).length, 24);
});
