import { NextResponse, type NextRequest } from "next/server";
import { getKoppelsleutel, maakKoppelsleutel } from "@/lib/koppelsleutel";
import { huidigePersoon } from "@/lib/persoon";
import { taskerProject } from "@/lib/tasker";

export const dynamic = "force-dynamic";

/**
 * De Tasker-taak als bestand.
 *
 * Bevat je sleutel, dus hij komt alleen langs een ingelogde sessie naar buiten
 * en wordt niet gecachet. Is er nog geen sleutel, dan wordt er een gemaakt:
 * het bestand downloaden zonder sleutel erin heeft geen zin.
 */
export async function GET(req: NextRequest) {
  const persoon = await huidigePersoon();
  const sleutel = (await getKoppelsleutel(persoon)) ?? (await maakKoppelsleutel(persoon));

  const adres = new URL("/api/tracker/beweging/extern", req.nextUrl.origin).toString();
  const xml = taskerProject({ adres, sleutel });

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      // Een project en niet een losse taak: Tasker weigert een bestand met
      // alleen een <Task> erin met "no Project found".
      "Content-Disposition": 'attachment; filename="kookboek.prj.xml"',
      "Cache-Control": "no-store",
    },
  });
}
