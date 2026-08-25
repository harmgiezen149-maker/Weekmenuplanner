import type { Category, Product } from "./types";

// ---------------------------------------------------------------------------
// Eigen basislijst met onbewerkte Nederlandse producten.
//
// Open Food Facts draait om verpakte artikelen met een streepjescode en is
// juist zwak in wat je dagelijks het vaakst logt: een ei, gekookte rijst, een
// stuk kipfilet. Deze lijst vult dat gat aan.
//
// Waarden zijn per 100 g of 100 ml, in de gebruikelijke bereidingsvorm
// (rijst en pasta gekookt, vlees en vis rauw). Aanvullen mag: één regel
// erbij is genoeg, de zoekfunctie pikt hem vanzelf op.
// ---------------------------------------------------------------------------

interface BasisRegel {
  id: string;
  naam: string;
  /** Extra woorden waarop gezocht kan worden. */
  ook?: string[];
  /**
   * Droog of gekookt gewogen.
   *
   * Dit is het verschil tussen een recept en een bord. Een recept zegt "300 g
   * rijst" en bedoelt de zak; jij logt "180 g rijst" en bedoelt je bord. Rijst
   * wordt bij het koken bijna drie keer zo zwaar, dus wie die twee door elkaar
   * haalt zit er een factor drie naast. Daarom staan beide vormen in de lijst
   * en kiest de zoekfunctie op basis van waar hij voor gebruikt wordt.
   */
  vorm?: "droog" | "gekookt";
  eenheid?: "g" | "ml";
  categorie?: Category;
  /** [kcal, eiwit, vet, verzadigd vet, koolhydraten, suiker, vezels] per 100. */
  w: [number, number, number, number, number, number, number];
  /**
   * Bevat alcohol. Alcohol levert 7 kcal per gram maar telt niet mee in de
   * macro's, dus voor deze regels kloppen de calorieen bewust niet met de som
   * van eiwit, vet en koolhydraten. De punten kloppen wel: die rekenen op kcal.
   */
  alcohol?: boolean;
  portie?: { grams: number; label: string };
}

