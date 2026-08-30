import type { Day, Entry, EntrySource, Profile } from "./types";
import { effectiveSugar, toonPunten } from "./points.ts";
import { dagBewegingspunten } from "./activiteit.ts";
import { dagenTussen, verschuifDatum } from "./datum.ts";
import { dagIndex, weekStart } from "./week.ts";
import { metTrend, type Weging } from "./gewicht.ts";
import { bmr, leeftijd, tdee } from "./budget.ts";

// ---------------------------------------------------------------------------
// De feitenlaag van de adviesmodule (Inzicht).
//
// Dit is de enige laag die correct móét zijn. Er komen geen conclusies uit,
// alleen getallen: een plat object dat zowel het dashboard vult als straks
// woordelijk aan het taalmodel wordt meegegeven. Alles wat een advies noemt
// moet hier letterlijk in terug te vinden zijn, en daarom staat elk getal
// afgerond in het pakket — niet pas bij het tonen.
//
// `buildFactPack` is bewust puur: het leest zelf niets. Het ophalen uit Redis
// en het cachen staan in lib/tracker/data.ts, zodat deze berekening op
// geseede data te testen is zonder database.
//
// De sleutels zijn Engels. Ze reizen mee als `facts_used` naar de
// validatielaag, en een sleutel die van taal wisselt breekt de herleidbaarheid.
// ---------------------------------------------------------------------------

export const VENSTER_WEKEN = 12;
export const VENSTER_DAGEN = VENSTER_WEKEN * 7;

// Onder dit aantal gelogde dagen worden patroonvlaggen niet gezet. Een vlag is
// een hint aan het taalmodel; een hint op vier dagen data is een verkeerde hint,
// en die weegt zwaarder dan een gemiste.
export const MIN_DAGEN_VOOR_PATRONEN = 14;

/** Weekdagsleutels van het pakket. Index 0 = maandag, net als `dagIndex`. */
export const WEEKDAGEN = [
  "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag",
] as const;

/** Blokken waarin de dag wordt verdeeld. `tot` is exclusief, in hele uren. */
const DAGBLOKKEN = [
  { sleutel: "before_10", van: 0, tot: 10 },
  { sleutel: "h10_14", van: 10, tot: 14 },
  { sleutel: "h14_18", van: 14, tot: 18 },
  { sleutel: "h18_21", van: 18, tot: 21 },
  { sleutel: "after_21", van: 21, tot: 24 },
] as const;

export type Dagblok = (typeof DAGBLOKKEN)[number]["sleutel"];

// Energie-inhoud van een kilo lichaamsvet. Zelfde vuistregel als het budget.
const KCAL_PER_KG_VET = 7700;

export interface FactPack {
  meta: {
    generated_at: string;
    reference_date: string;
    window_weeks: number;
    window_start: string;
    days_logged: number;
    days_in_window: number;
    completeness: number;
    /** Eerste gelogde dag binnen het venster, of null. */
    first_logged_date: string | null;
    /** Dagen tussen de eerste gelogde dag en de peildatum, deze meegerekend. */
    history_days: number;
    /** Gelogde dagen in de laatste veertien. Bewijslast voor sectie 5.1. */
    logged_last_14: number;
  };

  budget: {
    current_daily_budget: number;
    weekly_buffer: number;
    /**
     * Aandeel gelogde dagen dat binnen budget bleef. Bewegingspunten van die
     * dag tellen mee: ze verruimen het budget, dus een dag van 42 punten met 5
     * uit beweging blijft binnen een budget van 38.
     */
    adherence_rate: number;
    avg_points_per_day: number;
    median_points_per_day: number;
    sd_points_per_day: number;
    /**
     * Gemiddeld met bewegen verdiend, over dezelfde gelogde dagen als
     * `avg_points_per_day`. Staat los van `activity.avg_weekly_points`, dat per
     * week rekent en over álle dagen van het venster.
     *
     * Zonder dit getal is `adherence_rate` niet na te rekenen: je ziet dan een
     * gemiddelde van 42,3 tegen een budget van 38 en toch dagen die binnen
     * budget vielen, zonder dat ergens staat waar die ruimte vandaan kwam.
     */
    avg_activity_points_per_day: number;
  };

  by_weekday: Record<string, {
    avg_points: number;
    days_counted: number;
    over_budget_rate: number;
    /**
     * Gemiddeld met bewegen verdiend op deze weekdag, over dezelfde gelogde
     * dagen. Ruimte bovenop het dagbudget, geen gegeten punten — zonder dit
     * getal lijkt een actieve zaterdag boven budget te zitten terwijl hij er
     * onder bleef.
     */
    avg_bewegingspunten: number;
  }>;

