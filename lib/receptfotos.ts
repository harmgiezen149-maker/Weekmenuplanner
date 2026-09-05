// ---------------------------------------------------------------------------
// De foto los van het recept.
//
// Foto's staan als data-URL in het recept zelf. Dat is prettig om op te slaan
// — één sleutel, één ding — maar niet om te versturen: de receptenlijst werd
// er ruim tien megabyte van, en die haalde de app op bij elke start. Het
// kookboek liep er uiteindelijk op vast.
//
// Daarom gaat de foto niet meer mee in de lijst. Wat de browser krijgt is een
// recept met een lege `afbeelding` en `heeftFoto`, en een adres per foto. De
// opslag blijft precies zoals hij was: hier wordt niets verhuisd.
// ---------------------------------------------------------------------------

import type { Recept } from "./types";

/** Het adres waar de foto van dit recept te halen is. */
export function fotoPad(id: string): string {
  return `/api/recipes/${encodeURIComponent(id)}/foto`;
}

/** Eén recept zoals de browser het krijgt: zonder de foto, met de vlag. */
export function zonderFoto(r: Recept): Recept {
  return { ...r, afbeelding: "", heeftFoto: (r.afbeelding ?? "") !== "" };
}

export function zonderFotos(recepten: Recept[]): Recept[] {
  return recepten.map(zonderFoto);
}

/**
 * Wat er bij het opslaan met het foto-veld moet gebeuren.
 *
 * De browser heeft de foto niet meer, alleen het adres ervan. Stuurt een
 * formulier dat adres terug, dan zou je de foto overschrijven met een pad —
 * en was hij weg. Vandaar deze drie gevallen:
 *
 *   een data-URL   je koos een nieuwe foto        →  die bewaren
 *   lege string    je drukte op Verwijderen       →  weghalen
 *   iets anders    het adres kwam ongewijzigd terug → laten staan wat er staat
 */
export function nieuweFotoWaarde(binnengekomen: unknown, bestaand: string): string {
  if (typeof binnengekomen !== "string") return bestaand;
  if (binnengekomen === "") return "";
  if (binnengekomen.startsWith("data:")) return binnengekomen;
  return bestaand;
}

/** Een data-URL uit elkaar halen naar bytes plus het soort afbeelding. */
export function leesDataUrl(dataUrl: string): { type: string; bytes: Buffer } | null {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl ?? "");
  if (!m) return null;
  const type = m[1] || "image/jpeg";
  const bytes = m[2]
    ? Buffer.from(m[3], "base64")
    : Buffer.from(decodeURIComponent(m[3]), "utf8");
  return bytes.length > 0 ? { type, bytes } : null;
}
