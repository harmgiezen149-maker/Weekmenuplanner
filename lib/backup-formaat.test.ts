import { strict as assert } from "node:assert";
import { test } from "node:test";
import { BACKUP_VERSIE, leesBackup, tel } from "./backup-formaat.ts";
import type { BackupBestand } from "./backup-formaat.ts";

function bestand(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    app: "kookboek",
    versie: BACKUP_VERSIE,
    gemaakt: "2026-08-25T10:00:00.000Z",
    persoon: { id: "p1", naam: "Harm" },
    gedeeld: {
      recepten: [{ id: "r1" }, { id: "r2" }],
      dagen: [{ date: "2026-08-24" }],
      favorieten: [], recent: [], maaltijden: [], eigenProducten: [],
    },
    persoonlijk: { wegingen: [{ date: "2026-08-24", kg: 82.4 }], adviezen: [] },
    ...extra,
  };
}

test("een geldige back-up wordt gelezen", () => {
  const uit = leesBackup(bestand());
  assert.ok("bestand" in uit);
  assert.equal(uit.bestand.gedeeld.recepten.length, 2);
  assert.equal(uit.bestand.persoonlijk.wegingen.length, 1);
});

test("een bestand van een andere app gaat er niet overheen", () => {
  // Dit is de enige echte grens: terugzetten wist wat er staat, dus een
  // willekeurig JSON-bestand mag nooit als back-up doorgaan.
  for (const ruw of [null, "tekst", 42, {}, { app: "ietsanders", versie: 1 }]) {
    const uit = leesBackup(ruw);
    assert.ok("fout" in uit, JSON.stringify(ruw));
  }
});

test("een back-up uit een nieuwere versie wordt geweigerd", () => {
  const uit = leesBackup(bestand({ versie: BACKUP_VERSIE + 1 }));
  assert.ok("fout" in uit);
  assert.match(uit.fout, /nieuwere versie/);
});

test("het prijsboek gaat mee en ontbreekt netjes in oude back-ups", () => {
  const met = leesBackup(bestand({
    gedeeld: { prijsboek: { melk: { euro: 1.2, aantal: 1, eenheid: "l", winkel: "AH", datum: "2026-08-01" } } },
  }));
  assert.ok("bestand" in met);
  assert.equal(met.bestand.gedeeld.prijsboek?.melk.euro, 1.2);

  const zonder = leesBackup(bestand());
  assert.ok("bestand" in zonder);
  assert.equal(zonder.bestand.gedeeld.prijsboek, null);
});

test("ontbrekende onderdelen worden aangevuld met leeg in plaats van geweigerd", () => {
  // Een back-up van vroeger mist velden die er later bij zijn gekomen. Die
  // hoort gewoon te werken.
  const uit = leesBackup({ app: "kookboek", versie: 1 });
  assert.ok("bestand" in uit);
  assert.deepEqual(uit.bestand.gedeeld.recepten, []);
  assert.equal(uit.bestand.gedeeld.week, null);
  assert.equal(uit.bestand.persoonlijk.profiel, null);
  assert.deepEqual(uit.bestand.persoonlijk.adviezen, []);
});

test("een veld dat geen lijst is wordt een lege lijst", () => {
  const uit = leesBackup(bestand({ gedeeld: { recepten: "kapot", dagen: null } }));
  assert.ok("bestand" in uit);
  assert.deepEqual(uit.bestand.gedeeld.recepten, []);
  assert.deepEqual(uit.bestand.gedeeld.dagen, []);
});

test("de telling komt overeen met wat er in het bestand zit", () => {
  const uit = leesBackup(bestand());
  assert.ok("bestand" in uit);
  const t = tel(uit.bestand as BackupBestand);
  assert.deepEqual(t, {
    recepten: 2, dagen: 1, wegingen: 1, adviezen: 0, eigenProducten: 0,
  });
});
