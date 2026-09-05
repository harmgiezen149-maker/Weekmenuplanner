import { geldigeWeek, weekVan } from "../weeksleutel.ts";
import { datumSleutel, geldigeDatum } from "../tracker/datum.ts";
import { DAGEN } from "../types.ts";

// ---------------------------------------------------------------------------
// Wat de chatbot mag voorstellen.
//
// Deze drie functies schrijven niets. Ze zetten een kaartje klaar dat op het
// scherm verschijnt met een knop eronder; pas als je daarop drukt gaat het
// naar /api/chat/actie, dat alles opnieuw nakijkt en het werk doet.
//
// Los van de rest van het gereedschap omdat hier het echte oordeel zit — is
// dit een dag, een eetmoment, iets dat de app kent — en omdat het zo te testen
// is zonder database.
// ---------------------------------------------------------------------------

/** Een voorstel dat op het scherm als kaartje verschijnt met een knop eronder. */
export interface Voorstel {
  soort: "weekmenu" | "boodschap" | "logboek";
  /** Wat er gebeurt als je op de knop drukt, in gewone taal. */
  omschrijving: string;
  /** De gegevens voor de uitvoerroute. Bewust plat en klein. */
  gegevens: Record<string, unknown>;
}

export interface Uitkomst {
  /** Wat er terug het gesprek in gaat. */
  resultaat: unknown;
  /** Alleen gevuld bij een voorsteltool. */
  voorstel?: Voorstel;
}

const KLAARGEZET = {
  klaargezet: true,
  uitleg: "Het kaartje staat op het scherm; de gebruiker moet het nog bevestigen.",
};

export const EETMOMENTEN = ["ontbijt", "lunch", "diner", "snack"];

export function voorstelWeekmenu(invoer: Record<string, unknown>): Uitkomst {
  const receptId = tekst(invoer.recept_id).trim();
  const dag = DAGEN.find((d) => d.toLowerCase() === tekst(invoer.dag).trim().toLowerCase());
  if (!receptId || !dag) {
    return { resultaat: { fout: "Geef een recept_id en een dagnaam van Maandag tot en met Zondag." } };
  }

  const week = geldigeWeek(tekst(invoer.week)) ? tekst(invoer.week) : weekVan(datumSleutel());
  const personen = getal(invoer.personen);

  return {
    resultaat: KLAARGEZET,
    voorstel: {
      soort: "weekmenu",
      omschrijving: `${dag} in het weekmenu vullen`,
      gegevens: { receptId, dag, week, ...(personen ? { personen } : {}) },
    },
  };
}

export function voorstelBoodschap(invoer: Record<string, unknown>): Uitkomst {
  const naam = tekst(invoer.naam).trim();
  if (!naam) return { resultaat: { fout: "Geef een naam voor het boodschappenitem." } };

  const hoev = getal(invoer.hoeveelheid);
  const eenheid = tekst(invoer.eenheid).trim();

  return {
    resultaat: KLAARGEZET,
    voorstel: {
      soort: "boodschap",
      omschrijving: `${naam}${hoev ? ` (${hoev} ${eenheid || "stuk"})` : ""} op de boodschappenlijst zetten`,
      gegevens: { naam, ...(hoev ? { hoev } : {}), ...(eenheid ? { eenheid } : {}) },
    },
  };
}

/**
 * Loggen kan alleen met iets dat de app al kent. Zonder die regel zou het model
 * zelf voedingswaarden mogen verzinnen, en die zijn achteraf niet van echte te
 * onderscheiden — precies wat de punten waardeloos maakt.
 */
export function voorstelLogboek(invoer: Record<string, unknown>): Uitkomst {
  const eetmoment = tekst(invoer.eetmoment).trim().toLowerCase();
  if (!EETMOMENTEN.includes(eetmoment)) {
    return { resultaat: { fout: "eetmoment moet ontbijt, lunch, diner of snack zijn." } };
  }

  const bronnen: [string, string][] = [
    ["recept", tekst(invoer.recept_id).trim()],
    ["maaltijd", tekst(invoer.maaltijd_id).trim()],
    ["favoriet", tekst(invoer.favoriet_id).trim()],
  ];
  const gekozen = bronnen.filter(([, id]) => id !== "");
  if (gekozen.length !== 1) {
    return {
      resultaat: {
        fout: "Geef precies één van recept_id, maaltijd_id of favoriet_id. Iets loggen dat "
          + "de app niet kent kan niet: dan zouden de voedingswaarden verzonnen zijn.",
      },
    };
  }

  const [bron, id] = gekozen[0];
  const datum = geldigeDatum(tekst(invoer.datum)) ? tekst(invoer.datum) : datumSleutel();
  const porties = getal(invoer.porties) ?? 1;

  return {
    resultaat: KLAARGEZET,
    voorstel: {
      soort: "logboek",
      omschrijving: `loggen bij ${eetmoment} op ${datum}`,
      gegevens: { bron, id, eetmoment, datum, porties },
    },
  };
}

function tekst(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function getal(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
