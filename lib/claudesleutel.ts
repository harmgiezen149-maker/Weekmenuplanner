// ---------------------------------------------------------------------------
// De sleutel waarmee Claude (Harms AI-dorp op claude.ai) bij het kookboek mag.
//
//   claude:sleutel          -> de huidige sleutel
//   auth:claude:<sleutel>   -> "1" zolang hij geldig is
//
// Eén sleutel voor het huishouden, net als de recepten, het weekmenu en de
// boodschappen waar hij bij kan: die zijn ook van het huishouden. Persoonlijke
// gegevens (de tracker) kan hij niet bereiken, wat er ook in de sleutel staat.
//
// Hij zit in het adres van de connector (…/api/mcp/<sleutel>), want claude.ai
// bewaart dat adres en stuurt geen eigen inlog mee. Kwijt of gelekt? Maak een
// nieuwe: de oude vervalt meteen, en dan zet je het nieuwe adres in claude.ai.
// ---------------------------------------------------------------------------

import { redis } from "./redis";

const HUIDIG = "claude:sleutel";
const GELDIG = (s: string) => `auth:claude:${s}`;

/** 32 willekeurige bytes, url-veilig. */
function nieuweSleutel(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function getClaudeSleutel(): Promise<string | null> {
  return (await redis.get<string>(HUIDIG)) ?? null;
}

/** Maakt een nieuwe sleutel en laat de oude meteen vervallen. */
export async function maakClaudeSleutel(): Promise<string> {
  const oud = await getClaudeSleutel();
  const sleutel = nieuweSleutel();
  await redis.set(GELDIG(sleutel), "1");
  await redis.set(HUIDIG, sleutel);
  if (oud) await redis.del(GELDIG(oud));
  return sleutel;
}

export async function wisClaudeSleutel(): Promise<void> {
  const oud = await getClaudeSleutel();
  if (oud) await redis.del(GELDIG(oud));
  await redis.del(HUIDIG);
}

export async function claudeSleutelGeldig(sleutel: string): Promise<boolean> {
  const s = String(sleutel || "").trim();
  if (s.length < 30 || s.length > 100 || !/^[A-Za-z0-9_-]+$/.test(s)) return false;
  return (await redis.get(GELDIG(s))) !== null;
}
