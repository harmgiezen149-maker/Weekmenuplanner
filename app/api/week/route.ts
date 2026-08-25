import { NextRequest, NextResponse } from "next/server";
import { getWeek, saveWeek } from "@/lib/data";
import { geldigeWeek, weekVan } from "@/lib/weeksleutel";
import { datumSleutel } from "@/lib/tracker/datum";
import type { WeekState } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Welke week wordt gevraagd. Zonder of met een onzinnige `?week=` is dat deze
 * week: een verkeerd meegegeven sleutel hoort een lege planning voor een
 * onbestaande week op te leveren, niet een foutmelding waar niemand iets mee
 * kan.
 */
function gevraagdeWeek(req: NextRequest): { sleutel: string; huidig: boolean } {
  const nu = weekVan(datumSleutel());
  const gevraagd = req.nextUrl.searchParams.get("week") ?? "";
  const sleutel = geldigeWeek(gevraagd) ? gevraagd : nu;
  return { sleutel, huidig: sleutel === nu };
}

export async function GET(req: NextRequest) {
  const { sleutel, huidig } = gevraagdeWeek(req);
  const week = await getWeek(sleutel, huidig);
  return NextResponse.json({ ...week, week: sleutel });
}

export async function PUT(req: NextRequest) {
  const { sleutel } = gevraagdeWeek(req);
  const body = (await req.json()) as WeekState;
  const week: WeekState = {
    startDag: Number(body.startDag) || 0,
    slots: body.slots || {},
  };
  await saveWeek(sleutel, week);
  return NextResponse.json({ ...week, week: sleutel });
}
