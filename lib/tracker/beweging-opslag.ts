import { redis } from "../redis";
import { metPersoon, persoonSleutel } from "../persoon";
import { addActiviteit, getProfile, nieuwId } from "./data";
import { activiteitPunten } from "./activiteit";
import type { ActiviteitSoort } from "./activiteit";
import { bmr, leeftijd } from "./budget";
import type { Activity } from "./types";

// ---------------------------------------------------------------------------
// Activiteiten van buiten wegschrijven.
//
// Er zijn inmiddels vier wegen naar binnen — losse velden, een blok JSON van
// een plug-in, een geplakte lijst en losse tekst — en die deden alle vier
// hetzelfde: profiel ophalen, punten uitrekenen, dubbele eruit, opslaan. Vier
// kopieën van diezelfde lus lopen na twee wijzigingen gegarandeerd uit elkaar,
// en dan boekt de ene weg anders dan de andere. Vandaar één plek.
// ---------------------------------------------------------------------------

/** Hoe lang we onthouden dat we een training al hebben gezien. */
const GEZIEN_TTL = 90 * 24 * 60 * 60;

const GEZIEN = (persoon: string, externId: string) =>
  persoonSleutel(persoon, `extern:${externId}`);

export interface TeBoeken {
  datum: string;
  soort: ActiviteitSoort;
  minuten: number;
  /** Waaraan we deze training herkennen als hij nog eens langskomt. */
  externId: string;
}

export interface Geboekt {
  datum: string;
  soort: string;
  minuten: number;
  punten: number;
}

export type BoekUitslag =
  | { geboekt: Geboekt[]; overgeslagen: number }
  | { fout: string };

/**
 * Boekt een reeks activiteiten.
 *
 * Elke training laat een merkje achter, geschreven met NX: Tasker vuurt bij een
 * wankele verbinding zonder blikken of blozen drie keer, en drie keer dezelfde
 * hardloopsessie verruimt je budget met punten die je niet hebt verdiend. Loopt
 * het opslaan daarna alsnog mis, dan gaat het merkje weer weg — anders zou die
 * training voorgoed overgeslagen zijn.
 */
export async function boekActiviteiten(
  persoon: string, lijst: TeBoeken[], proef = false
): Promise<BoekUitslag> {
  if (lijst.length === 0) return { geboekt: [], overgeslagen: 0 };

  if (proef) {
    return {
      geboekt: lijst.map((a) => ({
        datum: a.datum, soort: a.soort.naam, minuten: a.minuten, punten: 0,
      })),
      overgeslagen: 0,
    };
  }

  const profiel = await metPersoon(persoon, () => getProfile());
  if (!profiel) return { fout: "Vul eerst je profiel in de app in." };

  const basaal = bmr(profiel.sex, profiel.current_weight_kg, profiel.height_cm,
    leeftijd(profiel.birthdate));

  const geboekt: Geboekt[] = [];
  let overgeslagen = 0;

  for (const a of lijst) {
    const nieuw = await redis.set(GEZIEN(persoon, a.externId), a.datum,
      { nx: true, ex: GEZIEN_TTL });
    if (!nieuw) { overgeslagen++; continue; }

    try {
      await metPersoon(persoon, async () => {
        const activiteit: Activity = {
          id: nieuwId(),
          ts: Date.now(),
          name: a.soort.naam,
          met: a.soort.met,
          minutes: a.minuten,
          points: activiteitPunten(a.soort.met, profiel.current_weight_kg, a.minuten,
            basaal, profiel.points_scale),
        };
        await addActiviteit(a.datum, activiteit);
        geboekt.push({
          datum: a.datum, soort: a.soort.naam, minuten: a.minuten, punten: activiteit.points,
        });
      });
    } catch (e) {
      await redis.del(GEZIEN(persoon, a.externId));
      throw e;
    }
  }

  return { geboekt, overgeslagen };
}
