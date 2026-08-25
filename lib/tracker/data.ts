import { redis } from "../redis";
import type { Activity, Day, Entry, FoodTemplate, Maaltijdsjabloon, Product, Profile } from "./types";
import {
  STANDAARD_POINTS_SCALE, STANDAARD_WEEKBUFFER, EIWIT_PER_KG_STREEFGEWICHT, RECENT_MAX,
} from "./types";
import { berekenBudget, eiwitDoelGram } from "./budget";
import type { Weging } from "./gewicht";
import { berekenTotalen } from "./points";
import { datumSleutel, geldigeDatum, isoWeek } from "./datum";
import {
  buildFactPack, feitenVingerafdruk, vensterDatums, type FactPack,
} from "./feiten";
import type { Advies } from "./advies";
import {
  evalueerAdvies, evaluatieVenster, MIN_DAGEN_VOOR_EVALUATIE, LEGE_COOLDOWN,
} from "./advies";
import type { Cooldown } from "./advies";

export { datumSleutel, geldigeDatum };

// ---------------------------------------------------------------------------
// Redis key-indeling van de tracker. Alles onder de prefix `wl:`, gescheiden
// van de kookboek-keys (recipe:*, week:current, boodschappen:current, ...).
//
//   wl:profile          -> JSON van het profiel
//   wl:day:<YYYY-MM-DD> -> JSON van één dag (regels + totalen)
//   wl:day:index        -> sorted set met gelogde datums, score = epoch
//   wl:favorites        -> JSON-lijst met bewaarde sjablonen
//   wl:recent           -> JSON-lijst met de laatst gelogde items
//   wl:food:<barcode>   -> gecachet product uit een externe bron, 90 dagen
//   wl:eigen:<barcode>  -> zelf ingevoerd product, blijft staan
//   wl:facts:<YYYY-Www> -> gecachet feitenpakket van de adviesmodule, 8 dagen
//   wl:advice:<id>      -> een uitgegeven advies; wordt nooit verwijderd
//   wl:advice:index     -> sorted set met adviezen, score = epoch
//   wl:advice:active    -> id van het lopende advies
//   wl:advice:cooldown  -> wanneer er voor het laatst gemeld is, en waarover
//   wl:advice:seen      -> id van het advies dat je al gezien hebt
//
// De volgende fases voegen hier wl:week:*, wl:weight:* en
// wl:recipe:points:* aan toe.
// ---------------------------------------------------------------------------

const PROFILE_KEY = "wl:profile";
const DAY = (datum: string) => `wl:day:${datum}`;
const DAY_INDEX = "wl:day:index";
const FAVORITES_KEY = "wl:favorites";
const RECENT_KEY = "wl:recent";
const FOOD = (barcode: string) => `wl:food:${barcode}`;
const EIGEN = (barcode: string) => `wl:eigen:${barcode}`;
const WEIGHT_LOG = "wl:weight:log";
const WEIGHT = (datum: string) => `wl:weight:${datum}`;
const MEALS_KEY = "wl:meals";
const RECIPE_POINTS = (id: string) => `wl:recipe:points:${id}`;
const FACTS = (week: string) => `wl:facts:${week}`;
const ADVICE = (id: string) => `wl:advice:${id}`;
const ADVICE_INDEX = "wl:advice:index";
const ADVICE_ACTIVE = "wl:advice:active";
const ADVICE_COOLDOWN = "wl:advice:cooldown";
const ADVICE_SEEN = "wl:advice:seen";

// Producten uit Open Food Facts blijven 90 dagen bruikbaar. Lang genoeg dat
// een winkelmandje aan vaste boodschappen offline werkt, kort genoeg dat een
// gewijzigd recept van de fabrikant een keer doorkomt.
const FOOD_TTL_SECONDEN = 90 * 24 * 60 * 60;

