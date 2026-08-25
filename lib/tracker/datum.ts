// Datumhulpjes zonder afhankelijkheden, zodat ze zowel op de server als in de
// browser bruikbaar zijn (lib/tracker/data.ts trekt de Redis-client mee en kan
// daarom niet vanuit een client-component geïmporteerd worden).

/** YYYY-MM-DD in de lokale tijdzone; toISOString zou in UTC een dag kunnen verspringen. */
export function datumSleutel(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function geldigeDatum(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Hele dagen tussen twee datums. Negatief als `tot` voor `van` ligt. */
export function dagenTussen(van: string, tot: string): number {
  return Math.round(
    (Date.parse(tot + "T00:00:00Z") - Date.parse(van + "T00:00:00Z")) / 86400000
  );
}

/** Datum n dagen verder of terug, als YYYY-MM-DD. */
export function verschuifDatum(datum: string, dagen: number): string {
  const d = new Date(datum + "T12:00:00");
  d.setDate(d.getDate() + dagen);
  return datumSleutel(d);
}

/** Getal met Nederlands decimaalteken; hele getallen zonder komma. */
export function nl(n: number, decimalen = 1): string {
  return n.toLocaleString("nl-NL", { maximumFractionDigits: decimalen });
}

/** Gewicht in kilo, altijd op één decimaal. Houdt een kolom cijfers rustig. */
export function nlKg(n: number): string {
  return n.toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * ISO-weeknummer als `YYYY-Www`. De donderdag bepaalt bij welk jaar een week
 * hoort, zodat een week rond de jaarwisseling niet in tweeën valt.
 */
export function isoWeek(datum: string): string {
  const d = new Date(datum + "T00:00:00Z");
  // Naar de donderdag van dezelfde week: die ligt altijd in het ISO-jaar.
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const jaar = d.getUTCFullYear();

  // 4 januari valt per definitie in week 1; van die week de donderdag pakken.
  const week1 = new Date(Date.UTC(jaar, 0, 4));
  week1.setUTCDate(week1.getUTCDate() - ((week1.getUTCDay() + 6) % 7) + 3);

  const nummer = 1 + Math.round((d.getTime() - week1.getTime()) / (7 * 86400000));
  return `${jaar}-W${String(nummer).padStart(2, "0")}`;
}
