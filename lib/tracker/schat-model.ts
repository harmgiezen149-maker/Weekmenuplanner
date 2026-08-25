import Anthropic from "@anthropic-ai/sdk";
import { leesSchatting } from "./schatting";
import { CATEGORIEEN } from "./types";
import type { Schatting } from "./schatting";

// ---------------------------------------------------------------------------
// De modelaanroep achter het schatten van een ingredient.
//
// Zowel het losse schatten (één ingredient, in een formulier dat je nakijkt)
// als het in één keer aanvullen van een heel recept gebruikt dit. Ze horen
// hetzelfde antwoord te geven, dus staat de aanroep hier en niet twee keer in
// een route.
// ---------------------------------------------------------------------------

// Gelijkgehouden met de rest van de app. De SDK hier kent nog geen structured
// outputs, dus de JSON wordt via de systeeminstructie afgedwongen en daarna
// defensief gelezen.
export const MODEL = "claude-sonnet-4-6";

export const SYSTEM =
  "Je geeft de gemiddelde voedingswaarden PER 100 GRAM (of per 100 ml bij een vloeistof) " +
  "van een ingrediënt. Geef UITSLUITEND geldige JSON terug, geen uitleg, geen markdown. " +
  'Schema: {"naam":"...","eenheid":"g","per100":{"kcal":0,"protein_g":0,"fat_g":0,' +
  '"satfat_g":0,"carbs_g":0,"sugar_g":0,"fiber_g":0,"category":"..."},"toelichting":"één korte zin"}. ' +
  "category kies je uit: " + CATEGORIEEN.join(", ") + ". Gebruik dairy_plain alleen bij zuivel " +
  "zonder toegevoegde suiker, fruit_whole bij vers heel fruit, vegetable bij groente, legume bij " +
  "peulvruchten, nuts_seeds bij noten en zaden, en anders default. " +
  "Ga uit van het onbewerkte product zoals je het in een recept gebruikt. " +
  "Ken je het ingrediënt niet, geef dan {\"naam\":\"\"} terug in plaats van te gokken. " +
  "Namen in het Nederlands.";

/**
 * Vraagt één schatting op. Geeft null als het model het ingredient niet kent of
 * als het antwoord onbruikbaar is; gooit alleen bij een echt netwerk- of
 * API-probleem, zodat de aanroeper dat kan onderscheiden van "weet ik niet".
 */
export async function schatIngredient(
  client: Anthropic,
  naam: string
): Promise<Schatting | null> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: SYSTEM,
    messages: [{ role: "user", content: `Ingrediënt: ${naam.slice(0, 80)}` }],
  });

  const tekst = res.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  return leesSchatting(tekst);
}
