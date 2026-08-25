import { NextRequest, NextResponse } from "next/server";
import { getRecept } from "@/lib/data";
import { berekenReceptPunten, matchNaarComponent, receptVingerafdruk } from "@/lib/tracker/recept";
import { getReceptPunten, cacheReceptPunten, getProfile } from "@/lib/tracker/data";
import { getIngredienten } from "@/lib/tracker/ingredienten-opslag";
import type { IngredientMatch, ReceptPunten } from "@/lib/tracker/recept";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Wat één ingrediënt bijdraagt aan een portie, onafgerond en schaalvrij.
 *
 * Dit wordt bij het uitlezen berekend en niet in de cache gezet. Zo kan het
 * nooit uit de pas lopen met het totaal — het gaat door dezelfde
 * `matchNaarComponent` als de puntentelling zelf — en blijven bestaande
 * gecachete recepten gewoon bruikbaar.
 */
function puntenPerIngredient(matches: IngredientMatch[], personen: number): (number | null)[] {
  const delen = Number.isFinite(personen) && personen > 0 ? personen : 1;
  return matches.map((m) => {
    const c = matchNaarComponent(m);
    return c ? c.points_raw / delen : null;
  });
}

/**
 * Rekent één kookboekrecept door naar punten per portie.
 *
 * Het resultaat wordt gecachet met een vingerafdruk van de ingrediënten en het
 * aantal personen. Pas je het recept in het kookboek aan, dan klopt die
 * vingerafdruk niet meer en wordt er automatisch opnieuw gerekend.
 *
 * Naast het totaal komt er per ingrediënt uit wat het bijdraagt. Zonder die
 * uitsplitsing is een totaal dat er raar uitziet niet na te lopen: je ziet dan
 * wel dát het misgaat, niet waar.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const recept = await getRecept(id);
  if (!recept) return NextResponse.json({ error: "Recept niet gevonden" }, { status: 404 });

  const ingredienten = recept.ingredienten.map((i) => ({
    naam: i.naam, hoev: i.hoev, eenheid: i.eenheid,
  }));
  const eigen = await getIngredienten();
  const hash = receptVingerafdruk(ingredienten, recept.personen, eigen.revisie);

  const gecachet = await getReceptPunten<ReceptPunten>(id, hash);
  const uitCache = gecachet != null;
  const punten = gecachet ?? berekenReceptPunten(ingredienten, recept.personen, {}, eigen);
  if (!uitCache) await cacheReceptPunten(id, hash, punten);

  const profiel = await getProfile();

  return NextResponse.json({
    recept: { id: recept.id, titel: recept.titel, personen: recept.personen, maaltijd: recept.maaltijd },
    punten,
    perIngredient: puntenPerIngredient(punten.matches, punten.personen),
    schaal: profiel?.points_scale ?? 1,
    uitCache,
  });
}