const REGELS: BasisRegel[] = [
  // -- graan, brood en aardappel --
  { id: "brood-volkoren", naam: "Volkorenbrood", ook: ["snee", "boterham"],
    w: [236, 9.0, 3.2, 0.7, 38.0, 3.0, 6.5], portie: { grams: 35, label: "1 snee" } },
  { id: "brood-wit", naam: "Witbrood", ook: ["snee", "boterham"],
    w: [265, 8.5, 3.0, 0.7, 47.0, 4.0, 2.5], portie: { grams: 35, label: "1 snee" } },
  { id: "rijst-wit", naam: "Witte rijst, gekookt", ook: ["basmati", "jasmijn"], vorm: "gekookt",
    w: [130, 2.7, 0.3, 0.1, 28.0, 0.1, 0.4], portie: { grams: 180, label: "1 opscheplepel" } },
  { id: "rijst-zilvervlies", naam: "Zilvervliesrijst, gekookt", ook: ["bruine rijst"], vorm: "gekookt",
    w: [123, 2.7, 1.0, 0.2, 25.6, 0.4, 1.6], portie: { grams: 180, label: "1 opscheplepel" } },
  { id: "pasta", naam: "Pasta, gekookt", ook: ["spaghetti", "penne", "macaroni"], vorm: "gekookt",
    w: [158, 5.8, 0.9, 0.2, 31.0, 0.6, 1.8], portie: { grams: 180, label: "1 portie" } },
  { id: "pasta-volkoren", naam: "Volkorenpasta, gekookt", vorm: "gekookt",
    w: [124, 5.0, 0.5, 0.1, 26.0, 0.6, 3.9], portie: { grams: 180, label: "1 portie" } },
  { id: "aardappel", naam: "Aardappel, gekookt", ook: ["krieltjes"],
    w: [87, 1.9, 0.1, 0.0, 20.0, 0.9, 1.8], portie: { grams: 150, label: "3 middelgrote" } },
  { id: "couscous", naam: "Couscous, gekookt", vorm: "gekookt",
    w: [112, 3.8, 0.2, 0.0, 23.2, 0.1, 1.4], portie: { grams: 150, label: "1 portie" } },
  { id: "havermout", naam: "Havermout, droog", ook: ["oatmeal", "pap"], vorm: "droog",
    w: [379, 13.0, 6.5, 1.1, 67.0, 1.0, 10.0], portie: { grams: 40, label: "1 portie" } },

  // -- vlees, vis en ei --
  // Droog gewogen. In een recept staat de zak, niet het bord: "300 g rijst"
  // betekent 300 g uit de zak, en dat wordt gekookt ruim 800 gram.
  { id: "rijst-wit-droog", naam: "Witte rijst, droog", ook: ["basmati", "jasmijn"], vorm: "droog",
    w: [360, 6.7, 0.6, 0.2, 79.0, 0.1, 1.3] },
  { id: "rijst-zilvervlies-droog", naam: "Zilvervliesrijst, droog", ook: ["bruine rijst"], vorm: "droog",
    w: [363, 7.5, 2.7, 0.6, 72.0, 0.7, 3.5] },
  { id: "pasta-droog", naam: "Pasta, droog", ook: ["spaghetti", "penne", "macaroni", "tagliatelle"], vorm: "droog",
    w: [371, 13.0, 1.5, 0.3, 74.0, 3.0, 3.2] },
  { id: "pasta-volkoren-droog", naam: "Volkorenpasta, droog", vorm: "droog",
    w: [348, 14.0, 2.5, 0.5, 63.0, 3.5, 9.0] },
  { id: "couscous-droog", naam: "Couscous, droog", vorm: "droog",
    w: [376, 12.8, 0.6, 0.1, 77.0, 0.2, 5.0] },
  { id: "bulgur-droog", naam: "Bulgur, droog", vorm: "droog",
    w: [342, 12.3, 1.3, 0.2, 63.0, 0.4, 12.5] },
  { id: "quinoa-droog", naam: "Quinoa, droog", vorm: "droog",
    w: [368, 14.1, 6.1, 0.7, 57.0, 0.9, 7.0] },
  { id: "quinoa", naam: "Quinoa, gekookt", vorm: "gekookt",
    w: [120, 4.4, 1.9, 0.2, 18.5, 0.9, 2.8] },
  { id: "mie-droog", naam: "Mie, droog", ook: ["noedels", "noodles"], vorm: "droog",
    w: [377, 12.0, 5.0, 1.5, 71.0, 2.0, 3.0] },
  { id: "mie", naam: "Mie, gekookt", vorm: "gekookt",
    w: [138, 4.5, 2.1, 0.5, 25.0, 0.5, 1.2] },
  { id: "linzen-droog", naam: "Linzen, droog", categorie: "legume", vorm: "droog",
    w: [353, 25.0, 1.1, 0.2, 49.0, 2.0, 11.0] },
  { id: "bruine-bonen-droog", naam: "Bruine bonen, droog", categorie: "legume", vorm: "droog",
    w: [341, 21.0, 1.2, 0.3, 55.0, 2.1, 16.0] },
  { id: "kikkererwten-droog", naam: "Kikkererwten, droog", categorie: "legume", vorm: "droog",
    w: [364, 19.0, 6.0, 0.6, 55.0, 10.0, 12.0] },

  { id: "wrap", naam: "Wrap", ook: ["tortilla"],
    w: [297, 8.0, 7.0, 3.0, 49.0, 2.5, 3.0], portie: { grams: 45, label: "1 wrap" } },
  { id: "stokbrood", naam: "Stokbrood", ook: ["baguette"],
    w: [274, 8.5, 1.5, 0.3, 55.0, 2.5, 2.8] },
  { id: "pitabrood", naam: "Pitabrood", ook: ["pita"],
    w: [275, 9.1, 1.2, 0.2, 55.7, 1.0, 2.2], portie: { grams: 60, label: "1 broodje" } },
  { id: "aardappelpuree", naam: "Aardappelpuree",
    w: [88, 2.0, 1.5, 0.9, 15.0, 1.2, 1.4] },
  { id: "frites-oven", naam: "Ovenfriet", ook: ["patat", "friet"],
    w: [180, 3.0, 6.0, 0.7, 27.0, 0.5, 3.0] },
  { id: "bloem", naam: "Tarwebloem", ook: ["bloem", "patentbloem"],
    w: [364, 10.3, 1.0, 0.2, 76.0, 0.3, 2.7] },

  { id: "kipfilet", naam: "Kipfilet, rauw", ook: ["kip"],
    w: [110, 23.0, 1.5, 0.5, 0, 0, 0], portie: { grams: 120, label: "1 filet" } },
  { id: "kipdij", naam: "Kipdijfilet, rauw",
    w: [148, 19.0, 8.0, 2.2, 0, 0, 0], portie: { grams: 120, label: "1 portie" } },
  { id: "gehakt-mager", naam: "Rundergehakt, mager, rauw",
    w: [175, 20.0, 10.0, 4.0, 0, 0, 0], portie: { grams: 100, label: "1 portie" } },
  { id: "gehakt-half", naam: "Half-om-halfgehakt, rauw",
    w: [242, 17.0, 19.0, 8.0, 0, 0, 0], portie: { grams: 100, label: "1 portie" } },
  { id: "biefstuk", naam: "Biefstuk, rauw",
    w: [124, 21.5, 4.0, 1.6, 0, 0, 0], portie: { grams: 125, label: "1 stuk" } },
  { id: "zalm", naam: "Zalmfilet, rauw",
    w: [208, 20.0, 13.0, 3.1, 0, 0, 0], portie: { grams: 125, label: "1 filet" } },
  { id: "kabeljauw", naam: "Kabeljauw, rauw", ook: ["witvis"],
    w: [82, 18.0, 0.7, 0.1, 0, 0, 0], portie: { grams: 125, label: "1 filet" } },
  { id: "tonijn-water", naam: "Tonijn in water, uitgelekt",
    w: [116, 26.0, 1.0, 0.3, 0, 0, 0], portie: { grams: 145, label: "1 blik" } },
  { id: "ei", naam: "Ei", ook: ["eieren", "gekookt ei", "gebakken ei"],
    w: [143, 12.6, 9.5, 3.1, 0.7, 0.4, 0], portie: { grams: 55, label: "1 ei" } },

  { id: "kipgehakt", naam: "Kipgehakt, rauw",
    w: [143, 20.0, 7.0, 2.0, 0.0, 0.0, 0.0] },
  { id: "spekblokjes", naam: "Spekblokjes", ook: ["bacon", "spek"],
    w: [280, 15.0, 24.0, 9.0, 0.5, 0.5, 0.0] },
  { id: "ham", naam: "Achterham",
    w: [104, 18.0, 3.0, 1.0, 1.0, 1.0, 0.0], portie: { grams: 20, label: "1 plak" } },
  { id: "chorizo", naam: "Chorizo",
    w: [455, 24.0, 38.0, 14.0, 2.0, 1.0, 0.0] },
  { id: "garnalen", naam: "Garnalen, gekookt",
    w: [85, 18.0, 1.0, 0.3, 0.5, 0.0, 0.0] },
  { id: "tonijn-olie", naam: "Tonijn in olie, uitgelekt",
    w: [186, 25.0, 9.0, 1.5, 0.0, 0.0, 0.0] },
  { id: "tofu", naam: "Tofu", ook: ["tahoe"], categorie: "legume",
    w: [76, 8.1, 4.8, 0.7, 1.9, 0.6, 0.3] },
  { id: "tempeh", naam: "Tempeh", categorie: "legume",
    w: [193, 19.0, 11.0, 2.2, 9.4, 0.0, 5.5] },
  { id: "vega-gehakt", naam: "Vegetarisch gehakt", categorie: "legume",
    w: [180, 17.0, 9.0, 1.5, 5.0, 1.0, 4.0] },

  // -- zuivel --
  { id: "melk-halfvol", naam: "Halfvolle melk", eenheid: "ml", categorie: "dairy_plain",
    w: [47, 3.5, 1.5, 1.0, 4.7, 4.7, 0], portie: { grams: 200, label: "1 glas" } },
  { id: "melk-mager", naam: "Magere melk", eenheid: "ml", categorie: "dairy_plain",
    w: [35, 3.5, 0.1, 0.1, 4.9, 4.9, 0], portie: { grams: 200, label: "1 glas" } },
  { id: "kwark-mager", naam: "Magere kwark", categorie: "dairy_plain",
    w: [47, 9.4, 0.2, 0.1, 3.9, 3.9, 0], portie: { grams: 150, label: "1 bakje" } },
  { id: "yoghurt-grieks-0", naam: "Griekse yoghurt 0%", categorie: "dairy_plain",
    w: [57, 10.0, 0.4, 0.1, 3.6, 3.6, 0], portie: { grams: 150, label: "1 bakje" } },
  { id: "yoghurt-mager", naam: "Magere yoghurt", categorie: "dairy_plain",
    w: [41, 4.1, 0.1, 0.1, 5.6, 5.6, 0], portie: { grams: 150, label: "1 bakje" } },
  { id: "kaas-48", naam: "Goudse kaas 48+", ook: ["jong belegen", "plak kaas"],
    w: [356, 25.0, 28.0, 18.0, 0, 0, 0], portie: { grams: 20, label: "1 plak" } },
  { id: "kaas-30", naam: "Kaas 30+", ook: ["magere kaas"],
    w: [275, 30.0, 17.0, 11.0, 0, 0, 0], portie: { grams: 20, label: "1 plak" } },
  { id: "boter", naam: "Roomboter",
    w: [717, 0.9, 81.0, 51.0, 0.1, 0.1, 0], portie: { grams: 10, label: "1 eetlepel" } },

  { id: "yoghurt-vol", naam: "Volle yoghurt", categorie: "dairy_plain",
    w: [61, 3.5, 3.3, 2.1, 4.7, 4.7, 0.0] },
  { id: "skyr", naam: "Skyr", categorie: "dairy_plain",
    w: [63, 11.0, 0.2, 0.1, 4.0, 4.0, 0.0] },
  { id: "huttenkase", naam: "Hüttenkäse", ook: ["cottage cheese"], categorie: "dairy_plain",
    w: [98, 11.0, 4.3, 2.7, 3.4, 2.7, 0.0] },
  { id: "mozzarella", naam: "Mozzarella",
    w: [280, 18.0, 22.0, 14.0, 1.5, 1.0, 0.0] },
  { id: "feta", naam: "Feta",
    w: [264, 14.0, 21.0, 15.0, 4.1, 4.1, 0.0] },
  { id: "parmezaan", naam: "Parmezaanse kaas", ook: ["parmezaan", "grana"],
    w: [402, 33.0, 29.0, 19.0, 3.2, 0.8, 0.0] },
  { id: "roomkaas", naam: "Roomkaas", ook: ["monchou"],
    w: [253, 6.0, 24.0, 15.0, 3.5, 3.5, 0.0] },
  { id: "slagroom", naam: "Slagroom", ook: ["room"], eenheid: "ml",
    w: [337, 2.1, 35.0, 22.0, 3.0, 3.0, 0.0] },
  { id: "kookroom", naam: "Kookroom", eenheid: "ml",
    w: [195, 2.6, 20.0, 13.0, 3.2, 3.2, 0.0] },
  { id: "creme-fraiche", naam: "Crème fraîche",
    w: [292, 2.4, 30.0, 20.0, 2.9, 2.9, 0.0] },

  // -- groente --
  { id: "broccoli", naam: "Broccoli", categorie: "vegetable",
    w: [34, 2.8, 0.4, 0.0, 7.0, 1.7, 2.6], portie: { grams: 150, label: "1 portie" } },
  { id: "tomaat", naam: "Tomaat", categorie: "vegetable",
    w: [18, 0.9, 0.2, 0.0, 3.9, 2.6, 1.2], portie: { grams: 120, label: "1 stuk" } },
  { id: "komkommer", naam: "Komkommer", categorie: "vegetable",
    w: [15, 0.7, 0.1, 0.0, 3.6, 1.7, 0.5], portie: { grams: 100, label: "1 portie" } },
  { id: "sperziebonen", naam: "Sperziebonen", categorie: "vegetable",
    w: [31, 1.8, 0.2, 0.0, 7.0, 3.3, 2.7], portie: { grams: 150, label: "1 portie" } },
  { id: "wortel", naam: "Wortel", ook: ["worteltjes"], categorie: "vegetable",
    w: [41, 0.9, 0.2, 0.0, 10.0, 4.7, 2.8], portie: { grams: 150, label: "1 portie" } },
  { id: "spinazie", naam: "Spinazie", categorie: "vegetable",
    w: [23, 2.9, 0.4, 0.1, 3.6, 0.4, 2.2], portie: { grams: 150, label: "1 portie" } },
  { id: "paprika", naam: "Paprika", categorie: "vegetable",
    w: [31, 1.0, 0.3, 0.0, 6.0, 4.2, 2.1], portie: { grams: 120, label: "1 stuk" } },
  { id: "ui", naam: "Ui", categorie: "vegetable",
    w: [40, 1.1, 0.1, 0.0, 9.3, 4.2, 1.7], portie: { grams: 80, label: "1 stuk" } },
  { id: "bloemkool", naam: "Bloemkool", categorie: "vegetable",
    w: [25, 1.9, 0.3, 0.1, 5.0, 1.9, 2.0], portie: { grams: 150, label: "1 portie" } },
  { id: "courgette", naam: "Courgette", categorie: "vegetable",
    w: [16, 0.7, 0.1, 0.0, 3.6, 1.7, 0.5], portie: { grams: 150, label: "1 portie" } },

  { id: "knoflook", naam: "Knoflook", ook: ["teentje knoflook"], categorie: "vegetable",
    w: [149, 6.4, 0.5, 0.1, 27.0, 1.0, 2.1], portie: { grams: 3, label: "1 teentje" } },
  { id: "prei", naam: "Prei", categorie: "vegetable",
    w: [61, 1.5, 0.3, 0.0, 12.4, 3.5, 1.8] },
  { id: "champignons", naam: "Champignons", ook: ["paddenstoelen"], categorie: "vegetable",
    w: [22, 3.1, 0.3, 0.1, 0.4, 0.2, 1.0] },
  { id: "aubergine", naam: "Aubergine", categorie: "vegetable",
    w: [25, 1.0, 0.2, 0.0, 3.0, 2.4, 3.0] },
  { id: "doperwten", naam: "Doperwten", ook: ["erwtjes"], categorie: "vegetable",
    w: [81, 5.4, 0.4, 0.1, 9.0, 3.0, 5.1] },
  { id: "mais", naam: "Maïs", categorie: "vegetable",
    w: [86, 3.3, 1.2, 0.2, 15.0, 3.2, 2.7] },
  { id: "zoete-aardappel", naam: "Zoete aardappel", categorie: "vegetable",
    w: [86, 1.6, 0.1, 0.0, 17.0, 4.2, 3.0] },
  { id: "spruitjes", naam: "Spruitjes", categorie: "vegetable",
    w: [43, 3.4, 0.3, 0.1, 3.5, 2.2, 3.8] },
  { id: "boerenkool", naam: "Boerenkool", categorie: "vegetable",
    w: [49, 4.3, 0.9, 0.1, 2.5, 2.3, 3.6] },
  { id: "rode-kool", naam: "Rode kool", categorie: "vegetable",
    w: [31, 1.4, 0.2, 0.0, 4.7, 3.3, 2.1] },
  { id: "witte-kool", naam: "Witte kool", categorie: "vegetable",
    w: [25, 1.3, 0.1, 0.0, 3.4, 3.2, 2.5] },
  { id: "venkel", naam: "Venkel", categorie: "vegetable",
    w: [31, 1.2, 0.2, 0.0, 4.0, 3.9, 3.1] },
  { id: "pompoen", naam: "Pompoen", categorie: "vegetable",
    w: [26, 1.0, 0.1, 0.0, 4.9, 2.8, 0.5] },
  { id: "bleekselderij", naam: "Bleekselderij", ook: ["selderij"], categorie: "vegetable",
    w: [16, 0.7, 0.2, 0.0, 1.4, 1.3, 1.6] },
  { id: "sjalot", naam: "Sjalot", ook: ["sjalotje"], categorie: "vegetable",
    w: [72, 2.5, 0.1, 0.0, 13.0, 6.0, 3.2], portie: { grams: 30, label: "1 sjalot" } },
  { id: "tauge", naam: "Taugé", categorie: "vegetable",
    w: [30, 3.0, 0.2, 0.0, 2.6, 1.8, 1.8] },
  { id: "sla", naam: "Sla", ook: ["ijsbergsla", "kropsla"], categorie: "vegetable",
    w: [15, 1.4, 0.2, 0.0, 1.0, 0.8, 1.3] },
  { id: "andijvie", naam: "Andijvie", categorie: "vegetable",
    w: [17, 1.3, 0.2, 0.0, 1.0, 0.3, 3.1] },
  { id: "tomatenblokjes", naam: "Tomatenblokjes", ook: ["passata", "gezeefde tomaten", "tomaat uit blik"], categorie: "vegetable",
    w: [32, 1.3, 0.2, 0.0, 5.0, 4.5, 1.3] },
  { id: "tomatenpuree", naam: "Tomatenpuree", categorie: "vegetable",
    w: [82, 4.3, 0.5, 0.1, 12.2, 9.0, 2.8] },

  // -- fruit --
  { id: "banaan", naam: "Banaan", categorie: "fruit_whole",
    w: [89, 1.1, 0.3, 0.1, 23.0, 12.0, 2.6], portie: { grams: 120, label: "1 stuk" } },
  { id: "appel", naam: "Appel", categorie: "fruit_whole",
    w: [52, 0.3, 0.2, 0.0, 14.0, 10.0, 2.4], portie: { grams: 150, label: "1 stuk" } },
  { id: "sinaasappel", naam: "Sinaasappel", categorie: "fruit_whole",
    w: [47, 0.9, 0.1, 0.0, 12.0, 9.0, 2.4], portie: { grams: 150, label: "1 stuk" } },
  { id: "blauwe-bessen", naam: "Blauwe bessen", categorie: "fruit_whole",
    w: [57, 0.7, 0.3, 0.0, 14.0, 10.0, 2.4], portie: { grams: 100, label: "1 bakje" } },
  { id: "avocado", naam: "Avocado", categorie: "fruit_whole",
    w: [160, 2.0, 15.0, 2.1, 9.0, 0.7, 7.0], portie: { grams: 150, label: "1 halve" } },

  // -- peulvruchten en noten --
  { id: "bruine-bonen", naam: "Bruine bonen, gekookt", categorie: "legume", vorm: "gekookt",
    w: [127, 8.7, 0.5, 0.1, 23.0, 0.3, 6.4], portie: { grams: 150, label: "1 portie" } },
  { id: "kikkererwten", naam: "Kikkererwten, gekookt", categorie: "legume", vorm: "gekookt",
    w: [164, 8.9, 2.6, 0.3, 27.0, 4.8, 7.6], portie: { grams: 150, label: "1 portie" } },
  { id: "linzen", naam: "Linzen, gekookt", categorie: "legume", vorm: "gekookt",
    w: [116, 9.0, 0.4, 0.1, 20.0, 1.8, 7.9], portie: { grams: 150, label: "1 portie" } },
  { id: "amandelen", naam: "Amandelen", categorie: "nuts_seeds",
    w: [579, 21.0, 50.0, 3.8, 22.0, 4.4, 12.5], portie: { grams: 25, label: "1 handje" } },
  { id: "walnoten", naam: "Walnoten", categorie: "nuts_seeds",
    w: [654, 15.0, 65.0, 6.1, 14.0, 2.6, 6.7], portie: { grams: 25, label: "1 handje" } },
  { id: "pindakaas", naam: "Pindakaas",
    w: [588, 25.0, 50.0, 10.0, 20.0, 9.0, 8.0], portie: { grams: 15, label: "1 mespunt" } },

  // -- olie en dranken --
  { id: "cashewnoten", naam: "Cashewnoten", categorie: "nuts_seeds",
    w: [580, 18.0, 44.0, 8.0, 27.0, 6.0, 3.3] },
  { id: "pijnboompitten", naam: "Pijnboompitten", categorie: "nuts_seeds",
    w: [673, 14.0, 68.0, 5.0, 13.0, 3.6, 3.7] },
  { id: "sesamzaad", naam: "Sesamzaad", categorie: "nuts_seeds",
    w: [573, 17.7, 50.0, 7.0, 23.0, 0.3, 11.8] },
  { id: "rozijnen", naam: "Rozijnen",
    w: [299, 3.1, 0.5, 0.1, 79.0, 59.0, 3.7] },
  { id: "kokosmelk", naam: "Kokosmelk", eenheid: "ml",
    w: [197, 2.0, 20.0, 17.5, 2.8, 2.8, 0.0] },
  { id: "bouillon", naam: "Bouillon", ook: ["groentebouillon", "kippenbouillon"], eenheid: "ml",
    w: [4, 0.3, 0.1, 0.0, 0.4, 0.2, 0.0] },
  { id: "sojasaus", naam: "Sojasaus", eenheid: "ml",
    w: [53, 8.1, 0.6, 0.1, 4.9, 1.7, 0.8] },
  { id: "ketjap", naam: "Ketjap manis", eenheid: "ml",
    w: [265, 3.0, 0.1, 0.0, 62.0, 55.0, 0.5] },
  { id: "mosterd", naam: "Mosterd",
    w: [66, 4.4, 3.3, 0.2, 5.8, 1.1, 3.3] },
  { id: "mayonaise", naam: "Mayonaise",
    w: [680, 1.1, 75.0, 6.0, 1.3, 1.3, 0.0] },
  { id: "suiker", naam: "Suiker",
    w: [400, 0.0, 0.0, 0.0, 100.0, 100.0, 0.0] },
  { id: "honing", naam: "Honing",
    w: [304, 0.3, 0.0, 0.0, 82.0, 82.0, 0.2] },
  { id: "zonnebloemolie", naam: "Zonnebloemolie", ook: ["bakolie", "olie"], eenheid: "ml",
    w: [900, 0.0, 100.0, 11.0, 0.0, 0.0, 0.0] },
  { id: "sesamolie", naam: "Sesamolie", eenheid: "ml",
    w: [900, 0.0, 100.0, 14.0, 0.0, 0.0, 0.0] },

  { id: "olijfolie", naam: "Olijfolie", eenheid: "ml",
    w: [900, 0, 100.0, 14.0, 0, 0, 0], portie: { grams: 10, label: "1 eetlepel" } },
  { id: "bier-pils", naam: "Pils", ook: ["bier"], eenheid: "ml", alcohol: true,
    w: [43, 0.5, 0, 0, 3.6, 0, 0], portie: { grams: 250, label: "1 glas" } },
  { id: "wijn-rood", naam: "Rode wijn", eenheid: "ml", alcohol: true,
    w: [85, 0.1, 0, 0, 2.6, 0.6, 0], portie: { grams: 150, label: "1 glas" } },
  { id: "wijn-wit", naam: "Witte wijn", eenheid: "ml", alcohol: true,
    w: [82, 0.1, 0, 0, 2.6, 1.0, 0], portie: { grams: 150, label: "1 glas" } },
];

