import { NextRequest, NextResponse } from "next/server";
import { getWeek, saveWeek } from "@/lib/data";
import type { WeekState } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const week = await getWeek();
  return NextResponse.json(week);
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as WeekState;
  const week: WeekState = {
    startDag: Number(body.startDag) || 0,
    slots: body.slots || {},
  };
  await saveWeek(week);
  return NextResponse.json(week);
}
