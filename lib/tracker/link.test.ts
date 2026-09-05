import { test } from "node:test";
import assert from "node:assert/strict";
import { leesUrl, ontleedIngredient, leesPersonen, uitJsonLd, uitHtml, striptags, leesBereiding } from "./link.ts";

test("een link wordt uit een gedeelde tekst gevist", () => {
  assert.equal(leesUrl("https://ah.nl/recept/123"), "https://ah.nl/recept/123");
  assert.equal(
    leesUrl("Kijk eens: https://leukerecepten.nl/pasta lekker toch?"),
    "https://leukerecepten.nl/pasta"
  );
  // Android deelt vaak titel plus url in één tekstveld.
  assert.equal(
    leesUrl("Pasta pesto\nhttps://24kitchen.nl/pasta-pesto"),
    "https://24kitchen.nl/pasta-pesto"
  );
});

test("zonder bruikbare link komt er null terug", () => {
  assert.equal(leesUrl(""), null);
  assert.equal(leesUrl("gewoon wat tekst zonder link"), null);
  assert.equal(leesUrl("ftp://ergens/bestand"), null);
  assert.equal(leesUrl("javascript:alert(1)"), null);
});

// -- ingredienten ontleden ---------------------------------------------------

test("hoeveelheid, eenheid en naam worden gescheiden", () => {
  assert.deepEqual(ontleedIngredient("200 g bloem"), { naam: "bloem", hoev: 200, eenheid: "g" });
  assert.deepEqual(ontleedIngredient("2 el olijfolie"), { naam: "olijfolie", hoev: 2, eenheid: "el" });
  assert.deepEqual(ontleedIngredient("3 tenen knoflook"), { naam: "knoflook", hoev: 3, eenheid: "tenen" });
  assert.deepEqual(ontleedIngredient("1 blik tomatenblokjes"), { naam: "tomatenblokjes", hoev: 1, eenheid: "blik" });
});

test("een woord dat geen eenheid is hoort bij de naam", () => {
  // "rode" is geen maat, dus het geheel is de naam.
  assert.deepEqual(ontleedIngredient("2 rode uien"), { naam: "rode uien", hoev: 2, eenheid: "" });
  assert.deepEqual(ontleedIngredient("4 eieren"), { naam: "eieren", hoev: 4, eenheid: "" });
});

test("breuktekens van receptsites worden begrepen", () => {
  assert.deepEqual(ontleedIngredient("½ tl zout"), { naam: "zout", hoev: 0.5, eenheid: "tl" });
  assert.deepEqual(ontleedIngredient("¼ l melk"), { naam: "melk", hoev: 0.25, eenheid: "l" });
});

test("een komma als decimaalteken werkt", () => {
  assert.deepEqual(ontleedIngredient("0,5 kg aardappels"), { naam: "aardappels", hoev: 0.5, eenheid: "kg" });
});

test("een regel zonder getal wordt een enkel stuk", () => {
  assert.deepEqual(ontleedIngredient("zout en peper"), { naam: "zout en peper", hoev: 1, eenheid: "" });
});

test("lege en absurde regels vallen af", () => {
  assert.equal(ontleedIngredient(""), null);
  assert.equal(ontleedIngredient("   "), null);
  assert.equal(ontleedIngredient("x".repeat(200)), null);
});

// -- aantal personen ---------------------------------------------------------

test("het aantal personen wordt uit allerlei schrijfwijzen gehaald", () => {
  assert.equal(leesPersonen("4"), 4);
  assert.equal(leesPersonen("4 personen"), 4);
  assert.equal(leesPersonen(["6 servings"]), 6);
  assert.equal(leesPersonen(2), 2);
});

test("een onbruikbaar aantal personen valt terug op vier", () => {
  assert.equal(leesPersonen(undefined), 4);
  assert.equal(leesPersonen("naar smaak"), 4);
  assert.equal(leesPersonen(0), 4);
  assert.equal(leesPersonen(999), 4);
});

// -- JSON-LD -----------------------------------------------------------------

const JSONLD_PAGINA = `<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Recipe","name":"Pasta pesto",
 "recipeYield":"4 personen",
 "recipeIngredient":["300 g pasta","2 el olijfolie","150 g pesto","50 g Parmezaanse kaas"]}
</script></head><body>Punten volgens deze site: 12</body></html>`;

