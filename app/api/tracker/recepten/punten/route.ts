import { NextResponse } from "next/server";
import { getAllRecepten } from "@/lib/data";
import { berekenReceptPunten, receptVingerafdruk } from "@/lib/tracker/recept";
import { getReceptPunten, cacheReceptPunten, getProfile } from "@/lib/tracker/data";
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
  const [recepten, profiel] = await Promise.all([getAllRecepten(), getProfile()]);
  const schaal = profiel?.points_scale ?? 1;

  const punten: Record<string, { punten: number; nietHerkend: number; totaal: number }> = {};

  for (const r of recepten) {
    const ingredienten = r.ingredienten.map((i) => ({
      naam: i.naam, hoev: i.hoev, eenheid: i.eenheid,
    }));
    if (ingredienten.length === 0) continue;

    const hash = receptVingerafdruk(ingredienten, r.personen);
    let berekend = await getReceptPunten<ReceptPunten>(r.id, hash);
    if (!berekend) {
      berekend = berekenReceptPunten(ingredienten, r.personen);
      await cacheReceptPunten(r.id, hash, berekend);
    }

    punten[r.id] = {
      // Afronden gebeurt hier, want dit is puur voor weergave.
      punten: Math.max(0, Math.round(berekend.perPortiePunten * schaal)),
      nietHerkend: berekend.nietHerkend.length,
      totaal: ingredienten.length,
    };
  }

  return NextResponse.json({ punten, profiel: profiel != null });
}
