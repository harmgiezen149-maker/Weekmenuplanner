// ---------------------------------------------------------------------------
// Het prijsboek.
//
// Wat je op een kassabon hebt betaald wordt onthouden per product en per
// winkel, zodat je boodschappenlijst kan laten zien wat hij ongeveer gaat
// kosten. "Ongeveer" is hier geen slag om de arm maar de kern: prijzen
// veranderen, aanbiedingen bestaan, en een lijst die doet alsof hij op de cent
// klopt is misleidend. Daarom staat er altijd bij hoeveel items géén bekende
// prijs hebben.
//
// De pure functies staan hier; de opslag in Redis staat in lib/prijsboek.ts.
// ---------------------------------------------------------------------------

/** Hoe lang een prijs meetelt. Daarna is hij te oud om nog iets te beloven. */
export const PRIJS_HOUDBAAR_DAGEN = 120;

export interface Prijs {
  /** Prijs voor de genoteerde hoeveelheid, in euro. */
  euro: number;
  aantal: number;
  eenheid: string;
  winkel: string;
  /** Wanneer je dit betaalde, als YYYY-MM-DD. */
  datum: string;
}

/** Per genormaliseerde productnaam de laatst betaalde prijs. */
export type Prijsboek = Record<string, Prijs>;

export const LEEG_PRIJSBOEK: Prijsboek = {};

/**
 * Sleutel voor een productnaam. Merken, verpakkingsaanduidingen en
 * hoeveelheden gaan eraf, zodat "AH Halfvolle melk 1L", "halfvolle melk" en
 * "Melk halfvol" dezelfde regel treffen.
 */
export function prijsSleutel(naam: string): string {
  return String(naam || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // Winkelmerken vooraan zeggen niets over wat het is.
    .replace(/^(ah|albert heijn|jumbo|lidl|g'woon|basic|huismerk)\b\s*/g, "")
    // Verpakkingsaanduidingen: "1l", "500 g", "6 st", "2x200ml".
    .replace(/\b\d+\s*[x×]\s*\d+\s*(g|gr|gram|kg|ml|cl|l|st|stuks?)\b/g, " ")
    .replace(/\b\d+([.,]\d+)?\s*(g|gr|gram|kg|ml|cl|l|st|stuks?)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Neemt een prijs op in het boek. Een nieuwere prijs vervangt een oudere. */
export function metPrijs(boek: Prijsboek, naam: string, prijs: Prijs): Prijsboek {
  const sleutel = prijsSleutel(naam);
  if (!sleutel) return boek;
  const bestaand = boek[sleutel];
  // Alleen vervangen door iets nieuwers: een oude bon nascannen hoort de
  // actuele prijs niet terug te draaien.
  if (bestaand && bestaand.datum > prijs.datum) return boek;
  return { ...boek, [sleutel]: prijs };
}

export function zoekPrijs(boek: Prijsboek, naam: string): Prijs | null {
  const sleutel = prijsSleutel(naam);
  if (!sleutel) return null;
  if (boek[sleutel]) return boek[sleutel];

  // Geen exacte treffer: een regel waarvan de sleutel volledig in de gezochte
  // naam voorkomt telt ook. Wie "melk" kent, herkent "halfvolle melk". Van
  // meerdere treffers wint de langste, want die is het meest specifiek.
  let beste: Prijs | null = null;
  let besteLengte = 0;
  for (const [k, v] of Object.entries(boek)) {
    if (k.length <= besteLengte) continue;
    if (sleutel === k || sleutel.includes(` ${k} `) || sleutel.startsWith(`${k} `) || sleutel.endsWith(` ${k}`)) {
      beste = v;
      besteLengte = k.length;
    }
  }
  return beste;
}

export interface Raming {
  /** Wat de items met een bekende prijs samen kosten. */
  euro: number;
  /** Hoeveel items een bekende prijs hadden. */
  bekend: number;
  /** Hoeveel items niet. Dit getal hoort altijd zichtbaar te zijn. */
  onbekend: number;
  /** Hoeveel prijzen ouder zijn dan PRIJS_HOUDBAAR_DAGEN. */
  verouderd: number;
}

/**
 * Wat de lijst ongeveer gaat kosten.
 *
 * Afgevinkte items tellen mee: je hebt ze in je mandje liggen, dus ze staan op
 * de bon. Wat níét meetelt zijn items zonder bekende prijs — die worden geteld,
 * niet geraden. Een raming die stiekem een gemiddelde invult ziet er
 * nauwkeuriger uit dan hij is.
 */
export function raamLijst(
  boek: Prijsboek,
  items: { naam: string; hoev?: number }[],
  vandaag: string
): Raming {
  let euro = 0;
  let bekend = 0;
  let onbekend = 0;
  let verouderd = 0;

  for (const item of items) {
    const prijs = zoekPrijs(boek, item.naam);
    if (!prijs) { onbekend++; continue; }
    bekend++;
    if (dagenGeleden(prijs.datum, vandaag) > PRIJS_HOUDBAAR_DAGEN) verouderd++;
    // De bewaarde prijs geldt voor de hoeveelheid die op de bon stond. Staat er
    // op de lijst een ander aantal, dan schaalt de prijs mee.
    const factor = item.hoev && item.hoev > 0 && prijs.aantal > 0 ? item.hoev / prijs.aantal : 1;
    euro += prijs.euro * (Number.isFinite(factor) && factor > 0 && factor <= 50 ? factor : 1);
  }

  return { euro: Math.round(euro * 100) / 100, bekend, onbekend, verouderd };
}

function dagenGeleden(datum: string, vandaag: string): number {
  const a = Date.parse(datum + "T00:00:00Z");
  const b = Date.parse(vandaag + "T00:00:00Z");
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86400000);
}

/** Euro's zoals je ze in Nederland schrijft. */
export function euroTekst(bedrag: number): string {
  return "€ " + bedrag.toFixed(2).replace(".", ",");
}
