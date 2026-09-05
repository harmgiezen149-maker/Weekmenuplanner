import { test } from "node:test";
import assert from "node:assert/strict";
import { voorstelWeekmenu, voorstelBoodschap, voorstelLogboek } from "./voorstellen.ts";
import { titelUit, geldigId, nieuwGesprekId } from "./gesprek.ts";
import { datumSleutel } from "../tracker/datum.ts";
import { weekVan } from "../weeksleutel.ts";

test("een gerecht op een dag levert een kaartje op, geen wijziging", () => {
  const uit = voorstelWeekmenu({ recept_id: "r1", dag: "donderdag" });
  assert.equal(uit.voorstel?.soort, "weekmenu");
  assert.deepEqual(uit.voorstel?.gegevens, {
    receptId: "r1", dag: "Donderdag", week: weekVan(datumSleutel()),
  });
  // Het antwoord aan het model mag nooit suggereren dat het al gebeurd is.
  assert.match(JSON.stringify(uit.resultaat), /bevestigen/);
});

test("een onzinnige dag levert geen voorstel op", () => {
  for (const dag of ["gisteren", "", "Maandagochtend"]) {
    const uit = voorstelWeekmenu({ recept_id: "r1", dag });
    assert.equal(uit.voorstel, undefined);
  }
  assert.equal(voorstelWeekmenu({ dag: "Maandag" }).voorstel, undefined);
});

test("een eigen week mag mee, onzin niet", () => {
  assert.equal(voorstelWeekmenu({ recept_id: "r", dag: "Maandag", week: "2026-W36" })
    .voorstel?.gegevens.week, "2026-W36");
  assert.equal(voorstelWeekmenu({ recept_id: "r", dag: "Maandag", week: "volgende week" })
    .voorstel?.gegevens.week, weekVan(datumSleutel()));
});

test("een boodschap zonder naam gaat niet door", () => {
  assert.equal(voorstelBoodschap({ naam: "  " }).voorstel, undefined);
  const uit = voorstelBoodschap({ naam: "melk", hoeveelheid: 2, eenheid: "pak" });
  assert.deepEqual(uit.voorstel?.gegevens, { naam: "melk", hoev: 2, eenheid: "pak" });
  assert.match(uit.voorstel?.omschrijving ?? "", /melk \(2 pak\)/);
});

test("loggen kan alleen met iets dat de app kent", () => {
  // Niets aangewezen: dan zou het model de voedingswaarden moeten verzinnen.
  const leeg = voorstelLogboek({ eetmoment: "lunch" });
  assert.equal(leeg.voorstel, undefined);
  assert.match(JSON.stringify(leeg.resultaat), /verzonnen/);

  // Twee tegelijk is even onduidelijk als geen.
  assert.equal(
    voorstelLogboek({ eetmoment: "lunch", recept_id: "r1", favoriet_id: "f1" }).voorstel,
    undefined
  );
});

test("een eetmoment moet er een van de vier zijn", () => {
  assert.equal(voorstelLogboek({ eetmoment: "tussendoor", recept_id: "r1" }).voorstel, undefined);
  assert.equal(voorstelLogboek({ eetmoment: "Diner", recept_id: "r1" })
    .voorstel?.gegevens.eetmoment, "diner");
});

test("een logvoorstel vult datum en porties aan", () => {
  const uit = voorstelLogboek({ eetmoment: "diner", recept_id: "r7" });
  assert.deepEqual(uit.voorstel?.gegevens, {
    bron: "recept", id: "r7", eetmoment: "diner", datum: datumSleutel(), porties: 1,
  });

  const eigen = voorstelLogboek({
    eetmoment: "ontbijt", maaltijd_id: "m2", datum: "2026-09-01", porties: 0.5,
  });
  assert.equal(eigen.voorstel?.gegevens.datum, "2026-09-01");
  assert.equal(eigen.voorstel?.gegevens.bron, "maaltijd");
  assert.equal(eigen.voorstel?.gegevens.porties, 0.5);
});

test("een onmogelijke datum valt terug op vandaag", () => {
  const uit = voorstelLogboek({ eetmoment: "snack", favoriet_id: "f1", datum: "morgen" });
  assert.equal(uit.voorstel?.gegevens.datum, datumSleutel());
});

test("de titel komt uit de eerste zin", () => {
  assert.equal(titelUit("Wat staat er deze week op het menu? En morgen?"),
    "Wat staat er deze week op het menu");
  // Te kort om iets te zeggen: dan liever de hele vraag.
  assert.equal(titelUit("Hoi? Wat eet ik vandaag"), "Hoi? Wat eet ik vandaag");
  assert.equal(titelUit("   "), "Nieuw gesprek");
  assert.ok(titelUit("a".repeat(200)).length <= 50);
});

test("alleen onze eigen gespreks-ids worden geaccepteerd", () => {
  assert.equal(geldigId(nieuwGesprekId()), true);
  assert.equal(geldigId("../profile"), false);
  assert.equal(geldigId("ABC123"), false);
  assert.equal(geldigId(""), false);
  assert.equal(geldigId(42), false);
});
