// ---------------------------------------------------------------------------
// Een weekmenu voorstellen.
//
// Bewust zonder model. Een weekmenu samenstellen is een keuzeprobleem met
// harde regels — niet twee avonden achter elkaar pasta, doordeweeks niets van
// anderhalf uur — en dat soort regels laten zich beter opschrijven dan
// uitleggen. Het is bovendien meteen klaar, kost niets, werkt zonder
// API-sleutel en is te testen.
//
// Wat het niet is: een dieetplan. Het voorstel kiest uit jouw eigen recepten,
// zegt per dag waarom, en je kunt elke dag zelf overschrijven. Er wordt niets
// aangeraden dat je niet al zelf hebt opgeschreven.
// ---------------------------------------------------------------------------

export interface VoorstelRecept {
  id: string;
  titel: string;
  /** Een van HOOFDINGREDIENTEN: Pasta, Kip, Vis, ... */
  hoofd: string;
  keuken: string;
  /** Bereidingstijd in minuten. */
  tijd: number;
  /** 0 tot 5. */
  score: number;
  /** Hoe vaak dit recept al gegeten is. */
  gegeten: number;
  /** Punten per portie, of null als het recept niet door te rekenen was. */
  punten: number | null;
  /** Geschatte kosten voor het hele recept, of null zonder bekende prijzen. */
  euro: number | null;
}

export interface VoorstelDag {
  /** Dagnaam zoals de app hem gebruikt: Maandag, Dinsdag, ... */
  dag: string;
  recept: VoorstelRecept;
  /** In één zin waarom juist dit recept op deze dag. */
  waarom: string;
  /**
   * Een goedkoper gerecht met hetzelfde hoofdingredient, als dat er is.
   *
   * Alleen bij een verschil dat de moeite waard is. "Bespaar 30 cent" is geen
   * advies maar ruis, en zou de suggestie op elke dag laten verschijnen.
   */
  goedkoper?: { recept: VoorstelRecept; scheelt: number };
}

export interface Voorstel {
  dagen: VoorstelDag[];
  /** Samen, voor zover bekend. */
  totaalEuro: number | null;
  gemiddeldePunten: number | null;
  /** Wat er niet is gelukt, in gewone taal. */
  opmerkingen: string[];
}

export interface VoorstelOpties {
  /** Dagen waarop je doordeweeks kookt en dus weinig tijd hebt. */
  dagen: readonly string[];
  /** Op welke van die dagen mag het langer duren. */
  ruimeDagen?: readonly string[];
  /** Hoeveel minuten "snel" is op een gewone avond. */
  snelMinuten?: number;
  /** Punten per portie waar het gemiddelde omheen mag liggen. */
  puntenDoel?: number | null;
  /** Verandert de keuze zonder de regels te veranderen: de knop "andere week". */
  variatie?: number;
}

const STANDAARD_SNEL = 35;
const STANDAARD_RUIM = ["Zaterdag", "Zondag"];

/**
 * Stelt een week samen.
 *
 * De aanpak is dag voor dag: voor elke dag krijgt elk overgebleven recept een
 * score, en de beste wint. Niet één keer alles doorrekenen en dan de zeven
 * beste pakken — dan krijg je zeven keer hetzelfde soort avondeten, want wat
 * één keer goed scoort scoort altijd goed.
 */
export function steldWeekVoor(
  recepten: VoorstelRecept[], opties: VoorstelOpties
): Voorstel {
  const dagen = opties.dagen;
  const ruim = new Set(opties.ruimeDagen ?? STANDAARD_RUIM);
  const snel = opties.snelMinuten ?? STANDAARD_SNEL;
  const opmerkingen: string[] = [];

  const beschikbaar = [...recepten];
  if (beschikbaar.length === 0) {
    return { dagen: [], totaalEuro: null, gemiddeldePunten: null,
      opmerkingen: ["Er staan nog geen avondrecepten in je kookboek."] };
  }
  if (beschikbaar.length < dagen.length) {
    opmerkingen.push(
      `Je hebt ${beschikbaar.length} ${beschikbaar.length === 1 ? "recept" : "recepten"} en `
      + `${dagen.length} dagen, dus sommige komen twee keer terug.`
    );
  }

  const gekozen: VoorstelDag[] = [];
  const keukenTeller = new Map<string, number>();
  let over = [...beschikbaar];

  for (let i = 0; i < dagen.length; i++) {
    const dag = dagen[i];
    const vorige = gekozen[gekozen.length - 1]?.recept ?? null;
    const magLang = ruim.has(dag);

    // Op is op: zijn alle recepten geweest, dan begint de lijst opnieuw.
    if (over.length === 0) over = [...beschikbaar];

    const gewogen = over.map((r) => ({
      r,
      punt: beoordeel(r, { vorige, magLang, snel, keukenTeller, puntenDoel: opties.puntenDoel }),
    }));

    // De variatie schuift de keuze op zonder de regels aan te tasten: bij
    // gelijke score wint een andere, en dat is precies wat "andere week" moet
    // doen.
    const beste = kiesBeste(gewogen, (opties.variatie ?? 0) + i);
    gekozen.push({
      dag,
      recept: beste.r,
      waarom: leg(beste.r, { vorige, magLang, snel }),
      ...goedkoperDan(beste.r, over, magLang, snel),
    });
    keukenTeller.set(beste.r.keuken, (keukenTeller.get(beste.r.keuken) ?? 0) + 1);
    over = over.filter((r) => r.id !== beste.r.id);
  }

  const metEuro = gekozen.filter((d) => d.recept.euro != null);
  const metPunten = gekozen.filter((d) => d.recept.punten != null);
  if (metEuro.length > 0 && metEuro.length < gekozen.length) {
    opmerkingen.push(
      `Van ${gekozen.length - metEuro.length} van de ${gekozen.length} gerechten is de prijs nog `
      + "onbekend; scan een kassabon om die aan te vullen."
    );
  }

  return {
    dagen: gekozen,
    totaalEuro: metEuro.length > 0
      ? Math.round(metEuro.reduce((s, d) => s + (d.recept.euro ?? 0), 0) * 100) / 100
      : null,
    gemiddeldePunten: metPunten.length > 0
      ? Math.round((metPunten.reduce((s, d) => s + (d.recept.punten ?? 0), 0) / metPunten.length) * 10) / 10
      : null,
    opmerkingen,
  };
}

