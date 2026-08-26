import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  herkenSoort, leesExterneActiviteit, leesGeplakteLijst, ontvangenVelden,
} from "./koppeling.ts";

const VANDAAG = "2026-08-25";

test("namen van Health Connect en Garmin komen uit bij onze soorten", () => {
  assert.equal(herkenSoort("RUNNING")?.id, "hardlopen");
  assert.equal(herkenSoort("Walking")?.id, "wandelen");
  assert.equal(herkenSoort("biking")?.id, "fietsen-rustig");
  assert.equal(herkenSoort("MOUNTAIN_BIKING")?.id, "fietsen-stevig");
  assert.equal(herkenSoort("STRENGTH_TRAINING")?.id, "krachttraining");
  assert.equal(herkenSoort("swimming_open_water")?.id, "zwemmen");
});

test("onze eigen id's en namen werken ook", () => {
  assert.equal(herkenSoort("wandelen-stevig")?.id, "wandelen-stevig");
  assert.equal(herkenSoort("Stevig wandelen")?.id, "wandelen-stevig");
  assert.equal(herkenSoort("Fietsen, rustig")?.id, "fietsen-rustig");
});

test("hardlopen wordt geen wandelen omdat er lopen in staat", () => {
  // Op hele woorden zoeken, niet op substrings: anders boekt "hardlopen 30 min"
  // zichzelf als wandelen en vind je die punten later nergens terug.
  assert.equal(herkenSoort("Hardlopen 30 min")?.id, "hardlopen");
  assert.equal(herkenSoort("hardlopen")?.id, "hardlopen");
  assert.equal(herkenSoort("Trail running 2026-08-24")?.id, "hardlopen");
});

test("een naam van twee woorden wordt herkend tussen andere tekst", () => {
  assert.equal(herkenSoort("2026-08-24 strength training 45 min")?.id, "krachttraining");
});

test("een onbekende activiteit wordt geweigerd in plaats van gegokt", () => {
  // Liever een afgewezen regel dan een hardloopsessie die als tuinieren wordt
  // geboekt: die punten kun je later niet meer terugvinden.
  assert.equal(herkenSoort("padel"), null);
  assert.equal(herkenSoort(""), null);
  assert.equal(herkenSoort("   "), null);
});

test("een binnenkomende activiteit wordt gelezen", () => {
  const uit = leesExterneActiviteit(
    { soort: "RUNNING", minuten: 42, datum: "2026-08-24", id: "garmin-123" }, VANDAAG
  );
  assert.ok("activiteit" in uit);
  assert.equal(uit.activiteit.soort.id, "hardlopen");
  assert.equal(uit.activiteit.minuten, 42);
  assert.equal(uit.activiteit.datum, "2026-08-24");
  assert.equal(uit.activiteit.externId, "garmin-123");
});

test("seconden en milliseconden worden ook gelezen", () => {
  for (const [veld, waarde] of [["seconden", 2700], ["duration_s", 2700], ["duration_ms", 2700000]] as const) {
    const uit = leesExterneActiviteit({ soort: "walking", [veld]: waarde }, VANDAAG);
    assert.ok("activiteit" in uit, veld);
    assert.equal(uit.activiteit.minuten, 45, veld);
  }
});

test("een duur onder een minuut of boven tien uur telt niet", () => {
  // Een horloge dat per ongeluk startte, of een verkeerd gelezen eenheid.
  for (const m of [0, 0.4, 601, 100000]) {
    const uit = leesExterneActiviteit({ soort: "walking", minuten: m }, VANDAAG);
    assert.ok("fout" in uit, String(m));
  }
});

test("zonder datum wordt het vandaag", () => {
  const uit = leesExterneActiviteit({ soort: "walking", minuten: 30 }, VANDAAG);
  assert.ok("activiteit" in uit);
  assert.equal(uit.activiteit.datum, VANDAAG);
});

test("zonder eigen id komt er een id uit datum, soort en duur", () => {
  // Niet perfect, maar het voorkomt dat een herhaalde aanroep dubbel boekt.
  const a = leesExterneActiviteit({ soort: "walking", minuten: 30 }, VANDAAG);
  const b = leesExterneActiviteit({ soort: "walking", minuten: 30 }, VANDAAG);
  assert.ok("activiteit" in a && "activiteit" in b);
  assert.equal(a.activiteit.externId, b.activiteit.externId);
});

