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
