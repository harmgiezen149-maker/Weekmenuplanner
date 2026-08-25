import { NextResponse, type NextRequest } from "next/server";
import { leesBackup, maakBackup, tel, zetBackupTerug } from "@/lib/backup";
import { huidigePersoon } from "@/lib/persoon";
import { getGebruiker } from "@/lib/gebruikers";

export const dynamic = "force-dynamic";
// Een volledige back-up leest tientallen sleutels achter elkaar; op een grote
// database duurt dat langer dan de standaardlimiet.
export const maxDuration = 60;

/** Alles in één bestand. Komt als download binnen, niet als schermvulling. */
export async function GET() {
  const id = await huidigePersoon();
  const gebruiker = await getGebruiker(id);
  const bestand = await maakBackup({ id, naam: gebruiker?.naam ?? "" });

  const datum = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(bestand, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="kookboek-backup-${datum}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Terugzetten. Vervangt de inhoud van de app door die van het bestand.
 *
 * De aanroeper moet `bevestigd: true` meesturen. Dat is geen formaliteit: dit
 * is de enige route in de app die met één aanroep alles kan wissen, en een
 * vergissing hoort niet één klik ver te liggen.
 */
export async function POST(req: NextRequest) {
  await huidigePersoon();
  const body = await req.json().catch(() => null);
  if (!body || body.bevestigd !== true) {
    return NextResponse.json(
      { error: "Terugzetten overschrijft wat er nu in de app staat en moet bevestigd worden." },
      { status: 400 }
    );
  }

  const gelezen = leesBackup(body.bestand);
  if ("fout" in gelezen) return NextResponse.json({ error: gelezen.fout }, { status: 400 });

  const telling = await zetBackupTerug(gelezen.bestand);
  return NextResponse.json({
    teruggezet: telling,
    uit: gelezen.bestand.gemaakt,
    gevonden: tel(gelezen.bestand),
  });
}
