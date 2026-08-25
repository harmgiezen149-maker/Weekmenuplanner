import type { Profile } from "./types";
import { dagIndex } from "./week.ts";

// ---------------------------------------------------------------------------
// Wanneer sturen we een herinnering, en wat staat erin?
//
// Pure logica, zonder database en zonder pushkanaal, zodat de regels te testen
// zijn. Wie de meldingen daadwerkelijk verstuurt staat in app/api/cron.
//
// De toon volgt dezelfde regel als de adviesmodule: er staat wat er is, niet
// wat je zou moeten doen. Een herinnering die "vergeet niet te loggen!" roept
// is geen hulpmiddel meer maar een standje, en dat is precies wat mensen doet
// stoppen met bijhouden.
//
// Drie dingen waar de app zichzelf mee tegenhoudt:
//   - je zet ze zelf aan, per soort; standaard staat alles uit;
//   - dezelfde soort gaat hooguit één keer per dag;
//   - wie al een week niets logt krijgt geen logherinnering. Dat is geen
//     vergeetachtigheid meer maar een pauze, en daar hoort de app zich niet
//     dagelijks in te mengen.
// ---------------------------------------------------------------------------

export type HerinneringSoort = "weegdag" | "logboek";

export interface Meldingvoorkeur {
  /** Op je weegdag, als er nog geen weging staat. */
  weegdag: boolean;
  /** Aan het eind van de dag, als je dagboek nog leeg is. */
  logboek: boolean;
}

export const STANDAARD_VOORKEUR: Meldingvoorkeur = { weegdag: false, logboek: false };

export function normaliseerVoorkeur(v: Partial<Meldingvoorkeur> | null | undefined): Meldingvoorkeur {
  return {
    weegdag: v?.weegdag === true,
    logboek: v?.logboek === true,
  };
}

export interface HerinneringInvoer {
  soort: HerinneringSoort;
  voorkeur: Meldingvoorkeur;
  profiel: Pick<Profile, "weigh_day">;
  /** De dag waarop de melding zou uitgaan, als YYYY-MM-DD. */
  vandaag: string;
  alGewogenVandaag: boolean;
  regelsVandaag: number;
  /** Op hoeveel van de afgelopen zeven dagen er iets is gelogd. */
  gelogdeDagenLaatste7: number;
  /** Welke soort er vandaag al is verstuurd, als die er is. */
  alGestuurdVandaag: HerinneringSoort | null;
}

export interface Herinnering {
  soort: HerinneringSoort;
  titel: string;
  tekst: string;
  /** Waar de melding naartoe brengt als je erop tikt. */
  pad: string;
}

/**
 * De enige plek waar wordt besloten of er een melding uitgaat.
 *
 * Geeft null terug zodra er ook maar één reden is om te zwijgen. Dat is de
 * veilige kant: een gemiste herinnering merk je nauwelijks, een overbodige
 * melding op je telefoon wel.
 */
export function bepaalHerinnering(invoer: HerinneringInvoer): Herinnering | null {
  const { soort, voorkeur, vandaag, alGestuurdVandaag } = invoer;

  if (!voorkeur[soort]) return null;
  if (alGestuurdVandaag === soort) return null;

  if (soort === "weegdag") {
    if (dagIndex(vandaag) !== invoer.profiel.weigh_day) return null;
    if (invoer.alGewogenVandaag) return null;
    return {
      soort,
      titel: "Vandaag is je weegdag",
      tekst: "Er staat nog geen weging. Het beste moment is hetzelfde als vorige week: "
        + "na het opstaan, voor het ontbijt.",
      pad: "/tracker/gewicht",
    };
  }

  if (invoer.regelsVandaag > 0) return null;
  // Wie een week lang niets logt is niet vergeetachtig maar even gestopt.
  if (invoer.gelogdeDagenLaatste7 === 0) return null;
  return {
    soort,
    titel: "Je dagboek van vandaag is nog leeg",
    tekst: "Achteraf invullen kan ook: de dag blijft open zolang je hem nog weet.",
    pad: "/tracker",
  };
}
