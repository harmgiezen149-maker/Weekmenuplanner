import { NextResponse } from "next/server";
import { stuurNaarPersoon } from "@/lib/push";
import { huidigePersoon } from "@/lib/persoon";

export const dynamic = "force-dynamic";

/**
 * Stuurt één proefmelding naar je eigen apparaten.
 *
 * Zonder deze knop merk je pas over een week of de meldingen werken, en dan is
 * niet meer te achterhalen waar het misging.
 */
export async function POST() {
  const persoon = await huidigePersoon();
  const uitslag = await stuurNaarPersoon(persoon, {
    soort: "logboek",
    titel: "Proefmelding",
    tekst: "Als je dit ziet, komen je herinneringen straks ook aan.",
    pad: "/tracker/instellingen",
  });
  if (uitslag.verstuurd === 0) {
    const uitleg = uitslag.fouten.length > 0
      ? `De pushdienst weigerde de melding — ${uitslag.fouten.join("; ")}`
      : uitslag.opgeruimd > 0
        ? "Dit apparaat stond niet meer aangemeld bij de pushdienst. Zet meldingen opnieuw aan."
        : "Er staat geen apparaat aangemeld. Zet meldingen eerst aan op dit apparaat.";
    return NextResponse.json({ error: uitleg }, { status: 400 });
  }
  return NextResponse.json(uitslag);
}
