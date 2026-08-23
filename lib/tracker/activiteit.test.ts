import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITEITEN, vindActiviteit, berekenVerbranding, activiteitPunten,
  dagBewegingspunten, MAX_BEWEGINGSPUNTEN_PER_DAG,
} from "./activiteit.ts";
import type { Activity } from "./types.ts";

// Profiel uit de eerdere tests: 95 kg, basaal metabolisme 1868,75 kcal.
const GEWICHT = 95;
const BMR = 1868.75;

test("de MET-tabel staat compleet en plausibel", () => {
  assert.equal(ACTIVITEITEN.length, 8);
  for (const a of ACTIVITEITEN) {
    assert.ok(a.met >= 3 && a.met <= 12, `${a.naam}: MET ${a.met} onwaarschijnlijk`);
    assert.ok(a.naam.length > 0);
  }
  assert.equal(vindActiviteit("hardlopen")?.met, 9.5);
  assert.equal(vindActiviteit("bestaat-niet"), undefined);
});

test("de rustverbranding gaat van de bruto verbranding af", () => {
  // Een uur stevig wandelen (MET 5) bij 95 kg: 475 kcal bruto.
  const v = berekenVerbranding(5, GEWICHT, 60, BMR);
  assert.ok(Math.abs(v.bruttoKcal - 475) < 0.01);
  // Rust in datzelfde uur: 1868,75 / 24 = 77,86 kcal.
  assert.ok(Math.abs(v.rustKcal - 77.865) < 0.01);
  assert.ok(Math.abs(v.nettoKcal - 397.135) < 0.01);
  assert.ok(v.nettoKcal < v.bruttoKcal, "netto hoort onder bruto te liggen");
});

test("rust levert geen punten op, ook al lopen de twee maatstaven niet gelijk", () => {
  // De MET-schaal en Mifflin-St Jeor zijn het niet precies eens over
  // rustverbranding: MET 1 komt voor 95 kg op 95 kcal per uur uit, Mifflin op
  // 77,9. Er blijft dus een restje staan na de aftrek. Dat is inherent aan het
  // combineren van twee conventies en geen fout, maar het is klein genoeg om
  // op nul punten af te ronden — precies wat je wilt.
  const v = berekenVerbranding(1, GEWICHT, 60, BMR);
  assert.ok(v.nettoKcal > 0 && v.nettoKcal < 25, `restje ${v.nettoKcal} kcal`);
  assert.equal(activiteitPunten(1, GEWICHT, 60, BMR), 0);
});

test("bij zeer lichte inspanning is de aftrek aan de zuinige kant", () => {
  // Keerzijde van hetzelfde verschil: MET 1,5 — nauwelijks meer dan staan —
  // levert al twee punten op. De lichtste activiteit in de keuzelijst is
  // wandelen op MET 3,5, dus in de app is dit niet te kiezen. Het is wel de
  // reden dat het dagplafond van zes punten er staat.
  assert.equal(activiteitPunten(1.5, GEWICHT, 60, BMR), 2);
  assert.ok(ACTIVITEITEN.every((a) => a.met >= 3.5), "de lijst begint bij MET 3,5");
});

test("de aftrek scheelt echt iets bij een gewone activiteit", () => {
  // Zonder de rustaftrek zou een uur wandelen bijna twee punten meer geven.
  const met = berekenVerbranding(3.5, GEWICHT, 60, BMR);
  const zonderAftrek = Math.round(0.024 * met.bruttoKcal);
  const metAftrek = activiteitPunten(3.5, GEWICHT, 60, BMR);
  assert.ok(zonderAftrek - metAftrek >= 1, `${zonderAftrek} versus ${metAftrek}`);
});

test("punten volgen dezelfde caloriecoefficient als het eten", () => {
  // 397,135 netto kcal x 0,024 = 9,53 -> 10 punten (nog ongeplafonneerd).
  assert.equal(activiteitPunten(5, GEWICHT, 60, BMR), 10);
  // Een half uur is ongeveer de helft.
  assert.equal(activiteitPunten(5, GEWICHT, 30, BMR), 5);
});

test("de puntenschaal werkt door op bewegingspunten", () => {
  assert.equal(activiteitPunten(5, GEWICHT, 60, BMR, 1.0), 10);
  assert.equal(activiteitPunten(5, GEWICHT, 60, BMR, 0.75), 7);
});

test("nul of negatieve duur levert nul punten", () => {
  assert.equal(activiteitPunten(9.5, GEWICHT, 0, BMR), 0);
  assert.equal(activiteitPunten(9.5, GEWICHT, -30, BMR), 0);
});

test("een zwaarder lichaam verbrandt meer bij dezelfde inspanning", () => {
  const licht = activiteitPunten(6, 65, 60, 1500);
  const zwaar = activiteitPunten(6, 110, 60, 2000);
  assert.ok(zwaar > licht);
});

// -- het dagplafond ----------------------------------------------------------

function act(punten: number): Activity {
  return { id: String(Math.random()), ts: 0, name: "test", met: 5, minutes: 60, points: punten };
}

test("onder het plafond telt alles gewoon mee", () => {
  const d = dagBewegingspunten([act(2), act(3)]);
  assert.equal(d.ruw, 5);
  assert.equal(d.meetellend, 5);
  assert.equal(d.afgetopt, false);
});

test("boven het plafond telt er maar zes mee", () => {
  const d = dagBewegingspunten([act(10), act(8)]);
  assert.equal(d.ruw, 18);
  assert.equal(d.meetellend, MAX_BEWEGINGSPUNTEN_PER_DAG);
  assert.equal(d.meetellend, 6);
  assert.equal(d.afgetopt, true);
});

test("precies op het plafond telt niet als afgetopt", () => {
  const d = dagBewegingspunten([act(6)]);
  assert.equal(d.meetellend, 6);
  assert.equal(d.afgetopt, false);
});

test("een dag zonder beweging is nul", () => {
  const d = dagBewegingspunten([]);
  assert.equal(d.ruw, 0);
  assert.equal(d.meetellend, 0);
  assert.equal(d.afgetopt, false);
});

test("een marathon aan sport kan het tekort niet wegeten", () => {
  // Drie uur hardlopen zou ruim vijftig punten opleveren; er tellen er zes mee.
  const punten = activiteitPunten(9.5, GEWICHT, 180, BMR);
  assert.ok(punten > 40, `verwachtte een hoge ruwe waarde, kreeg ${punten}`);
  assert.equal(dagBewegingspunten([act(punten)]).meetellend, 6);
});
