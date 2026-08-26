import { NextRequest, NextResponse } from "next/server";
import { huidigePersoon } from "@/lib/persoon";
import { datumSleutel, getProfile } from "@/lib/tracker/data";
import { leesGeplakteLijst } from "@/lib/tracker/koppeling";
import { boekActiviteiten } from "@/lib/tracker/beweging-opslag";

export const dynamic = "force-dynamic";

// Een lijst die je uit Garmin Connect kopieert en hier plakt.
//
// Aparte route van /extern, en niet dezelfde met een andere methode: die route
// staat bewust open voor je horloge, en een route die half open en half achter
// de inlog zit is een route waarvan niemand meer weet wat er geldt.

export async function POST(req: NextRequest) {
  const persoon = await huidigePersoon();
  const body = await req.json().catch(() => ({}));
  const vandaag = datumSleutel();

  const { herkend, afgewezen } = leesGeplakteLijst(String(body?.tekst ?? ""), vandaag);
  if (herkend.length === 0) {
    return NextResponse.json({ geboekt: [], overgeslagen: 0, afgewezen });
  }

  if (!(await getProfile())) {
    return NextResponse.json({ error: "Vul eerst je profiel in." }, { status: 400 });
  }

  const uitslag = await boekActiviteiten(persoon, herkend.map((r) => ({
    datum: r.datum, soort: r.soort, minuten: r.minuten,
    externId: `plak-${r.datum}-${r.soort.id}-${r.minuten}`,
  })));
  if ("fout" in uitslag) {
    return NextResponse.json({ error: uitslag.fout }, { status: 400 });
  }

  return NextResponse.json({ ...uitslag, afgewezen });
}