/** Hoeveel goedkoper het moet zijn voor het het noemen waard is. */
export const MINIMALE_BESPARING = 1.5;

/**
 * Een goedkoper alternatief met hetzelfde hoofdingredient.
 *
 * Hetzelfde hoofdingredient, want anders is het geen alternatief maar een
 * ander gerecht. En het moet ook op die avond passen: een goedkoop recept van
 * anderhalf uur op een woensdag is geen besparing maar een probleem.
 */
function goedkoperDan(
  gekozen: VoorstelRecept, over: VoorstelRecept[], magLang: boolean, snel: number
): { goedkoper?: { recept: VoorstelRecept; scheelt: number } } {
  if (gekozen.euro == null) return {};

  let beste: VoorstelRecept | null = null;
  for (const r of over) {
    if (r.id === gekozen.id || r.euro == null) continue;
    if (r.hoofd !== gekozen.hoofd) continue;
    if (!magLang && r.tijd > snel) continue;
    if (gekozen.euro - r.euro < MINIMALE_BESPARING) continue;
    if (!beste || r.euro < beste.euro!) beste = r;
  }
  if (!beste) return {};
  return {
    goedkoper: { recept: beste, scheelt: Math.round((gekozen.euro - beste.euro!) * 100) / 100 },
  };
}

interface Weegcontext {
  vorige: VoorstelRecept | null;
  magLang: boolean;
  snel: number;
  keukenTeller: Map<string, number>;
  puntenDoel?: number | null;
}

/**
 * Wat een recept op deze dag waard is.
 *
 * De getallen zijn met opzet grof. Fijnafstelling suggereert een
 * nauwkeurigheid die er niet is: het verschil tussen een 71 en een 68 zegt
 * niets over welke avond leuker wordt.
 */
function beoordeel(r: VoorstelRecept, c: Weegcontext): number {
  let punt = 50;

  // Wat je hoog waardeert komt vaker terug. Een recept zonder score telt als
  // gemiddeld, niet als slecht: ongewaardeerd is niet hetzelfde als afgekeurd.
  punt += (r.score > 0 ? r.score - 3 : 0) * 6;

  // Twee avonden achter elkaar hetzelfde hoofdingredient is het enige waar
  // vrijwel iedereen over valt.
  if (c.vorige && c.vorige.hoofd === r.hoofd) punt -= 30;
  if (c.vorige && c.vorige.keuken === r.keuken) punt -= 8;

  // Drie keer Italiaans in een week voelt als geen keuze gemaakt hebben.
  const alGehad = c.keukenTeller.get(r.keuken) ?? 0;
  if (alGehad >= 2) punt -= 12 * (alGehad - 1);

  // Doordeweeks telt de klok.
  if (!c.magLang && r.tijd > c.snel) punt -= Math.min(30, (r.tijd - c.snel) / 2);
  if (c.magLang && r.tijd > c.snel) punt += 5;

  // Een recept dat je al vaak hebt gegeten is bewezen, maar mag de week niet
  // overnemen. Vandaar een kleine plus die snel afvlakt.
  punt += Math.min(6, Math.sqrt(Math.max(0, r.gegeten)) * 2);

  // Ligt er een puntendoel, dan telt de afstand ertoe mee — mild, want een
  // zware avond mag, zolang de week klopt.
  if (c.puntenDoel != null && r.punten != null) {
    punt -= Math.min(15, Math.abs(r.punten - c.puntenDoel) * 1.2);
  }

  return punt;
}

/**
 * Kiest uit de best scorende recepten, met de variatie als draaiknop.
 *
 * Niet altijd de allerhoogste: dan levert "andere week" precies dezelfde week
 * op. Wel altijd uit de top, zodat het voorstel niet willekeurig wordt.
 */
function kiesBeste<T extends { punt: number }>(gewogen: T[], variatie: number): T {
  const gesorteerd = [...gewogen].sort((a, b) => b.punt - a.punt);
  const top = gesorteerd.filter((g) => g.punt >= gesorteerd[0].punt - 6);
  const keuze = top.length > 0 ? top : gesorteerd;
  return keuze[Math.abs(Math.round(variatie)) % keuze.length];
}

function leg(
  r: VoorstelRecept, c: { vorige: VoorstelRecept | null; magLang: boolean; snel: number }
): string {
  if (!c.magLang && r.tijd <= c.snel) return `In ${r.tijd} minuten klaar`;
  if (c.magLang && r.tijd > c.snel) return `Mag wat langer duren: ${r.tijd} minuten`;
  if (r.score >= 4) return `Je gaf dit ${r.score} van de 5`;
  if (c.vorige && c.vorige.hoofd !== r.hoofd) return `Na ${c.vorige.hoofd.toLowerCase()} weer iets anders`;
  if (r.gegeten >= 3) return `Al ${r.gegeten} keer gemaakt`;
  return `${r.keuken}, ${r.tijd} minuten`;
}
