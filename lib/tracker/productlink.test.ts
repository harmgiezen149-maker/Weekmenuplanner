import { test } from "node:test";
import assert from "node:assert/strict";
import {
  schoneUrl, eenheidVoor, uitNutritionInformation, uitProductJsonLd,
  leesVoedingsrijen, uitVoedingsHtml, naarProduct, lijktOpProduct,
} from "./productlink.ts";
import { rawPoints, toonPunten } from "./points.ts";

// -- de link opschonen -------------------------------------------------------

const JUMBO_LINK =
  "https://www.jumbo.com/producten/jumbo-multivitamine-light-1,5-l-583639FLS" +
  "?channable=02a13d696400353833363339464c53a6&utm_campaign=alwayson&utm_medium=cpc" +
  "&utm_source=google&ju_subth=b2c&gad_source=1&gclid=Cj0KCQjw16_UBhCq";

test("tracking-parameters gaan van de link af", () => {
  const schoon = schoneUrl(JUMBO_LINK);
  assert.equal(
    schoon,
    "https://www.jumbo.com/producten/jumbo-multivitamine-light-1,5-l-583639FLS"
  );
  for (const rommel of ["utm_", "gclid", "channable", "gad_source", "ju_subth"]) {
    assert.ok(!schoon.includes(rommel), `${rommel} hoort weg te zijn`);
  }
});

test("een link zonder rommel blijft ongemoeid", () => {
  const kaal = "https://www.ah.nl/producten/product/wi123456/ah-magere-kwark";
  assert.equal(schoneUrl(kaal), kaal);
});

test("een echte parameter blijft staan", () => {
  assert.equal(
    schoneUrl("https://winkel.nl/p?id=42&utm_source=google"),
    "https://winkel.nl/p?id=42"
  );
});

test("onzin komt onveranderd terug in plaats van te klappen", () => {
  assert.equal(schoneUrl("geen url"), "geen url");
});

// -- eenheid -----------------------------------------------------------------

test("dranken worden in milliliter gelogd", () => {
  assert.equal(eenheidVoor("Jumbo Multivitamine light 1,5 l"), "ml");
  assert.equal(eenheidVoor("Appelsap", "1 l"), "ml");
  assert.equal(eenheidVoor("Halfvolle melk"), "ml");
  assert.equal(eenheidVoor("Magere kwark", "500 g"), "g");
  assert.equal(eenheidVoor("Volkorenbrood"), "g");
});

// -- schema.org NutritionInformation ----------------------------------------

test("een NutritionInformation-blok wordt omgezet", () => {
  const n = uitNutritionInformation({
    "@type": "NutritionInformation",
    calories: "47 kcal",
    proteinContent: "9,4 g",
    fatContent: "0,2 g",
    saturatedFatContent: "0,1 g",
    carbohydrateContent: "3,9 g",
    sugarContent: "3,9 g",
    fiberContent: "0 g",
  });
  assert.ok(n);
  assert.equal(n.kcal, 47);
  assert.equal(n.protein_g, 9.4);
  assert.equal(n.satfat_g, 0.1);
  assert.equal(n.sugar_g, 3.9);
});

test("een leeg voedingsblok geeft null", () => {
  assert.equal(uitNutritionInformation({}), null);
  assert.equal(uitNutritionInformation({ servingSize: "100 g" }), null);
});

// -- productpagina met JSON-LD ----------------------------------------------

const JUMBO_PAGINA = `<!doctype html><html><head>
<title>Jumbo Multivitamine Light 1,5 l | Jumbo</title>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product",
 "name":"Jumbo Multivitamine Light 1,5 l",
 "brand":{"@type":"Brand","name":"Jumbo"},
 "gtin13":"8718452123456",
 "weight":"1,5 l",
 "offers":{"@type":"Offer","price":"1.29","priceCurrency":"EUR"},
 "nutrition":{"@type":"NutritionInformation","calories":"12 kcal","proteinContent":"0 g",
   "fatContent":"0 g","saturatedFatContent":"0 g","carbohydrateContent":"2,4 g",
   "sugarContent":"2,3 g","fiberContent":"0 g"}}
</script></head><body><p>Nu 2 voor 2,00 euro</p></body></html>`;

test("een productpagina levert naam, merk, streepjescode en voedingswaarden", () => {
  const p = uitProductJsonLd(JUMBO_PAGINA);
  assert.ok(p);
  assert.equal(p.naam, "Jumbo Multivitamine Light 1,5 l");
  assert.equal(p.merk, "Jumbo");
  assert.equal(p.barcode, "8718452123456");
  assert.equal(p.eenheid, "ml", "1,5 l is een drank");
  assert.equal(p.verpakking, 1500);
  assert.equal(p.per100.kcal, 12);
  assert.equal(p.per100.sugar_g, 2.3);
});

test("de prijs van de pagina komt niet mee", () => {
  const p = uitProductJsonLd(JUMBO_PAGINA)!;
  const tekst = JSON.stringify(p);
  assert.ok(!tekst.includes("1.29"), "de prijs hoort niet in het product te zitten");
  assert.ok(!tekst.includes("EUR"));
});

