import { redis } from "../redis.ts";
import { persoonlijk } from "../persoon.ts";
import { BERICHTEN_MAX, GESPREKKEN_MAX, geldigId } from "./gesprek.ts";
import type { Gesprek } from "./gesprek.ts";

// ---------------------------------------------------------------------------
// Gesprekken bewaren.
//
// Persoonlijk, niet gedeeld: een gesprek gaat over jouw gewicht, jouw dag en
// jouw vragen. Het staat daarom onder `wl:p:<persoon>:chat:*`, net als het
// profiel en de weeglijst.
//
// Van elke beurt wordt alleen de tekst bewaard, niet het gereedschapsverkeer
// eromheen. Dat scheelt opslag, en het houdt terugkijken leesbaar: wat er
// stond is wat je zag. Bij een vervolgvraag zoekt het model gewoon opnieuw op
// — dat kost een tel, en het antwoord is dan ook meteen bij.
// ---------------------------------------------------------------------------

const kGesprek = (id: string) => persoonlijk(`chat:${id}`);
const kIndex = () => persoonlijk("chat:index");

export async function leesGesprek(id: string): Promise<Gesprek | null> {
  if (!geldigId(id)) return null;
  return (await redis.get<Gesprek>(await kGesprek(id))) ?? null;
}

export async function bewaarGesprek(g: Gesprek): Promise<void> {
  const kort: Gesprek = { ...g, berichten: g.berichten.slice(-BERICHTEN_MAX) };
  await redis.set(await kGesprek(g.id), kort);

  // De index is een gesorteerde verzameling op tijd: "het laatste gesprek" is
  // dan één aanroep, en wat eruit moet staat vanzelf vooraan.
  const index = await kIndex();
  await redis.zadd(index, { score: g.bijgewerkt, member: g.id });

  const teveel = await redis.zrange<string[]>(index, 0, -GESPREKKEN_MAX - 1);
  for (const oud of teveel ?? []) {
    await redis.del(await kGesprek(oud));
    await redis.zrem(index, oud);
  }
}

/** De gesprekken, nieuwste eerst. Alleen id, titel en tijd — voor de lijst. */
export async function lijstGesprekken(): Promise<{ id: string; titel: string; bijgewerkt: number }[]> {
  const ids = await redis.zrange<string[]>(await kIndex(), 0, -1, { rev: true });
  if (!ids || ids.length === 0) return [];

  const gesprekken = await Promise.all(ids.map((id) => leesGesprek(id)));
  return gesprekken
    .filter((g): g is Gesprek => g != null)
    .map((g) => ({ id: g.id, titel: g.titel, bijgewerkt: g.bijgewerkt }));
}

export async function wisGesprek(id: string): Promise<void> {
  if (!geldigId(id)) return;
  await redis.del(await kGesprek(id));
  await redis.zrem(await kIndex(), id);
}
