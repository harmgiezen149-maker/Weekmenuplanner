import { NextResponse } from "next/server";
import { getPrijsboek } from "@/lib/prijsboek";

export const dynamic = "force-dynamic";

/** Het prijsboek, om de boodschappenlijst een raming te laten tonen. */
export async function GET() {
  return NextResponse.json({ boek: await getPrijsboek() });
}
