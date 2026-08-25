import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ingredientNaarGram, schoonIngredient, matchIngredient, matchNaarComponent,
  berekenReceptPunten, receptVingerafdruk, REKENVERSIE,
} from "./recept.ts";
import { toonPunten } from "./points.ts";

// -- omrekenen ---------------------------------------------------------------

test("gram en milliliter gaan een op een", () => {
  assert.equal(ingredientNaarGram(250, "g").grams, 250);
  assert.equal(ingredientNaarGram(200, "ml").grams, 200);
  assert.equal(ingredientNaarGram(1.5, "kg").grams, 1500);
  assert.equal(ingredientNaarGram(250, "g").onzeker, false);
});

test("huishoudelijke maten worden geschat", () => {
  assert.equal(ingredientNaarGram(2, "el").grams, 30);
  assert.equal(ingredientNaarGram(1, "tl").grams, 5);
  assert.equal(ingredientNaarGram(3, "tenen").grams, 15);
  assert.equal(ingredientNaarGram(1, "blik").grams, 400);
  assert.equal(ingredientNaarGram(2, "sneetjes").grams, 70);
});

test("een stuk gebruikt de portiegrootte van het gevonden product", () => {
  const banaan = matchIngredient("banaan", 2, "stuk");
  assert.ok(banaan.product);
  // Basisproduct banaan heeft een portie van 120 g per stuk.
  assert.equal(banaan.omrekening.grams, 240);
  assert.equal(banaan.omrekening.onzeker, false);
  assert.match(banaan.omrekening.aanname, /120 g/);
});

test("zonder bekende portiegrootte valt een stuk terug op 100 g, en dat is onzeker", () => {
  const r = ingredientNaarGram(1, "stuk");
  assert.equal(r.grams, 100);
  assert.equal(r.onzeker, true);
});

test("een onbekende maat telt niet mee in plaats van stilzwijgend geraden", () => {
  const r = ingredientNaarGram(1, "vleugje");
  assert.equal(r.onbekend, true);
  assert.equal(r.grams, 0);
  assert.match(r.aanname, /niet herkend/);
});

test("lepelmaten worden herkend, ook in het meervoud en met punten", () => {
  // De aanleiding: "2 koffielepel" viel eerst terug op 100 g per stuk, en dat
  // maakte van een scheutje olie het zwaarste ingredient van het recept.
  assert.equal(ingredientNaarGram(2, "koffielepel").grams, 10);
  assert.equal(ingredientNaarGram(2, "koffielepel").onbekend, false);
  assert.equal(ingredientNaarGram(1, "kl").grams, 5);

  assert.equal(ingredientNaarGram(2, "eetlepels").grams, 30);
  assert.equal(ingredientNaarGram(2, "E.L.").grams, 30);
  assert.equal(ingredientNaarGram(2, "  El ").grams, 30);
  assert.equal(ingredientNaarGram(3, "theelepels").grams, 15);
  assert.equal(ingredientNaarGram(1, "TL.").grams, 5);
});

test("Nederlandse gewichtsmaten en verpakkingen worden herkend", () => {
  assert.equal(ingredientNaarGram(1, "ons").grams, 100);
  assert.equal(ingredientNaarGram(1, "pond").grams, 500);
  assert.equal(ingredientNaarGram(2, "blikjes").grams, 800);
  assert.equal(ingredientNaarGram(1, "snufje").grams, 1);
  assert.equal(ingredientNaarGram(3, "takjes").grams, 9);
});

test('"portie" gebruikt de portiegrootte van het product', () => {
  const brood = { grams: 35, label: "1 snee" };
  const product = {
    id: "b", name: "Brood", bron: "basis" as const, eenheid: "g" as const,
    per100: {
      kcal: 236, protein_g: 9, fat_g: 3.2, satfat_g: 0.7,
      carbs_g: 38, sugar_g: 3, fiber_g: 6.5, category: "default" as const,
    },
    portie: brood,
  };
  assert.equal(ingredientNaarGram(2, "portie", product).grams, 70);
  assert.equal(ingredientNaarGram(2, "porties", product).grams, 70);
});