  by_time_of_day: Record<Dagblok, number>;

  buffer: {
    avg_weekly_used: number;
    /** 1 = maandag ... 7 = zondag. Null als de buffer zelden opgaat. */
    avg_exhaustion_day: number | null;
    /** Plaats binnen de trackerweek, 1 = weegdag. Zie de toelichting hieronder. */
    avg_exhaustion_position: number | null;
    weeks_fully_used: number;
    weeks_counted: number;
  };

  nutrition: {
    protein_g_per_kg: number;
    fiber_g: number;
    satfat_g: number;
    effective_sugar_g: number;
    kcal: number;
  };

  top_contributors: Array<{
    name: string; total_points: number; occurrences: number; avg_points: number;
  }>;

  source_mix: Record<EntrySource, number>;

  recipe_vs_freestyle: {
    recipe_days: { count: number; avg_points: number };
    freestyle_days: { count: number; avg_points: number };
  };

  activity: { avg_weekly_points: number; sessions_per_week: number };

  weight: {
    entries: Array<{ date: string; kg: number; trend_kg: number }>;
    trend_change_kg_per_week: number | null;
    total_change_kg: number | null;
    current_trend_kg: number | null;
    goal_kg: number;
  };

  energy_reconciliation: {
    tdee_kcal: number;
    avg_logged_kcal: number;
    expected_change_kg_per_week: number | null;
    actual_change_kg_per_week: number | null;
    gap_kg_per_week: number | null;
  };

  /**
   * De week waar je nu in zit. Staat los van `buffer`, dat alleen volledige
   * weken telt: de afwijkingstrigger moet juist naar de lopende week kijken.
   */
  current_week: {
    start: string;
    days_elapsed: number;
    logged_days: number;
    buffer_used: number;
    /** Plaats in de week waarop de buffer opging, of null. 1 = de weegdag. */
    exhausted_on_position: number | null;
  };

  /** Getallen waar vlaggen op rusten die verder nergens in het pakket staan. */
  recent: {
    /** Hoeveel gelogde dagen zijn meegewogen voor de telling hieronder; hooguit zeven. */
    logged_days_considered: number;
    days_under_80pct_budget: number;
    /** Gelogde dagen in de laatste zeven kalenderdagen — niet de laatste zeven gelogde. */
    logged_days_last_7_calendar: number;
    /** Gelogde dagen per volledige trackerweek, oudste eerst, hooguit vier. */
    logged_days_per_week_last_4: number[];
    weeks_with_logging: number;
    complete_weeks: number;
  };

  flags: string[];
}

export interface FeitenInvoer {
  /** Laatste dag van het venster, meestal vandaag. */
  peildatum: string;
  /** Dagen met inhoud uit het venster. Ontbrekende datums gelden als niet gelogd. */
  dagen: Day[];
  /** Het volledige weeglog; de trend heeft de hele reeks nodig om te kloppen. */
  wegingen: Weging[];
  profiel: Profile;
  /**
   * Lengte van het venster in dagen. Standaard twaalf weken; de evaluatielus
   * gebruikt een korter venster om één meetwaarde over de horizon van een
   * actie opnieuw te berekenen — met exact dezelfde rekenregels, zodat de
   * meting bij uitgifte en bij evaluatie niet uiteen kunnen lopen.
   */
  vensterDagen?: number;
  /** Alleen om `generated_at` vast te zetten in tests. */
  nu?: Date;
}

/** Alle datums van het venster, oudste eerst. */
export function vensterDatums(peildatum: string, dagen = VENSTER_DAGEN): string[] {
  return Array.from({ length: dagen }, (_, i) => verschuifDatum(peildatum, i - (dagen - 1)));
}

interface DagFeit {
  datum: string;
  weekdag: number;
  gelogd: boolean;
  punten: number;
  bewegingspunten: number;
  overBudget: number;
  kcal: number;
  protein_g: number;
  fiber_g: number;
  satfat_g: number;
  effective_sugar_g: number;
  entries: Entry[];
  sessies: number;
}

/**
 * Bouwt het feitenpakket. Pure functie: zelfde invoer, zelfde uitvoer.
 *
 * Twee keuzes die door het hele pakket lopen:
 *
 *   1. Dagen zonder logging tellen nergens mee als nul. Een dag die je vergat
 *      bij te houden was geen dag zonder eten. Overal waar gemiddeld wordt,
 *      staat het aantal dagen waarover gemiddeld is ernaast.
 *   2. Punten worden getoond zoals in de rest van de app: geschaald met
 *      `points_scale` en afgekapt op nul.
 */
