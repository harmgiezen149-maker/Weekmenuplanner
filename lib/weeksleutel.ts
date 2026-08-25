// ---------------------------------------------------------------------------
// Weken aanduiden en er doorheen bladeren.
//
// Het weekmenu was er één: `week:current`, altijd deze week. Wie volgende week
// wilde plannen moest wachten tot die begon. Nu heeft elke week een sleutel in
// ISO-notatie (2026-W35), en dat is dezelfde notatie die de adviesmodule al
// gebruikt voor zijn feitenpakket.
//
// ISO en niet "de week die op zondag begint": een ISO-week is eenduidig, ook
// rond de jaarwisseling, en het weeknummer klopt met wat je agenda zegt.
// ---------------------------------------------------------------------------

const PATROON = /^(\d{4})-W(\d{2})$/;

/** De maandag van de ISO-week waar deze datum in valt, als YYYY-MM-DD. */
export function maandagVan(datum: string): string {
  const d = new Date(datum + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) throw new Error(`ongeldige datum: ${datum}`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** De ISO-week van een datum, als 2026-W35. */
export function weekVan(datum: string): string {
  const d = new Date(datum + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) throw new Error(`ongeldige datum: ${datum}`);
  // Naar de donderdag van dezelfde week: die ligt altijd in het ISO-jaar.
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const jaar = d.getUTCFullYear();

  // 4 januari valt per definitie in week 1; van die week de donderdag pakken.
  const week1 = new Date(Date.UTC(jaar, 0, 4));
  week1.setUTCDate(week1.getUTCDate() - ((week1.getUTCDay() + 6) % 7) + 3);

  const nummer = 1 + Math.round((d.getTime() - week1.getTime()) / (7 * 86400000));
  return `${jaar}-W${String(nummer).padStart(2, "0")}`;
}

export function geldigeWeek(sleutel: unknown): boolean {
  const m = PATROON.exec(String(sleutel ?? ""));
  if (!m) return false;
  const nummer = Number(m[2]);
  // Week 53 bestaat, week 54 niet.
  return nummer >= 1 && nummer <= 53;
}

/** De maandag van een weeksleutel. */
export function maandagVanWeek(sleutel: string): string {
  const m = PATROON.exec(sleutel);
  if (!m) throw new Error(`ongeldige weeksleutel: ${sleutel}`);
  const jaar = Number(m[1]);
  const nummer = Number(m[2]);

  // 4 januari ligt altijd in week 1; vandaar terug naar de maandag en dan
  // vooruit per week.
  const week1 = new Date(Date.UTC(jaar, 0, 4));
  week1.setUTCDate(week1.getUTCDate() - ((week1.getUTCDay() + 6) % 7));
  week1.setUTCDate(week1.getUTCDate() + (nummer - 1) * 7);
  return week1.toISOString().slice(0, 10);
}

/**
 * Een aantal weken vooruit of achteruit.
 *
 * Rekent via de maandag en niet via het weeknummer: 2026-W52 plus één is niet
 * 2026-W53 maar 2027-W01, en sommige jaren hebben er wel 53.
 */
export function verschuifWeek(sleutel: string, weken: number): string {
  const d = new Date(maandagVanWeek(sleutel) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + weken * 7);
  return weekVan(d.toISOString().slice(0, 10));
}

/** De zeven datums van een week, maandag eerst. */
export function datumsVanWeek(sleutel: string): string[] {
  const start = new Date(maandagVanWeek(sleutel) + "T00:00:00Z");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/**
 * Hoe een week op het scherm heet: "deze week", "volgende week", of het
 * weeknummer met de datums erbij. Relatief waar het kan, want "week 35" zegt
 * niemand iets en "deze week" iedereen.
 */
export function weekLabel(sleutel: string, vandaag: string): string {
  const nu = weekVan(vandaag);
  if (sleutel === nu) return "Deze week";
  if (sleutel === verschuifWeek(nu, 1)) return "Volgende week";
  if (sleutel === verschuifWeek(nu, -1)) return "Vorige week";

  const datums = datumsVanWeek(sleutel);
  return `Week ${sleutel.slice(6)} · ${dagMaand(datums[0])} t/m ${dagMaand(datums[6])}`;
}

const MAANDEN = ["jan", "feb", "mrt", "apr", "mei", "jun",
  "jul", "aug", "sep", "okt", "nov", "dec"];

function dagMaand(datum: string): string {
  const [, maand, dag] = datum.split("-");
  return `${Number(dag)} ${MAANDEN[Number(maand) - 1]}`;
}
