// ---------------------------------------------------------------------------
// De sleutel waarmee je horloge activiteiten mag insturen.
//
//   wl:p:<id>:koppelsleutel  -> de sleutel van deze persoon
//   auth:koppel:<sleutel>    -> bij wie hij hoort
//
// De sleutel staat leesbaar in de database. Dat is een bewuste keuze en anders
// dan bij wachtwoorden: je moet hem in Tasker kunnen overtypen, ook een maand
// later, en met een hash zou hij na één keer tonen onleesbaar zijn. Wat hij kan
// is bovendien beperkt tot één ding — een activiteit toevoegen. Kwijt of
// gelekt? Dan maak je een nieuwe; de oude vervalt op datzelfde moment.
// ---------------------------------------------------------------------------

import { redis } from "./redis";
import { persoonSleutel } from "./persoon";

const EIGEN = (persoon: string) => persoonSleutel(persoon, "koppelsleutel");
const OMGEKEERD = (sleutel: string) => `auth:koppel:${sleutel}`;

/** 24 willekeurige bytes, url-veilig. Kort genoeg om over te typen. */
function nieuweSleutel(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function getKoppelsleutel(persoon: string): Promise<string | null> {
  return (await redis.get<string>(EIGEN(persoon))) ?? null;
}

/**
 * Maakt een nieuwe sleutel en laat de oude meteen vervallen. Zo is "nieuwe
 * sleutel maken" ook de knop om een gelekte sleutel in te trekken.
 */
export async function maakKoppelsleutel(persoon: string): Promise<string> {
  const oud = await getKoppelsleutel(persoon);
  const sleutel = nieuweSleutel();
  await redis.set(OMGEKEERD(sleutel), persoon);
  await redis.set(EIGEN(persoon), sleutel);
  if (oud) await redis.del(OMGEKEERD(oud));
  return sleutel;
}

export async function wisKoppelsleutel(persoon: string): Promise<void> {
  const oud = await getKoppelsleutel(persoon);
  if (oud) await redis.del(OMGEKEERD(oud));
  await redis.del(EIGEN(persoon));
}

/** Bij wie hoort deze sleutel? Null als hij niet (meer) bestaat. */
export async function persoonBijSleutel(sleutel: string): Promise<string | null> {
  const s = String(sleutel || "").trim();
  if (s.length < 20 || s.length > 100) return null;
  return (await redis.get<string>(OMGEKEERD(s))) ?? null;
}