export function buildFactPack(invoer: FeitenInvoer): FactPack {
  const { peildatum, profiel } = invoer;
  const schaal = profiel.points_scale;
  const datums = vensterDatums(peildatum, invoer.vensterDagen ?? VENSTER_DAGEN);
  const perDatum = new Map(invoer.dagen.map((d) => [d.date, d]));

  const dagFeiten: DagFeit[] = datums.map((datum) => {
    const dag = perDatum.get(datum);
    const entries = dag?.entries ?? [];
    const bewegingspunten = dag ? dagBewegingspunten(dag.activity).meetellend : 0;
    const punten = dag ? toonPunten(dag.totals.points_raw, schaal) : 0;
    return {
      datum,
      weekdag: dagIndex(datum),
      gelogd: entries.length > 0,
      punten,
      bewegingspunten,
      overBudget: Math.max(0, punten - profiel.daily_budget - bewegingspunten),
      kcal: dag?.totals.kcal ?? 0,
      protein_g: dag?.totals.protein_g ?? 0,
      fiber_g: dag?.totals.fiber_g ?? 0,
      satfat_g: dag?.totals.satfat_g ?? 0,
      effective_sugar_g: entries.reduce((s, e) => s + effectiveSugar(e.nutrients, e.grams), 0),
      entries,
      sessies: dag?.activity.length ?? 0,
    };
  });

  const gelogd = dagFeiten.filter((d) => d.gelogd);
  const alleEntries = gelogd.flatMap((d) => d.entries);

  const pakket: FactPack = {
    meta: bouwMeta(dagFeiten, gelogd, peildatum, invoer.nu),
    budget: bouwBudget(gelogd, profiel),
    by_weekday: bouwWeekdagen(gelogd),
    by_time_of_day: bouwDagblokken(alleEntries),
    buffer: bouwBuffer(dagFeiten, profiel),
    nutrition: bouwVoeding(gelogd, profiel),
    top_contributors: bouwBijdragers(alleEntries, schaal),
    source_mix: bouwBronmix(alleEntries),
    recipe_vs_freestyle: bouwReceptVergelijking(gelogd),
    activity: bouwBeweging(dagFeiten),
    weight: bouwGewicht(invoer.wegingen, datums, profiel),
    current_week: bouwLopendeWeek(dagFeiten, profiel),
    energy_reconciliation: { tdee_kcal: 0, avg_logged_kcal: 0, expected_change_kg_per_week: null, actual_change_kg_per_week: null, gap_kg_per_week: null },
    recent: bouwRecent(dagFeiten, gelogd, profiel),
    flags: [],
  };

  pakket.energy_reconciliation = bouwEnergiebalans(gelogd, profiel, pakket.weight, peildatum);
  // De vlaggen worden bewust uit het afgeronde pakket afgeleid en niet uit de
  // ruwe tussenwaarden. Zo staat een vlag altijd op de getallen die de
  // gebruiker ziet en die het advies straks mag citeren.
  pakket.flags = bepaalVlaggen(pakket);

  return pakket;
}

// -- onderdelen --------------------------------------------------------------

function bouwMeta(alle: DagFeit[], gelogd: DagFeit[], peildatum: string, nu?: Date): FactPack["meta"] {
  const eerste = gelogd.length > 0 ? gelogd[0].datum : null;
  const laatste14 = alle.slice(-14).filter((d) => d.gelogd).length;
  return {
    generated_at: (nu ?? new Date()).toISOString(),
    reference_date: peildatum,
    window_weeks: Math.max(1, Math.round(alle.length / 7)),
    window_start: alle[0].datum,
    days_logged: gelogd.length,
    days_in_window: alle.length,
    completeness: rond(deel(gelogd.length, alle.length), 2),
    first_logged_date: eerste,
    history_days: eerste ? dagenTussen(eerste, peildatum) + 1 : 0,
    logged_last_14: laatste14,
  };
}

function bouwBudget(gelogd: DagFeit[], profiel: Profile): FactPack["budget"] {
  const punten = gelogd.map((d) => d.punten);
  // overBudget is al berekend inclusief de bewegingspunten van die dag.
  const binnen = gelogd.filter((d) => d.overBudget === 0).length;
  const gem = gemiddelde(punten);
  return {
    current_daily_budget: profiel.daily_budget,
    weekly_buffer: profiel.weekly_buffer,
    adherence_rate: rond(deel(binnen, gelogd.length), 2),
    avg_points_per_day: rond(gem, 1),
    median_points_per_day: rond(mediaan(punten), 1),
    sd_points_per_day: rond(standaardafwijking(punten), 1),
    avg_activity_points_per_day: rond(gemiddelde(gelogd.map((d) => d.bewegingspunten)), 1),
  };
}

