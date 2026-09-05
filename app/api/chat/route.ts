import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { GEREEDSCHAP, voerUit } from "@/lib/chat/gereedschap";
import type { Uitkomst, Voorstel } from "@/lib/chat/gereedschap";
import { chatSysteem } from "@/lib/chat/systeem";
import { leesGesprek, bewaarGesprek, lijstGesprekken, wisGesprek } from "@/lib/chat/opslag";
import { titelUit, geldigId, nieuwGesprekId, GESCHIEDENIS } from "@/lib/chat/gesprek";
import type { Bron, ChatBericht, Gesprek } from "@/lib/chat/gesprek";
import { datumSleutel } from "@/lib/tracker/datum";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-opus-5";

/**
 * Zoveel keer mag het model gereedschap pakken voordat het moet antwoorden.
 * Vijf rondes is ruim: een vraag als "wat kan ik vanavond eten dat onder de
 * tien punten blijft" heeft er twee of drie nodig. Meer rondes zouden vooral
 * de kans vergroten dat de route tegen de tijdslimiet aanloopt.
 */
const MAX_RONDES = 5;

/** Lang genoeg voor een uitgebreid antwoord, kort genoeg om binnen de minuut
 *  terug te zijn. */
const MAX_TOKENS = 4000;

const MAX_VRAAG = 2000;

/**
 * Effort staat laag, en dat is een bewuste keuze en geen bezuiniging: dit is
 * een chat op een telefoon, met een tijdslimiet van een minuut op de server.
 * De zware denkstappen van de app — het advies, het schatten van producten —
 * lopen langs hun eigen route en staan los hiervan.
 */
const EFFORT = "low" as const;

/** De websearch draait bij Anthropic zelf; wij zien alleen het resultaat. */
const WEBSEARCH: Anthropic.ToolUnion = {
  type: "web_search_20260209",
  name: "web_search",
  max_uses: 4,
};

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const gesprek = await leesGesprek(id);
    if (!gesprek) return NextResponse.json({ error: "Geen gesprek" }, { status: 404 });
    return NextResponse.json({ gesprek });
  }
  return NextResponse.json({ gesprekken: await lijstGesprekken() });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is verplicht" }, { status: 400 });
  await wisGesprek(id);
  return NextResponse.json({ gesprekken: await lijstGesprekken() });
}

export async function POST(req: NextRequest) {
  const sleutel = process.env.ANTHROPIC_API_KEY;
  if (!sleutel) {
    return NextResponse.json(
      { error: "Zonder ANTHROPIC_API_KEY kan de chat niet werken; de rest van de app wel." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const vraag = String(body?.bericht ?? "").trim().slice(0, MAX_VRAAG);
  if (!vraag) return NextResponse.json({ error: "Stel een vraag" }, { status: 400 });
  const scherm = String(body?.scherm ?? "").trim().slice(0, 120) || undefined;

  const bestaand = geldigId(body?.gesprek) ? await leesGesprek(body.gesprek) : null;
  const gesprek: Gesprek = bestaand ?? {
    id: nieuwGesprekId(), titel: titelUit(vraag), bijgewerkt: Date.now(), berichten: [],
  };

  // Alleen de tekst van eerdere beurten gaat terug het model in; wat het toen
  // opzocht is nu misschien alweer veranderd, en opnieuw kijken is beter dan
  // een oud antwoord napraten.
  const messages: Anthropic.MessageParam[] = gesprek.berichten
    .slice(-GESCHIEDENIS)
    .map((b) => ({ role: b.rol === "mens" ? ("user" as const) : ("assistant" as const), content: b.tekst }))
    .filter((m) => m.content !== "");
  messages.push({ role: "user", content: vraag });

  const client = new Anthropic({ apiKey: sleutel });
  const systeem = chatSysteem(datumSleutel(), scherm);

  const bronnen: Bron[] = [];
  const voorstellen: Voorstel[] = [];
  let antwoord = "";

  try {
    for (let ronde = 0; ronde < MAX_RONDES; ronde++) {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: "adaptive" },
        output_config: { effort: EFFORT },
        system: systeem,
        tools: [...GEREEDSCHAP, WEBSEARCH],
        messages,
      });

      // De hele inhoud gaat terug, denkblokken incluis: die horen ongewijzigd
      // mee als het gesprek op hetzelfde model doorloopt.
      messages.push({ role: "assistant", content: res.content });

      const tekst = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text.trim())
        .filter((t) => t !== "")
        .join("\n\n");
      if (tekst) antwoord = tekst;
      bronnen.push(...leesBronnen(res.content));

      if (res.stop_reason === "pause_turn") continue;
      if (res.stop_reason !== "tool_use") break;

      const vragen = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (vragen.length === 0) break;

      // Alle resultaten in één bericht terug; los versturen leert het model af
      // om meerdere dingen tegelijk op te vragen.
      const resultaten: Anthropic.ToolResultBlockParam[] = [];
      for (const v of vragen) {
        const uit: Uitkomst = await voerUit(v.name, (v.input ?? {}) as Record<string, unknown>)
          .catch((e: unknown) => ({
            resultaat: { fout: e instanceof Error ? e.message : "opzoeken mislukt" },
          }));
        if (uit.voorstel) voorstellen.push(uit.voorstel);
        resultaten.push({
          type: "tool_result",
          tool_use_id: v.id,
          content: JSON.stringify(uit.resultaat).slice(0, 60000),
        });
      }
      messages.push({ role: "user", content: resultaten });
    }
  } catch (e) {
    const traag = e instanceof Anthropic.RateLimitError;
    return NextResponse.json(
      {
        error: traag
          ? "Het is even te druk bij het model. Probeer het zo nog eens."
          : "Er ging iets mis bij het beantwoorden.",
      },
      { status: traag ? 429 : 502 }
    );
  }

  if (!antwoord) antwoord = "Ik kwam er niet uit. Stel de vraag eens anders?";

  const nu = Date.now();
  const beurt: ChatBericht = {
    rol: "bot", tekst: antwoord, ts: nu,
    ...(bronnen.length > 0 ? { bronnen: ontdubbel(bronnen) } : {}),
    ...(voorstellen.length > 0 ? { voorstellen } : {}),
  };
  gesprek.berichten.push({ rol: "mens", tekst: vraag, ts: nu }, beurt);
  gesprek.bijgewerkt = nu;
  await bewaarGesprek(gesprek);

  return NextResponse.json({ gesprek: gesprek.id, titel: gesprek.titel, bericht: beurt });
}

/**
 * De bronnen uit een websearch. Bij een mislukte zoekopdracht is `content`
 * geen lijst maar een foutobject — dan valt er niets te vermelden en blijft
 * het antwoord gewoon staan.
 */
function leesBronnen(inhoud: Anthropic.ContentBlock[]): Bron[] {
  const uit: Bron[] = [];
  for (const blok of inhoud) {
    if (blok.type !== "web_search_tool_result") continue;
    if (!Array.isArray(blok.content)) continue;
    for (const r of blok.content) {
      if (r.type === "web_search_result") {
        uit.push({ titel: r.title || r.url, url: r.url });
      }
    }
  }
  return uit;
}

function ontdubbel(bronnen: Bron[]): Bron[] {
  const gezien = new Set<string>();
  return bronnen.filter((b) => {
    if (gezien.has(b.url)) return false;
    gezien.add(b.url);
    return true;
  }).slice(0, 8);
}
