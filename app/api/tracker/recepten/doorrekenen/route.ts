import { NextRequest, NextResponse } from "next/server";
import { berekenReceptPunten } from "@/lib/tracker/recept";
import { getIngredienten } from "@/lib/tracker/ingredienten-opslag";

export const dynamic = "force-dynamic";

/** Genoeg voor het langste recept; meer is geen recept maar een boodschappenlijst. */
const MAX_INGREDIENTEN = 60;

/**
 * Rekent een losse ingrediëntenlijst door naar punten per portie.
 *
 * Nodig zodra je op het importscherm een ingrediënt bijstelt: "volkorenmeel
 * (havermeel)" herkent de lijst niet, "havermeel" wel. Het antwoord is
 * hetzelfde als bij het ophalen van de pagina, dus het scherm kan het er
 * zonder omweg voor in de plaats zetten.
 *
 * Kost geen modelaanroep: dit is alleen de eigen productlijst en de eigen
 * formule. Vandaar dat er ook geen limiet op zit — opnieuw proberen mag zo
 * vaak als nodig.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const rauw = Array.isArray(body?.ingredienten) ? body.ingredienten : [];
  if (rauw.length === 0) {
    return NextResponse.json({ error: "Geen ingrediënten meegegeven" }, { status: 400 });
  }

  const ingredienten = rauw.slice(0, MAX_INGREDIENTEN).map((i: unknown) => {
    const r = (i ?? {}) as Record<string, unknown>;
    return {
      naam: String(r.naam ?? "").slice(0, 120),
      hoev: Number(r.hoev) || 0,
      eenheid: String(r.eenheid ?? "").slice(0, 30),
    };
  }).filter((i: { naam: string }) => i.naam.trim() !== "");

  if (ingredienten.length === 0) {
    return NextResponse.json({ error: "Geen bruikbare ingrediënten" }, { status: 400 });
  }

  const personen = Number(body?.personen) > 0 ? Number(body.personen) : 1;
  const bib = await getIngredienten();

  return NextResponse.json({ punten: berekenReceptPunten(ingredienten, personen, {}, bib) });
}
