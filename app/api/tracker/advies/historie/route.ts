import { NextResponse } from "next/server";
import { getAlleAdviezen } from "@/lib/tracker/data";

export const dynamic = "force-dynamic";

/**
 * De volledige adviesgeschiedenis, nieuwste eerst.
 *
 * Er wordt hier niets herberekend: de uitslagen staan al bij de adviezen zelf,
 * bijgewerkt door de evaluatielus. Deze route kost dus nooit een modelaanroep
 * en raakt de feitenlaag niet aan.
 */
export async function GET() {
  return NextResponse.json({ adviezen: await getAlleAdviezen() });
}
