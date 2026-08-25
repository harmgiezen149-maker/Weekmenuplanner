import type { NextResponse } from "next/server";
import { SESSIE_COOKIE, SESSIE_SECONDEN } from "./sessie";

// httpOnly: JavaScript in de pagina kan er niet bij, dus een lek in een script
// levert de sessie niet uit. sameSite lax: hij gaat niet mee met verzoeken die
// een andere site namens jou afvuurt. secure alleen in productie, want op
// http://localhost zou de browser hem dan weigeren.
export function zetSessieCookie(res: NextResponse, token: string): void {
  res.cookies.set(SESSIE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSIE_SECONDEN,
  });
}

export function wisSessieCookie(res: NextResponse): void {
  res.cookies.set(SESSIE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
