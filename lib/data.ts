import { redis } from "./redis";
import type { Recept, WeekState } from "./types";

// ----------------------------------------------------------------------------
// Redis key-indeling:
//   recipe:<id>      -> JSON van één recept
//   recipes:index    -> SET met alle recept-id's
//   week:current     -> JSON van de weekplanning (startDag + slots)
// Eén app/huishouden. Wil je later meerdere gebruikers, prefix dan met userId.
// ----------------------------------------------------------------------------

const RECIPE = (id: string) => `recipe:${id}`;
const RECIPE_INDEX = "recipes:index";
const WEEK_KEY = "week:current";

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

export async function getWeek(): Promise<WeekState> {
  return (await redis.get<WeekState>(WEEK_KEY)) ?? { startDag: 0, slots: {} };
}

export async function saveWeek(week: WeekState): Promise<WeekState> {
  await redis.set(WEEK_KEY, week);
  return week;
}

export function newId(): string {
  return "r" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}
