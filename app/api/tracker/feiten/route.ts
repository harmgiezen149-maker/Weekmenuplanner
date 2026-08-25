import { NextRequest, NextResponse } from "next/server";
import { laadFeiten, geldigeDatum, datumSleutel } from "@/lib/tracker/data";
import { adviesDrempel } from "@/lib/tracker/feiten";

export const dynamic = "force-dynamic";

/**
 * Het feitenpakket van de adviesmodule: twaalf weken logboek en wegingen,
 * teruggerekend tot platte getallen.
 *
 * `ververs=1` slaat de cache over. Dat is wat de knop op /tracker/inzicht
 * gebruikt; zonder die parameter komt het pakket uit de cache zolang er niets
 * nieuws gelogd is.
 */
export async function GET(req: NextRequest) {
  const gevraagd = req.nextUrl.searchParams.get("datum");
  const peildatum = geldigeDatum(gevraagd) ? gevraagd : datumSleutel();
  const ververs = req.nextUrl.searchParams.get("ververs") === "1";

  const { pakket, uitCache } = await laadFeiten(peildatum, { ververs });
  if (!pakket) return NextResponse.json({ pakket: null, drempel: null, uitCache: false });

  return NextResponse.json({ pakket, drempel: adviesDrempel(pakket), uitCache });
}
