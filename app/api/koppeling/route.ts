import { NextResponse } from "next/server";
import { getKoppelsleutel, maakKoppelsleutel, wisKoppelsleutel } from "@/lib/koppelsleutel";
import { huidigePersoon } from "@/lib/persoon";

export const dynamic = "force-dynamic";

export async function GET() {
  const persoon = await huidigePersoon();
  return NextResponse.json({ sleutel: await getKoppelsleutel(persoon) });
}

/** Een nieuwe sleutel. Dit trekt de oude meteen in. */
export async function POST() {
  const persoon = await huidigePersoon();
  return NextResponse.json({ sleutel: await maakKoppelsleutel(persoon) });
}

export async function DELETE() {
  const persoon = await huidigePersoon();
  await wisKoppelsleutel(persoon);
  return NextResponse.json({ sleutel: null });
}
