/* Service worker van Kookboek.
 *
 * Twee taken, allebei bewust klein gehouden:
 *
 *   1. De boodschappenlijst blijft werken in een winkel met slecht bereik. Van
 *      elke geslaagde aanvraag wordt een kopie bewaard; valt het netwerk weg,
 *      dan komt die kopie tevoorschijn met een kop erbij die zegt hoe oud hij
 *      is.
 *   2. Pushmeldingen tonen en op een tik de juiste pagina openen.
 *
 * Er wordt met opzet niet geprobeerd de hele app offline te laten werken.
 * Recepten toevoegen, punten berekenen en advies vragen kunnen niet zonder
 * server, en een app die half werkt zonder te zeggen wat er niet werkt is
 * verwarrender dan een app die eerlijk zegt dat hij geen verbinding heeft.
 */

const VERSIE = "kb-v1";
const SCHIL = `${VERSIE}-schil`;
const DATA = `${VERSIE}-data`;

// Aanvragen waarvan een kopie bewaard wordt om offline te kunnen tonen.
const BEWAREN = ["/api/boodschappen", "/api/voorraad", "/api/gebiedvolgorde", "/api/week"];

self.addEventListener("install", (e) => {
  // Meteen actief worden: bij een nieuwe versie wil je niet dat de oude
  // service worker nog een sessie lang de dienst uitmaakt.
  e.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const naam of await caches.keys()) {
      if (!naam.startsWith(VERSIE)) await caches.delete(naam);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Inloggen en uitloggen nooit uit een kopie beantwoorden: dan zou je een
  // verlopen sessie als geldig terugkrijgen.
  if (url.pathname.startsWith("/api/auth")) return;

  if (BEWAREN.includes(url.pathname)) {
    e.respondWith(netwerkEerst(req));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(kopieEerst(req));
    return;
  }

  if (req.mode === "navigate") {
    e.respondWith(paginaMetTerugval(req));
  }
});

/** Vers als het kan, anders de bewaarde kopie met een leeftijdskop erbij. */
async function netwerkEerst(req) {
  const kluis = await caches.open(DATA);
  try {
    const res = await fetch(req);
    if (res.ok) kluis.put(req, kopieMetTijd(res.clone()));
    return res;
  } catch (fout) {
    const bewaard = await kluis.match(req);
    if (bewaard) return bewaard;
    throw fout;
  }
}

/**
 * Bestanden onder /_next/static/ dragen een hash in hun naam: dezelfde naam is
 * altijd dezelfde inhoud. Die mogen dus zonder meer uit de kopie komen.
 */
async function kopieEerst(req) {
  const kluis = await caches.open(SCHIL);
  const bewaard = await kluis.match(req);
  if (bewaard) return bewaard;
  const res = await fetch(req);
  if (res.ok) kluis.put(req, res.clone());
  return res;
}

async function paginaMetTerugval(req) {
  const kluis = await caches.open(SCHIL);
  try {
    const res = await fetch(req);
    // Een doorstuur naar het loginscherm hoort niet onder de oorspronkelijke
    // pagina bewaard te worden: offline zou je dan het loginscherm zien op de
    // plek waar je boodschappenlijst hoorde te staan.
    if (res.ok && !res.redirected) kluis.put(req, res.clone());
    return res;
  } catch (fout) {
    const bewaard = await kluis.match(req);
    if (bewaard) return bewaard;
    return new Response(GEEN_VERBINDING, {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

/** Legt vast wanneer deze kopie is gemaakt, zodat de app kan tonen hoe oud hij is. */
function kopieMetTijd(res) {
  const koppen = new Headers(res.headers);
  koppen.set("x-kb-bewaard-op", new Date().toISOString());
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: koppen });
}

const GEEN_VERBINDING = `<!doctype html><html lang="nl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Geen verbinding</title>
<style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;
background:#f7f7f5;color:#101118;font-family:system-ui,sans-serif;padding:24px}
div{max-width:340px;text-align:center}h1{font-size:20px;margin:0 0 8px}
p{font-size:14px;line-height:1.6;color:#6f7385;margin:0}</style></head><body><div>
<h1>Geen verbinding</h1><p>Deze pagina staat niet in het geheugen van je telefoon.
Je boodschappenlijst wel — open die vanaf het beginscherm.</p></div></body></html>`;

// -- meldingen ---------------------------------------------------------------

self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = {};
  }
  const titel = data.titel || "Kookboek";
  e.waitUntil(self.registration.showNotification(titel, {
    body: data.tekst || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    // Twee meldingen van dezelfde soort vervangen elkaar in plaats van zich op
    // te stapelen op je vergrendelscherm.
    tag: data.soort || "kookboek",
    data: { pad: data.pad || "/tracker" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const pad = (e.notification.data && e.notification.data.pad) || "/tracker";
  e.waitUntil((async () => {
    const vensters = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // Staat de app al open, dan die gebruiken: een tweede tabblad van dezelfde
    // app is voor niemand handig.
    for (const v of vensters) {
      if (new URL(v.url).origin === self.location.origin) {
        await v.focus();
        if ("navigate" in v) await v.navigate(pad);
        return;
      }
    }
    await self.clients.openWindow(pad);
  })());
});
