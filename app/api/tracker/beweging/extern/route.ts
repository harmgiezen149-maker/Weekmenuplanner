import { NextRequest, NextResponse } from "next/server";
import { persoonBijSleutel } from "@/lib/koppelsleutel";
import { datumSleutel } from "@/lib/tracker/data";
import {
  leesExterneActiviteit, leesGeplakteLijst, ontvangenVelden,
} from "@/lib/tracker/koppeling";
import { leesGezondheidJson, lijktOpGezondheidJson } from "@/lib/tracker/gezondheidjson";
import { boekActiviteiten } from "@/lib/tracker/beweging-opslag";
import type { TeBoeken } from "@/lib/tracker/beweging-opslag";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Activiteiten van buiten de browser.
//
// Dit is de enige route in de app die zonder sessie bereikbaar is en die
// gegevens wegschrijft. Daarom een eigen sleutel per persoon, die alleen dít
// kan, en gaat alles wat binnenkomt langs een controle voordat er iets wordt
// opgeslagen.
//
// Hij accepteert vier vormen, want elke bron levert iets anders aan en het is
// niet de bedoeling dat de gebruiker dat verschil moet oplossen:
//
//   losse velden   ?soort=RUNNING&minuten=42          (queryparameters of JSON)
//   een blok JSON  {"records":[...]}                  (Health Connect-plug-in)
//   platte tekst   "Hardlopen 2026-08-24 45:12"       (notificatie, deelmenu)
//   een lijst      meerdere regels tekst
//
// Die derde is de weg die geen enkele plug-in nodig heeft: wat er ook aan tekst
// binnenkomt, hij probeert er een activiteit uit te lezen en zegt eerlijk of
// dat lukte.
// ---------------------------------------------------------------------------

/** Hoe het bericht binnenkwam. */
type Bericht =
  | { soort: "velden"; velden: Record<string, unknown> }
  | { soort: "tekst"; tekst: string }
  | { soort: "kapot"; fout: string; ruw: string };

/**
 * Veldnamen die we kennen. Zit er geen enkele in, dan was het geen formulier
 * maar gewoon tekst — en dan hoort de hele zin niet als veldnaam te eindigen.
 */
const BEKENDE_VELDEN = new Set([
  "soort", "type", "activity", "activiteit", "activitytype", "exercisetype",
  "sport", "workout", "naam", "name",
  "minuten", "minutes", "seconden", "seconds", "duration", "duration_s",
  "duration_ms", "duration_min", "millis",
  "datum", "date", "id", "extern_id", "bron", "source",
  "tekst", "text", "proef", "sleutel", "token", "records", "data", "sessions",
]);

function heeftBekendVeld(velden: Record<string, unknown>): boolean {
  return Object.keys(velden).some((k) => BEKENDE_VELDEN.has(k.toLowerCase()));
}

function sleutelUit(req: NextRequest, velden: Record<string, unknown>): string {
  const kop = req.headers.get("authorization") ?? "";
  if (kop.toLowerCase().startsWith("bearer ")) return kop.slice(7).trim();
  return String(
    req.headers.get("x-kb-sleutel")
    ?? new URL(req.url).searchParams.get("sleutel")
    ?? velden?.sleutel
    ?? ""
  );
}

/**
 * Wat er binnenkwam, in welke vorm dan ook.
 *
 * Een body die met { of [ begint was als JSON bedoeld; gaat die stuk, dan is
 * dat een leesfout en geen tekst. Dat onderscheid is er omdat
 * `{"minuten":%duur}` met een lege %duur `{"minuten":}` wordt — geen geldige
 * JSON, en zonder dit onderscheid zou dat als "onleesbare activiteit" langskomen
 * in plaats van als wat het is.
 */
