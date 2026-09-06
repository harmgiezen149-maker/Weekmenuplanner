// ---------------------------------------------------------------------------
// Een screenshot van een bewegingsoverzicht (Garmin Connect, Strava, Health
// Connect) omzetten naar dezelfde regels als een geplakte lijst.
//
// Het model doet alleen het aflezen: naam, datum en duur per activiteit. Wat
// daarna met die regels gebeurt — een sport herkennen, een datum lezen, een
// duur uitrekenen — ligt al vast in `leesGeplakteLijst` en blijft daar. Twee
// plekken die elk half hetzelfde controleren lopen op den duur uit elkaar, en
// dan herkent de foto-weg een activiteit die de plakweg wél kent, of omgekeerd.
// ---------------------------------------------------------------------------

/**
 * Leest de activiteiten uit het antwoord van het model en zet ze om in
 * tekst: één regel per activiteit, naam en datum en duur door een tab
 * gescheiden — precies de vorm die `leesGeplakteLijst` al verwerkt.
 *
 * Geen schemagarantie, dus alles wordt gecontroleerd. Een activiteit zonder
 * duur is niets waard (geen sport is aan een lege tijd te herkennen) en valt
 * af; een activiteit zonder datum blijft staan, want `leesGeplakteLijst` vult
 * daar vandaag voor in.
 */
export function leesFotoActiviteiten(tekst: string): string {
  const schoon = tekst.replace(/```json|```/g, "").trim();
  const start = schoon.indexOf("{");
  const eind = schoon.lastIndexOf("}");
  if (start < 0 || eind <= start) return "";

  let data: unknown;
  try {
    data = JSON.parse(schoon.slice(start, eind + 1));
  } catch {
    return "";
  }

  const rauw = (data as { activiteiten?: unknown })?.activiteiten;
  if (!Array.isArray(rauw)) return "";

  return rauw
    .map((a: unknown) => {
      const r = (a ?? {}) as Record<string, unknown>;
      const naam = String(r.naam ?? "").trim().slice(0, 60);
      const datum = String(r.datum ?? "").trim().slice(0, 20);
      const duur = String(r.duur ?? "").trim().slice(0, 20);
      if (!naam || !duur) return "";
      return [naam, datum, duur].filter(Boolean).join("\t");
    })
    .filter((regel) => regel !== "")
    .join("\n");
}