test("twee koffielepels olie leveren ongeveer een punt op, geen twintig", () => {
  const uit = berekenReceptPunten([{ naam: "olijfolie", hoev: 2, eenheid: "koffielepel" }], 2);
  assert.equal(uit.maatOnbekend.length, 0);
  assert.ok(uit.perPortiePunten > 0);
  assert.ok(uit.perPortiePunten < 2, `kreeg ${uit.perPortiePunten} punten per portie`);
});

// -- namen opschonen ---------------------------------------------------------

test("bereidingswoorden en haakjes gaan eruit", () => {
  assert.equal(schoonIngredient("verse spinazie"), "spinazie");
  assert.equal(schoonIngredient("gesnipperde ui"), "ui");
  assert.equal(schoonIngredient("kipfilet (in blokjes)"), "kipfilet");
  assert.equal(schoonIngredient("magere kwark"), "kwark");
  assert.equal(schoonIngredient("Broccoli, in roosjes"), "broccoli");
});

// -- matchen -----------------------------------------------------------------

test("gewone ingredienten worden herkend", () => {
  for (const [naam, verwacht] of [
    ["kipfilet", "Kipfilet, rauw"],
    ["broccoli", "Broccoli"],
    ["olijfolie", "Olijfolie"],
    ["verse spinazie", "Spinazie"],
  ] as const) {
    const m = matchIngredient(naam, 100, "g");
    assert.equal(m.product?.name, verwacht, naam);
    assert.equal(m.overgeslagen, false);
  }
});

test("een onbekend ingredient wordt overgeslagen in plaats van geraden", () => {
  const m = matchIngredient("harissa", 1, "el");
  assert.equal(m.product, null);
  assert.equal(m.overgeslagen, true);
  assert.equal(matchNaarComponent(m), null);
});

test("een match levert een onderdeel met zijn eigen categorie op", () => {
  const c = matchNaarComponent(matchIngredient("broccoli", 300, "g"));
  assert.ok(c);
  assert.equal(c.grams, 300);
  assert.equal(c.nutrients.category, "vegetable");
  assert.ok(Math.abs(c.nutrients.kcal - 102) < 0.01); // 34 kcal per 100 g
});

// -- hele recepten -----------------------------------------------------------

const KIP_BROCCOLI = [
  { naam: "kipfilet", hoev: 500, eenheid: "g" },
  { naam: "broccoli", hoev: 400, eenheid: "g" },
  { naam: "zilvervliesrijst", hoev: 600, eenheid: "g" },
  { naam: "olijfolie", hoev: 2, eenheid: "el" },
  { naam: "harissa", hoev: 1, eenheid: "el" },
];

test("een recept wordt per portie doorgerekend", () => {
  const r = berekenReceptPunten(KIP_BROCCOLI, 4);
  assert.equal(r.personen, 4);
  assert.equal(r.componenten.length, 4); // harissa valt af
  assert.deepEqual(r.nietHerkend, ["harissa"]);
  assert.ok(r.perPortiePunten > 0);
  // Vier porties samen zijn het hele recept.
  const heel = r.componenten.reduce((s, c) => s + c.points_raw, 0);
  assert.ok(Math.abs(r.perPortiePunten * 4 - heel) < 1e-9);
});

test("meer personen betekent minder punten per portie", () => {
  const voorTwee = berekenReceptPunten(KIP_BROCCOLI, 2);
  const voorVier = berekenReceptPunten(KIP_BROCCOLI, 4);
  assert.ok(Math.abs(voorTwee.perPortiePunten - 2 * voorVier.perPortiePunten) < 1e-9);
});

test("de suikercorrectie blijft per ingredient gelden", () => {
  // Broccoli levert geen suikerpunten op ondanks 1,7 g suiker per 100 g.
  const alleenBroccoli = berekenReceptPunten([{ naam: "broccoli", hoev: 400, eenheid: "g" }], 4);
  assert.equal(alleenBroccoli.componenten[0].nutrients.category, "vegetable");
  assert.equal(toonPunten(alleenBroccoli.perPortiePunten, 1), 0);
});

test("een onzinnig aantal personen wordt een", () => {
  for (const p of [0, -3, NaN]) {
    assert.equal(berekenReceptPunten(KIP_BROCCOLI, p as number).personen, 1);
  }
});

