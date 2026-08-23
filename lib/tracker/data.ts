import { redis } from "../redis";
import type { Day, Entry, FoodTemplate, Product, Profile } from "./types";
import {
  STANDAARD_POINTS_SCALE, STANDAARD_WEEKBUFFER, EIWIT_PER_KG_STREEFGEWICHT, RECENT_MAX,
} from "./types";
import { berekenBudget, eiwitDoelGram } from "./budget";
import type { Weging } from "./gewicht";
import { berekenTotalen } from "./points";
import { datumSleutel, geldigeDatum } from "./datum";

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
//   wl:food:<barcode>   -> gecachet product uit Open Food Facts, 90 dagen
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
const WEIGHT_LOG = "wl:weight:log";
const WEIGHT = (datum: string) => `wl:weight:${datum}`;

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
