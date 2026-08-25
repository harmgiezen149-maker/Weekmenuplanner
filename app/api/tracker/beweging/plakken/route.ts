import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { huidigePersoon, persoonSleutel } from "@/lib/persoon";
import { addActiviteit, datumSleutel, getProfile, nieuwId } from "@/lib/tracker/data";
import { activiteitPunten } from "@/lib/tracker/activiteit";
import { bmr, leeftijd } from "@/lib/tracker/budget";
import { leesGeplakteLijst } from "@/lib/tracker/koppeling";
import type { Activity } from "@/lib/tracker/types";

export const dynamic = "force-dynamic";

// Een lijst die je uit Garmin Connect kopieert en hier plakt.
//
// Aparte route van /extern, en niet dezelfde met een andere methode: die route
// staat bewust open voor je horloge, en een route die half open en half achter
// de inlog zit is een route waarvan niemand meer weet wat er geldt.
//
// Dezelfde dedupe als bij het horloge: een regel die je twee keer plakt levert
// één activiteit op.

const GEZIEN_TTL = 90 * 24 * 60 * 60;
const GEZIEN = (persoon: string, externId: string) =>
  persoonSleutel(persoon, `extern:${externId}`);

export async function POST(req: NextRequest) {
  const persoon = await huidigePersoon();
  const body = await req.json().catch(() => ({}));
  const vandaag = datumSleutel();

  const { herkend, afgewezen } = leesGeplakteLijst(String(body?.tekst ?? ""), vandaag);
  if (herkend.length === 0) {
    return NextResponse.json({ geboekt: [], overgeslagen: 0, afgewezen });
  }

  const profiel = await getProfile();
  if (!profiel) {
    return NextResponse.json({ error: "Vul eerst je profiel in." }, { status: 400 });
  }
  const basaal = bmr(profiel.sex, profiel.current_weight_kg, profiel.height_cm,
    leeftijd(profiel.birthdate));

  const geboekt: { datum: string; soort: string; minuten: number; punten: number }[] = [];
  let overgeslagen = 0;

  for (const r of herkend) {
    const externId = `plak-${r.datum}-${r.soort.id}-${r.minuten}`;
    const nieuw = await redis.set(GEZIEN(persoon, externId), r.datum, { nx: true, ex: GEZIEN_TTL });
    if (!nieuw) { overgeslagen++; continue; }

    const activiteit: Activity = {
      id: nieuwId(), ts: Date.now(), name: r.soort.naam, met: r.soort.met,
      minutes: r.minuten,
      points: activiteitPunten(r.soort.met, profiel.current_weight_kg, r.minuten,
        basaal, profiel.points_scale),
    };
    await addActiviteit(r.datum, activiteit);
    geboekt.push({ datum: r.datum, soort: r.soort.naam, minuten: r.minuten, punten: activiteit.points });
  }

  return NextResponse.json({ geboekt, overgeslagen, afgewezen });
}
