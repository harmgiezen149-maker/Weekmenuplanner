import { strict as assert } from "node:assert";
import { test } from "node:test";
import { steldWeekVoor } from "./weekvoorstel.ts";
import type { VoorstelRecept } from "./weekvoorstel.ts";

const DAGEN = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"] as const;

function recept(over: Partial<VoorstelRecept> & { id: string }): VoorstelRecept {
  return {
    titel: over.id, hoofd: "Kip", keuken: "Hollands", tijd: 30, score: 3,
    gegeten: 0, punten: 10, euro: 6, ...over,
  };
}

/** Twaalf recepten met genoeg spreiding om de regels te kunnen zien werken. */
function collectie(): VoorstelRecept[] {
  const hoofd = ["Kip", "Vis", "Pasta", "Vegetarisch", "Vlees", "Rijst"];
  const keuken = ["Italiaans", "Hollands", "Aziatisch", "Grieks"];
  return Array.from({ length: 12 }, (_, i) => recept({
    id: `r${i}`,
    hoofd: hoofd[i % hoofd.length],
    keuken: keuken[i % keuken.length],
    tijd: 20 + (i % 5) * 15,
    score: 2 + (i % 4),
    gegeten: i % 3,
    punten: 8 + (i % 6),
    euro: 4 + (i % 5),
  }));
}

test("een week krijgt zeven dagen", () => {
  const v = steldWeekVoor(collectie(), { dagen: DAGEN });
  assert.equal(v.dagen.length, 7);
  assert.deepEqual(v.dagen.map((d) => d.dag), [...DAGEN]);
});

test("geen twee avonden achter elkaar hetzelfde hoofdingredient", () => {
  // Dit is het enige waar vrijwel iedereen over valt.
  const v = steldWeekVoor(collectie(), { dagen: DAGEN });
  for (let i = 1; i < v.dagen.length; i++) {
    assert.notEqual(v.dagen[i].recept.hoofd, v.dagen[i - 1].recept.hoofd,
      `${v.dagen[i - 1].dag} en ${v.dagen[i].dag}`);
  }
});

