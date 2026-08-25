import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  bepaalHerinnering, normaliseerVoorkeur, STANDAARD_VOORKEUR,
} from "./herinnering.ts";
import type { HerinneringInvoer, HerinneringSoort } from "./herinnering.ts";

// 2026-08-23 is een zondag, 2026-08-25 een dinsdag.
const ZONDAG = "2026-08-23";
const DINSDAG = "2026-08-25";

function invoer(over: Partial<HerinneringInvoer> = {}): HerinneringInvoer {
  return {
    soort: "logboek",
    voorkeur: { weegdag: true, logboek: true },
    profiel: { weigh_day: 6 },  // zondag
    vandaag: DINSDAG,
    alGewogenVandaag: false,
    regelsVandaag: 0,
    gelogdeDagenLaatste7: 5,
    alGestuurdVandaag: null,
    ...over,
  };
}

test("standaard staat alles uit", () => {
  assert.deepEqual(STANDAARD_VOORKEUR, { weegdag: false, logboek: false });
  assert.equal(bepaalHerinnering(invoer({ voorkeur: STANDAARD_VOORKEUR })), null);
});

test("een lege dag levert een logherinnering", () => {
  const h = bepaalHerinnering(invoer());
  assert.ok(h);
  assert.equal(h.soort, "logboek");
  assert.equal(h.pad, "/tracker");
});

test("een dag met regels erin levert niets", () => {
  assert.equal(bepaalHerinnering(invoer({ regelsVandaag: 1 })), null);
});

test("wie al een week niets logt krijgt geen logherinnering", () => {
  // Anders wordt de app een dagelijks standje tegen iemand die pauzeert.
  assert.equal(bepaalHerinnering(invoer({ gelogdeDagenLaatste7: 0 })), null);
});

test("op de weegdag zonder weging komt de weegherinnering", () => {
  const h = bepaalHerinnering(invoer({ soort: "weegdag", vandaag: ZONDAG }));
  assert.ok(h);
  assert.equal(h.soort, "weegdag");
  assert.equal(h.pad, "/tracker/gewicht");
});

test("op een andere dag dan de weegdag komt er niets", () => {
  assert.equal(bepaalHerinnering(invoer({ soort: "weegdag", vandaag: DINSDAG })), null);
});

test("al gewogen op de weegdag: geen melding", () => {
  assert.equal(
    bepaalHerinnering(invoer({ soort: "weegdag", vandaag: ZONDAG, alGewogenVandaag: true })),
    null
  );
});

test("de weegdag volgt het profiel, niet de zondag", () => {
  // weigh_day 1 = dinsdag in onze telling (0 = maandag).
  const h = bepaalHerinnering(invoer({
    soort: "weegdag", vandaag: DINSDAG, profiel: { weigh_day: 1 },
  }));
  assert.ok(h);
});

test("dezelfde soort gaat hooguit één keer per dag", () => {
  assert.equal(bepaalHerinnering(invoer({ alGestuurdVandaag: "logboek" })), null);
  // Een andere soort mag er die dag nog wel bij.
  assert.ok(bepaalHerinnering(invoer({
    soort: "weegdag", vandaag: ZONDAG, alGestuurdVandaag: "logboek",
  })));
});

test("een uitgezette soort blokkeert alleen zichzelf", () => {
  const alleenWegen = { weegdag: true, logboek: false };
  assert.equal(bepaalHerinnering(invoer({ voorkeur: alleenWegen })), null);
  assert.ok(bepaalHerinnering(invoer({
    soort: "weegdag", vandaag: ZONDAG, voorkeur: alleenWegen,
  })));
});

test("geen enkele melding spoort aan of veroordeelt", () => {
  // Dezelfde regel als in de adviesmodule: beschrijven, niet aansporen.
  const verboden = /\b(moet|niet vergeten|vergeet niet|zondig|slecht|discipline|volhouden)\b/i;
  const soorten: { soort: HerinneringSoort; dag: string }[] = [
    { soort: "logboek", dag: DINSDAG }, { soort: "weegdag", dag: ZONDAG },
  ];
  for (const s of soorten) {
    const h = bepaalHerinnering(invoer({ soort: s.soort, vandaag: s.dag }));
    assert.ok(h, s.soort);
    assert.equal(verboden.test(h.titel + " " + h.tekst), false, h.titel + " " + h.tekst);
    assert.equal(h.titel.includes("!"), false, h.titel);
  }
});

test("een half of onzinnig opgeslagen voorkeur wordt uit", () => {
  assert.deepEqual(normaliseerVoorkeur(null), { weegdag: false, logboek: false });
  assert.deepEqual(normaliseerVoorkeur({ weegdag: true }), { weegdag: true, logboek: false });
  assert.deepEqual(
    normaliseerVoorkeur({ weegdag: "ja" } as unknown as { weegdag: boolean }),
    { weegdag: false, logboek: false }
  );
});
