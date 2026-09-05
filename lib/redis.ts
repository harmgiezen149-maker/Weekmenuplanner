import { Redis } from "@upstash/redis";

// Eén gedeelde client. Leest UPSTASH_REDIS_REST_URL en UPSTASH_REDIS_REST_TOKEN
// automatisch uit de omgeving (zie .env.local / Vercel env vars).
export const redis = Redis.fromEnv();

/**
 * Zoveel sleutels per mget.
 *
 * Upstash trekt bij ruim 10 MB per opdracht de stekker eruit. Eén waarde mag
 * bijna een megabyte zijn — een recept met een foto komt daarbij in de buurt —
 * dus tien tegelijk is de bovengrens waarvan je zeker weet dat het past.
 */
const STUK = 10;

/**
 * Haalt veel sleutels op zonder Upstash's limiet aan te tikken.
 *
 * Waar dit vandaan komt: het kookboek liep vast op
 * "max request size exceeded. Limit: 10485760, Actual: 10733457". Alle
 * recepten stonden in één mget, en met de foto's erin waren ze samen ruim
 * tien megabyte. Eén ophaalopdracht kan dat niet dragen.
 *
 * De stukjes gaan bewust ná elkaar, niet met Promise.all. De client zet
 * standaard auto-pipelining aan: gelijktijdige opdrachten worden samengevoegd
 * tot één verzoek, en dan sta je precies weer waar je begon.
 */
export async function mgetInStukjes<T>(sleutels: string[]): Promise<(T | null)[]> {
  if (sleutels.length === 0) return [];

  const uit: (T | null)[] = [];
  for (let i = 0; i < sleutels.length; i += STUK) {
    const deel = sleutels.slice(i, i + STUK);
    const stuk = await redis.mget<(T | null)[]>(...deel);
    // Een mget die niets vindt geeft null terug in plaats van een lijst.
    uit.push(...(Array.isArray(stuk) ? stuk : deel.map(() => null)));
  }
  return uit;
}