test("een leeg recept geeft nul zonder te klappen", () => {
  const r = berekenReceptPunten([], 4);
  assert.equal(r.perPortiePunten, 0);
  assert.equal(r.componenten.length, 0);
  assert.deepEqual(r.nietHerkend, []);
});

test("een onleesbare maat wordt apart gemeld en telt niet mee", () => {
  const r = berekenReceptPunten([
    { naam: "kipfilet", hoev: 500, eenheid: "g" },
    { naam: "ui", hoev: 2, eenheid: "vleugje" },
  ], 2);
  assert.ok(r.maatOnbekend.includes("ui"), "onleesbare maat hoort gemeld te worden");
  // Niet ook nog als "onzeker": dat zou dezelfde regel twee keer melden.
  assert.ok(!r.onzeker.includes("ui"));
  assert.ok(!r.maatOnbekend.includes("kipfilet"));

  // Alleen de kip telt mee; de ui levert geen punten en ook geen 100 g aanname.
  const alleen = berekenReceptPunten([{ naam: "kipfilet", hoev: 500, eenheid: "g" }], 2);
  assert.equal(r.perPortiePunten, alleen.perPortiePunten);
});

test("een stuk zonder bekende portiegrootte blijft op 100 g staan", () => {
  // Anders dan bij een lepel is 100 g voor een stuk groente een verdedigbare
  // aanname: die zit binnen een factor drie. Bij een lepel zat hij er twintig
  // keer naast, en daar is de aanname daarom weg.
  const r = ingredientNaarGram(1, "stuk");
  assert.equal(r.grams, 100);
  assert.equal(r.onbekend, false);
  assert.equal(r.onzeker, true);
});

test("de rekenversie zit in de vingerafdruk", () => {
  // Zonder dit zouden al doorgerekende recepten hun oude uitkomst houden, ook
  // nadat de omrekening is verbeterd.
  assert.ok(receptVingerafdruk(KIP_BROCCOLI, 4).length > 0);
  assert.notEqual(REKENVERSIE, 1);
});

// -- cache-invalidatie -------------------------------------------------------

test("de vingerafdruk verandert zodra het recept verandert", () => {
  const basis = receptVingerafdruk(KIP_BROCCOLI, 4);
  assert.equal(receptVingerafdruk(KIP_BROCCOLI, 4), basis, "gelijk recept, gelijke afdruk");
  assert.notEqual(receptVingerafdruk(KIP_BROCCOLI, 2), basis, "ander aantal personen");
  assert.notEqual(
    receptVingerafdruk([...KIP_BROCCOLI, { naam: "citroen", hoev: 1, eenheid: "stuk" }], 4),
    basis, "extra ingredient"
  );
  assert.notEqual(
    receptVingerafdruk(KIP_BROCCOLI.map((i) => i.naam === "kipfilet" ? { ...i, hoev: 600 } : i), 4),
    basis, "andere hoeveelheid"
  );
});

// -- wat elk ingredient bijdraagt --------------------------------------------

/**
 * De uitsplitsing die het receptvenster toont, precies zoals de API hem maakt:
 * per match de punten van dat onderdeel, gedeeld door het aantal personen.
 */
function bijdragePerPortie(
  matches: ReturnType<typeof berekenReceptPunten>["matches"],
  personen: number
): (number | null)[] {
  return matches.map((m) => {
    const c = matchNaarComponent(m);
    return c ? c.points_raw / personen : null;
  });
}

test("de bijdragen per ingredient tellen op tot het totaal per portie", () => {
  const recept = [
    { naam: "kipfilet", hoev: 400, eenheid: "g" },
    { naam: "olijfolie", hoev: 2, eenheid: "el" },
    { naam: "rijst", hoev: 300, eenheid: "g" },
    { naam: "broccoli", hoev: 500, eenheid: "g" },
  ];
  const uit = berekenReceptPunten(recept, 4);
  const bijdragen = bijdragePerPortie(uit.matches, uit.personen);

  const som = bijdragen.reduce<number>((s, v) => s + (v ?? 0), 0);
  // Zonder deze gelijkheid zou het venster een uitsplitsing tonen die niet bij
  // het getoonde totaal optelt, en dan is hij als controlemiddel waardeloos.
  assert.ok(Math.abs(som - uit.perPortiePunten) < 1e-9,
    `som ${som} wijkt af van totaal ${uit.perPortiePunten}`);
});

