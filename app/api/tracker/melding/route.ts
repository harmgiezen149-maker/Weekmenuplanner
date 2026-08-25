import { NextRequest, NextResponse } from "next/server";
import {
  laadFeiten, getProfile, getWegingen, getLaatsteAdviezen,
  getCooldown, getGezienAdvies, geldigeDatum, datumSleutel,
} from "@/lib/tracker/data";
import { weegmomentOpen, afwijkingOpen } from "@/lib/tracker/advies";

export const dynamic = "force-dynamic";

/** Zie de toelichting in app/api/tracker/advies/route.ts. */
const TRIGGER_HISTORIE = 10;

/**
 * Of er iets voor je klaarstaat op Inzicht: een advies dat je nog niet gezien
 * hebt, of een trigger die openstaat.
 *
 * Dit is het kanaal uit sectie 5.4 — een banner in de app en een stip op de
 * navigatie, geen push-notificaties. Die zijn op iOS onbetrouwbaar en verhogen
 * de meldingsdruk zonder aantoonbare winst.
 *
 * Er wordt hier niets gegenereerd; dat gebeurt pas als je Inzicht opent. Deze
 * route kost dus nooit een modelaanroep.
 */
export async function GET(req: NextRequest) {
  const gevraagd = req.nextUrl.searchParams.get("datum");
  const peildatum = geldigeDatum(gevraagd) ? gevraagd : datumSleutel();

  const profiel = await getProfile();
  if (!profiel) return NextResponse.json({ nieuw: false, trigger: null, aanleiding: null });

  const [{ pakket }, wegingen, historie, cooldown, gezien] = await Promise.all([
    laadFeiten(peildatum),
    getWegingen(),
    getLaatsteAdviezen(TRIGGER_HISTORIE),
    getCooldown(),
    getGezienAdvies(),
  ]);
  if (!pakket) return NextResponse.json({ nieuw: false, trigger: null, aanleiding: null });

  const moment = weegmomentOpen(pakket, wegingen, profiel, historie);
  const afwijking = afwijkingOpen(pakket, wegingen, profiel, historie, cooldown, new Date());
  const ongelezen = historie[0] != null && historie[0].id !== gezien;

  return NextResponse.json({
    nieuw: ongelezen || moment.open || afwijking.open,
    trigger: moment.open ? "weegmoment" : afwijking.open ? "afwijking" : ongelezen ? "gereed" : null,
    aanleiding: afwijking.open ? afwijking.vlag : null,
  });
}
