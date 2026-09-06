import { strict as assert } from "node:assert";
import { test } from "node:test";
import { leesFotoActiviteiten } from "./beweging-foto.ts";
import { leesGeplakteLijst } from "./koppeling.ts";

const VANDAAG = "2026-09-06";

test("het antwoord van het model wordt tab-gescheiden tekst", () => {
  const antwoord = JSON.stringify({
    activiteiten: [
      { naam: "Renkum Wandelen", datum: "05-09-2026", duur: "1:11:24" },
      { naam: "Kracht", datum: "03-09-2026", duur: "58:04" },
    ],
  });
  assert.equal(
    leesFotoActiviteiten(antwoord),
    "Renkum Wandelen\t05-09-2026\t1:11:24\nKracht\t03-09-2026\t58:04"
  );
});

test("de screenshot van het Garmin-overzicht levert boekbare activiteiten op", () => {
  // Precies de rij uit de daadwerkelijke schermafbeelding: naam, datum en duur
  // los onder elkaar, en er staat ook een activiteit tussen die de app niet
  // kent (Meditatie) — die hoort te blijven staan als tekst, niet als crash.
  const antwoord = JSON.stringify({
    activiteiten: [
      { naam: "Renkum Wandelen", datum: "05-09-2026", duur: "1:11:24" },
      { naam: "Meditatie", datum: "04-09-2026", duur: "17:35" },
      { naam: "Kracht", datum: "03-09-2026", duur: "58:04" },
      { naam: "Overbetuwe Fietsen", datum: "03-09-2026", duur: "18:46" },
    ],
  });
  const tekst = leesFotoActiviteiten(antwoord);
  const { herkend, afgewezen } = leesGeplakteLijst(tekst, VANDAAG);

  assert.equal(herkend.length, 3);
  assert.deepEqual(
    herkend.map((r) => `${r.datum} ${r.soort.id} ${r.minuten}`),
    ["2026-09-05 wandelen 71", "2026-09-03 krachttraining 58", "2026-09-03 fietsen-rustig 19"]
  );
  assert.equal(afgewezen.length, 1);
  assert.ok(afgewezen[0].includes("Meditatie"));
});

test("ongeldige of lege JSON levert niets op, geen crash", () => {
  assert.equal(leesFotoActiviteiten(""), "");
  assert.equal(leesFotoActiviteiten("geen json"), "");
  assert.equal(leesFotoActiviteiten("{ dit is geen geldig json"), "");
  assert.equal(leesFotoActiviteiten('{"activiteiten": "geen lijst"}'), "");
  assert.equal(leesFotoActiviteiten("{}"), "");
});

test("een activiteit zonder duur valt af, zonder datum blijft staan", () => {
  const antwoord = JSON.stringify({
    activiteiten: [
      { naam: "Zwemmen", datum: "01-09-2026" }, // geen duur: onbruikbaar
      { naam: "Yoga", duur: "1:14:43" }, // geen datum: leesGeplakteLijst vult vandaag in
    ],
  });
  const tekst = leesFotoActiviteiten(antwoord);
  assert.equal(tekst, "Yoga\t1:14:43");

  const { herkend, afgewezen } = leesGeplakteLijst(tekst, VANDAAG);
  assert.equal(herkend.length, 0); // yoga kent de app niet
  assert.equal(afgewezen.length, 1);
});

test("markdown-codeblokken en tekst eromheen worden genegeerd", () => {
  const antwoord = "Hier is de lijst:\n```json\n" + JSON.stringify({
    activiteiten: [{ naam: "Hardlopen", datum: "01-09-2026", duur: "45:00" }],
  }) + "\n```";
  assert.equal(leesFotoActiviteiten(antwoord), "Hardlopen\t01-09-2026\t45:00");
});
