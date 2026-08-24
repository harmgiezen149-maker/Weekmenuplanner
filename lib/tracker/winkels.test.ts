import { test } from "node:test";
import assert from "node:assert/strict";
import {
  winkelGetal, uitVoedingstabel, tabelNaarNutrients, leesGewicht,
  uitAhDetail, uitJumboDetail, zoekBijWinkels,
} from "./winkels.ts";
import { rawPoints, toonPunten } from "./points.ts";

// -- getallen uit webshoptekst -----------------------------------------------

test("getallen komen als tekst met eenheid binnen", () => {
  assert.equal(winkelGetal("12,5 g"), 12.5);
  assert.equal(winkelGetal("12.5"), 12.5);
  assert.equal(winkelGetal(47), 47);
  assert.equal(winkelGetal("380 kcal"), 380);
  assert.equal(winkelGetal("1600 kJ"), 1600);
});

test("een waarde onder de meetgrens telt als die grens", () => {
  // "< 0,5 g" is de gebruikelijke schrijfwijze op etiketten.
  assert.equal(winkelGetal("< 0,5 g"), 0.5);
  assert.equal(winkelGetal("<0,5"), 0.5);
});

test("onbruikbare waarden geven null", () => {
  assert.equal(winkelGetal(""), null);
  assert.equal(winkelGetal("onbekend"), null);
  assert.equal(winkelGetal(null), null);
  assert.equal(winkelGetal(undefined), null);
  assert.equal(winkelGetal("-3"), null);
});

test("milligrammen worden naar gram omgerekend", () => {
  const rijen = [{ naam: "Vezels", waarde: "2500 mg" }];
  assert.equal(uitVoedingstabel(rijen, ["vezel"]), 2.5);
});

// -- voedingstabel -----------------------------------------------------------

const AH_TABEL = [
  { naam: "Energie (kJ)", waarde: "1590 kJ" },
  { naam: "Energie (kcal)", waarde: "380 kcal" },
  { naam: "Vetten", waarde: "6,5 g" },
  { naam: "waarvan verzadigde vetzuren", waarde: "1,1 g" },
  { naam: "Koolhydraten", waarde: "58 g" },
  { naam: "waarvan suikers", waarde: "1,0 g" },
  { naam: "Vezels", waarde: "10 g" },
  { naam: "Eiwitten", waarde: "13 g" },
  { naam: "Zout", waarde: "0,01 g" },
];

test("een complete voedingstabel wordt omgezet", () => {
  const n = tabelNaarNutrients(AH_TABEL);
  assert.ok(n);
  assert.equal(n.kcal, 380);
  assert.equal(n.protein_g, 13);
  assert.equal(n.fat_g, 6.5);
  assert.equal(n.satfat_g, 1.1);
  assert.equal(n.carbs_g, 58);
  assert.equal(n.sugar_g, 1);
  assert.equal(n.fiber_g, 10);
  // En hij is meteen door te rekenen: deze havermout komt op 8 punten per 100 g.
  assert.equal(toonPunten(rawPoints(n, 100), 1), 8);
});

test("kcal wint van kilojoules als beide er staan", () => {
  const n = tabelNaarNutrients(AH_TABEL)!;
  assert.equal(n.kcal, 380, "1590 kJ zou 380 kcal geven, maar kcal staat er zelf");
});

test("alleen kilojoules is genoeg", () => {
  const n = tabelNaarNutrients([
    { naam: "Energie", waarde: "1046 kJ" },
    { naam: "Eiwitten", waarde: "5 g" },
  ]);
  assert.ok(n);
  assert.ok(Math.abs(n.kcal - 250) < 1);
});

test("ontbrekende rijen worden nul, niet undefined", () => {
  const n = tabelNaarNutrients([{ naam: "Energie (kcal)", waarde: "120" }]);
  assert.ok(n);
  assert.equal(n.protein_g, 0);
  assert.equal(n.satfat_g, 0);
  assert.equal(n.fiber_g, 0);
});

test("een lege of nutteloze tabel geeft null", () => {
  assert.equal(tabelNaarNutrients([]), null);
  assert.equal(tabelNaarNutrients([{ naam: "Zout", waarde: "0,5 g" }]), null);
  assert.equal(tabelNaarNutrients([{ naam: "Energie (kcal)", waarde: "onbekend" }]), null);
});

