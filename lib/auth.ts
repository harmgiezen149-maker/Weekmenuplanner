// ---------------------------------------------------------------------------
// Wachtwoorden. Draait alleen op de server (node:crypto), nooit in de browser
// en nooit in middleware.
//
// Er wordt scrypt gebruikt in plaats van een simpele hash. Het verschil zit in
// de tijd: scrypt is met opzet traag en geheugenzwaar, zodat iemand die de
// database in handen krijgt niet miljoenen wachtwoorden per seconde kan
// proberen. De kosten staan in de opgeslagen regel zelf, zodat ze later omhoog
// kunnen zonder dat bestaande wachtwoorden onleesbaar worden.
// ---------------------------------------------------------------------------

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const N = 16384; // rekenkosten
const R = 8;     // blokgrootte
const P = 1;     // parallellisme
const SLEUTEL_BYTES = 64;
const ZOUT_BYTES = 16;

export const MIN_WACHTWOORD = 8;

/**
 * Zet een wachtwoord om in een opslagbare regel:
 *   scrypt$<N>$<r>$<p>$<zout in hex>$<sleutel in hex>
 * Elke keer een nieuw zout, dus twee mensen met hetzelfde wachtwoord krijgen
 * verschillende regels.
 */
export function hashWachtwoord(wachtwoord: string): string {
  const zout = randomBytes(ZOUT_BYTES);
  const sleutel = scryptSync(wachtwoord.normalize("NFKC"), zout, SLEUTEL_BYTES, { N, r: R, p: P });
  return ["scrypt", N, R, P, zout.toString("hex"), sleutel.toString("hex")].join("$");
}

/**
 * Controleert een wachtwoord tegen een opgeslagen regel.
 *
 * De vergelijking is tijdsonafhankelijk: een gewone `===` stopt bij het eerste
 * verschillende teken en verraadt daarmee hoeveel er al klopte.
 */
export function controleerWachtwoord(wachtwoord: string, opgeslagen: string): boolean {
  const delen = String(opgeslagen || "").split("$");
  if (delen.length !== 6 || delen[0] !== "scrypt") return false;

  const n = Number(delen[1]);
  const r = Number(delen[2]);
  const p = Number(delen[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  // Een regel uit de database mag de server niet kunnen laten vastlopen op
  // absurde rekenkosten.
  if (n < 1024 || n > 1 << 20 || r < 1 || r > 32 || p < 1 || p > 16) return false;

  let zout: Buffer;
  let verwacht: Buffer;
  try {
    zout = Buffer.from(delen[4], "hex");
    verwacht = Buffer.from(delen[5], "hex");
  } catch {
    return false;
  }
  if (zout.length === 0 || verwacht.length === 0) return false;

  let sleutel: Buffer;
  try {
    sleutel = scryptSync(String(wachtwoord).normalize("NFKC"), zout, verwacht.length,
      { N: n, r, p, maxmem: 256 * 1024 * 1024 });
  } catch {
    return false;
  }
  return timingSafeEqual(sleutel, verwacht);
}

/**
 * De gebruikersnaam waarop wordt ingelogd. Kleine letters, cijfers, punt,
 * streepje en liggend streepje; geen spaties, want die typ je op een telefoon
 * te makkelijk verkeerd. De weergavenaam mag alles zijn.
 */
export function normaliseerGebruikersnaam(naam: string): string {
  return String(naam || "").trim().toLowerCase();
}

export function gebruikersnaamProbleem(naam: string): string | null {
  const n = normaliseerGebruikersnaam(naam);
  if (n.length < 2) return "Kies een gebruikersnaam van minstens 2 tekens.";
  if (n.length > 32) return "Een gebruikersnaam mag hooguit 32 tekens hebben.";
  if (!/^[a-z0-9._-]+$/.test(n)) {
    return "Gebruik alleen letters, cijfers, punten en streepjes — geen spaties.";
  }
  return null;
}

export function wachtwoordProbleem(wachtwoord: string): string | null {
  const w = String(wachtwoord || "");
  if (w.length < MIN_WACHTWOORD) {
    return `Kies een wachtwoord van minstens ${MIN_WACHTWOORD} tekens.`;
  }
  if (w.length > 200) return "Dat wachtwoord is te lang.";
  return null;
}
