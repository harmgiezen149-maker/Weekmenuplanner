import { NextResponse, type NextRequest } from "next/server";
import { maakGebruiker, telGebruikers, zonderWachtwoord } from "@/lib/gebruikers";
import { maakSessie } from "@/lib/sessie";
import { zetSessieCookie } from "@/lib/cookie";
import { migreerNaarPersoon } from "@/lib/migratie";

export const dynamic = "force-dynamic";

/**
 * Het allereerste account.
 *
 * Deze route staat open, maar werkt precies één keer: zodra er een account is,
 * weigert hij. Daarna lopen nieuwe personen via /api/auth/gebruikers, en dus
 * langs een inlog.
 *
 * Bij dit eerste account verhuizen de gegevens mee die er al stonden — profiel,
 * weeglijst, adviezen. Die waren van niemand en zijn nu van jou.
 */
export async function POST(req: NextRequest) {
  if ((await telGebruikers()) > 0) {
    return NextResponse.json(
      { error: "De app is al ingericht. Log in met je eigen account." }, { status: 409 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const uitslag = await maakGebruiker({
    gebruikersnaam: String(body?.gebruikersnaam ?? ""),
    naam: String(body?.naam ?? ""),
    wachtwoord: String(body?.wachtwoord ?? ""),
  });
  if ("fout" in uitslag) return NextResponse.json({ error: uitslag.fout }, { status: 400 });

  const migratie = await migreerNaarPersoon(uitslag.gebruiker.id);
  const token = await maakSessie(uitslag.gebruiker.id);
  const res = NextResponse.json({
    gebruiker: zonderWachtwoord(uitslag.gebruiker),
    migratie,
  });
  zetSessieCookie(res, token);
  return res;
}
