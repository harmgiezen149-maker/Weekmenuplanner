import { test } from "node:test";
import assert from "node:assert/strict";
import { naamVarianten } from "./naamvarianten.ts";

test("een haakje levert twee namen op", () => {
  assert.deepEqual(naamVarianten("volkorenmeel (havermeel)"), ["volkorenmeel", "havermeel"]);
});

test("een opsomming valt uiteen", () => {
  assert.deepEqual(naamVarianten("spinazie, vers"), ["spinazie", "vers"]);
  assert.deepEqual(naamVarianten("kipfilet of kalkoenfilet"), ["kipfilet", "kalkoenfilet"]);
});

test("de naam zelf staat er niet bij", () => {
  assert.deepEqual(naamVarianten("kipfilet"), []);
  assert.deepEqual(naamVarianten("  kipfilet  "), []);
});

test("losse letters en lege delen vallen af", () => {
  assert.deepEqual(naamVarianten("ui (1)"), ["ui"]);
  assert.deepEqual(naamVarianten("melk,,"), ["melk"]);
});

test("er komen er hooguit vier", () => {
  assert.ok(naamVarianten("a1, b2, c3, d4, e5, f6").length <= 4);
});

test("niets in, niets uit", () => {
  assert.deepEqual(naamVarianten(""), []);
  assert.deepEqual(naamVarianten("   "), []);
});
