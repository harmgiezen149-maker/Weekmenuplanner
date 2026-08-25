import { ACTIVITEITEN, vindActiviteit } from "./activiteit.ts";
import type { ActiviteitSoort } from "./activiteit";
import { geldigeDatum } from "./datum.ts";

// ---------------------------------------------------------------------------
// Beweging die van buiten binnenkomt.
//
// Twee wegen naar dezelfde deur:
//   - je horloge, via Health Connect en Tasker, dat een POST doet;
//   - een lijst die je zelf uit Garmin Connect kopieert en plakt.
//
// Allebei komen ze uit op dezelfde soorten die de app al kent, want de punten
// worden hier zelf berekend uit MET, gewicht en basaal metabolisme. Een
// verbranding die een horloge meestuurt wordt bewust NIET overgenomen: die
// getallen zijn structureel te optimistisch, en de app heeft daar al twee
// dempers tegen (rustverbranding eraf, plafond van zes punten per dag). Een
// externe schatting zou die dempers omzeilen.
// ---------------------------------------------------------------------------

/**
 * Namen zoals Health Connect, Garmin en Strava ze gebruiken, teruggebracht tot
 * de soorten die de app kent. Alles in kleine letters, zonder streepjes.
 */
const SYNONIEMEN: Record<string, string> = {
  // lopen
  walking: "wandelen", walk: "wandelen", wandelen: "wandelen", lopen: "wandelen",
  hiking: "wandelen-stevig", hike: "wandelen-stevig", wandeling: "wandelen",
  nordic_walking: "wandelen-stevig", stevig_wandelen: "wandelen-stevig",
  running: "hardlopen", run: "hardlopen", hardlopen: "hardlopen",
  trail_running: "hardlopen", treadmill_running: "hardlopen", joggen: "hardlopen",
  // fietsen
  biking: "fietsen-rustig", cycling: "fietsen-rustig", fietsen: "fietsen-rustig",
  ride: "fietsen-rustig", biking_stationary: "fietsen-rustig",
  road_biking: "fietsen-stevig", mountain_biking: "fietsen-stevig",
  virtualride: "fietsen-stevig", racefiets: "fietsen-stevig",
  // kracht en overig
  strength_training: "krachttraining", weight_lifting: "krachttraining",
  krachttraining: "krachttraining", workout: "krachttraining", fitness: "krachttraining",
  swimming: "zwemmen", swimming_pool: "zwemmen", swimming_open_water: "zwemmen",
  zwemmen: "zwemmen", gardening: "tuinieren", tuinieren: "tuinieren",
};

