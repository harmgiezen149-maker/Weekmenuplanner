import { NextRequest, NextResponse } from "next/server";
import { offProduct } from "@/lib/tracker/off";
import { getGecachetProduct, cacheProduct } from "@/lib/tracker/data";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

type Params = { params: Promise<{ code: string }> };

/**
 * Zoekt een product op streepjescode.
 *
 * De cache wordt eerst geraadpleegd en is ook de terugval als Open Food Facts
 * onbereikbaar is. Producten die je vaker scant blijven daardoor werken zonder
 * netwerk. Kent niemand de code, dan komt er `gevonden: false` terug en vult
 * het invoerscherm de code alvast in bij handmatig toevoegen.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { code } = await params;
  if (!/^\d{6,14}$/.test(code)) {
    return NextResponse.json({ error: "Ongeldige streepjescode" }, { status: 400 });
  }

  const gecachet = await getGecachetProduct(code);
  if (gecachet) {
    return NextResponse.json({ gevonden: true, product: gecachet, uitCache: true });
  }

  try {
    const product = await offProduct(code);
    if (!product) {
      return NextResponse.json({ gevonden: false, barcode: code });
    }
    await cacheProduct(code, product);
    return NextResponse.json({ gevonden: true, product, uitCache: false });
  } catch {
    // Geen netwerk en niets in de cache: handmatig invullen is dan de weg.
    return NextResponse.json({
      gevonden: false,
      barcode: code,
      offline: true,
    });
  }
}
