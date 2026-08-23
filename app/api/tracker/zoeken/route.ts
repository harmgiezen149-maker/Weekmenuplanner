import { NextRequest, NextResponse } from "next/server";
import { offZoek } from "@/lib/tracker/off";
import { zoekBasisproducten } from "@/lib/tracker/basisproducten";
import type { Product } from "@/lib/tracker/types";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

/**
 * Zoekt op naam in de eigen basislijst en in Open Food Facts.
 *
 * De basislijst gaat voorop: die bevat onbewerkte producten (ei, rijst, kip)
 * waar Open Food Facts zwak in is, en hij is er altijd. Faalt de externe
 * zoekopdracht, dan komen de eigen resultaten alsnog terug, met een melding
 * erbij in plaats van een lege lijst.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ resultaten: [], extern: "leeg" });

  const basis = zoekBasisproducten(q);

  let extern: Product[] = [];
  let externStatus: "ok" | "mislukt" = "ok";
  try {
    extern = await offZoek(q);
  } catch {
    externStatus = "mislukt";
  }

  // Dubbelingen eruit: een product uit de basislijst wint van hetzelfde
  // product uit de externe database.
  const gezien = new Set(basis.map((p) => p.name.toLowerCase()));
  const uniek = extern.filter((p) => {
    const k = p.name.toLowerCase();
    if (gezien.has(k)) return false;
    gezien.add(k);
    return true;
  });

  return NextResponse.json({
    resultaten: [...basis, ...uniek].slice(0, 30),
    extern: externStatus,
  });
}
