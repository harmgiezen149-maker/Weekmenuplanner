import { test } from "node:test";
import assert from "node:assert/strict";
import { leesDeling } from "./deellink.ts";

test("een keurige deling met de link in url", () => {
  assert.deepEqual(
    leesDeling({ url: "https://ah.nl/recept/123", text: "", title: "Shakshuka" }),
    { url: "https://ah.nl/recept/123", tekst: "Shakshuka" }
  );
});

test("Chrome zet de link vaak in text, met de titel ervoor", () => {
  const d = leesDeling({
    text: "Lasagne bolognese https://leukerecepten.nl/lasagne",
    title: "Lasagne bolognese",
  });
  assert.equal(d.url, "https://leukerecepten.nl/lasagne");
  assert.equal(d.tekst, "Lasagne bolognese");
});

test("een punt achter de link hoort bij de zin", () => {
  assert.equal(leesDeling({ text: "Kijk hier: https://site.nl/recept." }).url, "https://site.nl/recept");
});

test("zonder link blijft de tekst over", () => {
  const d = leesDeling({ text: "boerenkool met worst" });
  assert.equal(d.url, null);
  assert.equal(d.tekst, "boerenkool met worst");
});

test("alleen http en https tellen als link", () => {
  assert.equal(leesDeling({ text: "javascript:alert(1)" }).url, null);
  assert.equal(leesDeling({ url: "content://media/foto.jpg" }).url, null);
});

test("een lege deling levert niets op", () => {
  assert.deepEqual(leesDeling({}), { url: null, tekst: "" });
  assert.deepEqual(leesDeling({ url: "   ", text: null, title: undefined }), { url: null, tekst: "" });
});

test("een eindeloze tekst wordt afgekapt", () => {
  assert.ok(leesDeling({ text: "a".repeat(500) }).tekst.length <= 200);
});
