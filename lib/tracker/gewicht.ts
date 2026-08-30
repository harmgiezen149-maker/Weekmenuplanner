// ---------------------------------------------------------------------------
// Weeglog en trendlijn.
//
// Een losse weging zegt weinig: een kilo verschil van dag tot dag is vocht,
// geen vet. De trendlijn is een exponentieel voortschrijdend gemiddelde over
// de wegingen en is daarom het getal waar de app op stuurt.
// ---------------------------------------------------------------------------

/** Weegfactor van de nieuwste meting. Lager betekent een vlakkere lijn. */
export const TREND_ALFA = 0.25;

export interface Weging {
  date: string; // YYYY-MM-DD
  kg: number;
  note?: string;
}

export interface WegingMetTrend extends Weging {
  /** Het voortschrijdend gemiddelde tot en met deze weging. */
  trend_kg: number;
  /** Verschil met de vorige trendwaarde. Negatief is afname. */
  delta_kg: number;
  /**
   * Verschil met de vórige meting, niet met de vorige trendwaarde. Null bij de
   * eerste weging, want er is dan niets om mee te vergelijken.
   *
   * De app stuurt op de trend, en dat blijft zo — maar wie 2,4 kilo lager op de
   * weegschaal staat wil dat getal zien, niet alleen de gedempte versie ervan.
   * Beide naast elkaar tonen is eerlijker dan één van de twee weglaten: de
   * trend zegt waar het heen gaat, de meting wat er vanochtend stond.
   */
  delta_meting_kg: number | null;
}

/**
 * Berekent de trendlijn over alle wegingen, oplopend in tijd.
 *
 * De trend wordt bewust niet opgeslagen maar elke keer opnieuw berekend:
 * corrigeer je een oude weging, dan kloppen alle latere waarden meteen weer.
 * Een opgeslagen trend zou dan stil verouderen.
 */
export function metTrend(wegingen: Weging[]): WegingMetTrend[] {
  const oplopend = [...wegingen].sort((a, b) => a.date.localeCompare(b.date));
  const uit: WegingMetTrend[] = [];
  let trend = 0;

  oplopend.forEach((w, i) => {
    // De eerste meting is zijn eigen trend; er is nog niets om mee te middelen.
    trend = i === 0 ? w.kg : TREND_ALFA * w.kg + (1 - TREND_ALFA) * trend;
    uit.push({
      ...w,
      trend_kg: trend,
      delta_kg: i === 0 ? 0 : trend - uit[i - 1].trend_kg,
      delta_meting_kg: i === 0 ? null : w.kg - oplopend[i - 1].kg,
    });
  });

  return uit;
}

/** De laatste trendwaarde, of null als er nog niet gewogen is. */
export function huidigeTrend(wegingen: Weging[]): number | null {
  const reeks = metTrend(wegingen);
  return reeks.length > 0 ? reeks[reeks.length - 1].trend_kg : null;
}

export interface Voortgang {
  startKg: number;
  huidigKg: number;
  streefKg: number;
  /** Kilo's af sinds de start. Positief is afgevallen. */
  afgevallenKg: number;
  /** Kilo's nog te gaan. Nul als het streefgewicht bereikt is. */
  teGaanKg: number;
  /** Aandeel van de weg naar het streefgewicht, 0 tot 1. */
  aandeel: number;
  bereikt: boolean;
}

/**
 * Voortgang naar het streefgewicht, gerekend op de trend.
 * Ligt het startgewicht op of onder het streefgewicht, dan is er geen weg af
 * te leggen en staat het aandeel op 1.
 */
export function voortgang(startKg: number, huidigKg: number, streefKg: number): Voortgang {
  const teAfleggen = startKg - streefKg;
  const afgevallenKg = startKg - huidigKg;
  const bereikt = huidigKg <= streefKg;

  return {
    startKg,
    huidigKg,
    streefKg,
    afgevallenKg,
    teGaanKg: Math.max(0, huidigKg - streefKg),
    aandeel: teAfleggen <= 0 ? 1 : Math.min(1, Math.max(0, afgevallenKg / teAfleggen)),
    bereikt,
  };
}

/**
 * Gemiddelde afname per week over de trendlijn, in kilo.
 * Geeft null zolang er te weinig of te kort achter elkaar gewogen is.
 */
export function tempoPerWeek(wegingen: Weging[]): number | null {
  const reeks = metTrend(wegingen);
  if (reeks.length < 2) return null;

  const eerste = reeks[0];
  const laatste = reeks[reeks.length - 1];
  const dagen =
    (Date.parse(laatste.date + "T00:00:00Z") - Date.parse(eerste.date + "T00:00:00Z")) / 86400000;
  if (dagen < 7) return null;

  return ((eerste.trend_kg - laatste.trend_kg) / dagen) * 7;
}