function bouwWeekdagen(gelogd: DagFeit[]): FactPack["by_weekday"] {
  const uit: FactPack["by_weekday"] = {};
  WEEKDAGEN.forEach((naam, i) => {
    const dagen = gelogd.filter((d) => d.weekdag === i);
    uit[naam] = {
      avg_points: rond(gemiddelde(dagen.map((d) => d.punten)), 1),
      days_counted: dagen.length,
      over_budget_rate: rond(deel(dagen.filter((d) => d.overBudget > 0).length, dagen.length), 2),
      avg_bewegingspunten: rond(gemiddelde(dagen.map((d) => d.bewegingspunten)), 1),
    };
  });
  return uit;
}

/**
 * Aandeel van de punten per dagdeel.
 *
 * Gewogen met de onafgeronde punten van de regel zelf, niet met de afgeronde
 * dagtotalen: anders zou een dag met tien kleine regels zwaarder wegen dan een
 * dag met twee grote. Regels die onder nul uitkomen (mager eiwit) tellen als
 * nul mee — negatieve gewichten zouden het aandeel onleesbaar maken.
 */
function bouwDagblokken(entries: Entry[]): FactPack["by_time_of_day"] {
  const per = new Map<Dagblok, number>(DAGBLOKKEN.map((b) => [b.sleutel, 0]));
  let totaal = 0;

  for (const e of entries) {
    const gewicht = Math.max(0, e.points_raw);
    if (gewicht === 0) continue;
    const uur = new Date(e.ts).getHours();
    const blok = DAGBLOKKEN.find((b) => uur >= b.van && uur < b.tot) ?? DAGBLOKKEN[0];
    per.set(blok.sleutel, (per.get(blok.sleutel) ?? 0) + gewicht);
    totaal += gewicht;
  }

  const uit = {} as FactPack["by_time_of_day"];
  for (const b of DAGBLOKKEN) uit[b.sleutel] = rond(deel(per.get(b.sleutel) ?? 0, totaal), 2);
  return uit;
}

/**
 * Weekbuffer over de volledige trackerweken in het venster.
 *
 * De week loopt van weegdag tot weegdag; alleen weken waarvan alle zeven dagen
 * in het venster vallen tellen mee, anders drukt de lopende halve week het
 * gemiddelde omlaag.
 *
 * Het uitputtingsmoment staat er twee keer in. `avg_exhaustion_day` is de
 * kalenderdag (1 = maandag), zoals afgesproken. Maar "vroeg in de week" is
 * alleen te zien ten opzichte van de weegdag: bij een weegdag op zondag is
 * maandag de tweede dag van de week, niet de eerste. Daarom staat de plaats
 * binnen de trackerweek er als `avg_exhaustion_position` naast, en rust de
 * vlag `buffer_early` op die tweede waarde.
 */
function bouwBuffer(alle: DagFeit[], profiel: Profile): FactPack["buffer"] {
  const weken = volledigeWeken(alle, profiel.weigh_day);

  const gebruikt: number[] = [];
  const kalenderdagen: number[] = [];
  const plaatsen: number[] = [];
  let volGebruikt = 0;

  for (const week of weken) {
    const totaal = week.reduce((s, d) => s + d.overBudget, 0);
    gebruikt.push(totaal);
    if (totaal >= profiel.weekly_buffer) volGebruikt++;

    let cumulatief = 0;
    for (let i = 0; i < week.length; i++) {
      cumulatief += week[i].overBudget;
      if (cumulatief >= profiel.weekly_buffer) {
        kalenderdagen.push(week[i].weekdag + 1);
        plaatsen.push(i + 1);
        break;
      }
    }
  }

  return {
    avg_weekly_used: rond(gemiddelde(gebruikt), 1),
    avg_exhaustion_day: kalenderdagen.length > 0 ? rond(gemiddelde(kalenderdagen), 1) : null,
    avg_exhaustion_position: plaatsen.length > 0 ? rond(gemiddelde(plaatsen), 1) : null,
    weeks_fully_used: volGebruikt,
    weeks_counted: weken.length,
  };
}

function bouwVoeding(gelogd: DagFeit[], profiel: Profile): FactPack["nutrition"] {
  const eiwit = gemiddelde(gelogd.map((d) => d.protein_g));
  return {
    protein_g_per_kg: rond(deel(eiwit, profiel.current_weight_kg), 2),
    fiber_g: rond(gemiddelde(gelogd.map((d) => d.fiber_g)), 1),
    satfat_g: rond(gemiddelde(gelogd.map((d) => d.satfat_g)), 1),
    effective_sugar_g: rond(gemiddelde(gelogd.map((d) => d.effective_sugar_g)), 1),
    kcal: Math.round(gemiddelde(gelogd.map((d) => d.kcal))),
  };
}

