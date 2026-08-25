import { NextResponse, type NextRequest } from "next/server";
import { getGebruiker, telGebruikers, zonderWachtwoord } from "@/lib/gebruikers";
import { SESSIE_COOKIE, leesSessie } from "@/lib/sessie";

export const dynamic = "force-dynamic";

/**
 * Wie ben ik, en is de app al ingericht?
 *
 * Deze route staat open, want het loginscherm heeft hem nodig voordat er een
 * sessie is. Er komt dan ook niets uit wat je niet mag weten: alleen of er al
 * een account bestaat, en zo ja wie jij zelf bent.
 */
export async function GET(req: NextRequest) {
  const aantal = await telGebruikers();
  const token = req.cookies.get(SESSIE_COOKIE)?.value ?? "";
  const id = token ? await leesSessie(token) : null;
  const gebruiker = id ? await getGebruiker(id) : null;
  return NextResponse.json({
    ingericht: aantal > 0,
    ingelogd: gebruiker != null,
    gebruiker: gebruiker ? zonderWachtwoord(gebruiker) : null,
  });
}
