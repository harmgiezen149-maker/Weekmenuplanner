import { NextRequest, NextResponse } from "next/server";
import { getVoorraad, saveVoorraad } from "@/lib/data";
import type { Voorraad } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const v = await getVoorraad();
  return NextResponse.json(v);
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as Voorraad;
  const v: Voorraad = { items: Array.isArray(body.items) ? body.items : [] };
  await saveVoorraad(v);
  return NextResponse.json(v);
}
