// ---------------------------------------------------------------------------
// Een foto bij een receptpagina zoeken — kant van de browser.
//
// De server plukt de kandidaat-url's van de pagina; hier worden ze omgezet naar
// iets dat je kunt bewaren. Twee stappen, allebei via /api/import:
// de foto ophalen als data-url (dat kan de browser zelf niet vanwege CORS) en
// hem verkleinen tot hij binnen de opslaglimiet past.
//
// Meer dan één kandidaat proberen is geen luxe: de bovenste is vaak een
// fotoserver die een aanvraag zonder verwijzende pagina weigert, terwijl de
// tweede het gewoon doet.
// ---------------------------------------------------------------------------

import { comprimeerAfbeelding } from "./afbeelding";

/** Verder dan de derde kandidaat wordt het zelden nog het gerecht. */
const PROBEERSELS = 3;

async function post(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch("/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String((data as { error?: string })?.error || "Ophalen mislukt"));
  return data as Record<string, unknown>;
}

/** De kandidaat-foto's van een pagina, beste eerst. Kost geen modelaanroep. */
export async function paginaFotos(pageUrl: string): Promise<string[]> {
  const data = await post({ type: "afbeeldingen", url: pageUrl });
  return Array.isArray(data.afbeeldingen) ? (data.afbeeldingen as string[]) : [];
}

/** Haalt één kandidaat op en verkleint hem tot een bewaarbare data-url. */
export async function fotoAlsDataUrl(fotoUrl: string): Promise<string> {
  const data = await post({ type: "afbeelding-proxy", url: fotoUrl });
  return comprimeerAfbeelding(String(data.dataUrl || ""));
}

/**
 * De foto van een receptpagina, klaar om op te slaan.
 *
 * Levert een lege string als er niets te halen viel. Dat is geen fout: een
 * recept zonder foto is nog steeds een recept, en het scherm dat dit aanroept
 * heeft belangrijker werk te doen dan een plaatje.
 */
export async function fotoVanPagina(pageUrl: string): Promise<string> {
  let kandidaten: string[] = [];
  try {
    kandidaten = await paginaFotos(pageUrl);
  } catch { return ""; }

  for (const url of kandidaten.slice(0, PROBEERSELS)) {
    try {
      const klein = await fotoAlsDataUrl(url);
      if (klein) return klein;
    } catch { /* volgende kandidaat */ }
  }
  return "";
}