test("een niet herkend ingredient levert geen bijdrage op", () => {
  const recept = [
    { naam: "rijst", hoev: 300, eenheid: "g" },
    { naam: "sjalotjesconfituur van de buurman", hoev: 1, eenheid: "el" },
  ];
  const uit = berekenReceptPunten(recept, 2);
  const bijdragen = bijdragePerPortie(uit.matches, uit.personen);

  assert.equal(bijdragen.length, 2);
  assert.ok(bijdragen[0] != null);
  assert.equal(bijdragen[1], null);
  // Het totaal telt hem ook niet mee, dus de optelling blijft kloppen.
  assert.ok(Math.abs((bijdragen[0] as number) - uit.perPortiePunten) < 1e-9);
});

test("meer personen verdeelt dezelfde bijdrage over meer porties", () => {
  const recept = [{ naam: "rijst", hoev: 400, eenheid: "g" }];
  const twee = berekenReceptPunten(recept, 2);
  const vier = berekenReceptPunten(recept, 4);

  const perTwee = bijdragePerPortie(twee.matches, twee.personen)[0] as number;
  const perVier = bijdragePerPortie(vier.matches, vier.personen)[0] as number;
  assert.ok(Math.abs(perTwee - 2 * perVier) < 1e-9);
});

test("een bijdrage onder nul wordt niet afgekapt", () => {
  // Vezelrijk en vrijwel calorieloos: dan trekt het ingredient de puntensom
  // omlaag. In de uitsplitsing hoort dat als min zichtbaar te zijn, want juist
  // zo'n regel verklaart een totaal dat laag uitvalt. Afkappen op nul gebeurt
  // pas bij het tonen van het recepttotaal.
  const vezelrijk = matchNaarComponent({
    ingredient: "psylliumvezels",
    hoev: 100,
    eenheid: "g",
    product: {
      id: "test-vezel", name: "Psylliumvezels", bron: "eigen", eenheid: "g",
      per100: {
        kcal: 20, protein_g: 2, fat_g: 0, satfat_g: 0,
        carbs_g: 2, sugar_g: 0, fiber_g: 80, category: "default",
      },
    },
    score: 100,
    omrekening: { grams: 100, aanname: "100 g", onzeker: false, onbekend: false },
    overgeslagen: false,
  });

  assert.ok(vezelrijk != null);
  assert.ok(vezelrijk.points_raw < 0, `verwachtte een min, kreeg ${vezelrijk.points_raw}`);
  // En zo'n waarde wordt pas bij het tonen van een totaal op nul gezet.
  assert.equal(toonPunten(vezelrijk.points_raw), 0);
});

test("kipfilet levert een positieve maar lage bijdrage", () => {
  // Vastgelegd omdat het de intuitie tegenspreekt: eiwit maakt een product
  // goedkoper, maar niet gratis. 100 g kipfilet blijft rond een punt.
  const uit = berekenReceptPunten([{ naam: "kipfilet", hoev: 400, eenheid: "g" }], 4);
  const bijdrage = bijdragePerPortie(uit.matches, uit.personen)[0] as number;
  assert.ok(bijdrage > 0.5 && bijdrage < 1.5, `kreeg ${bijdrage}`);
});

test("een ingredient valt in hooguit één van de twee gatenlijsten", () => {
  // Saffraan is noch als product bekend, noch met een leesbare maat. Zou het in
  // beide lijsten staan, dan telt het scherm het dubbel als "telt niet mee".
  const r = berekenReceptPunten([
    { naam: "kipfilet", hoev: 400, eenheid: "g" },
    { naam: "saffraan", hoev: 1, eenheid: "vleugje" },
    { naam: "ui", hoev: 2, eenheid: "vleugje" },
  ], 2);

  assert.deepEqual(r.nietHerkend, ["saffraan"]);
  assert.deepEqual(r.maatOnbekend, ["ui"]);
  // Twee van de drie tellen niet mee, en dat is precies de som van de lijsten.
  assert.equal(r.nietHerkend.length + r.maatOnbekend.length, 2);
  assert.equal(r.componenten.length, 1);
});
