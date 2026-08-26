import { herkenSoort } from "./koppeling.ts";
import type { ActiviteitSoort } from "./activiteit";
import { geldigeDatum } from "./datum.ts";

// ---------------------------------------------------------------------------
// De ruwe JSON van een Health Connect-plug-in.
//
// Zo'n plug-in geeft geen losse variabelen terug maar één blok JSON. Die in
// Tasker uit elkaar peuteren kan, maar het is priegelwerk in een schermpje —
// en een app is daar nu eenmaal beter in dan een telefoon-UI. Stuur het hele
// blok mee als body en deze module haalt eruit wat nodig is.
//
// Wat er NIET gebeurt: raden. Komt de sport binnen als een nummer, dan wordt
// die regel geweigerd met dat nummer erbij. De cijfercodes van Health Connect
// zijn nergens betrouwbaar na te slaan, en een verkeerd gegokt nummer boekt
// stilletjes de verkeerde sport. Een geweigerde regel zie je; een verkeerd
// geboekte niet.
// ---------------------------------------------------------------------------

export interface GevondenActiviteit {
  datum: string;
  soort: ActiviteitSoort;
  minuten: number;
  externId: string;
}

export interface GeweigerdeRegel {
  /** Waarom deze regel niet te gebruiken was, in gewone taal. */
  reden: string;
  /** Wat er in stond, kort, om te kunnen zien waar het misging. */
  inhoud: string;
}

export interface JsonUitslag {
  gevonden: GevondenActiviteit[];
  geweigerd: GeweigerdeRegel[];
}

/** Ziet dit eruit als een blok gezondheidsgegevens in plaats van losse velden? */
export function lijktOpGezondheidJson(body: unknown): boolean {
  if (Array.isArray(body)) return true;
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (Array.isArray(b.records) || Array.isArray(b.data) || Array.isArray(b.sessions)) return true;
  // Eén losse sessie: herkenbaar aan de tijdvelden van Health Connect.
  return typeof b.startTime === "string" && typeof b.endTime === "string";
}

function haalRegels(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== "object") return [];
  const b = body as Record<string, unknown>;
  for (const veld of ["records", "data", "sessions"]) {
    if (Array.isArray(b[veld])) return b[veld] as unknown[];
  }
  return [b];
}

/**
 * Leest de sessies uit het blok.
 *
 * Ruim in wat het accepteert, streng in wat het doorlaat: elke regel die niet
 * compleet te lezen is komt terug in `geweigerd`, met de reden erbij. Zo zie je
 * meteen of het aan één regel ligt of aan het hele formaat.
 */
export function leesGezondheidJson(body: unknown, vandaag: string): JsonUitslag {
  const gevonden: GevondenActiviteit[] = [];
  const geweigerd: GeweigerdeRegel[] = [];

  for (const ruw of haalRegels(body)) {
    if (!ruw || typeof ruw !== "object") {
      geweigerd.push({ reden: "geen leesbare regel", inhoud: kort(ruw) });
      continue;
    }
    const r = ruw as Record<string, unknown>;

    const soort = soortUit(r);
    if (!soort) {
      const type = r.exerciseType;
      geweigerd.push({
        reden: typeof type === "number"
          ? `de sport staat er als nummer (${type}) en niet als naam. Stuur dat nummer door, `
            + "dan zet ik het erbij — raden zou de verkeerde sport boeken."
          : "geen herkenbare sport gevonden",
        inhoud: kort(r),
      });
      continue;
    }

    const minuten = minutenUit(r);
    if (minuten == null) {
      geweigerd.push({ reden: "geen bruikbare duur", inhoud: kort(r) });
      continue;
    }

    gevonden.push({
      soort,
      minuten,
      datum: datumUit(r) ?? vandaag,
      externId: idUit(r) || `hc-${datumUit(r) ?? vandaag}-${soort.id}-${minuten}`,
    });
  }

  return { gevonden, geweigerd };
}

