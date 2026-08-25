import { NextRequest, NextResponse } from "next/server";
import { getAllRecepten } from "@/lib/data";
import { getProfile, getReceptPunten, cacheReceptPunten } from "@/lib/tracker/data";
import { getIngredienten } from "@/lib/tracker/ingredienten-opslag";
import { berekenReceptPunten, receptVingerafdruk } from "@/lib/tracker/recept";
import type { ReceptPunten } from "@/lib/tracker/recept";
import { getPrijsboek } from "@/lib/prijsboek";
import { raamLijst } from "@/lib/prijzen";
import { steldWeekVoor } from "@/lib/weekvoorstel";
import type { VoorstelRecept } from "@/lib/weekvoorstel";
import { DAGEN } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Stelt een weekmenu voor uit je eigen recepten.
 *
 * De keuze zelf is puur rekenwerk in lib/weekvoorstel.ts; hier worden alleen de
 * gegevens bij elkaar gezocht: de punten per portie (uit de cache, net als de
 * badges in het kookboek) en een kostenraming uit het prijsboek.
 *
 * Er wordt niets opgeslagen. Het voorstel gaat terug naar het scherm, jij kijkt
 * ernaar, en pas als je op overnemen drukt verandert je weekmenu.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const variatie = Number(body?.variatie);
  const gevraagdeDagen: string[] = Array.isArray(body?.dagen) && body.dagen.length > 0
    ? body.dagen.filter((d: unknown) => DAGEN.includes(String(d) as typeof DAGEN[number]))
    : [...DAGEN];

  const [recepten, profiel, eigen, prijsboek] = await Promise.all([
    getAllRecepten(), getProfile(), getIngredienten(), getPrijsboek(),
  ]);

  const vandaag = new Date().toISOString().slice(0, 10);
  const schaal = profiel?.points_scale ?? 1;

  // Alleen avondeten: ontbijt en lunch plan je niet per dag, en een toetje is
  // geen weekmenu.
  const avond = recepten.filter((r) => r.maaltijd === "Avondeten" && r.ingredienten.length > 0);

  const kandidaten: VoorstelRecept[] = [];
  for (const r of avond) {
    const ingredienten = r.ingredienten.map((i) => ({
      naam: i.naam, hoev: i.hoev, eenheid: i.eenheid,
    }));
    const hash = receptVingerafdruk(ingredienten, r.personen, eigen.revisie);
    let berekend = await getReceptPunten<ReceptPunten>(r.id, hash);
    if (!berekend) {
      berekend = berekenReceptPunten(ingredienten, r.personen, {}, eigen);
      await cacheReceptPunten(r.id, hash, berekend);
    }

    // Kosten voor het hele recept. Alleen tonen als er iets van bekend is:
    // nul euro voor een avondmaal is geen raming maar een leugen.
    const raming = raamLijst(prijsboek, ingredienten, vandaag);

    kandidaten.push({
      id: r.id,
      titel: r.titel,
      hoofd: r.hoofd,
      keuken: r.keuken,
      tijd: Number(r.tijd) || 30,
      score: Number(r.score) || 0,
      gegeten: Number(r.gegeten) || 0,
      punten: profiel ? Math.max(0, Math.round(berekend.perPortiePunten * schaal)) : null,
      euro: raming.bekend > 0 ? raming.euro : null,
    });
  }

  const voorstel = steldWeekVoor(kandidaten, {
    dagen: gevraagdeDagen,
    variatie: Number.isFinite(variatie) ? variatie : 0,
    // Het dagbudget is voor de hele dag; een avondmaal is daar grofweg de helft
    // van. Mild meegewogen, want een zware avond mag zolang de week klopt.
    puntenDoel: profiel?.daily_budget ? Math.round(profiel.daily_budget * 0.45) : null,
  });

  return NextResponse.json(voorstel);
}
