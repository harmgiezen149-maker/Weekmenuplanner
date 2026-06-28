import { NextRequest, NextResponse } from "next/server";
import { getGebiedVolgorde, saveGebiedVolgorde } from "@/lib/data";
import type { GebiedVolgorde } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await getGebiedVolgorde();
  return NextResponse.json(g);
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as GebiedVolgorde;
  const g: GebiedVolgorde = body && typeof body === "object" ? body : {};
  await saveGebiedVolgorde(g);
  return NextResponse.json(g);
}
