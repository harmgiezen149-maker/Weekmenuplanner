import { strict as assert } from "node:assert";
import { test } from "node:test";
import { taskerProject } from "./tasker.ts";

const OPTIES = {
  adres: "https://voorbeeld.nl/api/tracker/beweging/extern",
  sleutel: "AbC-123_xyz",
};

test("het bestand is welgevormde XML met twee taken erin", () => {
  const xml = taskerProject(OPTIES);
  assert.match(xml, /^<\?xml version="1\.0"/);
  assert.match(xml, /<TaskerData /);
  assert.equal((xml.match(/<Task sr=/g) ?? []).length, 2);
  assert.equal((xml.match(/<\/TaskerData>/g) ?? []).length, 1);
  // Elke geopende actie wordt ook gesloten.
  assert.equal((xml.match(/<Action /g) ?? []).length, (xml.match(/<\/Action>/g) ?? []).length);
});

test("de acties zijn per taak opeenvolgend genummerd vanaf nul", () => {
  // Tasker leest ze op sr-nummer; een gat of een dubbele levert een taak op
  // waarin acties ontbreken of van plek wisselen.
  for (const blok of taskerProject(OPTIES).split("<Task sr=").slice(1)) {
    const nummers = [...blok.matchAll(/<Action sr="act(\d+)"/g)].map((m) => Number(m[1]));
    assert.ok(nummers.length > 0);
    assert.deepEqual(nummers, nummers.map((_, i) => i));
  }
});

test("de sleutel staat in de header-actie", () => {
  assert.match(taskerProject(OPTIES), /Authorization: Bearer AbC-123_xyz/);
});

test("de ampersands in de URL zijn ontsnapt", () => {
  // Een kale & maakt het bestand ongeldige XML, en dan importeert Tasker niets.
  const xml = taskerProject(OPTIES);
  const kaal = xml.replace(/&(amp|lt|gt|quot|#\d+);/g, "");
  assert.equal(kaal.includes("&"), false, "er staat nog een niet-ontsnapte &");
  assert.match(xml, /soort=%kb_soort&amp;minuten=%kb_minuten/);
});

test("een adres of sleutel met vreemde tekens breekt het bestand niet", () => {
  const xml = taskerProject({
    adres: "https://voorbeeld.nl/a?x=1&y=2",
    sleutel: 'a"b<c>d&e',
    naam: "Taak & <test>",
  });
  const kaal = xml.replace(/&(amp|lt|gt|quot|#\d+);/g, "");
  assert.equal(/[<>&]/.test(kaal.replace(/<[^>]*>/g, "")), false);
  assert.match(xml, /Bearer a&quot;b&lt;c&gt;d&amp;e/);
});

test("de taak begint in de proefstand", () => {
  // Een eerste run die het logboek volzet met testritjes is vervelender dan
  // een eerste run die niets doet.
  const xml = taskerProject(OPTIES);
  assert.match(xml, /<Str sr="arg0" ve="3">%kb_proef<\/Str>\s*<Str sr="arg1" ve="3">1<\/Str>/);
});

test("een leeg tekstargument staat er als lege tag, zoals Tasker het zelf schrijft", () => {
  assert.equal(/<Str sr="arg\d+" ve="3"><\/Str>/.test(taskerProject(OPTIES)), false);
});

test("de in te vullen velden staan leeg en zijn als zodanig gelabeld", () => {
  const xml = taskerProject(OPTIES);
  for (const v of ["%kb_json", "%kb_soort", "%kb_minuten", "%kb_datum", "%kb_id"]) {
    assert.match(xml, new RegExp(`<Str sr="arg0" ve="3">${v}</Str>\\s*<Str sr="arg1" ve="3"/>`), v);
  }
  assert.equal((xml.match(/VUL IN/g) ?? []).length, 5);
});

test("elke actie heeft een label, want dat is wat je in Tasker ziet", () => {
  const xml = taskerProject(OPTIES);
  const acties = (xml.match(/<Action /g) ?? []).length;
  assert.equal((xml.match(/<label>/g) ?? []).length, acties);
});

test("in de veldentaak gaan de gegevens achter de URL en niet in een body", () => {
  // Een lege variabele levert dan een leeg veld op in plaats van kapotte JSON.
  // In de JSON-taak is de body juist wél gevuld; die staat hierboven apart.
  const veldenTaak = taskerProject(OPTIES).split("<Task sr=")[2];
  assert.match(veldenTaak, /<Str sr="arg4" ve="3"\/>/);
  assert.equal(veldenTaak.includes("%kb_json"), false);
});

test("er zit een Project in dat naar alle taken verwijst", () => {
  // Letterlijk de fout die een bestand met alleen een <Task> oplevert:
  // "Import failed ... no Project found". En een tids die naar een taak wijst
  // die er niet is levert een leeg tabblad op.
  const xml = taskerProject(OPTIES);
  assert.match(xml, /<Project sr="proj\d+"/);
  const tids = (/<tids>([\d,]+)<\/tids>/.exec(xml)?.[1] ?? "").split(",");
  const taakIds = [...xml.matchAll(/<Task sr="task(\d+)"/g)].map((m) => m[1]);
  assert.deepEqual(tids, taakIds);
  assert.deepEqual([...xml.matchAll(/<id>(\d+)<\/id>/g)].map((m) => m[1]), taakIds);
});

test("de JSON-taak stuurt het hele blok mee als body", () => {
  // De plug-in geeft JSON terug, geen losse velden. Dat in Tasker uit elkaar
  // peuteren is priegelwerk; de app kan het in één keer.
  const xml = taskerProject(OPTIES);
  const jsonTaak = xml.split("<Task sr=")[1];
  assert.match(jsonTaak, /%kb_json/);
  assert.match(jsonTaak, /<Str sr="arg4" ve="3">%kb_json<\/Str>/);
  assert.match(jsonTaak, /Content-Type: application\/json/);
});

test("de taken staan in de volgorde waarin je ze aanpakt", () => {
  const namen = [...taskerProject(OPTIES).matchAll(/<nme>([^<]+)<\/nme>/g)].map((m) => m[1]);
  assert.match(namen[0], /^1 /);
  assert.match(namen[1], /^2 /);
});

test("de URL staat voluit in de HTTP-actie, niet via een tussenvariabele", () => {
  // Tasker vult variabelen één laag diep in. Zou de URL in %kb_url staan en
  // %kb_url zélf weer %kb_soort bevatten, dan verstuurt Tasker de letterlijke
  // tekst "%kb_soort".
  const xml = taskerProject(OPTIES);
  assert.equal(xml.includes("%kb_url"), false);
  assert.equal(xml.includes("%kb_header"), false);
  assert.match(xml, /<Str sr="arg1" ve="3">https:\/\/voorbeeld\.nl[^<]*soort=%kb_soort/);
});

test("beide taken beginnen in de proefstand", () => {
  const xml = taskerProject(OPTIES);
  assert.equal((xml.match(/%kb_proef<\/Str>\s*<Str sr="arg1" ve="3">1<\/Str>/g) ?? []).length, 2);
});

test("er staat geen voorbeeldvariabele in die op een echte lijkt", () => {
  // %hc_type ziet eruit als een bestaande variabele, wordt letterlijk
  // overgenomen, en levert dan een onvindbare fout op.
  assert.equal(/%hc_|%hs_/.test(taskerProject(OPTIES)), false);
});