function naarProduct(r: BasisRegel): Product {
  const [kcal, eiwit, vet, verzadigd, koolhydraten, suiker, vezels] = r.w;
  return {
    id: `basis:${r.id}`,
    name: r.naam,
    bron: "basis",
    eenheid: r.eenheid ?? "g",
    per100: {
      kcal, protein_g: eiwit, fat_g: vet, satfat_g: verzadigd,
      carbs_g: koolhydraten, sugar_g: suiker, fiber_g: vezels,
      category: r.categorie ?? "default",
    },
    ...(r.portie ? { portie: r.portie } : {}),
  };
}

export const BASISPRODUCTEN: Product[] = REGELS.map(naarProduct);

/**
 * Waar een product voor gewogen is, per id. Nodig om bij het zoeken de juiste
 * vorm te kunnen kiezen.
 */
const VORM: Map<string, "droog" | "gekookt"> = new Map(
  REGELS.filter((r) => r.vorm).map((r) => [`basis:${r.id}`, r.vorm as "droog" | "gekookt"])
);

/** Id's van producten waarvan de calorieen uit alcohol komen. */
export const MET_ALCOHOL: Set<string> = new Set(
  REGELS.filter((r) => r.alcohol).map((r) => `basis:${r.id}`)
);

/** Zoekterm normaliseren: kleine letters, zonder accenten. */
function normaliseer(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

export interface Treffer {
  product: Product;
  /** 0 tot 100. Onder de 50 is het een gok en hoort de gebruiker het te zien. */
  score: number;
}

export interface ZoekOpties {
  /**
   * Welke vorm de voorkeur heeft als beide op de lijst staan.
   *
   * Een recept zegt "300 g rijst" en bedoelt de zak; een logregel zegt
   * "180 g rijst" en bedoelt het bord. Zonder deze voorkeur zou een recept met
   * rijst er een factor drie naast zitten, en dat is precies zo'n fout die je
   * aan het totaal niet ziet.
   */
  voorkeur?: "droog" | "gekookt";
}

/** Hoeveel de voorkeursvorm zwaarder telt. Genoeg om een gelijkspel te beslechten,
 *  te weinig om een duidelijk betere naamtreffer te overrulen. */
const VORM_BONUS = 6;

/**
 * Zoekt in de basislijst en geeft de score erbij. Wordt gebruikt bij het
 * matchen van receptingredienten, waar zichtbaar moet zijn hoe zeker een
 * match is.
 */
export function zoekMetScore(term: string, limiet = 8, opties: ZoekOpties = {}): Treffer[] {
  const q = normaliseer(term);
  if (q.length < 1) return [];

  const scores: { p: Product; score: number }[] = [];
  REGELS.forEach((r, i) => {
    const naam = normaliseer(r.naam);
    const woorden = naam.split(/[\s,]+/);
    const extra = (r.ook ?? []).map(normaliseer);

    let score = 0;
    if (naam === q) score = 100;
    else if (naam.startsWith(q)) score = 80;
    else if (woorden.some((w) => w === q)) score = 70;
    else if (extra.some((e) => e === q)) score = 65;
    else if (woorden.some((w) => w.startsWith(q))) score = 50;
    else if (extra.some((e) => e.startsWith(q))) score = 45;
    else if (naam.includes(q)) score = 30;
    else if (extra.some((e) => e.includes(q))) score = 20;

    if (score > 0) {
      if (opties.voorkeur && r.vorm) {
        score += r.vorm === opties.voorkeur ? VORM_BONUS : -VORM_BONUS;
      }
      scores.push({ p: BASISPRODUCTEN[i], score });
    }
  });

  return scores
    .sort((a, b) =>
      b.score - a.score ||
      a.p.name.length - b.p.name.length ||
      a.p.name.localeCompare(b.p.name))
    .slice(0, limiet)
    .map((s) => ({ product: s.p, score: s.score }));
}

/**
 * Zoekt in de basislijst. Een treffer aan het begin van de naam weegt zwaarder
 * dan een treffer ergens in het midden, zodat "ei" bovenaan het ei geeft en
 * niet de sperziebonen.
 */
export function zoekBasisproducten(term: string, limiet = 8): Product[] {
  // Zonder voorkeur: wie in de tracker "rijst" zoekt heeft een bord voor zich
  // staan, maar krijgt hier gewoon beide vormen te zien en kiest zelf.
  return zoekMetScore(term, limiet).map((t) => t.product);
}

/** Is dit product droog of gekookt gewogen? Null als het niet uitmaakt. */
export function vormVan(productId: string): "droog" | "gekookt" | null {
  return VORM.get(productId) ?? null;
}
