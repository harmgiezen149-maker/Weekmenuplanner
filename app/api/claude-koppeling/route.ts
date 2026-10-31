import { NextResponse } from "next/server";
import { getClaudeSleutel, maakClaudeSleutel, wisClaudeSleutel } from "@/lib/claudesleutel";

export const dynamic = "force-dynamic";

// Alleen voor wie is ingelogd (middleware.ts laat dit pad niet open): de
// sleutel zelf komt nooit buiten een sessie naar buiten.

export async function GET() {
  return NextResponse.json({ sleutel: await getClaudeSleutel() }, { headers: { "Cache-Control": "no-store" } });
}

/** Een nieuwe sleutel. Dit trekt de oude meteen in. */
export async function POST() {
  return NextResponse.json({ sleutel: await maakClaudeSleutel() }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE() {
  await wisClaudeSleutel();
  return NextResponse.json({ sleutel: null });
}
