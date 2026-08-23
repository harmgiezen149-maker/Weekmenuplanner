import { NextRequest, NextResponse } from "next/server";
import { getRecept } from "@/lib/data";
import { berekenReceptPunten, receptVingerafdruk } from "@/lib/tracker/recept";
import { getReceptPunten, cacheReceptPunten } from "@/lib/tracker/data";
import type { ReceptPunten } from "@/lib/tracker/recept";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Rekent één kookboekrecept door naar punten per portie.
 *
 * Het resultaat wordt gecachet met een vingerafdruk van de ingrediënten en het
 * aantal personen. Pas je het recept in het kookboek aan, dan klopt die
 * vingerafdruk niet meer en wordt er automatisch opnieuw gerekend.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const recept = await getRecept(id);
  if (!recept) return NextResponse.json({ error: "Recept niet gevonden" }, { status: 404 });

  const ingredienten = recept.ingredienten.map((i) => ({
    naam: i.naam, hoev: i.hoev, eenheid: i.eenheid,
  }));
  const hash = receptVingerafdruk(ingredienten, recept.personen);

  const gecachet = await getReceptPunten<ReceptPunten>(id, hash);
  if (gecachet) {
    return NextResponse.json({
      recept: { id: recept.id, titel: recept.titel, personen: recept.personen, maaltijd: recept.maaltijd },
      punten: gecachet,
      uitCache: true,
    });
  }

  const punten = berekenReceptPunten(ingredienten, recept.personen);
  await cacheReceptPunten(id, hash, punten);

  return NextResponse.json({
    recept: { id: recept.id, titel: recept.titel, personen: recept.personen, maaltijd: recept.maaltijd },
    punten,
    uitCache: false,
  });
}
