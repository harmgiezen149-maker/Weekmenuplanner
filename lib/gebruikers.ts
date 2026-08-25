// ---------------------------------------------------------------------------
// De mensen die op de app kunnen inloggen.
//
//   auth:gebruikers        -> SET met alle id's
//   auth:gebruiker:<id>    -> JSON van één account, inclusief de wachtwoordregel
//   auth:naam:<naam>       -> id, om op gebruikersnaam te kunnen inloggen
//
// Bewust buiten de prefix `wl:` van de tracker: dit gaat over toegang tot de
// hele app, niet over voeding.
// ---------------------------------------------------------------------------

import { redis } from "./redis";
import {
  controleerWachtwoord, gebruikersnaamProbleem, hashWachtwoord,
  normaliseerGebruikersnaam, wachtwoordProbleem,
} from "./auth";

const GEBRUIKERS = "auth:gebruikers";
const GEBRUIKER = (id: string) => `auth:gebruiker:${id}`;
const NAAM = (naam: string) => `auth:naam:${naam}`;

export interface Gebruiker {
  id: string;
  /** Waarop je inlogt: kleine letters, geen spaties. */
  gebruikersnaam: string;
  /** Hoe je in de app heet. Mag alles zijn. */
  naam: string;
  wachtwoord: string;
  gemaakt: string;
}

/** Een account zoals het naar de browser mag: zonder de wachtwoordregel. */
export type PubliekeGebruiker = Omit<Gebruiker, "wachtwoord">;

export function zonderWachtwoord(g: Gebruiker): PubliekeGebruiker {
  const { wachtwoord: _weg, ...rest } = g;
  return rest;
}

function nieuwPersoonId(): string {
  return "p" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
}

export async function telGebruikers(): Promise<number> {
  return (await redis.scard(GEBRUIKERS)) ?? 0;
}

export async function getGebruiker(id: string): Promise<Gebruiker | null> {
  if (!id) return null;
  return (await redis.get<Gebruiker>(GEBRUIKER(id))) ?? null;
}

export async function getGebruikerOpNaam(gebruikersnaam: string): Promise<Gebruiker | null> {
  const naam = normaliseerGebruikersnaam(gebruikersnaam);
  if (!naam) return null;
  const id = await redis.get<string>(NAAM(naam));
  return id ? getGebruiker(id) : null;
}

/** Alle accounts, op naam gesorteerd. Zonder wachtwoordregels. */
export async function alleGebruikers(): Promise<PubliekeGebruiker[]> {
  const ids = ((await redis.smembers(GEBRUIKERS)) ?? []) as string[];
  if (ids.length === 0) return [];
  const rauw = await redis.mget<(Gebruiker | null)[]>(...ids.map(GEBRUIKER));
  return (rauw ?? [])
    .filter((g): g is Gebruiker => g != null)
    .map(zonderWachtwoord)
    .sort((a, b) => a.gemaakt.localeCompare(b.gemaakt));
}

/**
 * Maakt een account aan. Geeft een leesbare foutmelding terug in plaats van te
 * gooien, want elk van deze fouten hoort gewoon op het scherm te komen.
 */
export async function maakGebruiker(invoer: {
  gebruikersnaam: string; naam?: string; wachtwoord: string;
}): Promise<{ gebruiker: Gebruiker } | { fout: string }> {
  const naamFout = gebruikersnaamProbleem(invoer.gebruikersnaam);
  if (naamFout) return { fout: naamFout };
  const wwFout = wachtwoordProbleem(invoer.wachtwoord);
  if (wwFout) return { fout: wwFout };

  const gebruikersnaam = normaliseerGebruikersnaam(invoer.gebruikersnaam);
  const gebruiker: Gebruiker = {
    id: nieuwPersoonId(),
    gebruikersnaam,
    naam: (invoer.naam || "").trim() || gebruikersnaam,
    wachtwoord: hashWachtwoord(invoer.wachtwoord),
    gemaakt: new Date().toISOString(),
  };

  // De naamsleutel wordt met NX gezet: bestaat hij al, dan is die
  // gebruikersnaam bezet en stoppen we voordat er iets anders is geschreven.
  const gelukt = await redis.set(NAAM(gebruikersnaam), gebruiker.id, { nx: true });
  if (!gelukt) return { fout: "Die gebruikersnaam is al in gebruik." };

  await redis.set(GEBRUIKER(gebruiker.id), gebruiker);
  await redis.sadd(GEBRUIKERS, gebruiker.id);
  return { gebruiker };
}

/**
 * Controleert een inlogpoging.
 *
 * Bij een onbekende gebruikersnaam wordt tóch een wachtwoord doorgerekend. Dat
 * kost een fractie van een seconde en zorgt dat "die naam bestaat niet" en "dat
 * wachtwoord klopt niet" even lang duren — anders is aan de tijd af te lezen
 * welke namen bestaan.
 */
const NEP_HASH = hashWachtwoord("plaatshouder-voor-onbekende-namen");

export async function controleerInlog(
  gebruikersnaam: string, wachtwoord: string
): Promise<Gebruiker | null> {
  const g = await getGebruikerOpNaam(gebruikersnaam);
  if (!g) {
    controleerWachtwoord(wachtwoord, NEP_HASH);
    return null;
  }
  return controleerWachtwoord(wachtwoord, g.wachtwoord) ? g : null;
}

export async function wijzigWachtwoord(
  id: string, huidig: string, nieuw: string
): Promise<{ ok: true } | { fout: string }> {
  const g = await getGebruiker(id);
  if (!g) return { fout: "Onbekend account." };
  if (!controleerWachtwoord(huidig, g.wachtwoord)) {
    return { fout: "Je huidige wachtwoord klopt niet." };
  }
  const probleem = wachtwoordProbleem(nieuw);
  if (probleem) return { fout: probleem };
  await redis.set(GEBRUIKER(id), { ...g, wachtwoord: hashWachtwoord(nieuw) });
  return { ok: true };
}

/**
 * Verwijdert een account. De persoonlijke gegevens blijven staan: die weghalen
 * hoort bij een bewuste opruimactie, niet bij het intrekken van een inlog.
 * Het laatste account kan niet weg — dan zou niemand meer binnenkomen.
 */
export async function verwijderGebruiker(id: string): Promise<{ ok: true } | { fout: string }> {
  if ((await telGebruikers()) <= 1) {
    return { fout: "Dit is het laatste account. Zonder account komt niemand er meer in." };
  }
  const g = await getGebruiker(id);
  if (!g) return { fout: "Onbekend account." };
  await redis.del(NAAM(g.gebruikersnaam));
  await redis.del(GEBRUIKER(id));
  await redis.srem(GEBRUIKERS, id);
  return { ok: true };
}
