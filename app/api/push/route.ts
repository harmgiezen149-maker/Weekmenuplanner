import { NextResponse, type NextRequest } from "next/server";
import { abonneer, getAbonnementen, publiekeSleutel, zegOp } from "@/lib/push";
import { huidigePersoon } from "@/lib/persoon";
import { getVoorkeur, saveVoorkeur } from "@/lib/tracker/meldingen";
import { normaliseerVoorkeur } from "@/lib/tracker/herinnering";

export const dynamic = "force-dynamic";

/** De publieke sleutel, je aangemelde apparaten en je voorkeuren. */
export async function GET() {
  const persoon = await huidigePersoon();
  const [sleutel, abonnementen, voorkeur] = await Promise.all([
    publiekeSleutel(), getAbonnementen(persoon), getVoorkeur(persoon),
  ]);
  return NextResponse.json({
    sleutel,
    apparaten: abonnementen.map((a) => ({ endpoint: a.endpoint, sinds: a.sinds })),
    voorkeur,
  });
}

/** Een apparaat aanmelden en/of de voorkeuren bijwerken. */
export async function POST(req: NextRequest) {
  const persoon = await huidigePersoon();
  const body = await req.json().catch(() => ({}));

  if (body?.abonnement?.endpoint && body?.abonnement?.keys?.p256dh && body?.abonnement?.keys?.auth) {
    await abonneer(persoon, {
      endpoint: String(body.abonnement.endpoint),
      keys: {
        p256dh: String(body.abonnement.keys.p256dh),
        auth: String(body.abonnement.keys.auth),
      },
    });
  }

  const voorkeur = body?.voorkeur
    ? await saveVoorkeur(persoon, normaliseerVoorkeur(body.voorkeur))
    : await getVoorkeur(persoon);

  const abonnementen = await getAbonnementen(persoon);
  return NextResponse.json({
    voorkeur,
    apparaten: abonnementen.map((a) => ({ endpoint: a.endpoint, sinds: a.sinds })),
  });
}

/**
 * Een apparaat afmelden. Zonder endpoint gaan ze er allemaal af — dat is de
 * knop "op geen enkel apparaat meer".
 */
export async function DELETE(req: NextRequest) {
  const persoon = await huidigePersoon();
  const endpoint = new URL(req.url).searchParams.get("endpoint") ?? "";
  const over = await zegOp(persoon, endpoint);
  return NextResponse.json({ apparaten: over });
}