test("een leeg soortveld levert een andere fout dan een onbekende soort", () => {
  // Dit is bij het instellen het verschil tussen "de variabele bestaat niet"
  // en "de vertaling ontbreekt", en dat bepaalt waar je gaat zoeken.
  const leeg = leesExterneActiviteit({ soort: "", minuten: 30 }, VANDAAG);
  assert.ok("fout" in leeg);
  assert.match(leeg.fout, /leeg binnen/);

  const onbekend = leesExterneActiviteit({ soort: "padel", minuten: 30 }, VANDAAG);
  assert.ok("fout" in onbekend);
  assert.match(onbekend.fout, /niet herkend/);
  assert.match(onbekend.fout, /RUNNING/, "de foutmelding hoort te zeggen dat Engels ook werkt");
});

test("de soort mag onder allerlei veldnamen binnenkomen", () => {
  // Elke Health Connect-plug-in verzint zijn eigen namen; die uitzoeken hoort
  // niet het werk van de gebruiker te zijn.
  for (const veld of ["soort", "type", "activity", "activiteit", "exerciseType", "sport", "workout"]) {
    const uit = leesExterneActiviteit({ [veld]: "RUNNING", minuten: 30 }, VANDAAG);
    assert.ok("activiteit" in uit, veld);
    assert.equal(uit.activiteit.soort.id, "hardlopen", veld);
  }
});

test("een leeg veld wordt overgeslagen ten gunste van een gevuld veld", () => {
  const uit = leesExterneActiviteit(
    { soort: "", type: "  ", activity: "WALKING", minuten: 30 }, VANDAAG
  );
  assert.ok("activiteit" in uit);
  assert.equal(uit.activiteit.soort.id, "wandelen");
});

test("de ontvangen velden komen terug zonder de sleutel erin", () => {
  // Handig bij het instellen, maar de sleutel hoort nooit terug in een
  // foutmelding die in een log belandt.
  const velden = ontvangenVelden({ soort: "RUNNING", minuten: 30, sleutel: "geheim", token: "ook" });
  assert.deepEqual(velden, { soort: "RUNNING", minuten: "30" });
});

test("onzin levert een leesbare fout op, geen crash", () => {
  for (const b of [null, "tekst", 42, {}, { soort: "padel", minuten: 30 }]) {
    assert.ok("fout" in leesExterneActiviteit(b, VANDAAG), JSON.stringify(b));
  }
});

test("een verbranding van het horloge wordt niet overgenomen", () => {
  // De app rekent zelf, met rustverbranding eraf en een dagplafond. Een
  // externe schatting zou die dempers omzeilen.
  const uit = leesExterneActiviteit(
    { soort: "running", minuten: 30, kcal: 900, calories: 900 }, VANDAAG
  );
  assert.ok("activiteit" in uit);
  assert.equal("kcal" in uit.activiteit, false);
  assert.equal("calories" in uit.activiteit, false);
});

test("een geplakte lijst uit Garmin Connect wordt gelezen", () => {
  const { herkend, afgewezen } = leesGeplakteLijst(`
    Hardlopen	2026-08-24	45:12
    Wandelen  2026-08-23  1:05:00
    Fietsen, rustig; 24-08-2026; 90 min
  `, VANDAAG);
  assert.equal(afgewezen.length, 0);
  assert.deepEqual(herkend.map((r) => r.soort.id), ["hardlopen", "wandelen", "fietsen-rustig"]);
  assert.equal(herkend[0].minuten, 45);
  assert.equal(herkend[1].minuten, 65);
  assert.equal(herkend[2].minuten, 90);
  assert.equal(herkend[2].datum, "2026-08-24");
});

test("wat niet herkend wordt komt terug als afgewezen, niet als gok", () => {
  const { herkend, afgewezen } = leesGeplakteLijst(
    "Padel 2026-08-24 60 min\nHardlopen 30 min\nTotaal deze week", VANDAAG
  );
  assert.equal(herkend.length, 1);
  assert.equal(herkend[0].soort.id, "hardlopen");
  assert.equal(afgewezen.length, 2);
});

test("een regel zonder duur telt niet mee", () => {
  const { herkend, afgewezen } = leesGeplakteLijst("Hardlopen 2026-08-24", VANDAAG);
  assert.equal(herkend.length, 0);
  assert.equal(afgewezen.length, 1);
});

test("een regel zonder datum krijgt vandaag", () => {
  const { herkend } = leesGeplakteLijst("Zwemmen 40 min", VANDAAG);
  assert.equal(herkend[0].datum, VANDAAG);
});
