import { NextRequest, NextResponse } from "next/server";
import { offProduct } from "@/lib/tracker/off";
import { zoekBijWinkels, maakHaler } from "@/lib/tracker/winkels";
import {
  getGecachetProduct, cacheProduct, getEigenProduct, saveEigenProduct,
} from "@/lib/tracker/data";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Params = { params: Promise<{ code: string }> };

/**
 * Zoekt een product op streepjescode. Vier bronnen, in deze volgorde:
 *
 *   1. Je eigen invoer. Wat je ooit zelf hebt ingevuld bij deze code wint
 *      altijd: dat is precies het product uit jouw kast.
 *   2. De cache van een eerdere externe treffer. Werkt ook zonder netwerk.
 *   3. Open Food Facts. Dekt merkproducten goed, huismerken slecht.
 *   4. De supermarkten zelf. Onofficiele endpoints, dus alles faalt stil.
 *
 * Levert niets een product op, dan komt er `gevonden: false` terug met de
 * code erbij, zodat het invoerscherm hem kan voorvullen — en na één keer
 * invullen zit hij in bron 1.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { code } = await params;
  if (!/^\d{6,14}$/.test(code)) {
    return NextResponse.json({ error: "Ongeldige streepjescode" }, { status: 400 });
  }

  const eigen = await getEigenProduct(code);
  if (eigen) {
    return NextResponse.json({ gevonden: true, product: eigen, bron: "eigen" });
  }

  const gecachet = await getGecachetProduct(code);
  if (gecachet) {
    return NextResponse.json({ gevonden: true, product: gecachet, bron: "cache", uitCache: true });
  }

  let offline = false;

  try {
    const product = await offProduct(code);
    if (product) {
      await cacheProduct(code, product);
      return NextResponse.json({ gevonden: true, product, bron: "off" });
    }
  } catch {
    offline = true;
  }

  // Open Food Facts kent hem niet — bij Nederlandse huismerken is dat eerder
  // regel dan uitzondering. Dan de supermarkten zelf proberen.
  try {
    const winkelProduct = await zoekBijWinkels(code, maakHaler());
    if (winkelProduct) {
      await cacheProduct(code, winkelProduct);
      return NextResponse.json({ gevonden: true, product: winkelProduct, bron: "winkel" });
    }
  } catch {
    offline = true;
  }

  return NextResponse.json({ gevonden: false, barcode: code, offline });
}

/**
 * Bewaart een zelf ingevuld product bij zijn streepjescode, zodat de volgende
 * scan hem meteen vindt. Dit is de manier waarop de app langzaam jouw eigen
 * boodschappenlijst leert kennen.
 */
export async function PUT(req: NextRequest, { params }: Params) {
  const { code } = await params;
  if (!/^\d{6,14}$/.test(code)) {
    return NextResponse.json({ error: "Ongeldige streepjescode" }, { status: 400 });
  }

  const body = await req.json();
  const naam = String(body?.name ?? "").trim();
  const per100 = body?.per100;
  if (!naam || !per100 || typeof per100 !== "object") {
    return NextResponse.json({ error: "Naam en voedingswaarden zijn verplicht" }, { status: 400 });
  }

  await saveEigenProduct(code, {
    id: code,
    name: naam.slice(0, 120),
    ...(body?.brand ? { brand: String(body.brand).slice(0, 80) } : {}),
    bron: "eigen",
    eenheid: body?.eenheid === "ml" ? "ml" : "g",
    per100,
    ...(body?.portie ? { portie: body.portie } : {}),
    barcode: code,
  });

  return NextResponse.json({ bewaard: true, barcode: code }, { status: 201 });
}
