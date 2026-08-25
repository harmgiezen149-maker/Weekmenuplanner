import { NextResponse, type NextRequest } from "next/server";
import { controleerInlog, zonderWachtwoord } from "@/lib/gebruikers";
import { maakSessie } from "@/lib/sessie";
import { zetSessieCookie } from "@/lib/cookie";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const gebruiker = await controleerInlog(
    String(body?.gebruikersnaam ?? ""), String(body?.wachtwoord ?? "")
  );

  // Eén melding voor beide fouten. Zou hier "onbekende naam" staan, dan is de
  // lijst met bestaande accounts zo af te lezen.
  if (!gebruiker) {
    return NextResponse.json(
      { error: "Gebruikersnaam of wachtwoord klopt niet." }, { status: 401 }
    );
  }

  const token = await maakSessie(gebruiker.id);
  const res = NextResponse.json({ gebruiker: zonderWachtwoord(gebruiker) });
  zetSessieCookie(res, token);
  return res;
}
