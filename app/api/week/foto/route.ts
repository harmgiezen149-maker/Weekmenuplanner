import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { leesWeekfoto } from "@/lib/weekfoto";
import { LIMIET_STATUS, aiMelding, logAiFout, controleerWeigering } from "@/lib/ai-fout";
import { MODEL, ZONDER_DENKEN } from "@/lib/ai-model";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM =
  "Je leest een handgeschreven weekmenu van een briefje. Geef UITSLUITEND geldige JSON terug, " +
  "geen uitleg, geen markdown. Schema: " +
  '{"dagen":[{"dag":"ma","gerecht":"..."}]}. ' +
  "dag is de afkorting zoals hij op het briefje staat (ma, di, wo, do, vr, za, zo). " +
  "gerecht is precies wat er bij die dag staat, letterlijk overgenomen — ook als het geen " +
  "gerechtnaam is maar een rijtje ingrediënten zoals 'spinazie, gehakt, pasta'. " +
  "Verzin NIETS: staat er bij een dag niets, geef dan een lege string. Vul geen gerechten aan " +
  "en corrigeer geen namen. Het briefje kan gedraaid of scheef gefotografeerd zijn; " +
  "de dagen staan meestal onder elkaar met het gerecht ernaast. " +
  "Neem alle zeven dagen op die je ziet, ook de lege.";

/**
 * Leest een gefotografeerd weekmenu.
 *
 * Deze route doet één ding: kijken wat er op het briefje staat. Het koppelen
 * aan recepten gebeurt in het scherm, met lib/receptmatch.ts en de recepten die
 * daar toch al geladen zijn. Dat scheelt niet alleen werk hier — het zorgt er
 * ook voor dat een dag zichzelf opnieuw koppelt zodra je het ontbrekende
 * gerecht alsnog aanmaakt, zonder de foto opnieuw te hoeven lezen.
 *
 * Er wordt niets opgeslagen. Het antwoord is een voorstel; pas als je het in
 * het scherm bevestigt verandert je weekmenu.
 */
export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY ontbreekt. Zonder die sleutel kan een foto niet gelezen worden; met de hand plannen wel." },
      { status: 503 }
    );
  }

  const body = await req.json();
  const dataUrl = String(body?.afbeelding ?? "");
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(dataUrl);
  if (!match) {
    return NextResponse.json({ error: "Geen bruikbare afbeelding ontvangen" }, { status: 400 });
  }

  const [, mediaType, base64] = match;
  if (base64.length > 7_000_000) {
    return NextResponse.json({ error: "De foto is te groot" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: key });
  let gelezen;
  try {
    const res = await client.messages.create({
      model: MODEL,
      thinking: ZONDER_DENKEN,
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType as "image/jpeg", data: base64 },
          },
          { type: "text", text: "Wat staat er op dit weekmenu?" },
        ],
      }],
    });
    controleerWeigering(res);
    const tekst = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text).join("");
    gelezen = leesWeekfoto(tekst);
  } catch (e) {
    logAiFout("weekfoto-lezen", e);
    const limiet = aiMelding(e);
    if (limiet) return NextResponse.json({ error: limiet }, { status: LIMIET_STATUS });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Het lezen van de foto ging mis" },
      { status: 502 }
    );
  }

  if (gelezen.every((d) => !d.tekst)) {
    return NextResponse.json(
      { error: "Geen dagen kunnen lezen op deze foto. Probeer hem rechter, met het hele briefje in beeld." },
      { status: 422 }
    );
  }

  return NextResponse.json({ dagen: gelezen });
}
