import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  datumsVanWeek, geldigeWeek, maandagVan, maandagVanWeek, verschuifWeek, weekLabel, weekVan,
} from "./weeksleutel.ts";

test("de week van een datum klopt met de agenda", () => {
  // 2026-08-25 is een dinsdag in week 35.
  assert.equal(weekVan("2026-08-25"), "2026-W35");
  assert.equal(weekVan("2026-08-24"), "2026-W35"); // maandag
  assert.equal(weekVan("2026-08-30"), "2026-W35"); // zondag
  assert.equal(weekVan("2026-08-31"), "2026-W36"); // volgende maandag
});

test("rond de jaarwisseling volgt de telling de ISO-regel", () => {
  // 4 januari ligt per definitie in week 1; 1 januari 2027 is een vrijdag en
  // valt daarmee nog in week 53 van 2026.
  assert.equal(weekVan("2027-01-01"), "2026-W53");
  assert.equal(weekVan("2027-01-04"), "2027-W01");
});

test("de maandag van een week en van een datum komen overeen", () => {
  assert.equal(maandagVan("2026-08-27"), "2026-08-24");
  assert.equal(maandagVanWeek("2026-W35"), "2026-08-24");
  assert.equal(maandagVanWeek(weekVan("2026-08-27")), maandagVan("2026-08-27"));
});

test("een week vooruit gaat over de jaargrens heen goed", () => {
  // Via de maandag rekenen en niet via het nummer: 2026 heeft 53 weken.
  assert.equal(verschuifWeek("2026-W52", 1), "2026-W53");
  assert.equal(verschuifWeek("2026-W53", 1), "2027-W01");
  assert.equal(verschuifWeek("2027-W01", -1), "2026-W53");
});

test("heen en terug komt op dezelfde week uit", () => {
  for (const w of ["2026-W01", "2026-W35", "2026-W53", "2027-W01"]) {
    assert.equal(verschuifWeek(verschuifWeek(w, 3), -3), w, w);
  }
});

test("een week heeft zeven opeenvolgende datums, maandag eerst", () => {
  const d = datumsVanWeek("2026-W35");
  assert.equal(d.length, 7);
  assert.equal(d[0], "2026-08-24");
  assert.equal(d[6], "2026-08-30");
});

test("alleen een echte weeksleutel telt", () => {
  assert.equal(geldigeWeek("2026-W35"), true);
  assert.equal(geldigeWeek("2026-W53"), true);
  assert.equal(geldigeWeek("2026-W54"), false);
  assert.equal(geldigeWeek("2026-W00"), false);
  assert.equal(geldigeWeek("2026-35"), false);
  assert.equal(geldigeWeek(""), false);
  assert.equal(geldigeWeek(null), false);
});

test("een week heet zoals je hem zou noemen", () => {
  // "Week 35" zegt niemand iets, "deze week" iedereen.
  assert.equal(weekLabel("2026-W35", "2026-08-25"), "Deze week");
  assert.equal(weekLabel("2026-W36", "2026-08-25"), "Volgende week");
  assert.equal(weekLabel("2026-W34", "2026-08-25"), "Vorige week");
  assert.match(weekLabel("2026-W37", "2026-08-25"), /^Week 37 · 7 sep t\/m 13 sep$/);
});