/**
 * De vijftien producten die samen de meeste punten hebben gekost.
 *
 * Samengestelde maaltijden en recepten tellen onder hun eigen naam, niet onder
 * hun onderdelen: dat is de naam die je in het logboek terugziet.
 */
function bouwBijdragers(entries: Entry[], schaal: number): FactPack["top_contributors"] {
  const per = new Map<string, { naam: string; totaal: number; aantal: number }>();

  for (const e of entries) {
    const naam = e.name.trim();
    if (!naam) continue;
    const sleutel = `${naam.toLowerCase()}|${(e.brand ?? "").trim().toLowerCase()}`;
    const rij = per.get(sleutel) ?? { naam, totaal: 0, aantal: 0 };
    rij.totaal += Math.max(0, e.points_raw) * schaal;
    rij.aantal++;
    per.set(sleutel, rij);
  }

  return [...per.values()]
    .sort((a, b) => b.totaal - a.totaal || a.naam.localeCompare(b.naam))
    .slice(0, 15)
    .map((r) => ({
      name: r.naam,
      total_points: rond(r.totaal, 1),
      occurrences: r.aantal,
      avg_points: rond(deel(r.totaal, r.aantal), 1),
    }));
}

/** Aantal regels per bron. Alle acht bronnen staan er, ook de lege. */
function bouwBronmix(entries: Entry[]): FactPack["source_mix"] {
  const uit: FactPack["source_mix"] = {
    barcode: 0, search: 0, manual: 0, photo: 0, link: 0, recipe: 0, favorite: 0, meal: 0,
  };
  for (const e of entries) if (e.source in uit) uit[e.source]++;
  return uit;
}

function bouwReceptVergelijking(gelogd: DagFeit[]): FactPack["recipe_vs_freestyle"] {
  const metRecept = gelogd.filter((d) => d.entries.some((e) => e.source === "recipe"));
  const zonder = gelogd.filter((d) => !d.entries.some((e) => e.source === "recipe"));
  return {
    recipe_days: {
      count: metRecept.length,
      avg_points: rond(gemiddelde(metRecept.map((d) => d.punten)), 1),
    },
    freestyle_days: {
      count: zonder.length,
      avg_points: rond(gemiddelde(zonder.map((d) => d.punten)), 1),
    },
  };
}

/**
 * Beweging per week, gedeeld door het aantal weken waarin iets gelogd is.
 * Delen door de volle twaalf weken zou iemand die zes weken geleden begon de
 * helft van zijn beweging afpakken.
 */
function bouwBeweging(alle: DagFeit[]): FactPack["activity"] {
  const weken = wekenMetLogging(alle);
  const punten = alle.reduce((s, d) => s + d.bewegingspunten, 0);
  const sessies = alle.reduce((s, d) => s + d.sessies, 0);
  return {
    avg_weekly_points: rond(deel(punten, weken), 1),
    sessions_per_week: rond(deel(sessies, weken), 1),
  };
}

function bouwGewicht(wegingen: Weging[], datums: string[], profiel: Profile): FactPack["weight"] {
  // De trend over de héle reeks berekenen en pas daarna afkappen: een trend die
  // op de vensterrand opnieuw begint, begint bij zijn eerste meting en klopt niet.
  const reeks = metTrend(wegingen);
  const van = datums[0];
  const tot = datums[datums.length - 1];
  const inVenster = reeks.filter((w) => w.date >= van && w.date <= tot);

  return {
    entries: inVenster.map((w) => ({
      date: w.date, kg: rond(w.kg, 1), trend_kg: rond(w.trend_kg, 2),
    })),
    trend_change_kg_per_week: tempoOverLaatste(reeks, 4),
    total_change_kg: reeks.length >= 2
      ? rond(reeks[reeks.length - 1].trend_kg - reeks[0].trend_kg, 2)
      : null,
    current_trend_kg: reeks.length > 0 ? rond(reeks[reeks.length - 1].trend_kg, 2) : null,
    goal_kg: profiel.goal_weight_kg,
  };
}

