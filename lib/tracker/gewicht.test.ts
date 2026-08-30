import { test } from "node:test";
import assert from "node:assert/strict";
import { metTrend, huidigeTrend, voortgang, tempoPerWeek, TREND_ALFA } from "./gewicht.ts";
import type { Weging } from "./gewicht.ts";

const w = (date: string, kg: number): Weging => ({ date, kg });

test("de eerste weging is zijn eigen trend", () => {
  const r = metTrend([w("2026-01-04", 95)]);
  assert.equal(r.length, 1);
  assert.equal(r[0].trend_kg, 95);
  assert.equal(r[0].delta_kg, 0);
});

test("de trend volgt het exponentieel voortschrijdend gemiddelde", () => {
  const r = metTrend([w("2026-01-04", 95), w("2026-01-11", 94)]);
  // 0,25 * 94 + 0,75 * 95 = 94,75
  assert.ok(Math.abs(r[1].trend_kg - 94.75) < 1e-9);
  assert.ok(Math.abs(r[1].delta_kg - -0.25) < 1e-9);
});

test("het verschil op de weegschaal staat los van het verschil in de trend", () => {
  // Precies het geval waar dit om begonnen is: 2,4 kilo lager op de weegschaal,
  // terwijl de trend maar 0,6 zakt. Beide getallen horen er te staan.
  const r = metTrend([w("2026-01-04", 100), w("2026-01-11", 97.6)]);
  assert.equal(r[0].delta_meting_kg, null, "de eerste weging heeft niets om mee te vergelijken");
  assert.ok(Math.abs(r[1].delta_meting_kg! - -2.4) < 1e-9);
  // De trend beweegt een kwart mee: 0,25 * 2,4 = 0,6.
  assert.ok(Math.abs(r[1].delta_kg - -0.6) < 1e-9);
});

test("het verschil op de weegschaal telt van meting tot meting, niet van trend tot trend", () => {
  // Twee keer hetzelfde gewicht: op de weegschaal is er niets veranderd, ook al
  // loopt de trend nog na te ijlen naar dat gewicht toe.
  const r = metTrend([w("2026-01-04", 100), w("2026-01-11", 96), w("2026-01-18", 96)]);
  assert.equal(r[2].delta_meting_kg, 0);
  assert.ok(r[2].delta_kg < 0, "de trend zakt nog door");
});

test("de trend dempt een uitschieter van een kilo", () => {
  // Vier stabiele wegingen, dan een vochtdag van +1,5 kg.
  const r = metTrend([
    w("2026-01-04", 95), w("2026-01-11", 95), w("2026-01-18", 95),
    w("2026-01-25", 95), w("2026-02-01", 96.5),
  ]);
  const laatste = r[r.length - 1];
  assert.equal(laatste.kg, 96.5);
  // De trend beweegt maar een kwart van de uitschieter mee.
  assert.ok(Math.abs(laatste.trend_kg - 95.375) < 1e-9);
  assert.ok(laatste.trend_kg < laatste.kg, "de trend moet onder de uitschieter blijven");
});

test("wegingen worden op datum gesorteerd voor de trend", () => {
  const doorElkaar = metTrend([w("2026-01-18", 93), w("2026-01-04", 95), w("2026-01-11", 94)]);
  const opVolgorde = metTrend([w("2026-01-04", 95), w("2026-01-11", 94), w("2026-01-18", 93)]);
  assert.deepEqual(doorElkaar.map((x) => x.date), opVolgorde.map((x) => x.date));
  assert.deepEqual(doorElkaar.map((x) => x.trend_kg), opVolgorde.map((x) => x.trend_kg));
});

test("bij een gestage afname loopt de trend achter op de meting", () => {
  const wegingen = [95, 94.5, 94, 93.5, 93].map((kg, i) => w(`2026-01-0${4 + i}`, kg));
  const r = metTrend(wegingen);
  const laatste = r[r.length - 1];
  assert.ok(laatste.trend_kg > laatste.kg, "de trend hoort na te ijlen bij een daling");
  // Maar hij loopt wel dezelfde kant op.
  assert.ok(r.every((x, i) => i === 0 || x.delta_kg < 0));
});

test("de alfa staat op een kwart", () => {
  assert.equal(TREND_ALFA, 0.25);
});

test("huidigeTrend geeft null zonder wegingen", () => {
  assert.equal(huidigeTrend([]), null);
  assert.equal(huidigeTrend([w("2026-01-04", 88)]), 88);
});

// -- voortgang ---------------------------------------------------------------

test("voortgang rekent de afgelegde weg naar het streefgewicht", () => {
  const v = voortgang(95, 90, 85);
  assert.equal(v.afgevallenKg, 5);
  assert.equal(v.teGaanKg, 5);
  assert.equal(v.aandeel, 0.5);
  assert.equal(v.bereikt, false);
});

test("op het streefgewicht is de voortgang compleet", () => {
  const v = voortgang(95, 85, 85);
  assert.equal(v.aandeel, 1);
  assert.equal(v.teGaanKg, 0);
  assert.equal(v.bereikt, true);
});

test("onder het streefgewicht blijft het aandeel op een", () => {
  const v = voortgang(95, 82, 85);
  assert.equal(v.aandeel, 1);
  assert.equal(v.teGaanKg, 0);
  assert.equal(v.bereikt, true);
});

test("aankomen levert geen negatief aandeel op", () => {
  const v = voortgang(95, 97, 85);
  assert.equal(v.aandeel, 0);
  assert.equal(v.afgevallenKg, -2);
  assert.equal(v.teGaanKg, 12);
});

test("een streefgewicht boven het startgewicht laat het aandeel op een staan", () => {
  const v = voortgang(80, 80, 85);
  assert.equal(v.aandeel, 1);
  assert.equal(v.bereikt, true);
});

// -- tempo -------------------------------------------------------------------

test("tempo blijft null bij te weinig of te korte historie", () => {
  assert.equal(tempoPerWeek([]), null);
  assert.equal(tempoPerWeek([w("2026-01-04", 95)]), null);
  // Twee wegingen binnen een week zeggen nog niets.
  assert.equal(tempoPerWeek([w("2026-01-04", 95), w("2026-01-07", 94)]), null);
});

test("tempo rekent de afname per week over de trend", () => {
  // Vier weken, elke week een kilo eraf.
  const wegingen = [
    w("2026-01-04", 95), w("2026-01-11", 94), w("2026-01-18", 93),
    w("2026-01-25", 92), w("2026-02-01", 91),
  ];
  const tempo = tempoPerWeek(wegingen);
  assert.ok(tempo != null);
  // De trend ijlt na, dus het gemeten tempo ligt onder de kilo per week,
  // maar wel duidelijk positief en in de goede orde van grootte.
  assert.ok(tempo > 0.4 && tempo < 1.0, `tempo ${tempo}`);
});

test("aankomen geeft een negatief tempo", () => {
  const tempo = tempoPerWeek([
    w("2026-01-04", 90), w("2026-01-11", 91), w("2026-01-18", 92),
  ]);
  assert.ok(tempo != null && tempo < 0);
});
