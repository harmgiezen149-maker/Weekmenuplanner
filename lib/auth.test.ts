import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  controleerWachtwoord, gebruikersnaamProbleem, hashWachtwoord,
  normaliseerGebruikersnaam, wachtwoordProbleem,
} from "./auth.ts";

test("een gehasht wachtwoord is terug te herkennen", () => {
  const regel = hashWachtwoord("mijngeheim123");
  assert.equal(controleerWachtwoord("mijngeheim123", regel), true);
});

test("een verkeerd wachtwoord wordt afgewezen", () => {
  const regel = hashWachtwoord("mijngeheim123");
  assert.equal(controleerWachtwoord("mijngeheim124", regel), false);
  assert.equal(controleerWachtwoord("", regel), false);
});

test("het wachtwoord staat niet leesbaar in de opgeslagen regel", () => {
  const regel = hashWachtwoord("wachtwoordinklaretaal");
  assert.equal(regel.includes("wachtwoordinklaretaal"), false);
  assert.equal(regel.startsWith("scrypt$"), true);
});

test("twee keer hetzelfde wachtwoord geeft twee verschillende regels", () => {
  // Zonder eigen zout per regel zou de database verraden wie hetzelfde
  // wachtwoord gebruikt, en zou één regenboogtabel beide kraken.
  assert.notEqual(hashWachtwoord("zelfdewachtwoord"), hashWachtwoord("zelfdewachtwoord"));
});

test("een kapotte of vreemde regel wordt afgewezen in plaats van geaccepteerd", () => {
  for (const regel of [
    "", "onzin", "scrypt$16384$8$1$zout", "bcrypt$16384$8$1$aa$bb",
    "scrypt$16384$8$1$$", "scrypt$0$8$1$aa$bb",
  ]) {
    assert.equal(controleerWachtwoord("wachtwoord", regel), false, regel);
  }
});

test("absurde rekenkosten in een regel laten de server niet vastlopen", () => {
  // Een regel uit de database is invoer. Zou N hier zomaar worden overgenomen,
  // dan is één rij genoeg om de server minutenlang te laten rekenen.
  const regel = "scrypt$1073741824$8$1$aabb$ccdd";
  assert.equal(controleerWachtwoord("wachtwoord", regel), false);
});

test("gebruikersnamen worden genormaliseerd naar kleine letters zonder spaties", () => {
  assert.equal(normaliseerGebruikersnaam("  Harm  "), "harm");
  assert.equal(normaliseerGebruikersnaam("HARM.G"), "harm.g");
});

test("gebruikersnaam met spaties of vreemde tekens wordt geweigerd", () => {
  assert.equal(gebruikersnaamProbleem("harm"), null);
  assert.equal(gebruikersnaamProbleem("harm-g_1.2"), null);
  assert.notEqual(gebruikersnaamProbleem("h"), null);
  assert.notEqual(gebruikersnaamProbleem("harm giezen"), null);
  assert.notEqual(gebruikersnaamProbleem("harm@thuis"), null);
  assert.notEqual(gebruikersnaamProbleem("x".repeat(33)), null);
});

test("een te kort wachtwoord wordt geweigerd", () => {
  assert.notEqual(wachtwoordProbleem("kort"), null);
  assert.equal(wachtwoordProbleem("langgenoeg"), null);
});
