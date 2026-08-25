// ---------------------------------------------------------------------------
// Wie is er ingelogd, en welke sleutels zijn van die persoon?
//
// De app kent twee soorten gegevens:
//
//   gedeeld     recepten, weekmenu, boodschappen, voorraad, het eetdagboek,
//               favorieten, maaltijden en de productcache. Dit is van het
//               huishouden: samen koken werkt alleen met één kookboek.
//   persoonlijk profiel, weeglijst en alles wat daaruit volgt (feitenpakket,
//               adviezen). Dit gaat over één lichaam en hoort bij één mens.
//
// Persoonlijke sleutels staan onder `wl:p:<persoon>:`, precies het oude pad met
// een tussenstuk erin. Een sleutel van gedeeld naar persoonlijk verhuizen is
// daardoor één regel: `wl:day:2026-01-01` wordt `wl:p:h3k9:day:2026-01-01`.
//
// Het id van de ingelogde persoon komt binnen via een header die middleware.ts
// zet. Daardoor hoeft geen enkele aanroeper in de app een persoon mee te geven:
// `getProfile()` blijft `getProfile()`.
// ---------------------------------------------------------------------------

import { AsyncLocalStorage } from "node:async_hooks";
import { headers } from "next/headers";
import { PERSOON_HEADER } from "./sessie";

export { PERSOON_HEADER };

/**
 * Werk namens iemand anders dan de ingelogde persoon.
 *
 * Nodig voor de dagelijkse taak die de herinneringen verstuurt: die draait
 * zonder browser en dus zonder sessie, maar moet wel per persoon het profiel en
 * het logboek kunnen lezen. Binnen dit blokje kijkt `huidigePersoon()` naar dit
 * id in plaats van naar de header, zodat de hele datalaag ongewijzigd bruikbaar
 * blijft.
 *
 * Het id leeft alleen binnen de callback. Een route die dit niet aanroept kan
 * er nooit per ongeluk in terechtkomen.
 */
const namensPersoon = new AsyncLocalStorage<string>();

export function metPersoon<T>(id: string, werk: () => Promise<T>): Promise<T> {
  if (!id) throw new Error("metPersoon zonder id");
  return namensPersoon.run(id, werk);
}

/**
 * Het id van de ingelogde persoon.
 *
 * Gooit een fout wanneer er niemand is ingelogd. Dat hoort ook zo: middleware
 * laat geen enkele aanvraag door zonder sessie, dus komen we hier zonder
 * persoon, dan is er iets grondig mis en is stoppen veiliger dan doorrekenen
 * met andermans cijfers.
 */
export async function huidigePersoon(): Promise<string> {
  const namens = namensPersoon.getStore();
  if (namens) return namens;
  const h = await headers();
  const id = h.get(PERSOON_HEADER);
  if (!id) throw new Error("Niet ingelogd");
  return id;
}

/** Zet een persoonlijke sleutel om naar het pad van de ingelogde persoon. */
export async function persoonlijk(rest: string): Promise<string> {
  return persoonSleutel(await huidigePersoon(), rest);
}

/** Hetzelfde, maar voor een persoon die je al kent (migratie, back-up). */
export function persoonSleutel(persoon: string, rest: string): string {
  return `wl:p:${persoon}:${rest}`;
}
