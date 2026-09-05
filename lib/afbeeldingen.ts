// ---------------------------------------------------------------------------
// Foto's van een receptpagina plukken.
//
// Een recept zonder foto ziet er in het kookboek uit als een boodschappenlijst.
// De pagina waar het vandaan komt heeft er wél een, meestal netjes aangewezen
// in de meta-tags of in de receptgegevens. Dit haalt die kandidaten eruit, op
// volgorde van betrouwbaarheid, zodat het scherm de eerste die het ophalen
// overleeft op het recept kan zetten.
//
// Bewust gescheiden van het ophalen zelf: het uitlezen is dan te testen zonder
// internet, en het ophalen kan op meer plekken worden hergebruikt.
// ---------------------------------------------------------------------------

/** Meer dan een handvol keuzes past niet op een telefoonscherm. */
const MAX = 8;

/** Genoeg om een pagina met een lange fotogalerij niet af te lopen. */
const MAX_IMG_TAGS = 60;

/**
 * Losse plaatjes die op elke pagina staan en nooit het gerecht zijn.
 * Sponsorlogo's en avatars van de schrijver komen anders bovenaan te staan.
 */
const GEEN_GERECHT = /logo|icon|sprite|avatar|placeholder|favicon|pixel|badge|\.svg/i;

/**
 * HTML-entiteiten die in een `content="..."` van een meta-tag voorkomen.
 *
 * Hier zit de adder: een og:image staat er vaak als
 * `...&amp;width=1200&amp;height=800`. Neem je dat letterlijk over, dan vraag
 * je de fotoserver om een parameter die `amp;width` heet en krijg je een 404 —
 * precies het geval waarin er "geen foto meekomt" terwijl de pagina er een had.
 */
function ontsla(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Kandidaat-foto's uit de HTML van een pagina, absoluut gemaakt en ontdubbeld.
 *
 * Volgorde: meta-tags (og:image, twitter:image) eerst, dan de receptgegevens
 * in JSON-LD, dan gewone `<img>`-tags. De eerste is daarmee vrijwel altijd de
 * hoofdfoto van het gerecht.
 */
export function afbeeldingenUitHtml(html: string, pageUrl: string): string[] {
  const urls: string[] = [];
  const duw = (u?: string | null) => {
    if (u && typeof u === "string") urls.push(ontsla(u).trim());
  };

  // 1) Meta-tags: og:image (beide attribuut-volgordes), secure_url, twitter:image.
  //    Dit is vrijwel altijd de hoofdfoto van het gerecht.
  const metaRes = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/gi,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/gi,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/gi,
  ];
  for (const re of metaRes) {
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(html))) duw(mm[1]);
  }

  // 2) JSON-LD (schema.org Recipe): "image" als string, array of object — dit is
  //    op receptsites de betrouwbaarste bron voor de gerechtfoto.
  const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let ld: RegExpExecArray | null;
  while ((ld = ldRe.exec(html))) {
    try {
      const data = JSON.parse(ld[1]);
      const nodes = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
      for (const node of nodes) {
        const img = node?.image ?? node?.thumbnailUrl;
        if (!img) continue;
        if (typeof img === "string") duw(img);
        else if (Array.isArray(img)) {
          img.forEach((i: unknown) =>
            duw(typeof i === "string" ? i : (i as { url?: string } | null)?.url)
          );
        } else if (typeof img === "object") duw((img as { url?: string }).url);
      }
    } catch { /* ongeldig JSON-LD overslaan */ }
  }

  // 3) <img>-tags: src, data-src en srcset (lazy loading), alleen echte fotoformaten.
  const imgRes = [
    /<img[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)["']/gi,
    /<img[^>]+srcset=["']([^"'\s,]+)/gi,
  ];
  for (const re of imgRes) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && urls.length < MAX_IMG_TAGS) {
      const src = m[1];
      if (/\.(jpe?g|png|webp)(\?|$)/i.test(src)) duw(src);
    }
  }

  const absoluut = urls
    .map((u) => { try { return new URL(u, pageUrl).href; } catch { return null; } })
    .filter((u): u is string => !!u && u.startsWith("http"))
    .filter((u) => !GEEN_GERECHT.test(u));

  // ontdubbel, behoud volgorde (meta/JSON-LD eerst = hoofdfoto vooraan)
  return [...new Set(absoluut)].slice(0, MAX);
}

/**
 * Haalt de pagina op en levert de kandidaat-foto's.
 *
 * Doet zich voor als een gewone browser: een aantal receptsites geeft een kale
 * fetch niets terug. Lukt het toch niet, dan is dat geen fout maar een lege
 * lijst — het recept zelf is belangrijker dan de foto.
 */
export async function haalAfbeeldingen(pageUrl: string): Promise<string[]> {
  const r = await fetch(pageUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "nl,en;q=0.8",
    },
    redirect: "follow",
  });
  if (!r.ok) return [];
  const html = await r.text();
  return afbeeldingenUitHtml(html, pageUrl);
}
