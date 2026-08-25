import { NextResponse, type NextRequest } from "next/server";
import { PERSOON_HEADER, SESSIE_COOKIE, leesSessie } from "@/lib/sessie";

// ---------------------------------------------------------------------------
// Het slot op de deur.
//
// Alles gaat hierlangs: elke pagina en elke API-route. Er is precies één plek
// waar wordt beslist of iemand binnen mag, in plaats van dertig routes die het
// elk apart moeten onthouden — vergeet je er daar één, dan staat je gewicht
// open op het internet.
//
// Wie er is ingelogd gaat als header mee naar beneden. Die header wordt eerst
// weggegooid en dan pas gezet, zodat een browser hem niet zelf kan meesturen en
// zich zo voor iemand anders kan uitgeven.
// ---------------------------------------------------------------------------

/**
 * Paden die zonder inlog bereikbaar zijn.
 *
 * Met opzet per pad opgesomd en niet als `/api/auth/*`: onder die noemer vallen
 * ook het toevoegen van een persoon en het wijzigen van een wachtwoord, en die
 * horen juist alleen te werken als je al binnen bent.
 */
const OPEN: (string | RegExp)[] = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/status",
  "/api/auth/inrichten",
  // De service worker moet ook op het loginscherm te registreren zijn, anders
  // komt hij pas na de eerste inlog binnen en mist de eerste paginalading hem.
  "/sw.js",
  // De dagelijkse taak draait zonder browser en dus zonder sessie; hij heeft
  // zijn eigen controle (CRON_SECRET) en kan niets veranderen behalve een
  // melding versturen.
  /^\/api\/cron(\/|$)/,
  "/manifest.webmanifest",
  "/favicon.ico",
  "/apple-touch-icon.png",
  /^\/icon-.*\.png$/,
];

function isOpen(pad: string): boolean {
  return OPEN.some((r) => (typeof r === "string" ? pad === r : r.test(pad)));
}

/**
 * De iOS-Shortcut post recepten binnen met een eigen token, buiten de browser
 * en dus buiten de sessie om. Die route houdt zijn eigen tokencontrole; hier
 * wordt alleen bepaald dat er een token meekomt, zodat hij überhaupt bij die
 * controle aankomt.
 */
function metImportToken(req: NextRequest): boolean {
  return req.nextUrl.pathname === "/api/tracker/import"
    && req.method === "POST"
    && !!process.env.TRACKER_IMPORT_TOKEN
    && req.headers.get("x-tracker-token") === process.env.TRACKER_IMPORT_TOKEN;
}

function doorMet(req: NextRequest, persoon: string | null) {
  const kop = new Headers(req.headers);
  kop.delete(PERSOON_HEADER);
  if (persoon) kop.set(PERSOON_HEADER, persoon);
  return NextResponse.next({ request: { headers: kop } });
}

export async function middleware(req: NextRequest) {
  const pad = req.nextUrl.pathname;
  if (isOpen(pad)) return doorMet(req, null);
  if (metImportToken(req)) return doorMet(req, null);

  const token = req.cookies.get(SESSIE_COOKIE)?.value ?? "";
  let persoon: string | null = null;
  try {
    persoon = token ? await leesSessie(token) : null;
  } catch {
    // Is Redis onbereikbaar, dan is niemand ingelogd. Dichtvallen is hier de
    // juiste kant om te falen.
    persoon = null;
  }

  if (persoon) return doorMet(req, persoon);

  if (pad.startsWith("/api/")) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const naarLogin = req.nextUrl.clone();
  naarLogin.pathname = "/login";
  naarLogin.search = "";
  // Zodat je na het inloggen terugkomt waar je heen wilde.
  if (pad !== "/") naarLogin.searchParams.set("door", pad + req.nextUrl.search);
  return NextResponse.redirect(naarLogin);
}

export const config = {
  // Statische bestanden van Next zelf hebben geen slot nodig en zouden de
  // sessiecontrole alleen maar per plaatje herhalen.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
