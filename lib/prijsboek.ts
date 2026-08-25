import { redis } from "./redis";
import { LEEG_PRIJSBOEK, metPrijs } from "./prijzen";
import type { Prijsboek } from "./prijzen";
import type { BonRegel } from "./bon";

// ---------------------------------------------------------------------------
// Opslag van het prijsboek. Key: `prijzen:boek`.
//
// Gedeeld, net als de boodschappenlijst zelf: wie de bon scant maakt niet uit,
// het huishouden betaalt dezelfde prijzen.
//
// Het boek wordt als geheel bewaard. Het gaat om tientallen tot een paar
// honderd regels van elk zo'n honderd bytes, en bij het ramen van een lijst is
// hij toch in zijn geheel nodig.
// ---------------------------------------------------------------------------

const PRIJSBOEK_KEY = "prijzen:boek";

export async function getPrijsboek(): Promise<Prijsboek> {
  const b = await redis.get<Prijsboek>(PRIJSBOEK_KEY);
  return b && typeof b === "object" ? b : LEEG_PRIJSBOEK;
}

export async function savePrijsboek(boek: Prijsboek): Promise<Prijsboek> {
  await redis.set(PRIJSBOEK_KEY, boek);
  return boek;
}

/**
 * Neemt de prijzen van een bevestigde bon op.
 *
 * Regels zonder leesbare prijs worden overgeslagen in plaats van op nul gezet:
 * een prijs van nul zou de raming stilletjes te laag maken.
 */
export async function neemBonOp(
  regels: BonRegel[], winkel: string, datum: string
): Promise<{ boek: Prijsboek; opgenomen: number }> {
  let boek = await getPrijsboek();
  let opgenomen = 0;
  for (const r of regels) {
    if (r.prijs == null) continue;
    boek = metPrijs(boek, r.naam, {
      euro: r.prijs,
      aantal: r.aantal,
      eenheid: r.eenheid,
      winkel,
      datum,
    });
    opgenomen++;
  }
  if (opgenomen > 0) await savePrijsboek(boek);
  return { boek, opgenomen };
}
