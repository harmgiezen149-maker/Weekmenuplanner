import type Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Fouten van de modelaanroepen, voor alle routes gelijk.
//
// Wat hier zonder logging werd weggevangen, bleef in productie onzichtbaar: een
// op tegoed gelopen account zag er wekenlang uit als "de foto kon niet worden
// verwerkt", en in de logs stond niets.
// ---------------------------------------------------------------------------

/** Status voor een aanroep die het model niet wilde of kon doen. */
export const LIMIET_STATUS = 503;

/** Het model weigerde: een gewone 200, maar zonder bruikbaar antwoord. */
export class AiWeigering extends Error {
  readonly categorie: string | null;
  constructor(categorie: string | null) {
    super(`model weigerde (${categorie ?? "geen categorie"})`);
    this.name = "AiWeigering";
    this.categorie = categorie;
  }
}

/**
 * Zet een weigering om in een fout, zodat die langs dezelfde weg loopt als de
 * limiet. Zonder deze stap leest de route een lege tekst en meldt "geen
 * bruikbare JSON".
 */
export function controleerWeigering(res: Pick<Anthropic.Message, "stop_reason" | "stop_details">): void {
  if (res.stop_reason === "refusal") throw new AiWeigering(res.stop_details?.category ?? null);
}

function tekstVan(e: unknown): string {
  if (e instanceof Error) return e.message;
  return typeof e === "string" ? e : "";
}

/**
 * Een melding voor de gebruiker bij de twee fouten die geen storing zijn: het
 * tegoed is op, of het model weigerde. Null voor elke andere fout.
 *
 * De limiet wordt herkend aan de tekst en niet aan het fouttype: de API geeft
 * hiervoor een gewone 400 (invalid_request_error), niet te onderscheiden van
 * een fout in de aanvraag zelf.
 */
export function aiMelding(e: unknown): string | null {
  if (e instanceof AiWeigering) {
    return "Het model weigerde dit verzoek. Probeer een andere foto of formulering, of vul het met de hand in.";
  }

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
