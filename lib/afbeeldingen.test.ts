import { test } from "node:test";
import assert from "node:assert/strict";
import { afbeeldingenUitHtml } from "./afbeeldingen.ts";

const BRON = "https://voorbeeld.nl/recepten/shakshuka";

test("og:image staat vooraan", () => {
  const html = `
    <meta property="og:image" content="https://cdn.nl/shakshuka.jpg">
    <img src="/foto/pan.jpg">
  `;
  assert.deepEqual(afbeeldingenUitHtml(html, BRON), [
    "https://cdn.nl/shakshuka.jpg",
    "https://voorbeeld.nl/foto/pan.jpg",
  ]);
});

test("de omgekeerde attribuutvolgorde telt ook", () => {
  const html = `<meta content="https://cdn.nl/a.jpg" property="og:image">`;
  assert.deepEqual(afbeeldingenUitHtml(html, BRON), ["https://cdn.nl/a.jpg"]);
});

test("&amp; in de url wordt teruggedraaid", () => {
  // Zonder dit vraag je de fotoserver om een parameter "amp;height".
  const html = `<meta property="og:image" content="https://cdn.nl/a.jpg?w=1200&amp;h=800">`;
  assert.deepEqual(afbeeldingenUitHtml(html, BRON), ["https://cdn.nl/a.jpg?w=1200&h=800"]);
});

test("json-ld levert de foto, als string, lijst of object", () => {
  const html = `
    <script type="application/ld+json">
      {"@type":"Recipe","image":{"url":"https://cdn.nl/uit-object.jpg"}}
    </script>
    <script type="application/ld+json">
      {"@graph":[{"@type":"Recipe","image":["https://cdn.nl/uit-lijst.jpg"]}]}
    </script>
  `;
  assert.deepEqual(afbeeldingenUitHtml(html, BRON), [
    "https://cdn.nl/uit-object.jpg",
    "https://cdn.nl/uit-lijst.jpg",
  ]);
});

test("kapot json-ld gooit de rest niet weg", () => {
  const html = `
    <script type="application/ld+json">{ dit is geen json </script>
    <meta property="og:image" content="https://cdn.nl/a.jpg">
  `;
  assert.deepEqual(afbeeldingenUitHtml(html, BRON), ["https://cdn.nl/a.jpg"]);
});

test("logo's, iconen en svg vallen af", () => {
  const html = `
    <img src="https://cdn.nl/logo.png">
    <img src="https://cdn.nl/favicon.png">
    <img src="https://cdn.nl/gerecht.jpg">
  `;
  assert.deepEqual(afbeeldingenUitHtml(html, BRON), ["https://cdn.nl/gerecht.jpg"]);
});

test("lazy loading en srcset worden meegenomen", () => {
  const html = `
    <img data-src="https://cdn.nl/lui.jpg">
    <img srcset="https://cdn.nl/klein.jpg 400w, https://cdn.nl/groot.jpg 1200w">
  `;
  assert.deepEqual(afbeeldingenUitHtml(html, BRON), [
    "https://cdn.nl/lui.jpg",
    "https://cdn.nl/klein.jpg",
  ]);
});

test("dezelfde foto komt er maar één keer uit", () => {
  const html = `
    <meta property="og:image" content="https://cdn.nl/a.jpg">
    <meta name="twitter:image" content="https://cdn.nl/a.jpg">
    <img src="https://cdn.nl/a.jpg">
  `;
  assert.deepEqual(afbeeldingenUitHtml(html, BRON), ["https://cdn.nl/a.jpg"]);
});

test("er komen er hooguit acht", () => {
  const html = Array.from({ length: 20 }, (_, i) => `<img src="https://cdn.nl/${i}.jpg">`).join("");
  assert.equal(afbeeldingenUitHtml(html, BRON).length, 8);
});

test("een pagina zonder foto's levert niets op", () => {
  assert.deepEqual(afbeeldingenUitHtml("<html><body>niets</body></html>", BRON), []);
});
