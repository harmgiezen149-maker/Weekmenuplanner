// ---------------------------------------------------------------------------
// Fouten van de modelaanroepen, voor alle routes gelijk.
//
// Wat hier zonder logging werd weggevangen, bleef in productie onzichtbaar: een
// op tegoed gelopen account zag er wekenlang uit als "de foto kon niet worden
// verwerkt", en in de logs stond niets.
// ---------------------------------------------------------------------------

/** Status voor een aanroep die niet kon omdat het tegoed op is. */
export const LIMIET_STATUS = 503;

function tekstVan(e: unknown): string {
  if (e instanceof Error) return e.message;
  return typeof e === "string" ? e : "";
}

/**
 * Herkent de weigering van Anthropic wanneer de zelf ingestelde
 * bestedingslimiet bereikt is, en maakt er een melding van die zegt wat er aan
 * de hand is en wanneer het weer werkt. Geeft null voor elke andere fout.
 *
 * Herkend aan de tekst en niet aan het fouttype: de API geeft hiervoor een
 * gewone 400 (invalid_request_error), niet te onderscheiden van een fout in de
 * aanvraag zelf.
 */
export function limietMelding(e: unknown): string | null {
  const tekst = tekstVan(e);
  if (!/usage limits?/i.test(tekst)) return null;

  const m = /regain access on (\d{4}-\d{2}-\d{2}) at (\d{2}:\d{2}) UTC/i.exec(tekst);
  const tot = m ? new Date(`${m[1]}T${m[2]}:00Z`) : null;
  const wanneer = tot && !Number.isNaN(tot.getTime())
    ? ` Vanaf ${nlMoment(tot)} werkt het weer vanzelf.`
    : "";

  return (
    "Het AI-tegoed is op: de bestedingslimiet bij Anthropic is bereikt." + wanneer +
    " Eerder verder? Verhoog de limiet op console.anthropic.com."
  );
}

/** Zet de onderliggende fout in de runtime-logs, met status als die er is. */
export function logAiFout(waar: string, e: unknown): void {
  const status = (e as { status?: unknown } | null)?.status;
  const naam = e instanceof Error ? e.name : "Fout";
  const detail = tekstVan(e) || String(e);
  console.error(`${waar} mislukt:`, typeof status === "number" ? `${status} ${naam}: ${detail}` : `${naam}: ${detail}`);
}

/** "1 oktober om 02:00", in Nederlandse tijd. */
function nlMoment(d: Date): string {
  const zone = "Europe/Amsterdam";
  const dag = new Intl.DateTimeFormat("nl-NL", { timeZone: zone, day: "numeric", month: "long" }).format(d);
  const tijd = new Intl.DateTimeFormat("nl-NL", { timeZone: zone, hour: "2-digit", minute: "2-digit" }).format(d);
  return `${dag} om ${tijd}`;
}