test("met genoeg recepten komt niets twee keer terug", () => {
  const v = steldWeekVoor(collectie(), { dagen: DAGEN });
  const ids = v.dagen.map((d) => d.recept.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("doordeweeks wint het snelle recept van het lange", () => {
  const snel = recept({ id: "snel", tijd: 20, hoofd: "Kip" });
  const lang = recept({ id: "lang", tijd: 120, hoofd: "Vis" });
  const v = steldWeekVoor([snel, lang], { dagen: ["Maandag"] });
  assert.equal(v.dagen[0].recept.id, "snel");
});

test("in het weekend mag het lange recept wel", () => {
  const snel = recept({ id: "snel", tijd: 20, hoofd: "Kip", score: 3 });
  const lang = recept({ id: "lang", tijd: 120, hoofd: "Vis", score: 5 });
  const v = steldWeekVoor([snel, lang], { dagen: ["Zaterdag"] });
  assert.equal(v.dagen[0].recept.id, "lang");
});

test("een hoog gewaardeerd recept komt eerder aan de beurt", () => {
  const laag = recept({ id: "laag", score: 1, hoofd: "Kip" });
  const hoog = recept({ id: "hoog", score: 5, hoofd: "Kip" });
  const v = steldWeekVoor([laag, hoog], { dagen: ["Maandag"] });
  assert.equal(v.dagen[0].recept.id, "hoog");
});

test("een recept zonder score telt als gemiddeld, niet als afgekeurd", () => {
  // Ongewaardeerd is niet hetzelfde als slecht; anders verdwijnt alles wat je
  // nog niet hebt beoordeeld voorgoed uit je weekmenu.
  const zonder = recept({ id: "zonder", score: 0, hoofd: "Kip" });
  const slecht = recept({ id: "slecht", score: 1, hoofd: "Kip" });
  const v = steldWeekVoor([zonder, slecht], { dagen: ["Maandag"] });
  assert.equal(v.dagen[0].recept.id, "zonder");
});

test("te weinig recepten levert herhaling op, met een melding erbij", () => {
  const drie = [
    recept({ id: "a", hoofd: "Kip" }),
    recept({ id: "b", hoofd: "Vis" }),
    recept({ id: "c", hoofd: "Pasta" }),
  ];
  const v = steldWeekVoor(drie, { dagen: DAGEN });
  assert.equal(v.dagen.length, 7);
  assert.ok(v.opmerkingen.some((o) => /twee keer terug/.test(o)), v.opmerkingen.join(" | "));
});

test("een leeg kookboek levert geen week op maar wel een uitleg", () => {
  const v = steldWeekVoor([], { dagen: DAGEN });
  assert.equal(v.dagen.length, 0);
  assert.ok(v.opmerkingen.length > 0);
});

test("de variatie geeft een andere week, met dezelfde regels", () => {
  // Zonder dit levert "andere week" precies dezelfde week op.
  const a = steldWeekVoor(collectie(), { dagen: DAGEN, variatie: 0 });
  const b = steldWeekVoor(collectie(), { dagen: DAGEN, variatie: 3 });
  assert.notDeepEqual(a.dagen.map((d) => d.recept.id), b.dagen.map((d) => d.recept.id));
  for (let i = 1; i < b.dagen.length; i++) {
    assert.notEqual(b.dagen[i].recept.hoofd, b.dagen[i - 1].recept.hoofd);
  }
});

test("de kosten en de punten worden opgeteld over wat bekend is", () => {
  const v = steldWeekVoor([
    recept({ id: "a", hoofd: "Kip", euro: 5, punten: 10 }),
    recept({ id: "b", hoofd: "Vis", euro: null, punten: null }),
  ], { dagen: ["Maandag", "Dinsdag"] });
  assert.equal(v.totaalEuro, 5);
  assert.equal(v.gemiddeldePunten, 10);
  assert.ok(v.opmerkingen.some((o) => /prijs nog onbekend/.test(o)), v.opmerkingen.join(" | "));
});

test("zonder enige bekende prijs staat er geen bedrag", () => {
  // Nul euro voor een week eten is geen raming maar een leugen.
  const v = steldWeekVoor([recept({ id: "a", euro: null })], { dagen: ["Maandag"] });
  assert.equal(v.totaalEuro, null);
});

test("een puntendoel trekt de keuze naar recepten die daar dichtbij zitten", () => {
  const zwaar = recept({ id: "zwaar", punten: 25, hoofd: "Kip" });
  const licht = recept({ id: "licht", punten: 10, hoofd: "Kip" });
  const v = steldWeekVoor([zwaar, licht], { dagen: ["Maandag"], puntenDoel: 10 });
  assert.equal(v.dagen[0].recept.id, "licht");
});

test("een duidelijk goedkoper alternatief wordt genoemd", () => {
  const duur = recept({ id: "duur", hoofd: "Vis", euro: 12, score: 5, tijd: 25 });
  const goedkoop = recept({ id: "goedkoop", hoofd: "Vis", euro: 6, score: 3, tijd: 25 });
  const v = steldWeekVoor([duur, goedkoop], { dagen: ["Maandag"] });
  assert.equal(v.dagen[0].recept.id, "duur");
  assert.equal(v.dagen[0].goedkoper?.recept.id, "goedkoop");
  assert.equal(v.dagen[0].goedkoper?.scheelt, 6);
});

test("een verschil van een paar dubbeltjes wordt niet genoemd", () => {
  // "Bespaar 30 cent" is geen advies maar ruis, en zou op elke dag verschijnen.
  const a = recept({ id: "a", hoofd: "Vis", euro: 6.2, score: 5 });
  const b = recept({ id: "b", hoofd: "Vis", euro: 6.0, score: 3 });
  const v = steldWeekVoor([a, b], { dagen: ["Maandag"] });
  assert.equal(v.dagen[0].goedkoper, undefined);
});

test("een alternatief met een ander hoofdingredient telt niet", () => {
  // Dat is geen alternatief maar een ander gerecht.
  const vis = recept({ id: "vis", hoofd: "Vis", euro: 12, score: 5 });
  const pasta = recept({ id: "pasta", hoofd: "Pasta", euro: 3, score: 3 });
  const v = steldWeekVoor([vis, pasta], { dagen: ["Maandag"] });
  assert.equal(v.dagen[0].goedkoper, undefined);
});

test("een goedkoop maar tijdrovend alternatief wordt doordeweeks niet genoemd", () => {
  // Anderhalf uur koken op een woensdag is geen besparing maar een probleem.
  const snel = recept({ id: "snel", hoofd: "Vis", euro: 12, tijd: 25, score: 5 });
  const traag = recept({ id: "traag", hoofd: "Vis", euro: 5, tijd: 120, score: 3 });
  assert.equal(steldWeekVoor([snel, traag], { dagen: ["Woensdag"] }).dagen[0].goedkoper, undefined);
  assert.ok(steldWeekVoor([snel, traag], { dagen: ["Zaterdag"] }).dagen[0].goedkoper);
});

test("elke dag krijgt een uitleg in gewone taal", () => {
  const v = steldWeekVoor(collectie(), { dagen: DAGEN });
  for (const d of v.dagen) {
    assert.ok(d.waarom.length > 5, d.dag);
    assert.equal(/moet|zou moeten|verplicht/i.test(d.waarom), false, d.waarom);
  }
});