test("een merk als losse tekst werkt ook", () => {
  const p = uitProductJsonLd(`<script type="application/ld+json">
    {"@type":"Product","name":"Iets","brand":"Albert Heijn",
     "nutrition":{"calories":"100 kcal","proteinContent":"5 g"}}</script>`);
  assert.equal(p?.merk, "Albert Heijn");
});

test("een product zonder voedingswaarden telt niet", () => {
  const p = uitProductJsonLd(`<script type="application/ld+json">
    {"@type":"Product","name":"Vaatwastabletten","gtin13":"8718452000000"}</script>`);
  assert.equal(p, null);
});

test("een Product binnen een @graph wordt gevonden", () => {
  const p = uitProductJsonLd(`<script type="application/ld+json">
    {"@graph":[{"@type":"WebSite","name":"Jumbo"},
      {"@type":["Product"],"name":"Kwark","gtin13":"8718452999999",
       "nutrition":{"calories":"47 kcal","proteinContent":"9,4 g"}}]}</script>`);
  assert.equal(p?.naam, "Kwark");
  assert.equal(p?.barcode, "8718452999999");
});

test("een receptpagina levert geen product op", () => {
  assert.equal(uitProductJsonLd(`<script type="application/ld+json">
    {"@type":"Recipe","name":"Soep","recipeIngredient":["1 l bouillon"]}</script>`), null);
});

// -- voedingstabel uit HTML --------------------------------------------------

test("tabelrijen en definitielijsten worden allebei gelezen", () => {
  const rijen = leesVoedingsrijen(`
    <table><tr><th>Energie</th><td>380 kcal</td></tr>
           <tr><td>Eiwitten</td><td>13 g</td></tr></table>
    <dl><dt>Vet</dt><dd>6,5 g</dd></dl>`);
  assert.equal(rijen.length, 3);
  assert.deepEqual(rijen[0], { naam: "Energie", waarde: "380 kcal" });
  assert.deepEqual(rijen[2], { naam: "Vet", waarde: "6,5 g" });
});

test("de HTML-terugval maakt een product van een voedingstabel", () => {
  const p = uitVoedingsHtml(`<html><head><title>AH Havermout | Albert Heijn</title></head>
    <body><table>
      <tr><th>Energie</th><td>380 kcal</td></tr>
      <tr><td>Eiwitten</td><td>13 g</td></tr>
      <tr><td>Vetten</td><td>6,5 g</td></tr>
      <tr><td>waarvan verzadigd</td><td>1,1 g</td></tr>
      <tr><td>Koolhydraten</td><td>58 g</td></tr>
      <tr><td>Vezels</td><td>10 g</td></tr>
    </table></body></html>`);
  assert.ok(p);
  assert.equal(p.naam, "AH Havermout");
  assert.equal(p.per100.kcal, 380);
  assert.equal(p.per100.fiber_g, 10);
});

test("een pagina zonder bruikbare tabel geeft null", () => {
  assert.equal(uitVoedingsHtml("<html><body>niets</body></html>"), null);
  assert.equal(uitVoedingsHtml("<table><tr><td>Prijs</td><td>1,29</td></tr></table>"), null);
});

// -- omzetting en herkenning -------------------------------------------------

test("een ruw product wordt een bruikbaar product met punten", () => {
  const ruw = uitProductJsonLd(JUMBO_PAGINA)!;
  const p = naarProduct(ruw, JUMBO_LINK);
  assert.equal(p.id, "8718452123456", "de streepjescode is de sleutel");
  assert.equal(p.barcode, "8718452123456");
  assert.equal(p.bron, "winkel");
  assert.deepEqual(p.portie, { grams: 1500, label: "1500 ml" });
  // Multivitamine light: 12 kcal en 2,3 g suiker per 100 ml.
  assert.equal(toonPunten(rawPoints(p.per100, 100), 1), 1);
  // Een glas van 250 ml komt op nul uit na afronding? Nee: 0,72 -> 1.
  assert.ok(rawPoints(p.per100, 100) > 0);
});

test("zonder streepjescode wordt de opgeschoonde link de sleutel", () => {
  const p = naarProduct({ naam: "Iets", eenheid: "g", per100: {
    kcal: 100, protein_g: 0, fat_g: 0, satfat_g: 0, carbs_g: 0, sugar_g: 0, fiber_g: 0,
  } }, JUMBO_LINK);
  assert.ok(!p.id.includes("utm_"));
  assert.equal(p.barcode, undefined);
});

test("productpagina's en receptpagina's worden uit elkaar gehouden", () => {
  assert.equal(lijktOpProduct(JUMBO_PAGINA), true);
  assert.equal(lijktOpProduct('<script type="application/ld+json">{"@type":"Recipe","name":"x"}</script>'), false);
  assert.equal(lijktOpProduct("<html><body>een blog</body></html>"), false);
});
