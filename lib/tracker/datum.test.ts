import { test } from "node:test";
import assert from "node:assert/strict";
import { datumSleutel, geldigeDatum, verschuifDatum, isoWeek, nl, nlKg } from "./datum.ts";

test("datumSleutel schrijft de lokale dag, niet de UTC-dag", () => {
  const d = new Date(2026, 0, 5, 23, 30);
  assert.equal(datumSleutel(d), "2026-01-05");
});

test("geldigeDatum accepteert alleen YYYY-MM-DD", () => {
  assert.ok(geldigeDatum("2026-08-25"));
  assert.ok(!geldigeDatum("25-08-2026"));
  assert.ok(!geldigeDatum(null));
  assert.ok(!geldigeDatum(20260825));
});

test("verschuifDatum loopt over maand- en jaargrenzen", () => {
  assert.equal(verschuifDatum("2026-08-25", 7), "2026-09-01");
  assert.equal(verschuifDatum("2026-01-01", -1), "2025-12-31");
  assert.equal(verschuifDatum("2026-08-25", -83), "2026-06-03");
});

test("isoWeek nummert de week waarin de donderdag valt", () => {
  assert.equal(isoWeek("2026-08-25"), "2026-W35");
  assert.equal(isoWeek("2026-08-23"), "2026-W34"); // zondag hoort bij de vorige week
  assert.equal(isoWeek("2026-08-24"), "2026-W35"); // maandag begint de nieuwe
});

test("isoWeek houdt een week rond de jaarwisseling bij elkaar", () => {
  // 1 januari 2027 is een vrijdag en hoort nog bij week 53 van 2026.
  assert.equal(isoWeek("2026-12-31"), "2026-W53");
  assert.equal(isoWeek("2027-01-01"), "2026-W53");
  assert.equal(isoWeek("2027-01-04"), "2027-W01");
  // 4 januari valt altijd in week 1.
  assert.equal(isoWeek("2026-01-04"), "2026-W01");
  assert.equal(isoWeek("2026-01-05"), "2026-W02");
});

test("nl en nlKg schrijven Nederlandse getallen", () => {
  assert.equal(nl(1.25), "1,3");
  assert.equal(nl(12), "12");
  assert.equal(nlKg(88), "88,0");
});
