import { strict as assert } from "node:assert";
import { test } from "node:test";
import { leesGezondheidJson, lijktOpGezondheidJson } from "./gezondheidjson.ts";

const VANDAAG = "2026-08-26";

const SESSIE = {
  startTime: "2026-08-24T16:00:00Z",
  endTime: "2026-08-24T16:45:00Z",
  startZoneOffset: "+02:00",
  exerciseType: "RUNNING",
  title: "Hardloopsessie",
  metadata: { id: "hc-abc-123" },
};

test("een blok met records wordt herkend, losse velden niet", () => {
  assert.equal(lijktOpGezondheidJson({ records: [SESSIE] }), true);
  assert.equal(lijktOpGezondheidJson([SESSIE]), true);
  assert.equal(lijktOpGezondheidJson(SESSIE), true);
  assert.equal(lijktOpGezondheidJson({ soort: "RUNNING", minuten: 42 }), false);
  assert.equal(lijktOpGezondheidJson("tekst"), false);
  assert.equal(lijktOpGezondheidJson(null), false);
});

test("een sessie levert sport, duur, datum en id op", () => {
  const { gevonden, geweigerd } = leesGezondheidJson({ records: [SESSIE] }, VANDAAG);
  assert.equal(geweigerd.length, 0);
  assert.equal(gevonden.length, 1);
  assert.equal(gevonden[0].soort.id, "hardlopen");
  assert.equal(gevonden[0].minuten, 45);
  assert.equal(gevonden[0].datum, "2026-08-24");
  assert.equal(gevonden[0].externId, "hc-abc-123");
});

test("meerdere sessies in één blok komen er allemaal uit", () => {
  const { gevonden } = leesGezondheidJson({
    records: [
      SESSIE,
      { ...SESSIE, exerciseType: "WALKING", metadata: { id: "hc-2" },
        startTime: "2026-08-25T08:00:00Z", endTime: "2026-08-25T09:05:00Z" },
    ],
  }, VANDAAG);
  assert.deepEqual(gevonden.map((g) => g.soort.id), ["hardlopen", "wandelen"]);
  assert.equal(gevonden[1].minuten, 65);
});

test("EXERCISE_TYPE_ ervoor maakt niet uit", () => {
  const { gevonden } = leesGezondheidJson(
    [{ ...SESSIE, exerciseType: "EXERCISE_TYPE_MOUNTAIN_BIKING" }], VANDAAG
  );
  assert.equal(gevonden[0].soort.id, "fietsen-stevig");
});

test("staat de sport als nummer, dan wordt de regel geweigerd met dat nummer erbij", () => {
  // Niet raden: de cijfercodes zijn nergens betrouwbaar na te slaan, en een
  // verkeerd gegokt nummer boekt stilletjes de verkeerde sport.
  const { gevonden, geweigerd } = leesGezondheidJson(
    [{ ...SESSIE, exerciseType: 56, title: "" }], VANDAAG
  );
  assert.equal(gevonden.length, 0);
  assert.equal(geweigerd.length, 1);
  assert.match(geweigerd[0].reden, /nummer \(56\)/);
});

test("staat er een bruikbare titel bij, dan telt die zwaarder dan een cijfercode", () => {
  const { gevonden } = leesGezondheidJson(
    [{ ...SESSIE, exerciseType: 56, title: "Wandelen" }], VANDAAG
  );
  assert.equal(gevonden[0].soort.id, "wandelen");
});

test("de zoneverschuiving bepaalt op welke dag het valt", () => {
  // Half één 's nachts in Nederland is de dag ervoor in UTC. Zonder de
  // verschuiving belandt de training op de verkeerde dag en klopt je week niet.
  const laat = {
    ...SESSIE,
    startTime: "2026-08-24T22:30:00Z",
    endTime: "2026-08-24T23:10:00Z",
    startZoneOffset: "+02:00",
  };
  assert.equal(leesGezondheidJson([laat], VANDAAG).gevonden[0].datum, "2026-08-25");
});

test("een tijd met de zone er al in wordt op zijn eigen datum gelezen", () => {
  const { gevonden } = leesGezondheidJson([{
    ...SESSIE, startZoneOffset: undefined,
    startTime: "2026-08-25T00:30:00+02:00", endTime: "2026-08-25T01:10:00+02:00",
  }], VANDAAG);
  assert.equal(gevonden[0].datum, "2026-08-25");
});

test("een duur zonder begin- en eindtijd wordt uit een duurveld gehaald", () => {
  for (const [veld, waarde] of [
    ["durationMinutes", 45], ["seconds", 2700], ["durationMillis", 2700000],
  ] as const) {
    const { gevonden } = leesGezondheidJson(
      [{ exerciseType: "RUNNING", startTime: "2026-08-24T16:00:00+02:00", [veld]: waarde }],
      VANDAAG
    );
    assert.equal(gevonden[0]?.minuten, 45, veld);
  }
});

test("een sessie zonder duur wordt geweigerd, niet geraden", () => {
  const { gevonden, geweigerd } = leesGezondheidJson(
    [{ exerciseType: "RUNNING", startTime: "2026-08-24T16:00:00+02:00" }], VANDAAG
  );
  assert.equal(gevonden.length, 0);
  assert.match(geweigerd[0].reden, /duur/);
});

test("een sessie van nul minuten of van dagen telt niet mee", () => {
  const nul = { exerciseType: "RUNNING", startTime: "2026-08-24T16:00:00Z", endTime: "2026-08-24T16:00:20Z" };
  const eeuwig = { exerciseType: "RUNNING", startTime: "2026-08-24T00:00:00Z", endTime: "2026-08-27T00:00:00Z" };
  assert.equal(leesGezondheidJson([nul], VANDAAG).gevonden.length, 0);
  assert.equal(leesGezondheidJson([eeuwig], VANDAAG).gevonden.length, 0);
});

test("zonder eigen id komt er een id uit datum, sport en duur", () => {
  const zonder = { ...SESSIE, metadata: undefined };
  const a = leesGezondheidJson([zonder], VANDAAG).gevonden[0];
  const b = leesGezondheidJson([zonder], VANDAAG).gevonden[0];
  assert.equal(a.externId, b.externId);
  assert.match(a.externId, /^hc-2026-08-24-hardlopen-45$/);
});

test("een geweigerde regel houdt de rest niet tegen", () => {
  const { gevonden, geweigerd } = leesGezondheidJson({
    records: [SESSIE, { onzin: true }, "tekst", { ...SESSIE, metadata: { id: "hc-3" }, exerciseType: "SWIMMING_POOL" }],
  }, VANDAAG);
  assert.equal(gevonden.length, 2);
  assert.equal(geweigerd.length, 2);
});

test("een leeg blok levert niets op en geen fout", () => {
  assert.deepEqual(leesGezondheidJson({ records: [] }, VANDAAG), { gevonden: [], geweigerd: [] });
});
