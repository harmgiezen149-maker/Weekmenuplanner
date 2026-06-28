import { NextRequest, NextResponse } from "next/server";
import { getBoodschappen, saveBoodschappen } from "@/lib/data";
import type { Boodschappen } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const b = await getBoodschappen();
  return NextResponse.json(b);
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as Boodschappen;
  const b: Boodschappen = { items: Array.isArray(body.items) ? body.items : [] };
  await saveBoodschappen(b);
  return NextResponse.json(b);
}
