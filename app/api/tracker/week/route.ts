import { NextRequest, NextResponse } from "next/server";
import { getDays, getProfile, geldigeDatum, datumSleutel } from "@/lib/tracker/data";
import { vatWeekSamen, weekDatums, dagenTeGaan } from "@/lib/tracker/week";

export const dynamic = "force-dynamic";

/**
 * Samenvatting van de week waar `datum` in valt. De week loopt van weegdag tot
 * weegdag; het bufferverbruik wordt uit de dagen zelf afgeleid.
 */
export async function GET(req: NextRequest) {
  const gevraagd = req.nextUrl.searchParams.get("datum");
  const peildatum = geldigeDatum(gevraagd) ? gevraagd : datumSleutel();

  const profiel = await getProfile();
  if (!profiel) return NextResponse.json({ week: null, profiel: null });

  const datums = weekDatums(peildatum, profiel.weigh_day);
  const dagen = await getDays(datums);

  return NextResponse.json({
    week: vatWeekSamen(dagen, profiel, peildatum),
    profiel,
    dagenTeGaan: dagenTeGaan(peildatum, profiel.weigh_day),
  });
}
