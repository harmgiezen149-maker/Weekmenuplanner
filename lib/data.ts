import { redis } from "./redis";
import type { Recept, WeekState, Boodschappen, GebiedVolgorde, Voorraad } from "./types";

// ----------------------------------------------------------------------------
// Redis key-indeling:
//   recipe:<id>      -> JSON van één recept
//   recipes:index    -> SET met alle recept-id's
//   week:current     -> JSON van de weekplanning (startDag + slots)
//   boodschappen     -> JSON van de bewerkbare boodschappenlijst
//   gebiedvolgorde   -> JSON: per winkel de volgorde van winkelgebieden
// Eén app/huishouden. Wil je later meerdere gebruikers, prefix dan met userId.
// ----------------------------------------------------------------------------

const RECIPE = (id: string) => `recipe:${id}`;
const RECIPE_INDEX = "recipes:index";
// Vóór het plannen van meerdere weken stond er één weekmenu onder
// `week:current`. Dat blijft de sleutel van waar het vandaan komt: bij de
// eerste keer dat de huidige week wordt opgevraagd verhuist hij mee, en daarna
// heeft elke week zijn eigen sleutel.
const WEEK_OUD = "week:current";
const WEEK = (sleutel: string) => `week:${sleutel}`;
const BOODSCHAPPEN_KEY = "boodschappen:current";
const GEBIEDVOLGORDE_KEY = "gebiedvolgorde:current";
const VOORRAAD_KEY = "voorraad:current";

export async function getAllRecepten(): Promise<Recept[]> {
  const ids = await redis.smembers(RECIPE_INDEX);
  if (!ids || ids.length === 0) return [];
  const keys = ids.map((id) => RECIPE(id as string));
  const items = await redis.mget<Recept[]>(...keys);
  return (items.filter(Boolean) as Recept[]).sort((a, b) =>
    a.titel.localeCompare(b.titel)
  );
}

export async function getRecept(id: string): Promise<Recept | null> {
  return (await redis.get<Recept>(RECIPE(id))) ?? null;
}

export async function saveRecept(r: Recept): Promise<Recept> {
  await redis.set(RECIPE(r.id), r);
  await redis.sadd(RECIPE_INDEX, r.id);
  return r;
}

export async function deleteRecept(id: string): Promise<void> {
  await redis.del(RECIPE(id));
  await redis.srem(RECIPE_INDEX, id);
}

export const LEGE_WEEK: WeekState = { startDag: 0, slots: {} };

/**
 * Het weekmenu van één week.
 *
 * `huidig` zegt of dit de week is waar we nu in zitten. Alleen dán wordt het
 * oude `week:current` overgenomen — anders zou het weekmenu van deze week ook
 * bij volgende week verschijnen, en dan plan je twee keer hetzelfde.
 */
export async function getWeek(sleutel: string, huidig = false): Promise<WeekState> {
  const week = await redis.get<WeekState>(WEEK(sleutel));
  if (week) return week;
  if (huidig) {
    const oud = await redis.get<WeekState>(WEEK_OUD);
    if (oud) {
      await redis.set(WEEK(sleutel), oud);
      return oud;
    }
  }
  return LEGE_WEEK;
}

export async function saveWeek(sleutel: string, week: WeekState): Promise<WeekState> {
  await redis.set(WEEK(sleutel), week);
  return week;
}

export async function getBoodschappen(): Promise<Boodschappen> {
  return (await redis.get<Boodschappen>(BOODSCHAPPEN_KEY)) ?? { items: [] };
}

export async function saveBoodschappen(b: Boodschappen): Promise<Boodschappen> {
  await redis.set(BOODSCHAPPEN_KEY, b);
  return b;
}

export async function getGebiedVolgorde(): Promise<GebiedVolgorde> {
  return (await redis.get<GebiedVolgorde>(GEBIEDVOLGORDE_KEY)) ?? {};
}

export async function saveGebiedVolgorde(g: GebiedVolgorde): Promise<GebiedVolgorde> {
  await redis.set(GEBIEDVOLGORDE_KEY, g);
  return g;
}

export async function getVoorraad(): Promise<Voorraad> {
  return (await redis.get<Voorraad>(VOORRAAD_KEY)) ?? { items: [] };
}

export async function saveVoorraad(v: Voorraad): Promise<Voorraad> {
  await redis.set(VOORRAAD_KEY, v);
  return v;
}

export function newId(): string {
  return "r" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}
