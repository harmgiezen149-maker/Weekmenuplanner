import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { persoonBijSleutel } from "@/lib/koppelsleutel";
import { metPersoon, persoonSleutel } from "@/lib/persoon";
import { addActiviteit, datumSleutel, getProfile, nieuwId } from "@/lib/tracker/data";
import { activiteitPunten } from "@/lib/tracker/activiteit";
import { bmr, leeftijd } from "@/lib/tracker/budget";
import { leesExterneActiviteit } from "@/lib/tracker/koppeling";
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

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const persoon = await persoonBijSleutel(sleutelUit(req, body));
  if (!persoon) {
    return NextResponse.json(
      { error: "Onbekende of ingetrokken sleutel." }, { status: 401 }
    );
  }

  const vandaag = datumSleutel();
  const gelezen = leesExterneActiviteit(body, vandaag);
  if ("fout" in gelezen) {
    return NextResponse.json({ error: gelezen.fout }, { status: 400 });
  }
  const a = gelezen.activiteit;

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
