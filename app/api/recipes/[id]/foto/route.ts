import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getRecept } from "@/lib/data";
import { leesDataUrl } from "@/lib/receptfotos";

export const dynamic = "force-dynamic";

/**
 * De foto van één recept, als gewone afbeelding.
 *
 * Hierdoor hoeft de receptenlijst de foto's niet meer mee te sturen. De
 * browser haalt ze op zoals elke andere afbeelding op internet: parallel, pas
 * als ze in beeld komen, en daarna uit zijn eigen cache.
 *
 * Vijf minuten zonder navragen, daarna een ETag-controle die 304 teruggeeft
 * als er niets veranderd is. Vervang je een foto, dan verandert de ETag en
 * ziet je browser de nieuwe binnen die vijf minuten. Kort genoeg om niet naar
 * een oude foto te zitten kijken, lang genoeg om bij het rondklikken door je
 * kookboek geen enkel verzoek te kosten.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const recept = await getRecept(id);
  if (!recept) {
    return NextResponse.json({ error: "Recept niet gevonden" }, { status: 404 });
  }

  const foto = leesDataUrl(recept.afbeelding);
  if (!foto) {
    return NextResponse.json({ error: "Dit recept heeft geen foto" }, { status: 404 });
  }

  const etag = `"${createHash("sha1").update(recept.afbeelding).digest("hex").slice(0, 16)}"`;
  const cache = "private, max-age=300, must-revalidate";

  // Kent de browser deze foto al, dan hoeven de bytes er niet nog een keer
  // overheen. Dat is tenslotte de hele reden dat de foto's hierheen verhuisd
  // zijn.
  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": cache } });
  }

  return new NextResponse(new Uint8Array(foto.bytes), {
    headers: {
      "Content-Type": foto.type,
      "Content-Length": String(foto.bytes.length),
      "Cache-Control": cache,
      ETag: etag,
    },
  });
}