/**
 * Wat het logboek voorspelt tegenover wat de weegschaal laat zien.
 *
 * De verwachting komt uit de onderhoudsbehoefte min de gelogde inname. Gelogde
 * beweging telt hier niet apart mee: de activiteitsfactor zit al in de
 * onderhoudsbehoefte, en dat er twee keer in stoppen maakt het gat kunstmatig
 * groter.
 *
 * Een gat betekent niet dat er iets mis is met het lichaam. Het betekent meestal
 * dat er iets niet gelogd is — precies waar deze vergelijking voor bedoeld is.
 */
function bouwEnergiebalans(
  gelogd: DagFeit[], profiel: Profile, gewicht: FactPack["weight"], peildatum: string
): FactPack["energy_reconciliation"] {
  const jaren = leeftijd(profiel.birthdate, new Date(peildatum + "T12:00:00"));
  const onderhoud = tdee(
    bmr(profiel.sex, profiel.current_weight_kg, profiel.height_cm, jaren),
    profiel.activity_factor
  );
  const gemKcal = gemiddelde(gelogd.map((d) => d.kcal));

  const verwacht = gelogd.length > 0
    ? rond(((gemKcal - onderhoud) * 7) / KCAL_PER_KG_VET, 2)
    : null;
  const werkelijk = gewicht.trend_change_kg_per_week;

  return {
    tdee_kcal: Math.round(onderhoud),
    avg_logged_kcal: Math.round(gemKcal),
    expected_change_kg_per_week: verwacht,
    actual_change_kg_per_week: werkelijk,
    gap_kg_per_week: verwacht != null && werkelijk != null ? rond(werkelijk - verwacht, 2) : null,
  };
}

function bouwRecent(alle: DagFeit[], gelogd: DagFeit[], profiel: Profile): FactPack["recent"] {
  // Voor "te weinig eten" tellen de laatste zeven gelógde dagen: een dag die je
  // niet bijhield was geen dag zonder eten. Voor "je logt bijna niet meer"
  // tellen juist de laatste zeven kálenderdagen — daar is het ontbreken zelf
  // het signaal.
  const laatsteZevenGelogd = gelogd.slice(-7);
  const drempel = profiel.daily_budget * 0.8;
  const weken = volledigeWeken(alle, profiel.weigh_day);

  return {
    logged_days_considered: laatsteZevenGelogd.length,
    days_under_80pct_budget: profiel.daily_budget > 0
      ? laatsteZevenGelogd.filter((d) => d.punten < drempel).length
      : 0,
    logged_days_last_7_calendar: alle.slice(-7).filter((d) => d.gelogd).length,
    logged_days_per_week_last_4: weken.slice(-4).map((w) => w.filter((d) => d.gelogd).length),
    weeks_with_logging: wekenMetLogging(alle),
    complete_weeks: weken.length,
  };
}

/**
 * De week waar de peildatum in valt, tot en met die dag.
 *
 * `buffer` hierboven telt alleen volledige weken, want een halve week vertekent
 * elk gemiddelde. Maar de afwijkingstrigger moet juist weten of de buffer déze
 * week al op is, en dan is die halve week precies wat je nodig hebt.
 */
function bouwLopendeWeek(alle: DagFeit[], profiel: Profile): FactPack["current_week"] {
  const start = weekStart(alle[alle.length - 1].datum, profiel.weigh_day);
  const dagen = alle.filter((d) => d.datum >= start);

  let cumulatief = 0;
  let positie: number | null = null;
  dagen.forEach((d, i) => {
    cumulatief += d.overBudget;
    if (positie == null && cumulatief >= profiel.weekly_buffer) positie = i + 1;
  });

  return {
    start: dagen[0]?.datum ?? start,
    days_elapsed: dagen.length,
    logged_days: dagen.filter((d) => d.gelogd).length,
    buffer_used: rond(cumulatief, 1),
    exhausted_on_position: positie,
  };
}

// -- vlaggen -----------------------------------------------------------------

/** Vlaggen die de toon van het hele advies omdraaien; zie sectie 10.2. */
export const GUARDRAIL_VLAGGEN = ["underconsumption", "rapid_loss"] as const;

export const VLAG_LABEL: Record<string, string> = {
  weekend_drift: "Het weekend ligt hoger dan de doordeweekse dagen",
  evening_load: "Een groot deel van de punten valt na negenen",
  low_protein: "De eiwitinname ligt onder de richtlijn",
  low_fiber: "De vezelinname ligt onder de richtlijn",
  high_variance: "De dagen lopen sterk uiteen",
  logging_gaps: "Er zijn weken met weinig gelogde dagen",
  plateau: "Het trendgewicht staat vier wegingen vrijwel stil",
  energy_gap: "De weegschaal loopt achter op wat het logboek voorspelt",
  buffer_early: "De weekbuffer is meestal vroeg in de week op",
  underconsumption: "De inname ligt structureel onder het dagbudget",
  rapid_loss: "De afname gaat sneller dan bedoeld",
};

