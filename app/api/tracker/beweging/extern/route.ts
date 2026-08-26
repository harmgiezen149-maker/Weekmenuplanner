import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { persoonBijSleutel } from "@/lib/koppelsleutel";
import { metPersoon, persoonSleutel } from "@/lib/persoon";
import { addActiviteit, datumSleutel, getProfile, nieuwId } from "@/lib/tracker/data";
import { activiteitPunten } from "@/lib/tracker/activiteit";
import { bmr, leeftijd } from "@/lib/tracker/budget";
import { leesExterneActiviteit, ontvangenVelden } from "@/lib/tracker/koppeling";
import type { Activity } from "@/lib/tracker/types";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Activiteiten van buiten de browser.
//
// Dit is de enige route in de app die zonder sessie bereikbaar is en die
// gegevens wegschrijft. Daarom:
//   - een eigen sleutel per persoon, die alleen dít kan;
//   - alles wat binnenkomt gaat door leesExterneActiviteit() en wordt
//     gecontroleerd voordat er iets wordt opgeslagen;
//   - dezelfde training twee keer insturen levert één regel op. Tasker vuurt
//     bij een wankele verbinding zonder blikken of blozen drie keer, en drie
//     keer dezelfde hardloopsessie verruimt je budget met punten die je niet
//     hebt verdiend.
// ---------------------------------------------------------------------------

/** Hoe lang we onthouden dat we een training al hebben gezien. */
const GEZIEN_TTL = 90 * 24 * 60 * 60;

const GEZIEN = (persoon: string, externId: string) =>
  persoonSleutel(persoon, `extern:${externId}`);

function sleutelUit(req: NextRequest, body: Record<string, unknown>): string {
  const kop = req.headers.get("authorization") ?? "";
  if (kop.toLowerCase().startsWith("bearer ")) return kop.slice(7).trim();
  return String(
    req.headers.get("x-kb-sleutel")
    ?? new URL(req.url).searchParams.get("sleutel")
    ?? body?.sleutel
    ?? ""
  );
}

/**
 * Wat er binnenkwam, in welke vorm dan ook.
 *
 * Drie vormen worden gelezen: JSON, een formulierbody, en gewone
 * queryparameters. Die laatste is voor Tasker de veiligste weg — daar hoeft
 * niets aangehaald te worden, en een lege variabele levert dan een leeg veld op
 * in plaats van kapotte JSON.
 *
 * Dat laatste is precies de valkuil: `{"minuten":%duur}` met een lege %duur
 * wordt `{"minuten":}` en dat is geen geldige JSON. Vandaar dat een
 * leesfout hier apart wordt gemeld en niet stilletjes een leeg bericht wordt.
 */
async function leesBericht(req: NextRequest): Promise<
  { velden: Record<string, unknown> } | { fout: string; ruw: string }
> {
  const query: Record<string, unknown> = {};
  for (const [k, v] of new URL(req.url).searchParams) query[k] = v;

  const tekst = (await req.text().catch(() => "")).trim();
  if (!tekst) return { velden: query };

  const soort = (req.headers.get("content-type") ?? "").toLowerCase();

  if (soort.includes("x-www-form-urlencoded")) {
    const uit: Record<string, unknown> = { ...query };
    for (const [k, v] of new URLSearchParams(tekst)) uit[k] = v;
    return { velden: uit };
  }

  try {
    const data = JSON.parse(tekst);
    if (!data || typeof data !== "object") {
      return { fout: "De inhoud is wel leesbaar maar geen object.", ruw: tekst.slice(0, 200) };
    }
    return { velden: { ...query, ...(data as Record<string, unknown>) } };
  } catch {
    return {
      fout: "De inhoud is geen geldige JSON. Dat gebeurt bijna altijd doordat een variabele "
        + "leeg is: {\"minuten\":%duur} wordt dan {\"minuten\":} en dat kan niet gelezen "
        + "worden. Stuur de gegevens liever als queryparameters achter de URL, dan kan dit "
        + "niet gebeuren.",
      ruw: tekst.slice(0, 200),
    };
  }
}

export async function POST(req: NextRequest) {
  const bericht = await leesBericht(req);
  const body = "velden" in bericht ? bericht.velden : {};

  const persoon = await persoonBijSleutel(sleutelUit(req, body));
  if (!persoon) {
    return NextResponse.json(
      { error: "Onbekende of ingetrokken sleutel." }, { status: 401 }
    );
  }

  if ("fout" in bericht) {
    return NextResponse.json(
      { error: bericht.fout, ontvangen: bericht.ruw }, { status: 400 }
    );
  }

  const vandaag = datumSleutel();
  const gelezen = leesExterneActiviteit(body, vandaag);
  if ("fout" in gelezen) {
    // Teruggeven wát er binnenkwam. Zonder dat sta je in het Tasker-log te
    // raden welke variabele wel en niet gevuld is.
    return NextResponse.json(
      { error: gelezen.fout, ontvangen: ontvangenVelden(body) }, { status: 400 }
    );
  }
  const a = gelezen.activiteit;

  // Proefstand: alles controleren en teruggeven wat er geboekt zou worden,
  // zonder het te boeken. Zo kun je de koppeling instellen zonder je logboek
  // vol te zetten met testritjes.
  if (String(body.proef ?? "") === "1" || String(body.proef ?? "") === "true") {
    return NextResponse.json({
      proef: true,
      zouBoeken: { datum: a.datum, soort: a.soort.naam, minuten: a.minuten, id: a.externId },
    });
  }

  // Al eens gezien? Dan is dit een herhaling en gebeurt er niets. Met NX
  // geschreven, zodat twee aanroepen die tegelijk binnenkomen niet allebei
  // denken dat zij de eerste zijn.
  const nieuw = await redis.set(GEZIEN(persoon, a.externId), a.datum,
    { nx: true, ex: GEZIEN_TTL });
  if (!nieuw) {
    return NextResponse.json({ overgeslagen: true, reden: "al geboekt", id: a.externId });
  }

  try {
    const uitslag = await metPersoon(persoon, async () => {
      const profiel = await getProfile();
      if (!profiel) return null;

      const basaal = bmr(profiel.sex, profiel.current_weight_kg, profiel.height_cm,
        leeftijd(profiel.birthdate));
      const activiteit: Activity = {
        id: nieuwId(),
        ts: Date.now(),
        name: a.soort.naam,
        met: a.soort.met,
        minutes: a.minuten,
        points: activiteitPunten(a.soort.met, profiel.current_weight_kg, a.minuten,
          basaal, profiel.points_scale),
      };
      await addActiviteit(a.datum, activiteit);
      return activiteit;
    });

    if (!uitslag) {
      await redis.del(GEZIEN(persoon, a.externId));
      return NextResponse.json({ error: "Vul eerst je profiel in de app in." }, { status: 400 });
    }

    return NextResponse.json({
      geboekt: { datum: a.datum, soort: a.soort.naam, minuten: a.minuten, punten: uitslag.points },
    }, { status: 201 });
  } catch (e) {
    // Het merkje weer weg, anders is deze training voorgoed overgeslagen.
    await redis.del(GEZIEN(persoon, a.externId));
    throw e;
  }
}
