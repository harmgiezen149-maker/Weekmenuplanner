import { NextResponse, type NextRequest } from "next/server";
import { alleGebruikers, maakGebruiker, verwijderGebruiker, zonderWachtwoord } from "@/lib/gebruikers";
import { huidigePersoon } from "@/lib/persoon";

export const dynamic = "force-dynamic";

/** Wie er allemaal kunnen inloggen. Zonder wachtwoordregels. */
export async function GET() {
  return NextResponse.json({ gebruikers: await alleGebruikers(), ik: await huidigePersoon() });
}

/**
 * Een persoon erbij. Alleen vanuit een ingelogde sessie: wie binnen is mag
 * iemand binnenlaten, van buitenaf kan niemand zichzelf toevoegen.
 */
export async function POST(req: NextRequest) {
  await huidigePersoon();
  const body = await req.json().catch(() => ({}));
  const uitslag = await maakGebruiker({
    gebruikersnaam: String(body?.gebruikersnaam ?? ""),
    naam: String(body?.naam ?? ""),
    wachtwoord: String(body?.wachtwoord ?? ""),
  });
  if ("fout" in uitslag) return NextResponse.json({ error: uitslag.fout }, { status: 400 });

  return NextResponse.json({
    gebruiker: zonderWachtwoord(uitslag.gebruiker),
    gebruikers: await alleGebruikers(),
  });
}

export async function DELETE(req: NextRequest) {
  const ik = await huidigePersoon();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (id === ik) {
    return NextResponse.json(
      { error: "Je eigen account weghalen kan niet — dan sluit je jezelf buiten." },
      { status: 400 }
    );
  }
  const uitslag = await verwijderGebruiker(id);
  if ("fout" in uitslag) return NextResponse.json({ error: uitslag.fout }, { status: 400 });
  return NextResponse.json({ gebruikers: await alleGebruikers() });
}