test("een schema.org Recipe-blok wordt gelezen", () => {
  const r = uitJsonLd(JSONLD_PAGINA);
  assert.ok(r);
  assert.equal(r.titel, "Pasta pesto");
  assert.equal(r.personen, 4);
  assert.equal(r.ingredienten.length, 4);
  assert.deepEqual(r.ingredienten[0], { naam: "pasta", hoev: 300, eenheid: "g" });
});

test("een puntwaarde op de bronpagina wordt niet overgenomen", () => {
  const r = uitJsonLd(JSONLD_PAGINA)!;
  const alsTekst = JSON.stringify(r);
  assert.ok(!alsTekst.includes("12"), "er mag geen puntwaarde van de bron meekomen");
  assert.ok(!("punten" in r), "het resultaat kent geen puntenveld");
});

test("een Recipe binnen een @graph wordt ook gevonden", () => {
  const html = `<script type="application/ld+json">
  {"@graph":[{"@type":"WebSite","name":"Site"},
             {"@type":["Recipe"],"name":"Soep","recipeYield":"2",
              "recipeIngredient":["1 l bouillon","200 g wortel"]}]}
  </script>`;
  const r = uitJsonLd(html);
  assert.equal(r?.titel, "Soep");
  assert.equal(r?.personen, 2);
  assert.equal(r?.ingredienten.length, 2);
});

test("pagina's zonder Recipe-blok geven null", () => {
  assert.equal(uitJsonLd("<html><body>niets</body></html>"), null);
  assert.equal(uitJsonLd('<script type="application/ld+json">{kapot</script>'), null);
  assert.equal(uitJsonLd('<script type="application/ld+json">{"@type":"Article","name":"x"}</script>'), null);
});

// -- HTML-terugval -----------------------------------------------------------

test("de terugval leest een ingredientenlijst uit de HTML", () => {
  const html = `<html><head><title>Appeltaart - Site</title></head><body>
    <ul><li class="recipe-ingredient">200 g bloem</li>
        <li class="ingredient-item">100 g suiker</li>
        <li class="ingredients__item">3 appels</li></ul></body></html>`;
  const r = uitHtml(html);
  assert.ok(r);
  assert.match(r.titel, /Appeltaart/);
  assert.equal(r.ingredienten.length, 3);
  assert.deepEqual(r.ingredienten[0], { naam: "bloem", hoev: 200, eenheid: "g" });
});

test("de terugval slaat aan noch bij te weinig regels", () => {
  assert.equal(uitHtml("<li class='ingredient'>200 g bloem</li>"), null);
  assert.equal(uitHtml("<html><body>geen lijst</body></html>"), null);
});

// -- tekst opschonen ---------------------------------------------------------

test("scripts en stijlen verdwijnen uit de platte tekst", () => {
  const html = "<div>Hallo<script>kwaad()</script><style>p{}</style> wereld &amp; zo</div>";
  assert.equal(striptags(html), "Hallo wereld & zo");
});

test("de bereiding komt in vier vormen binnen", () => {
  // Eén lange tekst.
  assert.equal(leesBereiding("Meng alles en bak het."), "Meng alles en bak het.");

  // Een lijst zinnen.
  assert.equal(leesBereiding(["Snijd de ui.", "Bak hem aan."]), "1. Snijd de ui.\n2. Bak hem aan.");

  // HowToStep-objecten, zoals de meeste receptsites het schrijven.
  assert.equal(
    leesBereiding([{ "@type": "HowToStep", text: "Verwarm de oven." }, { "@type": "HowToStep", text: "Zet hem erin." }]),
    "1. Verwarm de oven.\n2. Zet hem erin."
  );

  // Secties met stappen erin.
  assert.equal(
    leesBereiding([{ "@type": "HowToSection", itemListElement: [{ text: "Maak de saus." }] }]),
    "Maak de saus."
  );
});

test("html in de bereiding gaat eruit", () => {
  assert.equal(leesBereiding("<p>Kook de <b>pasta</b>.</p>"), "Kook de pasta.");
});

test("geen bereiding levert een lege tekst op", () => {
  assert.equal(leesBereiding(undefined), "");
  assert.equal(leesBereiding([]), "");
  assert.equal(leesBereiding([{ "@type": "HowToStep" }]), "");
});