export function nieuwId(): string {
  return "w" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

// -- profiel -----------------------------------------------------------------

export async function getProfile(): Promise<Profile | null> {
  const p = await redis.get<Profile>(PROFILE_KEY);
  return p ? normaliseerProfiel(p) : null;
}

/**
 * Vult ontbrekende velden aan. Houdt oudere opgeslagen profielen bruikbaar
 * zonder aparte migratiestap.
 */
export function normaliseerProfiel(p: Partial<Profile>): Profile {
  const huidig = getal(p.current_weight_kg, getal(p.start_weight_kg, 80));
  const streef = getal(p.goal_weight_kg, huidig);
  return {
    name: p.name || "",
    sex: p.sex === "vrouw" ? "vrouw" : "man",
    birthdate: geldigeDatum(p.birthdate) ? p.birthdate : "1990-01-01",
    height_cm: getal(p.height_cm, 175),
    activity_factor: getal(p.activity_factor, 1.375),
    start_weight_kg: getal(p.start_weight_kg, huidig),
    current_weight_kg: huidig,
    goal_weight_kg: streef,
    weigh_day: Number.isInteger(p.weigh_day) ? Math.min(6, Math.max(0, p.weigh_day as number)) : 6,
    points_scale: getal(p.points_scale, STANDAARD_POINTS_SCALE),
    budget_basis_weight_kg: getal(p.budget_basis_weight_kg, huidig),
    daily_budget: getal(p.daily_budget, 0),
    weekly_buffer: getal(p.weekly_buffer, STANDAARD_WEEKBUFFER),
    protein_target_g: p.protein_target_g === 0
      ? 0
      : getal(p.protein_target_g, eiwitDoelGram(streef, EIWIT_PER_KG_STREEFGEWICHT)),
    created_at: p.created_at || new Date().toISOString(),
  };
}

/**
 * Slaat het profiel op en zet het dagbudget opnieuw vast op basis van het
 * huidige gewicht. `budget_basis_weight_kg` legt vast waar dat budget op rust,
 * zodat later te zien is wanneer herberekening nodig is.
 */
export async function saveProfile(invoer: Partial<Profile>): Promise<Profile> {
  const p = normaliseerProfiel(invoer);
  const budget = berekenBudget(p);
  const compleet: Profile = {
    ...p,
    daily_budget: budget.dagbudgetPunten,
    budget_basis_weight_kg: p.current_weight_kg,
  };
  await redis.set(PROFILE_KEY, compleet);
  return compleet;
}

function getal(v: unknown, standaard: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : standaard;
}

// -- dagen -------------------------------------------------------------------

export function legeDag(datum: string): Day {
  return {
    date: datum,
    entries: [],
    activity: [],
    totals: berekenTotalen([]),
    buffer_used: 0,
  };
}

export async function getDay(datum: string): Promise<Day> {
  const d = await redis.get<Day>(DAY(datum));
  if (!d) return legeDag(datum);
  // Totalen altijd opnieuw afleiden uit de regels: die zijn de bron van
  // waarheid, het totaalveld is een cache.
  const entries = Array.isArray(d.entries) ? d.entries : [];
  return {
    date: datum,
    entries,
    activity: Array.isArray(d.activity) ? d.activity : [],
    totals: berekenTotalen(entries),
    buffer_used: Number(d.buffer_used) || 0,
  };
}

export async function saveDay(dag: Day): Promise<Day> {
  const compleet: Day = { ...dag, totals: berekenTotalen(dag.entries) };
  await redis.set(DAY(dag.date), compleet);
  // Alleen dagen met inhoud in de index: zo blijven lege dagen buiten de
  // weekgemiddelden vallen zonder dat daar apart op gefilterd hoeft te worden.
  if (compleet.entries.length > 0 || compleet.activity.length > 0) {
    await redis.zadd(DAY_INDEX, { score: Date.parse(dag.date + "T00:00:00Z"), member: dag.date });
  } else {
    await redis.zrem(DAY_INDEX, dag.date);
  }
  return compleet;
}

export async function addEntry(datum: string, entry: Entry): Promise<Day> {
  const dag = await getDay(datum);
  dag.entries.push(entry);
  dag.entries.sort((a, b) => a.ts - b.ts);
  return saveDay(dag);
}

export async function updateEntry(datum: string, id: string, patch: Partial<Entry>): Promise<Day> {
  const dag = await getDay(datum);
  dag.entries = dag.entries.map((e) => (e.id === id ? { ...e, ...patch, id: e.id } : e));
  return saveDay(dag);
}

export async function deleteEntry(datum: string, id: string): Promise<Day> {
  const dag = await getDay(datum);
  dag.entries = dag.entries.filter((e) => e.id !== id);
  return saveDay(dag);
}

/** Gelogde datums binnen een bereik, oplopend. Lege dagen zitten er niet in. */
export async function gelogdeDatums(vanaf: string, tot: string): Promise<string[]> {
  const van = Date.parse(vanaf + "T00:00:00Z");
  const t = Date.parse(tot + "T00:00:00Z");
  const leden = await redis.zrange<string[]>(DAY_INDEX, van, t, { byScore: true });
  return leden ?? [];
}

// -- favorieten --------------------------------------------------------------

export async function getFavorieten(): Promise<FoodTemplate[]> {
  return (await redis.get<FoodTemplate[]>(FAVORITES_KEY)) ?? [];
}

export async function addFavoriet(f: FoodTemplate): Promise<FoodTemplate[]> {
  const lijst = await getFavorieten();
  // Hetzelfde product twee keer bewaren heeft geen zin: naam plus merk telt
  // als dezelfde favoriet en wordt overschreven.
  const zonderDubbel = lijst.filter((x) => !zelfdeProduct(x, f));
  const nieuw = [f, ...zonderDubbel];
  await redis.set(FAVORITES_KEY, nieuw);
  return nieuw;
}

export async function deleteFavoriet(id: string): Promise<FoodTemplate[]> {
  const nieuw = (await getFavorieten()).filter((f) => f.id !== id);
  await redis.set(FAVORITES_KEY, nieuw);
  return nieuw;
}

function zelfdeProduct(a: FoodTemplate, b: FoodTemplate): boolean {
  const sleutel = (t: FoodTemplate) =>
    `${t.name.trim().toLowerCase()}|${(t.brand ?? "").trim().toLowerCase()}`;
  return sleutel(a) === sleutel(b);
}

// -- recent ------------------------------------------------------------------

export async function getRecent(): Promise<FoodTemplate[]> {
  return (await redis.get<FoodTemplate[]>(RECENT_KEY)) ?? [];
}

/**
 * Zet een gelogd item bovenaan de recente lijst. Een item dat je vaker logt
 * schuift dus vanzelf naar boven in plaats van de lijst vol te zetten.
 */
export async function noteerRecent(f: FoodTemplate): Promise<void> {
  const lijst = await getRecent();
  const nieuw = [f, ...lijst.filter((x) => !zelfdeProduct(x, f))].slice(0, RECENT_MAX);
  await redis.set(RECENT_KEY, nieuw);
}

/** Maakt van een gelogde regel een herbruikbaar sjabloon. */
export function entryNaarTemplate(e: Entry): FoodTemplate {
  return {
    id: nieuwId(),
    name: e.name,
    ...(e.brand ? { brand: e.brand } : {}),
    source: e.source,
    amount: e.amount,
    unit: e.unit,
    grams: e.grams,
    nutrients: e.nutrients,
    points_raw: e.points_raw,
    ...(e.ref ? { ref: e.ref } : {}),
    last_used: Date.now(),
  };
}

// -- productcache ------------------------------------------------------------

export async function getGecachetProduct(barcode: string): Promise<Product | null> {
  return (await redis.get<Product>(FOOD(barcode))) ?? null;
}

export async function cacheProduct(barcode: string, p: Product): Promise<void> {
  await redis.set(FOOD(barcode), p, { ex: FOOD_TTL_SECONDEN });
}

// -- dagen in bulk -----------------------------------------------------------

/**
 * Haalt meerdere dagen in één keer op. Datums zonder logboek komen niet terug;
 * de aanroeper vult die zelf aan als lege dag.
 */
export async function getDays(datums: string[]): Promise<Day[]> {
  if (datums.length === 0) return [];
  const rauw = await redis.mget<(Day | null)[]>(...datums.map(DAY));
  const uit: Day[] = [];
  (rauw ?? []).forEach((d, i) => {
    if (!d) return;
    const entries = Array.isArray(d.entries) ? d.entries : [];
    uit.push({
      date: datums[i],
      entries,
      activity: Array.isArray(d.activity) ? d.activity : [],
      totals: berekenTotalen(entries),
      buffer_used: Number(d.buffer_used) || 0,
    });
  });
  return uit;
}

// -- wegingen ----------------------------------------------------------------

/** Kilo's op één decimaal; de sleutel in de sorted set moet stabiel zijn. */
function kiloTekst(kg: number): string {
  return kg.toFixed(1);
}

export async function getWegingen(): Promise<Weging[]> {
  const leden = (await redis.zrange<string[]>(WEIGHT_LOG, 0, -1)) ?? [];
  const wegingen: Weging[] = [];
  for (const lid of leden) {
    const scheiding = lid.lastIndexOf(":");
    if (scheiding < 0) continue;
    const datum = lid.slice(0, scheiding);
    const kg = Number(lid.slice(scheiding + 1));
    if (!geldigeDatum(datum) || !Number.isFinite(kg) || kg <= 0) continue;
    wegingen.push({ date: datum, kg });
  }
  return wegingen.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Slaat een weging op. Was er op dezelfde dag al gewogen, dan vervangt deze
 * die: één weging per dag houdt de trendlijn eerlijk.
 */
export async function saveWeging(datum: string, kg: number, note?: string): Promise<Weging[]> {
  const bestaand = await getWegingen();
  const oud = bestaand.find((w) => w.date === datum);
  if (oud) await redis.zrem(WEIGHT_LOG, `${datum}:${kiloTekst(oud.kg)}`);

  await redis.zadd(WEIGHT_LOG, {
    score: Date.parse(datum + "T00:00:00Z"),
    member: `${datum}:${kiloTekst(kg)}`,
  });
  await redis.set(WEIGHT(datum), { kg, ...(note ? { note } : {}) });

  return getWegingen();
}

export async function deleteWeging(datum: string): Promise<Weging[]> {
  const bestaand = await getWegingen();
  const oud = bestaand.find((w) => w.date === datum);
  if (oud) await redis.zrem(WEIGHT_LOG, `${datum}:${kiloTekst(oud.kg)}`);
  await redis.del(WEIGHT(datum));
  return getWegingen();
}

export async function getWegingNotitie(datum: string): Promise<string | undefined> {
  const w = await redis.get<{ kg: number; note?: string }>(WEIGHT(datum));
  return w?.note;
}

/**
 * Zet het gewicht in het profiel bij en herberekent het dagbudget wanneer dat
 * meer dan een kilo scheelt met het gewicht waar het huidige budget op rust.
 *
 * Er wordt op de trend gestuurd, niet op de losse meting: een vochtdag van
 * anderhalve kilo hoort je budget niet te verzetten. Dat is precies waar de
 * trendlijn voor is.
 */
export async function verwerkWeging(trendKg: number): Promise<{
  profiel: Profile | null;
  herberekend: boolean;
}> {
  const huidig = await getProfile();
  if (!huidig) return { profiel: null, herberekend: false };

  const herberekend = Math.abs(trendKg - huidig.budget_basis_weight_kg) > 1;
  const bijgewerkt: Profile = { ...huidig, current_weight_kg: trendKg };

  if (!herberekend) {
    await redis.set(PROFILE_KEY, bijgewerkt);
    return { profiel: bijgewerkt, herberekend: false };
  }

  const budget = berekenBudget(bijgewerkt);
  const nieuw: Profile = {
    ...bijgewerkt,
    daily_budget: budget.dagbudgetPunten,
    budget_basis_weight_kg: trendKg,
  };
  await redis.set(PROFILE_KEY, nieuw);
  return { profiel: nieuw, herberekend: true };
}

// -- samengestelde maaltijden ------------------------------------------------

export async function getMaaltijden(): Promise<Maaltijdsjabloon[]> {
  const lijst = (await redis.get<Maaltijdsjabloon[]>(MEALS_KEY)) ?? [];
  return lijst.sort((a, b) => b.last_used - a.last_used);
}

export async function saveMaaltijd(m: Maaltijdsjabloon): Promise<Maaltijdsjabloon[]> {
  const lijst = await getMaaltijden();
  // Bewerken van een bestaande maaltijd overschrijft hem op zijn id.
  const nieuw = [m, ...lijst.filter((x) => x.id !== m.id)];
  await redis.set(MEALS_KEY, nieuw);
  return nieuw.sort((a, b) => b.last_used - a.last_used);
}

export async function deleteMaaltijd(id: string): Promise<Maaltijdsjabloon[]> {
  const nieuw = (await getMaaltijden()).filter((m) => m.id !== id);
  await redis.set(MEALS_KEY, nieuw);
  return nieuw;
}

/** Zet een maaltijd bovenaan zonder de rest te raken. */
export async function raakMaaltijdAan(id: string): Promise<void> {
  const lijst = await getMaaltijden();
  const m = lijst.find((x) => x.id === id);
  if (!m) return;
  await redis.set(MEALS_KEY, lijst.map((x) => (x.id === id ? { ...x, last_used: Date.now() } : x)));
}

// -- doorgerekende recepten --------------------------------------------------

export interface ReceptCache<T> {
  /** Vingerafdruk van het recept toen dit werd berekend. */
  hash: string;
  berekend: T;
}

/**
 * Leest een doorgerekend recept uit de cache. Klopt de vingerafdruk niet meer
 * met het recept, dan komt er niets terug en wordt er opnieuw gerekend — zo
 * vervalt de cache vanzelf zodra je het recept aanpast.
 */
export async function getReceptPunten<T>(id: string, hash: string): Promise<T | null> {
  const c = await redis.get<ReceptCache<T>>(RECIPE_POINTS(id));
  return c && c.hash === hash ? c.berekend : null;
}

export async function cacheReceptPunten<T>(id: string, hash: string, berekend: T): Promise<void> {
  await redis.set(RECIPE_POINTS(id), { hash, berekend });
}

// -- bewegingsactiviteiten ---------------------------------------------------

export async function addActiviteit(datum: string, activiteit: Activity): Promise<Day> {
  const dag = await getDay(datum);
  dag.activity.push(activiteit);
  dag.activity.sort((a, b) => a.ts - b.ts);
  return saveDay(dag);
}

export async function deleteActiviteit(datum: string, id: string): Promise<Day> {
  const dag = await getDay(datum);
  dag.activity = dag.activity.filter((a) => a.id !== id);
  return saveDay(dag);
}

// -- eigen producten op streepjescode ---------------------------------------

/**
 * Producten die je zelf hebt ingevoerd nadat een scan niets opleverde.
 *
 * Externe productdatabases dekken Nederlandse huismerken slecht. Wat je één
 * keer zelf invult wordt hier onder zijn streepjescode bewaard en blijft
 * staan: de volgende scan van datzelfde pak vindt hem meteen. Zonder
 * vervaltermijn, want dit is jouw eigen invoer en niet andermans cache.
 */
export async function getEigenProduct(barcode: string): Promise<Product | null> {
  return (await redis.get<Product>(EIGEN(barcode))) ?? null;
}

export async function saveEigenProduct(barcode: string, p: Product): Promise<void> {
  await redis.set(EIGEN(barcode), p);
}

export async function deleteEigenProduct(barcode: string): Promise<void> {
  await redis.del(EIGEN(barcode));
}

// -- feitenpakket van de adviesmodule ----------------------------------------

// Het pakket beslaat twaalf weken en wordt per ISO-week gecachet. Acht dagen
// houdbaar: net langer dan een week, zodat de cache van de vorige week nog
// staat op het moment dat de nieuwe wordt opgebouwd.
const FACTS_TTL_SECONDEN = 8 * 24 * 60 * 60;

interface FeitenCache {
  /** Vingerafdruk van de gelogde data toen dit pakket werd gebouwd. */
  vingerafdruk: string;
  pakket: FactPack;
}

/**
 * Het feitenpakket voor een peildatum.
 *
 * Het pakket wordt hergebruikt zolang er niets nieuws gelogd is — dat is wat
 * de knop "Analyseer mijn patroon" nodig heeft om niet elke keer opnieuw de
 * hele twaalf weken door te rekenen. Verandert er wel iets aan het logboek,
 * de wegingen of het budget, dan verschilt de vingerafdruk en wordt er
 * opnieuw gerekend.
 *
 * Het lezen van de dagen gebeurt met één mget over het hele venster; de
 * berekening zelf staat in lib/tracker/feiten.ts en raakt geen database aan.
 */
export async function laadFeiten(
  peildatum: string = datumSleutel(),
  opties: { ververs?: boolean } = {}
): Promise<{ pakket: FactPack; uitCache: boolean } | { pakket: null; uitCache: false }> {
  const profiel = await getProfile();
  if (!profiel) return { pakket: null, uitCache: false };

  const [dagen, wegingen] = await Promise.all([
    getDays(vensterDatums(peildatum)),
    getWegingen(),
  ]);

  const vingerafdruk = feitenVingerafdruk({ peildatum, dagen, wegingen, profiel });
  const sleutel = FACTS(isoWeek(peildatum));

  if (!opties.ververs) {
    const gecachet = await redis.get<FeitenCache>(sleutel);
    if (gecachet && gecachet.vingerafdruk === vingerafdruk) {
      return { pakket: gecachet.pakket, uitCache: true };
    }
  }

  const pakket = buildFactPack({ peildatum, dagen, wegingen, profiel });
  await redis.set(sleutel, { vingerafdruk, pakket }, { ex: FACTS_TTL_SECONDEN });
  return { pakket, uitCache: false };
}

// -- adviezen ----------------------------------------------------------------

/**
 * Adviezen worden nooit verwijderd. De historie is het interessantste deel van
 * de module: pas over meerdere adviezen heen is te zien of er iets beweegt.
 */
export async function saveAdvies(advies: Advies): Promise<Advies> {
  await redis.set(ADVICE(advies.id), advies);
  await redis.zadd(ADVICE_INDEX, {
    score: Date.parse(advies.created_at) || Date.now(),
    member: advies.id,
  });
  await redis.set(ADVICE_ACTIVE, advies.id);
  return advies;
}

export async function getAdvies(id: string): Promise<Advies | null> {
  return (await redis.get<Advies>(ADVICE(id))) ?? null;
}

/** Het lopende advies, of null als er nog geen is. */
export async function getActiefAdvies(): Promise<Advies | null> {
  const id = await redis.get<string>(ADVICE_ACTIVE);
  return id ? getAdvies(id) : null;
}

/**
 * De laatste adviezen, nieuwste eerst. Er komen er hooguit een paar per maand
 * bij, dus de hele index ophalen en achteraan beginnen is goedkoper dan een
 * omgekeerde bereikopvraging — en werkt op elke Redis-variant hetzelfde.
 */
export async function getLaatsteAdviezen(aantal = 3): Promise<Advies[]> {
  const ids = (await redis.zrange<string[]>(ADVICE_INDEX, 0, -1)) ?? [];
  const nieuwste = ids.slice(-aantal).reverse();
  if (nieuwste.length === 0) return [];
  const rauw = await redis.mget<(Advies | null)[]>(...nieuwste.map(ADVICE));
  return (rauw ?? []).filter((a): a is Advies => a != null);
}

/** Het aantal adviezen dat ooit is uitgegeven. */
export async function telAdviezen(): Promise<number> {
  const ids = (await redis.zrange<string[]>(ADVICE_INDEX, 0, -1)) ?? [];
  return ids.length;
}

/**
 * Een feitenpakket over een kort venster, voor de evaluatielus.
 *
 * Niet gecachet: het venster verschuift per advies en de berekening is
 * goedkoop. Belangrijker is dat het door dezelfde `buildFactPack` gaat als het
 * pakket bij uitgifte — anders meet je het verschil tussen twee formules in
 * plaats van tussen twee weken.
 */
export async function laadPeriodePakket(
  peildatum: string, vensterDagen: number
): Promise<FactPack | null> {
  const profiel = await getProfile();
  if (!profiel) return null;

  const [dagen, wegingen] = await Promise.all([
    getDays(vensterDatums(peildatum, vensterDagen)),
    getWegingen(),
  ]);
  return buildFactPack({ peildatum, dagen, wegingen, profiel, vensterDagen });
}

/**
 * Meet een advies opnieuw en schrijft de uitslag bij als die veranderd is.
 *
 * Een advies waarvan de horizon om is wordt niet nog eens gemeten: die uitslag
 * ligt vast. Zolang de horizon loopt schuift de uitslag mee, zodat het scherm
 * altijd de stand van nu toont in plaats van te wachten op het volgende advies.
 */
export async function werkEvaluatieBij(advies: Advies, vandaag: string): Promise<Advies> {
  const definitief = advies.evaluation != null
    && advies.evaluation.dagen_gemeten >= advies.payload.action.horizon_days;
  if (definitief) return advies;

  const venster = evaluatieVenster(advies, vandaag);
  if (venster.dagen < MIN_DAGEN_VOOR_EVALUATIE) return advies;

  const periode = await laadPeriodePakket(venster.eind, venster.dagen);
  if (!periode) return advies;

  const evaluation = evalueerAdvies(advies, periode);
  if (!evaluation) return advies;
  if (advies.evaluation
    && advies.evaluation.uitkomst === evaluation.uitkomst
    && advies.evaluation.dagen_gemeten === evaluation.dagen_gemeten) {
    return advies;
  }

  const bijgewerkt: Advies = { ...advies, evaluation };
  // Alleen de regel zelf bijwerken: de index en het lopende advies veranderen niet.
  await redis.set(ADVICE(advies.id), bijgewerkt);
  return bijgewerkt;
}

/**
 * Wanneer er voor het laatst een afwijkingsmelding is geweest, en waarover.
 * Zonder dit geheugen zou de module op elke overschrijding reageren.
 */
export async function getCooldown(): Promise<Cooldown> {
  const c = await redis.get<Cooldown>(ADVICE_COOLDOWN);
  return c
    ? { last_push_at: c.last_push_at ?? null, flags_seen: c.flags_seen ?? {} }
    : LEGE_COOLDOWN;
}

export async function saveCooldown(cooldown: Cooldown): Promise<void> {
  await redis.set(ADVICE_COOLDOWN, cooldown);
}

/** Het id van het advies dat al bekeken is; bepaalt of de melding nog staat. */
export async function getGezienAdvies(): Promise<string | null> {
  return (await redis.get<string>(ADVICE_SEEN)) ?? null;
}

export async function setGezienAdvies(id: string): Promise<void> {
  await redis.set(ADVICE_SEEN, id);
}
