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
  /**
   * Wat een weegschaal met lichaamsanalyse er verder bij geeft. Allemaal
   * optioneel: de meeste wegingen zijn één getal, en een weegschaal die dit
   * niet meet hoort de rest niet in de weg te zitten.
   *
   * Spiermassa staat in kilo. Weegschalen geven dit soms in procenten, en die
   * twee reeksen overlappen bijna volledig — 38 kan 38 kilo spier zijn of 38
   * procent van je gewicht. Uit het getal alleen is dat niet af te leiden, dus
   * het invoerveld vraagt de eenheid en rekent procenten om vóór het opslaan.
   * Zo staat er in de opslag maar één ding.
   */
  vet_pct?: number;
  spier_kg?: number;
  vocht_pct?: number;
}

/** Grenzen waarbinnen een meting van een weegschaal kan komen. */
export const GRENZEN = {
  kg: { min: 20, max: 400 },
  vet_pct: { min: 2, max: 75 },
  vocht_pct: { min: 20, max: 80 },
  spier_kg: { min: 5, max: 150 },
  /** Spiermassa als percentage van het lichaamsgewicht. */
  spier_pct: { min: 5, max: 80 },
} as const;

/**
 * BMI uit gewicht en lengte.
 *
 * Bewust berekend en niet overgenomen van de weegschaal: die rekent met de
 * lengte die er in het apparaat staat, de app met de lengte uit je profiel.
 * Twee BMI's die elkaar tegenspreken is erger dan één BMI die je zelf kunt
 * narekenen.
 *
 * Null zonder bruikbare lengte; een BMI zonder lengte is een gok.
 */
export function bmi(kg: number, lengteCm: number | undefined | null): number | null {
  if (!Number.isFinite(kg) || kg <= 0) return null;
  const m = Number(lengteCm) / 100;
  if (!Number.isFinite(m) || m < 0.5 || m > 2.75) return null;
  return Math.round((kg / (m * m)) * 10) / 10;
}

/**
 * Hoe de BMI heet in de tabel van de WHO.
 *
 * Beschrijvend, niet waarderend — het is een verhouding tussen gewicht en
 * lengte, geen oordeel. En hij zegt niets over spier: een gespierd iemand komt
 * er hoog uit zonder dat daar iets mis mee is. Dat hoort erbij te staan waar
 * het getal staat.
 */
export function bmiKlasse(waarde: number): string {
  if (waarde < 18.5) return "ondergewicht";
  if (waarde < 25) return "normaal";
  if (waarde < 30) return "overgewicht";
  return "obesitas";
}

export interface WegingMetTrend extends Weging {
  /** Verschil met de vorige meting per onderdeel. Null als een van de twee ontbreekt. */
  delta_vet_pct: number | null;
  delta_spier_kg: number | null;
  delta_vocht_pct: number | null;
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
      delta_vet_pct: verschil(oplopend[i - 1]?.vet_pct, w.vet_pct),
      delta_spier_kg: verschil(oplopend[i - 1]?.spier_kg, w.spier_kg),
      delta_vocht_pct: verschil(oplopend[i - 1]?.vocht_pct, w.vocht_pct),
    });
  });

  return uit;
}

/**
 * Verschil tussen twee metingen die er allebei moeten zijn.
 *
 * Meet je de ene keer wel je vetpercentage en de andere keer niet, dan is er
 * geen verschil te melden. Nul teruggeven zou "onveranderd" betekenen, en dat
 * is iets anders dan "niet gemeten".
 */
function verschil(vorige: number | undefined, nu: number | undefined): number | null {
  return typeof vorige === "number" && typeof nu === "number" ? nu - vorige : null;
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