async function leesBericht(req: NextRequest): Promise<Bericht> {
  const query: Record<string, unknown> = {};
  for (const [k, v] of new URL(req.url).searchParams) query[k] = v;

  const tekst = (await req.text().catch(() => "")).trim();

  // Tekst kan ook achter de URL meekomen; handig voor een Tasker-actie die
  // geen body kan zetten.
  const uitQuery = String(query.tekst ?? query.text ?? "").trim();
  if (!tekst && uitQuery) return { soort: "tekst", tekst: uitQuery };
  if (!tekst) return { soort: "velden", velden: query };

  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();
  if (contentType.includes("x-www-form-urlencoded")) {
    const uit: Record<string, unknown> = { ...query };
    for (const [k, v] of new URLSearchParams(tekst)) uit[k] = v;
    // Alleen als het er ook echt als formulier uitziet. Een losse zin komt bij
    // veel clients binnen met deze content-type omdat dat de standaard is, en
    // dan wordt "Wandeling voltooid: 1:05:00" één veldnaam met een lege waarde.
    if (heeftBekendVeld(uit)) return { soort: "velden", velden: uit };
    return { soort: "tekst", tekst };
  }

  const alsJson = tekst.startsWith("{") || tekst.startsWith("[");
  if (alsJson) {
    try {
      const data = JSON.parse(tekst);
      if (!data || typeof data !== "object") {
        return { soort: "kapot", fout: "De inhoud is wel leesbaar maar geen object.", ruw: tekst.slice(0, 200) };
      }
      // Een lijst blijft een lijst: zou de query eroverheen worden gespreid,
      // dan wordt hij een object met cijfers als sleutels.
      if (Array.isArray(data)) {
        return { soort: "velden", velden: data as unknown as Record<string, unknown> };
      }
      return { soort: "velden", velden: { ...query, ...(data as Record<string, unknown>) } };
    } catch {
      return {
        soort: "kapot",
        fout: "De inhoud begint als JSON maar is niet te lezen. Dat gebeurt bijna altijd "
          + "doordat een variabele leeg is: {\"minuten\":%duur} wordt dan {\"minuten\":}. "
          + "Stuur de gegevens als queryparameters, of als gewone tekst zonder accolades.",
        ruw: tekst.slice(0, 200),
      };
    }
  }

  return { soort: "tekst", tekst };
}

export async function POST(req: NextRequest) {
  const bericht = await leesBericht(req);
  const velden = bericht.soort === "velden" ? bericht.velden : {};

  const persoon = await persoonBijSleutel(sleutelUit(req, velden));
  if (!persoon) {
    return NextResponse.json({ error: "Onbekende of ingetrokken sleutel." }, { status: 401 });
  }

  if (bericht.soort === "kapot") {
    return NextResponse.json({ error: bericht.fout, ontvangen: bericht.ruw }, { status: 400 });
  }

  const vandaag = datumSleutel();
  const proefVlag = new URL(req.url).searchParams.get("proef");
  const proef = proefVlag === "1" || proefVlag === "true"
    || String(velden.proef ?? "") === "1" || String(velden.proef ?? "") === "true";

  // -- platte tekst ---------------------------------------------------------
  if (bericht.soort === "tekst") {
    const { herkend, afgewezen } = leesGeplakteLijst(bericht.tekst, vandaag);
    if (herkend.length === 0) {
      return NextResponse.json({
        error: "Uit deze tekst is geen activiteit te lezen. Er moet een sport in staan en een "
          + "duur — bijvoorbeeld \"Hardlopen 45 min\" of \"Wandelen 2026-08-24 1:05:00\".",
        ontvangen: bericht.tekst.slice(0, 300),
        afgewezen,
      }, { status: 400 });
    }
    return antwoord(await boekActiviteiten(persoon, herkend.map((r) => ({
      datum: r.datum, soort: r.soort, minuten: r.minuten,
      externId: `tekst-${r.datum}-${r.soort.id}-${r.minuten}`,
    })), proef), { afgewezen, proef });
  }

  // -- een blok van een Health Connect-plug-in -------------------------------
  if (lijktOpGezondheidJson(velden)) {
    const { gevonden, geweigerd } = leesGezondheidJson(velden, vandaag);
    if (gevonden.length === 0) {
      return NextResponse.json({
        geboekt: [], overgeslagen: 0, geweigerd,
        hint: geweigerd.length > 0
          ? "Er zaten wel sessies in, maar geen enkele was compleet te lezen."
          : "Er zaten geen sessies in dit blok.",
      }, { status: geweigerd.length > 0 ? 400 : 200 });
    }
    return antwoord(await boekActiviteiten(persoon, gevonden, proef), { geweigerd, proef });
  }

  // -- losse velden ---------------------------------------------------------
  const gelezen = leesExterneActiviteit(velden, vandaag);
  if ("fout" in gelezen) {
    return NextResponse.json(
      { error: gelezen.fout, ontvangen: ontvangenVelden(velden) }, { status: 400 }
    );
  }
  const a = gelezen.activiteit;
  return antwoord(
    await boekActiviteiten(persoon, [{
      datum: a.datum, soort: a.soort, minuten: a.minuten, externId: a.externId,
    }], proef),
    { proef }
  );
}

function antwoord(
  uitslag: Awaited<ReturnType<typeof boekActiviteiten>>,
  extra: Record<string, unknown>
) {
  if ("fout" in uitslag) return NextResponse.json({ error: uitslag.fout }, { status: 400 });

  const leeg = (v: unknown) => v == null || (Array.isArray(v) && v.length === 0) || v === false;
  const rest = Object.fromEntries(Object.entries(extra).filter(([, v]) => !leeg(v)));

  return NextResponse.json({ ...uitslag, ...rest }, {
    status: uitslag.geboekt.length > 0 && !extra.proef ? 201 : 200,
  });
}
