import { NextRequest, NextResponse } from "next/server";
import { getProfile, saveProfile } from "@/lib/tracker/data";
import { berekenBudget } from "@/lib/tracker/budget";

export const dynamic = "force-dynamic";

// GET geeft { profiel, budget } terug. profiel is null zolang er nog niets is
// ingevuld; het scherm stuurt de gebruiker dan naar de instellingen.
export async function GET() {
  const profiel = await getProfile();
  return NextResponse.json({
    profiel,
    budget: profiel ? berekenBudget(profiel) : null,
  });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const profiel = await saveProfile(body);
  return NextResponse.json({ profiel, budget: berekenBudget(profiel) });
}
