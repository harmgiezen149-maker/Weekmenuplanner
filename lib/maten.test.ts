import { test } from "node:test";
import assert from "node:assert/strict";
import { onleesbareMaten, voorstelVoor, metAangevuldeMaten } from "./maten.ts";
import { berekenReceptPunten } from "./tracker/recept.ts";

test("een maat die niets zegt wordt aangewezen", () => {
  const uit = onleesbareMaten([
    { naam: "spaghetti", hoev: 400, eenheid: "g" },
    { naam: "peper", hoev: 1, eenheid: "naar smaak" },
    { naam: "olijfolie", hoev: 1, eenheid: "flinke scheut" },
  ]);
  assert.deepEqual(uit.map((o) => o.naam), ["peper", "olijfolie"]);
  assert.deepEqual(uit[0].voorstel, { hoev: 1, eenheid: "snufje" });
  // "flink" en "scheut" zitten er allebei in; de eerste die past wint, en dat
  // is de regel voor "scheut".
  assert.equal(uit[1].voorstel.eenheid, "el");
});

test("bekende maten en stuks blijven met rust", () => {
  const uit = onleesbareMaten([
    { naam: "ui", hoev: 2, eenheid: "" },
    { naam: "knoflook", hoev: 2, eenheid: "teentjes" },
    { naam: "melk", hoev: 200, eenheid: "ml" },
    { naam: "brood", hoev: 2, eenheid: "sneetjes" },
    { naam: "olie", hoev: 1, eenheid: "E.L." },
  ]);
  assert.deepEqual(uit, []);
});

test("een lege naam telt niet mee", () => {
  assert.deepEqual(onleesbareMaten([{ naam: "  ", hoev: 0, eenheid: "naar smaak" }]), []);
});

test("de aangewezen ingrediënten zijn precies de ingrediënten die buiten de punten vallen", () => {
  const lijst = [
    { naam: "spaghetti", hoev: 400, eenheid: "g" },
    { naam: "olijfolie", hoev: 1, eenheid: "naar smaak" },
  ];
  const berekend = berekenReceptPunten(lijst, 4);
  const aangewezen = onleesbareMaten(lijst).map((o) => o.naam);
  // Wat de puntentelling als onleesbare maat overslaat, staat ook hier.
  assert.deepEqual(aangewezen, berekend.maatOnbekend);
});

test("het voorstel leunt op de tekst, en anders op een snufje", () => {
  assert.deepEqual(voorstelVoor("naar smaak"), { hoev: 1, eenheid: "snufje" });
  assert.deepEqual(voorstelVoor("handvol"), { hoev: 1, eenheid: "handje" });
  assert.deepEqual(voorstelVoor("een royale bodem"), { hoev: 2, eenheid: "el" });
  assert.deepEqual(voorstelVoor("kwakkel"), { hoev: 1, eenheid: "snufje" });
  // De naam telt mee als de eenheid zelf niets prijsgeeft.
  assert.deepEqual(voorstelVoor("", "verse peterselie, een pluk"), { hoev: 1, eenheid: "takje" });
});

test("aanvullen vervangt alleen wat je hebt ingevuld", () => {
  const lijst = [
    { naam: "spaghetti", hoev: 400, eenheid: "g" },
    { naam: "peper", hoev: 1, eenheid: "naar smaak" },
    { naam: "zout", hoev: 1, eenheid: "naar smaak" },
  ];
  const uit = metAangevuldeMaten(lijst, {
    1: { hoev: 2, eenheid: "snufje" },
    2: null, // bewust laten staan
  });
  assert.deepEqual(uit[0], lijst[0]);
  assert.deepEqual(uit[1], { naam: "peper", hoev: 2, eenheid: "snufje" });
  assert.deepEqual(uit[2], lijst[2]);
});

test("een keuze zonder eenheid laat het ingredient staan", () => {
  const lijst = [{ naam: "peper", hoev: 1, eenheid: "naar smaak" }];
  assert.deepEqual(metAangevuldeMaten(lijst, { 0: { hoev: 3, eenheid: "  " } }), lijst);
});

test("na aanvullen telt het ingredient wél mee", () => {
  const lijst = [
    { naam: "spaghetti", hoev: 400, eenheid: "g" },
    { naam: "olijfolie", hoev: 1, eenheid: "naar smaak" },
  ];
  const na = metAangevuldeMaten(lijst, { 1: { hoev: 1, eenheid: "el" } });
  assert.deepEqual(onleesbareMaten(na), []);
  assert.deepEqual(berekenReceptPunten(na, 4).maatOnbekend, []);
});