// -- verpakkingsgewicht ------------------------------------------------------

test("het verpakkingsgewicht wordt gelezen", () => {
  assert.equal(leesGewicht("500 g"), 500);
  assert.equal(leesGewicht("1 kg"), 1000);
  assert.equal(leesGewicht("1,5 l"), 1500);
  assert.equal(leesGewicht("pak 250 g"), 250);
  assert.equal(leesGewicht("per stuk"), null);
  assert.equal(leesGewicht(undefined), null);
});

// -- omzetting per winkel ----------------------------------------------------

test("een AH-detail wordt een bruikbaar product", () => {
  const p = uitAhDetail(
    { nutritionalInformation: [{ nutrients: AH_TABEL.map((r) => ({ name: r.naam, value: r.waarde })) }] },
    { title: "AH Havermout", salesUnitSize: "500 g" },
    "8718906123456"
  );
  assert.ok(p);
  assert.equal(p.name, "AH Havermout");
  assert.equal(p.brand, "Albert Heijn");
  assert.equal(p.bron, "winkel");
  assert.equal(p.barcode, "8718906123456");
  assert.deepEqual(p.portie, { grams: 500, label: "500 g" });
  assert.equal(p.per100.kcal, 380);
});

test("een AH-product zonder voedingswaarden telt als niet gevonden", () => {
  assert.equal(uitAhDetail({}, { title: "Iets" }, "123"), null);
  assert.equal(
    uitAhDetail({ nutritionalInformation: [{ nutrients: [] }] }, { title: "Iets" }, "123"),
    null
  );
});

test("een AH-product zonder naam telt als niet gevonden", () => {
  const p = uitAhDetail(
    { nutritionalInformation: [{ nutrients: [{ name: "Energie (kcal)", value: "100" }] }] },
    {}, "123"
  );
  assert.equal(p, null);
});

test("een Jumbo-detail wordt een bruikbaar product", () => {
  const p = uitJumboDetail({
    title: "Jumbo Magere Kwark",
    quantity: "500 g",
    nutritionalInformation: [{
      nutritionalData: [
        { name: "Energie (kcal)", valuePer100g: "47 kcal" },
        { name: "Eiwitten", valuePer100g: "9,4 g" },
        { name: "Vetten", valuePer100g: "0,2 g" },
        { name: "waarvan verzadigd", valuePer100g: "0,1 g" },
        { name: "Koolhydraten", valuePer100g: "3,9 g" },
        { name: "waarvan suikers", valuePer100g: "3,9 g" },
      ],
    }],
  }, "8718452123456");
  assert.ok(p);
  assert.equal(p.name, "Jumbo Magere Kwark");
  assert.equal(p.brand, "Jumbo");
  assert.equal(p.per100.protein_g, 9.4);
  assert.equal(p.per100.sugar_g, 3.9);
  assert.deepEqual(p.portie, { grams: 500, label: "500 g" });
});

// -- de keten ----------------------------------------------------------------

test("een winkel die omvalt neemt de rest niet mee", async () => {
  const kapot = async () => { throw new Error("endpoint verplaatst"); };
  assert.equal(await zoekBijWinkels("123", kapot), null);
});

test("de eerste winkel met een treffer wint", async () => {
  let aanroepen = 0;
  const haal = async (url: string) => {
    aanroepen++;
    if (url.includes("mobile-auth")) return { access_token: "t" };
    if (url.includes("product/search")) return { products: [{ webshopId: 1, title: "AH Kwark" }] };
    if (url.includes("product/detail")) {
      return { nutritionalInformation: [{ nutrients: [{ name: "Energie (kcal)", value: "47" }, { name: "Eiwitten", value: "9,4 g" }] }] };
    }
    throw new Error("Jumbo had niet aangeroepen moeten worden");
  };
  const p = await zoekBijWinkels("123", haal);
  assert.equal(p?.name, "AH Kwark");
  assert.equal(aanroepen, 3, "AH is drie aanroepen; Jumbo wordt niet meer geprobeerd");
});

test("geen token betekent geen AH-resultaat", async () => {
  const haal = async (url: string) => {
    if (url.includes("mobile-auth")) return {};
    throw new Error("had hier niet moeten komen");
  };
  assert.equal(await zoekBijWinkels("123", haal), null);
});
