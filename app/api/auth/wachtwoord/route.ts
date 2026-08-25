import { NextResponse, type NextRequest } from "next/server";
import { wijzigWachtwoord } from "@/lib/gebruikers";
import { huidigePersoon } from "@/lib/persoon";

export const dynamic = "force-dynamic";

/** Je eigen wachtwoord wijzigen. Altijd met het huidige wachtwoord erbij. */
export async function POST(req: NextRequest) {
  const ik = await huidigePersoon();
  const body = await req.json().catch(() => ({}));
  const uitslag = await wijzigWachtwoord(
    ik, String(body?.huidig ?? ""), String(body?.nieuw ?? "")
  );
  if ("fout" in uitslag) return NextResponse.json({ error: uitslag.fout }, { status: 400 });
  return NextResponse.json({ gewijzigd: true });
}
