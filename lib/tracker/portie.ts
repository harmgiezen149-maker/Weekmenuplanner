// ---------------------------------------------------------------------------
// Loggen per stuk in plaats van per gram.
//
// Wie drie boterhammen eet, weet dat het er drie zijn — niet dat het 105 gram
// is. De portiekiezer rekent dat om, maar dan moet er wel een naam voor één
// stuk zijn. Die staat in het portielabel, alleen niet in een vaste vorm: de
// eigen basislijst schrijft "1 snee", de productdatabase geeft door wat er op
// de verpakking staat ("2 biscuits (25 g)", of gewoon "30 g").
// ---------------------------------------------------------------------------

/** Wat er in het logboek achter het aantal komt te staan: "3 × snee". */
export const STUK_STANDAARD = "stuk";

/**
 * De naam van één stuk, afgeleid van het portielabel.
 *
 * Het getal ervoor gaat eraf: het aantal typ je zelf, en "3 × 1 snee" leest
 * als een som die niemand gevraagd heeft. Een label dat alleen een gewicht is
 * ("30 g") levert geen naam op — daar is "stuk" eerlijker dan "30 g", want
 * anders staat er straks "3 × 30 g" bij een regel van 90 gram.
 */
export function stuknaam(label?: string): string {
  if (!label) return STUK_STANDAARD;

  const zonderHaakjes = label.replace(/\([^)]*\)/g, " ");
  // Het voorloopgetal eraf, met of zonder eenheid erachter: "2 biscuits" en
  // "1 snee" houden allebei het woord over.
  const kaal = zonderHaakjes
    .replace(/^\s*\d+(?:[.,]\d+)?\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (kaal === "" || isMaat(kaal)) return STUK_STANDAARD;
  return kaal.slice(0, 24);
}

/** Waaraan een gelogd aantal te herkennen is: "3 × snee". */
export const STUK_TEKEN = "×";

/** Eenheid zoals hij in het logboek belandt. */
export function stukEenheid(naam: string): string {
  return `${STUK_TEKEN} ${naam || STUK_STANDAARD}`;
}

/**
 * De naam terug uit zo'n eenheid, of null als deze regel niet per stuk is
 * gelogd. Daarmee weet het scherm dat "nog een keer, maar dan twee" over
 * stuks gaat en niet over grammen.
 */
export function naamUitStukEenheid(eenheid: string): string | null {
  const t = String(eenheid ?? "").trim();
  if (!t.startsWith(STUK_TEKEN)) return null;
  return t.slice(STUK_TEKEN.length).trim() || STUK_STANDAARD;
}

/**
 * Of dit een gewicht of inhoud is in plaats van een naam. Zonder deze regel
 * zou een label als "250 ml" als stuksnaam eindigen.
 */
function isMaat(s: string): boolean {
  return /^(g|gr|gram|kg|ml|cl|dl|l|liter|oz)$/.test(s.replace(/[\s.]/g, ""));
}
