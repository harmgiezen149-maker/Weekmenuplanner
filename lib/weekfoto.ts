import { DAGEN } from "./types.ts";

// ---------------------------------------------------------------------------
// Een handgeschreven weekmenu lezen.
//
// Het model krijgt de foto en geeft per dag terug wat er staat. Hier wordt dat
// antwoord defensief uitgepakt: dagen worden teruggebracht tot de zeven die de
// app kent, en wat daar niet bij past valt af.
//
// Een briefje is zelden compleet. Lege dagen zijn dus geen fout maar de
// normale toestand, en ze komen terug als lege regel in plaats van te
// verdwijnen — anders zie je niet dat er nog iets in te vullen valt.
// ---------------------------------------------------------------------------

export interface FotoDag {
  /** Dagnaam zoals de app hem gebruikt: Maandag, Dinsdag, ... */
  dag: string;
  /** Wat er bij die dag stond. Leeg als de dag niet was ingevuld. */
  tekst: string;
}

/** Afkortingen en schrijfwijzen die op een briefje voorkomen. */
const DAGWOORDEN: Record<string, string> = {
  ma: "Maandag", maa: "Maandag", maandag: "Maandag", mon: "Maandag", monday: "Maandag",
  di: "Dinsdag", din: "Dinsdag", dinsdag: "Dinsdag", tue: "Dinsdag", tuesday: "Dinsdag",
  wo: "Woensdag", woe: "Woensdag", woensdag: "Woensdag", wed: "Woensdag", wednesday: "Woensdag",
  do: "Donderdag", don: "Donderdag", donderdag: "Donderdag", thu: "Donderdag", thursday: "Donderdag",
  vr: "Vrijdag", vrij: "Vrijdag", vrijdag: "Vrijdag", fri: "Vrijdag", friday: "Vrijdag",
  za: "Zaterdag", zat: "Zaterdag", zaterdag: "Zaterdag", sat: "Zaterdag", saturday: "Zaterdag",
  zo: "Zondag", zon: "Zondag", zondag: "Zondag", sun: "Zondag", sunday: "Zondag",
};

/** Brengt een geschreven dagaanduiding terug tot een dag die de app kent. */
export function herkenDag(ruw: string): string | null {
  const w = String(ruw ?? "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
  if (!w) return null;
  return DAGWOORDEN[w] ?? null;
}

/**
 * Leest het antwoord van het model.
 *
 * Geeft altijd alle zeven dagen terug, in de volgorde van de week. Een dag die
 * niet op het briefje stond komt terug met een lege tekst: dat is informatie,
 * geen ontbrekende regel.
 */
export function leesWeekfoto(tekst: string): FotoDag[] {
  const data = pakJson(tekst);
  const gevonden = new Map<string, string>();

  const regels = Array.isArray((data as { dagen?: unknown })?.dagen)
    ? (data as { dagen: unknown[] }).dagen
    : Array.isArray(data) ? data : [];

  for (const r of regels) {
    if (!r || typeof r !== "object") continue;
    const rij = r as Record<string, unknown>;
    const dag = herkenDag(String(rij.dag ?? rij.day ?? ""));
    if (!dag) continue;
    const gerecht = String(rij.gerecht ?? rij.tekst ?? rij.dish ?? "").trim();
    // Een dag die twee keer voorkomt: de eerste met inhoud wint. Een tweede
    // lege regel hoort de eerste niet te wissen.
    if (!gevonden.has(dag) || (!gevonden.get(dag) && gerecht)) {
      gevonden.set(dag, gerecht.slice(0, 120));
    }
  }

  return DAGEN.map((dag) => ({ dag, tekst: gevonden.get(dag) ?? "" }));
}

function pakJson(tekst: string): unknown {
  const schoon = String(tekst || "").replace(/```json|```/g, "").trim();
  const start = Math.min(
    ...[schoon.indexOf("{"), schoon.indexOf("[")].filter((i) => i >= 0),
  );
  if (!Number.isFinite(start)) return null;
  const eind = Math.max(schoon.lastIndexOf("}"), schoon.lastIndexOf("]"));
  if (eind <= start) return null;
  try {
    return JSON.parse(schoon.slice(start, eind + 1));
  } catch {
    return null;
  }
}