/**
 * Deterministische hints voor het taalmodel — geen conclusies. Ze mogen
 * genegeerd worden, en het model mag patronen zien die hier niet in staan.
 *
 * Alles wat een patroon over meerdere weken beweert, vraagt eerst genoeg
 * gelogde dagen. De twee guardrail-vlaggen doen daar niet aan mee: die moeten
 * juist vroeg kunnen afgaan, want ze beschermen tegen te weinig eten en te
 * snel afvallen.
 */
export function bepaalVlaggen(p: FactPack): string[] {
  const vlaggen: string[] = [];
  const genoeg = p.meta.days_logged >= MIN_DAGEN_VOOR_PATRONEN;

  if (genoeg) {
    const doordeweeks = gemiddeldeVanDagen(p, [0, 1, 2, 3, 4]);
    const weekend = gemiddeldeVanDagen(p, [5, 6]);
    if (p.recent.weeks_with_logging >= 3 && doordeweeks > 0 && weekend >= 1.3 * doordeweeks) {
      vlaggen.push("weekend_drift");
    }
    if (p.recent.weeks_with_logging >= 3 && p.by_time_of_day.after_21 >= 0.2) {
      vlaggen.push("evening_load");
    }
    if (p.nutrition.protein_g_per_kg < 1.2) vlaggen.push("low_protein");
    if (p.nutrition.fiber_g < 25) vlaggen.push("low_fiber");
    if (p.budget.avg_points_per_day > 0
      && p.budget.sd_points_per_day > 0.35 * p.budget.avg_points_per_day) {
      vlaggen.push("high_variance");
    }
    if (p.buffer.avg_exhaustion_position != null
      && p.buffer.weeks_fully_used >= 2
      && p.buffer.avg_exhaustion_position <= 3) {
      vlaggen.push("buffer_early");
    }
    if (p.weight.trend_change_kg_per_week != null
      && p.weight.entries.length >= 4
      && p.weight.trend_change_kg_per_week >= -0.1
      && p.weight.trend_change_kg_per_week <= 0.1
      && p.budget.adherence_rate >= 0.7) {
      vlaggen.push("plateau");
    }
    if (p.energy_reconciliation.gap_kg_per_week != null
      && p.energy_reconciliation.gap_kg_per_week > 0.25) {
      vlaggen.push("energy_gap");
    }
  }

  // Weinig loggen is geen patroon dat de volle bewijslast nodig heeft; het is
  // de reden dat de rest onbetrouwbaar wordt, en hoort dus juist dán te
  // verschijnen. Wel pas als er iets te missen valt: bij een leeg logboek of
  // een tracker van een paar dagen oud zou deze vlag neerkomen op een
  // aansporing om te gaan loggen, en dat is precies wat sectie 10.3 verbiedt.
  const magere = p.recent.logged_days_per_week_last_4.filter((n) => n < 5).length;
  if (magere >= 2 && p.meta.days_logged > 0 && p.meta.history_days >= 14) {
    vlaggen.push("logging_gaps");
  }

  if (p.recent.days_under_80pct_budget >= 5) vlaggen.push("underconsumption");
  if (p.weight.trend_change_kg_per_week != null && p.weight.trend_change_kg_per_week < -1) {
    vlaggen.push("rapid_loss");
  }

  return vlaggen;
}

export function heeftGuardrail(vlaggen: string[]): boolean {
  return GUARDRAIL_VLAGGEN.some((g) => vlaggen.includes(g));
}

/**
 * De bewijslast uit sectie 5.1: minstens veertien dagen historie en acht
 * gelogde dagen in de laatste veertien. Haalt het pakket dat niet, dan worden
 * de cijfers wel getoond maar komt er geen advies — met erbij hoeveel er nog
 * nodig is, zodat het geen dichte deur is.
 */
export interface AdviesDrempel {
  genoeg: boolean;
  /** Dagen sinds de eerste gelogde dag in het venster. */
  historieDagen: number;
  historieNodig: number;
  gelogdLaatste14: number;
  gelogdNodig: number;
}

export function adviesDrempel(p: FactPack): AdviesDrempel {
  const historieNodig = Math.max(0, 14 - p.meta.history_days);
  const gelogdNodig = Math.max(0, 8 - p.meta.logged_last_14);
  return {
    genoeg: historieNodig === 0 && gelogdNodig === 0,
    historieDagen: p.meta.history_days,
    historieNodig,
    gelogdLaatste14: p.meta.logged_last_14,
    gelogdNodig,
  };
}

