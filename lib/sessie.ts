// ---------------------------------------------------------------------------
// Sessies. Bewust los van lib/auth.ts: dit bestand draait ook in de Edge-omgeving
// van middleware.ts en mag daarom niets uit node:crypto gebruiken. Alles hier
// leunt op Web Crypto en de REST-client van Upstash, die allebei op Edge werken.
//
// Een sessie is een ondoorzichtige willekeurige sleutel. In de sleutel zit geen
// informatie; wie erbij hoort staat in Redis. Dat maakt uitloggen echt uitloggen
// — de rij verdwijnt en de sleutel is meteen waardeloos.
// ---------------------------------------------------------------------------

import { redis } from "./redis";

export const SESSIE_COOKIE = "kb_sessie";

/**
 * Negentig dagen. Lang genoeg dat je op je telefoon in de praktijk ingelogd
 * blijft, kort genoeg dat een vergeten apparaat een keer vanzelf vervalt.
 */
export const SESSIE_SECONDEN = 90 * 24 * 60 * 60;

/**
 * De header waarmee middleware doorgeeft wie er is ingelogd. Deze wordt bij
 * elke aanvraag eerst weggegooid en daarna opnieuw gezet, zodat een browser
 * hem niet zelf kan meesturen.
 */
export const PERSOON_HEADER = "x-kb-persoon";

const SESSIE = (token: string) => `auth:sessie:${token}`;

/** 32 willekeurige bytes, url-veilig gecodeerd. */
export function nieuwSessieToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Geeft het id van de persoon achter deze sessie, of null. */
export async function leesSessie(token: string): Promise<string | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  const id = await redis.get<string>(SESSIE(token));
  return typeof id === "string" && id.length > 0 ? id : null;
}

export async function maakSessie(persoonId: string): Promise<string> {
  const token = nieuwSessieToken();
  await redis.set(SESSIE(token), persoonId, { ex: SESSIE_SECONDEN });
  return token;
}

export async function wisSessie(token: string): Promise<void> {
  if (!token) return;
  await redis.del(SESSIE(token));
}
