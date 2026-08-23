import { NextResponse } from "next/server";
import { getAllRecepten } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * De receptenlijst van het kookboek, uitgekleed tot wat de tracker nodig heeft.
 * Leest alleen; de kookboek-keys worden nergens geschreven.
 */
export async function GET() {
  const recepten = await getAllRecepten();
  return NextResponse.json({
    recepten: recepten.map((r) => ({
      id: r.id,
      titel: r.titel,
      maaltijd: r.maaltijd,
      personen: r.personen,
      aantalIngredienten: r.ingredienten.length,
    })),
  });
}
