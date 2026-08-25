import { NextResponse, type NextRequest } from "next/server";
import { SESSIE_COOKIE, wisSessie } from "@/lib/sessie";
import { wisSessieCookie } from "@/lib/cookie";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSIE_COOKIE)?.value ?? "";
  // Eerst de sessie zelf weg, dan pas de cookie: zo is de sleutel ook waardeloos
  // als hij ergens is blijven hangen.
  await wisSessie(token);
  const res = NextResponse.json({ uitgelogd: true });
  wisSessieCookie(res);
  return res;
}