function sleutel(naam: string): string {
  return String(naam || "")
    .trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/**
 * Zoekt de soort bij een binnengekomen naam.
 *
 * De naam wordt in woorden geknipt, en er wordt gezocht op aaneengesloten
 * reeksen woorden — de langste eerst. Dat is nodig omdat er ook namen van twee
 * woorden in de tabel staan ("strength training"), en het is nodig dat het op
 * hele woorden gaat: "hardlopen" bevat "lopen", en een losse substring-treffer
 * boekte een hardloopsessie daardoor als wandelen.
 *
 * Geen treffer betekent geen activiteit. Liever een afgewezen regel dan punten
 * onder een verkeerde noemer, want die vind je later niet meer terug.
 */
export function herkenSoort(naam: string): ActiviteitSoort | null {
  const s = sleutel(naam);
  if (!s) return null;

  const direct = vindActiviteit(s.replace(/_/g, "-"));
  if (direct) return direct;

  const woorden = s.split("_").filter(Boolean);
  for (let lengte = woorden.length; lengte >= 1; lengte--) {
    for (let i = 0; i + lengte <= woorden.length; i++) {
      const stuk = woorden.slice(i, i + lengte).join("_");
      const via = SYNONIEMEN[stuk];
      if (via) return vindActiviteit(via) ?? null;
      const eigenId = vindActiviteit(stuk.replace(/_/g, "-"));
      if (eigenId) return eigenId;
      const opNaam = ACTIVITEITEN.find((a) => sleutel(a.naam) === stuk);
      if (opNaam) return opNaam;
    }
  }
  return null;
}

export interface ExterneActiviteit {
  datum: string;
  soort: ActiviteitSoort;
  minuten: number;
  /** Het id van de bron, om dezelfde training niet twee keer te boeken. */
  externId: string;
  bron: string;
}

/**
 * Leest wat er binnenkomt van het horloge.
 *
 * Alles wordt gecontroleerd: dit is de enige route in de app die van buiten de
 * browser bereikbaar is, en wat er binnenkomt is een tekstveld uit Tasker.
 */
export function leesExterneActiviteit(
  body: unknown, vandaag: string
): { activiteit: ExterneActiviteit } | { fout: string } {
  if (!body || typeof body !== "object") return { fout: "Geen leesbare gegevens" };
  const b = body as Record<string, unknown>;

  const soort = herkenSoort(String(b.soort ?? b.type ?? b.activity ?? ""));
  if (!soort) {
    return {
      fout: `Onbekende activiteit "${String(b.soort ?? b.type ?? "")}". Bekende soorten: `
        + ACTIVITEITEN.map((a) => a.id).join(", "),
    };
  }

  const minuten = minutenUit(b);
  if (minuten == null) {
    return { fout: "Geef een duur mee: minuten, of seconden in het veld 'seconden'." };
  }

  const datum = String(b.datum ?? b.date ?? "").slice(0, 10);
  const geldig = geldigeDatum(datum) ? datum : vandaag;

  // Zonder eigen id blijft alleen de combinatie datum + soort + duur over. Dat
  // is niet perfect — twee identieke wandelingen op één dag tellen dan als één
  // — maar het is beter dan elke herhaalde aanroep dubbel boeken.
  const externId = String(b.id ?? b.extern_id ?? "").trim()
    || `${geldig}-${soort.id}-${minuten}`;

  return {
    activiteit: {
      datum: geldig,
      soort,
      minuten,
      externId: externId.slice(0, 120),
      bron: String(b.bron ?? b.source ?? "horloge").trim().slice(0, 40) || "horloge",
    },
  };
}

function minutenUit(b: Record<string, unknown>): number | null {
  const direct = Number(b.minuten ?? b.minutes ?? b.duration_min);
  if (Number.isFinite(direct) && direct > 0) return begrens(direct);

  const seconden = Number(b.seconden ?? b.seconds ?? b.duration_s ?? b.duration);
  if (Number.isFinite(seconden) && seconden > 0) return begrens(seconden / 60);

  const ms = Number(b.duration_ms ?? b.millis);
  if (Number.isFinite(ms) && ms > 0) return begrens(ms / 60000);

  return null;
}

/**
 * Een duur onder een minuut is ruis (een horloge dat per ongeluk startte);
 * boven de tien uur is het vrijwel zeker een verkeerd gelezen eenheid.
 */
function begrens(minuten: number): number | null {
  const afgerond = Math.round(minuten);
  if (afgerond < 1 || afgerond > 600) return null;
  return afgerond;
}

// -- geplakte lijst ----------------------------------------------------------

export interface GeplakteRegel {
  datum: string;
  soort: ActiviteitSoort;
  minuten: number;
  /** De regel zoals hij er stond, om te kunnen tonen wat er is herkend. */
  bron: string;
}

/**
 * Leest een lijst die je uit Garmin Connect of een ander logboek kopieert.
 *
 * Bewust zonder model: het formaat is regelmatig genoeg om zelf te lezen, het
 * kost dan niets, het werkt zonder API-sleutel, en het is te testen. Wat niet
 * herkend wordt komt terug als afgewezen regel in plaats van als gok.
 */
export function leesGeplakteLijst(
  tekst: string, vandaag: string
): { herkend: GeplakteRegel[]; afgewezen: string[] } {
  const herkend: GeplakteRegel[] = [];
  const afgewezen: string[] = [];

  for (const ruw of String(tekst || "").split(/\r?\n/)) {
    const regel = ruw.trim();
    if (!regel) continue;

    const soort = herkenSoortInRegel(regel);
    const minuten = minutenInRegel(regel);
    const datum = datumInRegel(regel) ?? vandaag;

    if (!soort || minuten == null) { afgewezen.push(regel); continue; }
    herkend.push({ datum, soort, minuten, bron: regel });
  }

  return { herkend, afgewezen };
}

function herkenSoortInRegel(regel: string): ActiviteitSoort | null {
  for (const deel of regel.split(/[\t;,|]|\s{2,}/)) {
    const s = herkenSoort(deel);
    if (s) return s;
  }
  return herkenSoort(regel);
}

/**
 * De duur uit een regel. Herkent "45 min", "1:15:00", "1u30" en "0:45".
 */
function minutenInRegel(regel: string): number | null {
  const klok = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(regel);
  if (klok) {
    const a = Number(klok[1]), b = Number(klok[2]), c = Number(klok[3] ?? NaN);
    // Met drie delen is het uu:mm:ss, met twee delen mm:ss — zo staat het in
    // Garmin Connect, waar een wandeling van 45 minuten "45:12" heet.
    const minuten = Number.isFinite(c) ? a * 60 + b + c / 60 : a + b / 60;
    return begrens(minuten);
  }
  const metUur = /(\d+)\s*(?:u|uur|h|hr|hour)\w*\s*(\d+)?/i.exec(regel);
  if (metUur) return begrens(Number(metUur[1]) * 60 + Number(metUur[2] ?? 0));

  const metMin = /(\d+(?:[.,]\d+)?)\s*(?:min|minuten|minutes|m)\b/i.exec(regel);
  if (metMin) return begrens(Number(metMin[1].replace(",", ".")));

  return null;
}

function datumInRegel(regel: string): string | null {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(regel);
  if (iso && geldigeDatum(iso[0])) return iso[0];

  // Nederlandse notatie: 24-08-2026 of 24/8/2026.
  const nl = /\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/.exec(regel);
  if (nl) {
    const d = `${nl[3]}-${nl[2].padStart(2, "0")}-${nl[1].padStart(2, "0")}`;
    if (geldigeDatum(d)) return d;
  }
  return null;
}