/**
 * Vingerafdruk van de gelogde data. Verandert er niets, dan mag het gecachete
 * pakket hergebruikt worden — dat is wat sectie 5.3 vraagt van de knop
 * "Analyseer mijn patroon".
 */
/**
 * Vorm van het pakket zelf.
 *
 * Verhoog dit zodra er een veld bijkomt of van betekenis verandert. Een
 * gecachet pakket van vóór die wijziging heeft dat veld niet, en een scherm dat
 * erop rekent tekent dan een gat — zonder dat er iets misgaat waar je het aan
 * ziet. De vingerafdruk neemt dit mee, dus oude caches vallen vanzelf af.
 */
export const PAKKETVERSIE = 3;

export function feitenVingerafdruk(invoer: Pick<FeitenInvoer, "peildatum" | "dagen" | "wegingen" | "profiel">): string {
  const regels = invoer.dagen.reduce((s, d) => s + d.entries.length + d.activity.length, 0);
  const laatste = invoer.dagen.map((d) => d.date).sort().at(-1) ?? "-";
  const laatsteWeging = invoer.wegingen.map((w) => w.date).sort().at(-1) ?? "-";
  return [
    `v${PAKKETVERSIE}`,
    invoer.peildatum, invoer.dagen.length, regels, laatste,
    invoer.wegingen.length, laatsteWeging,
    invoer.profiel.daily_budget, invoer.profiel.points_scale, invoer.profiel.weigh_day,
  ].join("|");
}

// -- rekenhulpjes ------------------------------------------------------------

/** Deling die niet op NaN of Infinity uitkomt. */
function deel(teller: number, noemer: number): number {
  return noemer > 0 ? teller / noemer : 0;
}

function gemiddelde(waarden: number[]): number {
  return deel(waarden.reduce((s, n) => s + n, 0), waarden.length);
}

function mediaan(waarden: number[]): number {
  if (waarden.length === 0) return 0;
  const s = [...waarden].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function standaardafwijking(waarden: number[]): number {
  if (waarden.length < 2) return 0;
  const gem = gemiddelde(waarden);
  return Math.sqrt(gemiddelde(waarden.map((n) => (n - gem) ** 2)));
}

function rond(n: number, decimalen = 1): number {
  if (!Number.isFinite(n)) return 0;
  const f = 10 ** decimalen;
  return Math.round(n * f) / f;
}

/** Gemiddelde punten over een aantal weekdagen, gewogen naar gelogde dagen. */
function gemiddeldeVanDagen(p: FactPack, indexen: number[]): number {
  let punten = 0;
  let dagen = 0;
  for (const i of indexen) {
    const rij = p.by_weekday[WEEKDAGEN[i]];
    if (!rij) continue;
    punten += rij.avg_points * rij.days_counted;
    dagen += rij.days_counted;
  }
  return deel(punten, dagen);
}

/**
 * De trackerweken waarvan alle zeven dagen in het venster vallen, oudste eerst.
 * Een week die half buiten het venster valt zou elk weekgemiddelde vertekenen.
 */
function volledigeWeken(alle: DagFeit[], weegdag: number): DagFeit[][] {
  const per = new Map<string, DagFeit[]>();
  for (const d of alle) {
    const start = weekStart(d.datum, weegdag);
    const lijst = per.get(start);
    if (lijst) lijst.push(d);
    else per.set(start, [d]);
  }
  return [...per.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, dagen]) => dagen)
    .filter((dagen) => dagen.length === 7);
}

/** Kalenderweken van zeven dagen waarin minstens één dag gelogd is. */
function wekenMetLogging(alle: DagFeit[]): number {
  let weken = 0;
  for (let i = 0; i < alle.length; i += 7) {
    if (alle.slice(i, i + 7).some((d) => d.gelogd)) weken++;
  }
  return weken;
}

/**
 * Verandering van het trendgewicht per week over de laatste n wegingen.
 * Negatief is afname. Null zolang de reeks te kort is of te dicht op elkaar
 * ligt: over drie dagen een weektempo uitrekenen levert een getal op dat
 * nergens op slaat.
 */
function tempoOverLaatste(reeks: ReturnType<typeof metTrend>, n: number): number | null {
  if (reeks.length < 2) return null;
  const deelReeks = reeks.slice(-n);
  const eerste = deelReeks[0];
  const laatste = deelReeks[deelReeks.length - 1];
  const dagen = dagenTussen(eerste.date, laatste.date);
  if (dagen < 7) return null;
  return rond(((laatste.trend_kg - eerste.trend_kg) / dagen) * 7, 2);
}
