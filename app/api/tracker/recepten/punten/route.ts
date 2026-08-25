import { NextResponse } from "next/server";
import { getAllRecepten } from "@/lib/data";
import { berekenReceptPunten, receptVingerafdruk } from "@/lib/tracker/recept";
import { getReceptPunten, cacheReceptPunten, getProfile } from "@/lib/tracker/data";
import { getIngredienten } from "@/lib/tracker/ingredienten-opslag";
import type { ReceptPunten } from "@/lib/tracker/recept";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Punten per portie voor alle recepten in het kookboek, in één keer.
 *
 * Hiermee kan het kookboek bij elk recept tonen wat een portie kost, zonder
 * per kaartje een aparte aanvraag te doen. Alles komt uit de cache; alleen
 * recepten die veranderd zijn worden opnieuw doorgerekend, want de
 * vingerafdruk van de ingrediënten klopt dan niet meer.
 *
 * De punten worden altijd zelf berekend uit de ingrediënten.
 */
export async function GET() {
  const [recepten, profiel, eigen] = await Promise.all([
    getAllRecepten(), getProfile(), getIngredienten(),
  ]);
  const schaal = profiel?.points_scale ?? 1;

  const punten: Record<string, {
    punten: number; nietHerkend: number; maatOnbekend: number; totaal: number;
    /** Welke ingredienten buiten het totaal vallen, bij naam. */
    gaten: string[];
  }> = {};

  // Genoeg om te zien wat er mist, kort genoeg om het antwoord klein te houden.
  const MAX_GATEN = 6;

  for (const r of recepten) {
    const ingredienten = r.ingredienten.map((i) => ({
      naam: i.naam, hoev: i.hoev, eenheid: i.eenheid,
    }));
    if (ingredienten.length === 0) continue;

    const hash = receptVingerafdruk(ingredienten, r.personen, eigen.revisie);
    let berekend = await getReceptPunten<ReceptPunten>(r.id, hash);
    if (!berekend) {
      berekend = berekenReceptPunten(ingredienten, r.personen, {}, eigen);
      await cacheReceptPunten(r.id, hash, berekend);
    }

    punten[r.id] = {
      // Afronden gebeurt hier, want dit is puur voor weergave.
      punten: Math.max(0, Math.round(berekend.perPortiePunten * schaal)),
      nietHerkend: berekend.nietHerkend.length,
      // Een onleesbare maat telt net zo goed niet mee als een onbekend product;
      // het totaal is dan ook onvolledig en de badge hoort dat te laten zien.
      maatOnbekend: (berekend.maatOnbekend ?? []).length,
      totaal: ingredienten.length,
      gaten: [...berekend.nietHerkend, ...(berekend.maatOnbekend ?? [])].slice(0, MAX_GATEN),
    };
  }

  return NextResponse.json({
    punten,
    profiel: profiel != null,
    // Het kookboek gebruikt dit om te kunnen zeggen wanneer zijn weekmenu op
    // een andere dag begint dan de trackerweek.
    weegdag: profiel?.weigh_day ?? null,
  });
}
