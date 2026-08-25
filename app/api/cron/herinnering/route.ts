import { NextResponse, type NextRequest } from "next/server";
import { alleGebruikers } from "@/lib/gebruikers";
import { metPersoon } from "@/lib/persoon";
import { stuurNaarPersoon } from "@/lib/push";
import { getDay, getProfile, getWegingen, gelogdeDatums } from "@/lib/tracker/data";
import { datumSleutel, verschuifDatum } from "@/lib/tracker/datum";
import { bepaalHerinnering } from "@/lib/tracker/herinnering";
import type { HerinneringSoort } from "@/lib/tracker/herinnering";
import { getLaatstGestuurd, getVoorkeur, noteerGestuurd } from "@/lib/tracker/meldingen";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// De dagelijkse taak die de herinneringen verstuurt.
//
// Draait via de planner van Vercel (zie vercel.json), twee keer per dag: één
// keer 's ochtends voor de weegdag en één keer 's avonds voor het logboek. Op
// het gratis abonnement mag zo'n taak één keer per dag draaien en kan hij tot
// een uur later uitkomen dan gepland — vandaar dat de tekst nergens een tijd
// noemt.
//
// De taak is met opzet onschadelijk als hij vaker draait: hij verstuurt
// hooguit één melding per soort per persoon per dag, en dat geheugen staat in
// Redis. Dat is hier ook de beveiliging. Staat CRON_SECRET ingesteld, dan wordt
// die daarbovenop gecontroleerd.
// ---------------------------------------------------------------------------

/** Wat er 's ochtends langskomt en wat 's avonds. */
const SOORTEN: Record<string, HerinneringSoort> = {
  weegdag: "weegdag",
  logboek: "logboek",
};

function magDraaien(req: NextRequest): boolean {
  const geheim = process.env.CRON_SECRET;
  if (!geheim) return true;
  return req.headers.get("authorization") === `Bearer ${geheim}`;
}

export async function GET(req: NextRequest) {
  if (!magDraaien(req)) {
    return NextResponse.json({ error: "Niet toegestaan" }, { status: 401 });
  }

  const gevraagd = new URL(req.url).searchParams.get("soort") ?? "";
  const soort = SOORTEN[gevraagd];
  if (!soort) {
    return NextResponse.json(
      { error: `Geef ?soort= mee: ${Object.keys(SOORTEN).join(" of ")}.` }, { status: 400 }
    );
  }

  const vandaag = datumSleutel();
  const gebruikers = await alleGebruikers();
  const uitslag: { persoon: string; verstuurd: number }[] = [];

  for (const g of gebruikers) {
    try {
      const verstuurd = await verwerkPersoon(g.id, soort, vandaag);
      if (verstuurd > 0) uitslag.push({ persoon: g.naam, verstuurd });
    } catch {
      // Eén persoon met een half profiel mag de anderen niet blokkeren.
    }
  }

  return NextResponse.json({ soort, vandaag, gestuurd: uitslag });
}

async function verwerkPersoon(
  id: string, soort: HerinneringSoort, vandaag: string
): Promise<number> {
  const voorkeur = await getVoorkeur(id);
  // Uit is uit: dan hoeven het profiel en het logboek niet eens gelezen te
  // worden. Scheelt op de gratis database het leeuwendeel van de aanvragen.
  if (!voorkeur[soort]) return 0;

  return metPersoon(id, async () => {
    const profiel = await getProfile();
    if (!profiel) return 0;

    const [dag, wegingen, laatst, recenteDagen] = await Promise.all([
      getDay(vandaag),
      soort === "weegdag" ? getWegingen() : Promise.resolve([]),
      getLaatstGestuurd(id, vandaag),
      soort === "logboek"
        ? gelogdeDatums(verschuifDatum(vandaag, -7), verschuifDatum(vandaag, -1))
        : Promise.resolve([]),
    ]);

    const herinnering = bepaalHerinnering({
      soort,
      voorkeur,
      profiel,
      vandaag,
      alGewogenVandaag: wegingen.some((w) => w.date === vandaag),
      regelsVandaag: dag.entries.length,
      gelogdeDagenLaatste7: recenteDagen.length,
      alGestuurdVandaag: laatst.includes(soort) ? soort : null,
    });
    if (!herinnering) return 0;

    const verzonden = await stuurNaarPersoon(id, herinnering);
    // Pas noteren als er echt iets aankwam: anders slaat de app een melding
    // over die nooit is verstuurd.
    if (verzonden.verstuurd > 0) await noteerGestuurd(id, vandaag, soort);
    return verzonden.verstuurd;
  });
}
