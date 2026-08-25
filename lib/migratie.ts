// ---------------------------------------------------------------------------
// Eenmalige verhuizing van de gegevens die er al stonden.
//
// Vóór de inlog was er één naamloze gebruiker en stonden profiel, wegingen en
// adviezen los onder `wl:...`. Zodra het eerste account wordt aangemaakt zijn
// die van die persoon en verhuizen ze naar `wl:p:<id>:...`.
//
// Er wordt gekopieerd, niet verplaatst. De oude sleutels blijven staan als
// vangnet: gaat er iets mis in de verhuizing, dan is het origineel er nog. Ze
// kosten samen een paar kilobyte en kunnen later met de hand weg.
//
// Het feitenpakket (`wl:facts:*`) verhuist niet mee. Dat is een cache met een
// houdbaarheid van acht dagen die zichzelf opnieuw opbouwt.
// ---------------------------------------------------------------------------

import { redis } from "./redis";
import { persoonSleutel } from "./persoon";

export interface MigratieUitslag {
  profiel: boolean;
  wegingen: number;
  adviezen: number;
}

export async function migreerNaarPersoon(persoon: string): Promise<MigratieUitslag> {
  const uitslag: MigratieUitslag = { profiel: false, wegingen: 0, adviezen: 0 };

  const profiel = await redis.get("wl:profile");
  if (profiel != null) {
    await redis.set(persoonSleutel(persoon, "profile"), profiel);
    uitslag.profiel = true;
  }

  uitslag.wegingen = await kopieerWegingen(persoon);
  uitslag.adviezen = await kopieerAdviezen(persoon);

  for (const los of ["advice:active", "advice:cooldown", "advice:seen"]) {
    const waarde = await redis.get(`wl:${los}`);
    if (waarde != null) await redis.set(persoonSleutel(persoon, los), waarde);
  }

  return uitslag;
}

/**
 * De weeglijst is een gesorteerde verzameling met de datum als score; die
 * scores moeten mee, anders klopt de volgorde straks niet meer. Per weging
 * hangt er ook een losse regel met de notitie.
 */
async function kopieerWegingen(persoon: string): Promise<number> {
  const plat = ((await redis.zrange("wl:weight:log", 0, -1, { withScores: true })) ??
    []) as (string | number)[];
  if (plat.length === 0) return 0;

  const leden: { score: number; member: string }[] = [];
  for (let i = 0; i + 1 < plat.length; i += 2) {
    leden.push({ score: Number(plat[i + 1]), member: String(plat[i]) });
  }
  if (leden.length === 0) return 0;

  await redis.zadd(persoonSleutel(persoon, "weight:log"), leden[0], ...leden.slice(1));

  for (const lid of leden) {
    const datum = lid.member.slice(0, lid.member.lastIndexOf(":"));
    if (!datum) continue;
    const regel = await redis.get(`wl:weight:${datum}`);
    if (regel != null) await redis.set(persoonSleutel(persoon, `weight:${datum}`), regel);
  }
  return leden.length;
}

async function kopieerAdviezen(persoon: string): Promise<number> {
  const plat = ((await redis.zrange("wl:advice:index", 0, -1, { withScores: true })) ??
    []) as (string | number)[];
  if (plat.length === 0) return 0;

  const leden: { score: number; member: string }[] = [];
  for (let i = 0; i + 1 < plat.length; i += 2) {
    leden.push({ score: Number(plat[i + 1]), member: String(plat[i]) });
  }
  if (leden.length === 0) return 0;

  await redis.zadd(persoonSleutel(persoon, "advice:index"), leden[0], ...leden.slice(1));

  for (const lid of leden) {
    const advies = await redis.get(`wl:advice:${lid.member}`);
    if (advies != null) await redis.set(persoonSleutel(persoon, `advice:${lid.member}`), advies);
  }
  return leden.length;
}
