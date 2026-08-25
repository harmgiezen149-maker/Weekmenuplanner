import { redis } from "../redis";
import { persoonSleutel } from "../persoon";
import { normaliseerVoorkeur, STANDAARD_VOORKEUR } from "./herinnering";
import type { HerinneringSoort, Meldingvoorkeur } from "./herinnering";

// ---------------------------------------------------------------------------
// Opslag rond meldingen, per persoon:
//
//   wl:p:<id>:push            -> de aangemelde apparaten (zie lib/push.ts)
//   wl:p:<id>:melding:voorkeur-> welke soorten aan staan
//   wl:p:<id>:melding:laatst  -> wat er die dag al is verstuurd
//
// De laatste is het geheugen dat voorkomt dat dezelfde herinnering twee keer
// op een dag binnenkomt wanneer de dagelijkse taak om wat voor reden dan ook
// twee keer draait.
// ---------------------------------------------------------------------------

const VOORKEUR = "melding:voorkeur";
const LAATST = "melding:laatst";

/** Twee dagen houdbaar: lang genoeg voor de dedupe, kort genoeg om op te ruimen. */
const LAATST_TTL = 2 * 24 * 60 * 60;

export async function getVoorkeur(persoon: string): Promise<Meldingvoorkeur> {
  const v = await redis.get<Meldingvoorkeur>(persoonSleutel(persoon, VOORKEUR));
  return v ? normaliseerVoorkeur(v) : STANDAARD_VOORKEUR;
}

export async function saveVoorkeur(
  persoon: string, voorkeur: Meldingvoorkeur
): Promise<Meldingvoorkeur> {
  const schoon = normaliseerVoorkeur(voorkeur);
  await redis.set(persoonSleutel(persoon, VOORKEUR), schoon);
  return schoon;
}

interface Laatst {
  datum: string;
  soorten: HerinneringSoort[];
}

export async function getLaatstGestuurd(
  persoon: string, vandaag: string
): Promise<HerinneringSoort[]> {
  const l = await redis.get<Laatst>(persoonSleutel(persoon, LAATST));
  return l && l.datum === vandaag && Array.isArray(l.soorten) ? l.soorten : [];
}

export async function noteerGestuurd(
  persoon: string, vandaag: string, soort: HerinneringSoort
): Promise<void> {
  const eerder = await getLaatstGestuurd(persoon, vandaag);
  const soorten = eerder.includes(soort) ? eerder : [...eerder, soort];
  await redis.set(persoonSleutel(persoon, LAATST), { datum: vandaag, soorten }, { ex: LAATST_TTL });
}