/**
 * De sport. Eerst het type, dan de titel — Garmin zet daar vaak "Hardlopen" of
 * "Running" in, en dat is bruikbaarder dan een cijfercode.
 */
function soortUit(r: Record<string, unknown>): ActiviteitSoort | null {
  const kandidaten = [r.exerciseType, r.type, r.activityType, r.title, r.name, r.sport];
  for (const k of kandidaten) {
    if (typeof k !== "string") continue;
    // Health Connect schrijft soms EXERCISE_TYPE_RUNNING.
    const schoon = k.replace(/^EXERCISE_TYPE_/i, "").trim();
    const gevonden = herkenSoort(schoon);
    if (gevonden) return gevonden;
  }
  return null;
}

function minutenUit(r: Record<string, unknown>): number | null {
  const start = Date.parse(String(r.startTime ?? r.start ?? ""));
  const eind = Date.parse(String(r.endTime ?? r.end ?? ""));
  if (Number.isFinite(start) && Number.isFinite(eind) && eind > start) {
    return begrens((eind - start) / 60000);
  }

  for (const [veld, deler] of [
    ["durationMinutes", 1], ["minuten", 1], ["minutes", 1],
    ["duration", 60], ["durationSeconds", 60], ["seconden", 60], ["seconds", 60],
    ["durationMillis", 60000],
  ] as const) {
    const n = Number(r[veld]);
    if (Number.isFinite(n) && n > 0) return begrens(n / deler);
  }
  return null;
}

/** Een duur onder een minuut is ruis; boven de tien uur een verkeerde eenheid. */
function begrens(minuten: number): number | null {
  const afgerond = Math.round(minuten);
  return afgerond < 1 || afgerond > 600 ? null : afgerond;
}

/**
 * De kalenderdag waarop de activiteit begon.
 *
 * Health Connect schrijft tijden in UTC met de zoneverschuiving er los naast.
 * Zonder die verschuiving belandt een training van half één 's nachts op de
 * verkeerde dag, en dan klopt je week niet.
 */
function datumUit(r: Record<string, unknown>): string | null {
  const ruw = String(r.startTime ?? r.start ?? "");
  if (!ruw) return null;

  // Staat de zone al in de tijd zelf (…+02:00), dan is de datum ervoor de juiste.
  if (/[+-]\d{2}:\d{2}$/.test(ruw)) {
    const d = ruw.slice(0, 10);
    return geldigeDatum(d) ? d : null;
  }

  const ms = Date.parse(ruw);
  if (!Number.isFinite(ms)) return null;

  const offset = zoneOffsetSeconden(r);
  const d = new Date(ms + offset * 1000).toISOString().slice(0, 10);
  return geldigeDatum(d) ? d : null;
}

function zoneOffsetSeconden(r: Record<string, unknown>): number {
  const ruw = r.startZoneOffset ?? r.zoneOffset ?? r.offset;
  if (typeof ruw === "number" && Number.isFinite(ruw)) {
    // Zowel seconden als uren komen voor; boven de 24 kan het geen uren zijn.
    return Math.abs(ruw) > 24 ? ruw : ruw * 3600;
  }
  if (typeof ruw === "string") {
    const m = /^([+-])(\d{2}):?(\d{2})?/.exec(ruw.trim());
    if (m) {
      const teken = m[1] === "-" ? -1 : 1;
      return teken * (Number(m[2]) * 3600 + Number(m[3] ?? 0) * 60);
    }
  }
  return 0;
}

function idUit(r: Record<string, unknown>): string {
  const meta = r.metadata;
  if (meta && typeof meta === "object") {
    const m = meta as Record<string, unknown>;
    const uit = String(m.id ?? m.uid ?? m.clientRecordId ?? "").trim();
    if (uit) return uit.slice(0, 120);
  }
  return String(r.id ?? r.uid ?? "").trim().slice(0, 120);
}

function kort(v: unknown): string {
  try {
    return JSON.stringify(v).slice(0, 160);
  } catch {
    return String(v).slice(0, 160);
  }
}
