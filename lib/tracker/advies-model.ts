import Anthropic from "@anthropic-ai/sdk";
import {
  adviesSysteem, bouwAdviesBericht, leesAdviesJson, valideerAdvies,
  type AdviesInvoer, type AdviesPayload, type Validatie,
} from "./advies.ts";

// ---------------------------------------------------------------------------
// De modelaanroep achter een advies.
//
// Gelijkgehouden met de rest van de app: hetzelfde model, en de JSON wordt via
// de systeeminstructie afgedwongen omdat de SDK in dit project nog geen
// structured outputs kent. Dat is hier minder erg dan elders — de validatielaag
// moest toch al elk veld nalopen.
//
// Twee pogingen, niet meer. Lukt het dan nog niet, dan komt er geen advies: een
// derde poging kost geld en levert zelden iets anders op, en géén advies is
// altijd beter dan een advies dat de controle niet doorstaat.
// ---------------------------------------------------------------------------

export const MODEL = "claude-sonnet-4-6";

/** Ruim genoeg voor 350 woorden tekst plus de JSON eromheen. */
const MAX_TOKENS = 2000;

export const MAX_POGINGEN = 2;

export type AdviesUitkomst =
  | { ok: true; payload: AdviesPayload; validatie: Validatie; pogingen: number }
  | { ok: false; redenen: string[]; pogingen: number };

/**
 * Vraagt een advies op en laat het door de validatielaag gaan.
 *
 * Bij een afgekeurd antwoord gaat de reden mee terug het gesprek in. Het model
 * weet dan wát er mis was — een verzonnen sleutel, een verboden woord, een
 * actie tegen de guardrail in — in plaats van blind opnieuw te moeten gokken.
 *
 * Gooit alleen bij een echt netwerk- of API-probleem, zodat de aanroeper dat
 * kan onderscheiden van "er kwam geen bruikbaar advies uit".
 */
export async function genereerAdvies(
  client: Anthropic,
  invoer: AdviesInvoer
): Promise<AdviesUitkomst> {
  const systeem = adviesSysteem(invoer.pakket, invoer.vorige);
  const berichten: Anthropic.MessageParam[] = [
    { role: "user", content: bouwAdviesBericht(invoer) },
  ];
  let laatsteRedenen: string[] = ["het model gaf geen bruikbare JSON terug"];

  for (let poging = 1; poging <= MAX_POGINGEN; poging++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systeem,
      messages: berichten,
    });

    const tekst = res.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("\n");

    const payload = leesAdviesJson(tekst);
    if (payload) {
      const validatie = valideerAdvies(payload, invoer.pakket, invoer.vorige);
      if (validatie.geldig) return { ok: true, payload, validatie, pogingen: poging };
      laatsteRedenen = validatie.redenen;
    }

    if (poging < MAX_POGINGEN) {
      berichten.push({ role: "assistant", content: tekst });
      berichten.push({ role: "user", content: herkansing(laatsteRedenen) });
    }
  }

  return { ok: false, redenen: laatsteRedenen, pogingen: MAX_POGINGEN };
}

function herkansing(redenen: string[]): string {
  return [
    "Dit advies is afgekeurd door de controle. Reden:",
    ...redenen.map((r) => `- ${r}`),
    "",
    "Schrijf het opnieuw en los precies dit op. Houd je aan het schema, gebruik alleen",
    "getallen die letterlijk in het feitenpakket staan, en zet elke gebruikte sleutel in",
    "facts_used. Antwoord weer uitsluitend met JSON.",
  ].join("\n");
}
