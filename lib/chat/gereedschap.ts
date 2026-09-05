import type Anthropic from "@anthropic-ai/sdk";
import { getAllRecepten, getRecept, getWeek, getBoodschappen, getVoorraad } from "../data.ts";
import { getIngredienten } from "../tracker/ingredienten-opslag.ts";
import { berekenReceptPunten } from "../tracker/recept.ts";
import { rawPoints, toonPunten } from "../tracker/points.ts";
import {
  getProfile, getDay, getDays, getWegingen, getMaaltijden, getFavorieten,
  laadFeiten, geldigeDatum,
} from "../tracker/data.ts";
import { vatWeekSamen, weekDatums, dagenTeGaan } from "../tracker/week.ts";
import { metTrend } from "../tracker/gewicht.ts";
import { dagBewegingspunten } from "../tracker/activiteit.ts";
import { zoekBasisproducten } from "../tracker/basisproducten.ts";
import { offZoek } from "../tracker/off.ts";
import { datumSleutel } from "../tracker/datum.ts";
import { weekVan, geldigeWeek, datumsVanWeek } from "../weeksleutel.ts";
import { DAGEN } from "../types.ts";
import type { IngredientBibliotheek } from "../tracker/ingredienten";
import type { Recept } from "../types";
import {
  voorstelWeekmenu, voorstelBoodschap, voorstelLogboek,
} from "./voorstellen.ts";
import type { Uitkomst } from "./voorstellen.ts";

// ---------------------------------------------------------------------------
// Wat de chatbot mag opzoeken.
//
// De bot krijgt geen dump van de hele database mee, maar gereedschap om te
// halen wat een vraag nodig heeft. Twee redenen: het hele kookboek plus twaalf
// weken logboek past niet zinnig in één bericht, en zo staat hier op één plek
// wat de bot wél en niet kan zien.
//
// Alles hier is lezen. De drie voorstellen aan het eind schrijven ook niets:
// die zetten alleen een kaartje klaar dat jij bevestigt — zie
// app/api/chat/actie/route.ts, waar het echte werk gebeurt en de gegevens
// opnieuw worden nagekeken. Wat het model terugstuurt is nooit meer dan een
// aanvraag.
// ---------------------------------------------------------------------------

export type { Voorstel, Uitkomst } from "./voorstellen.ts";

const RECEPTEN_MAX = 40;

export const GEREEDSCHAP: Anthropic.Tool[] = [
  {
    name: "recepten_zoeken",
    description:
      "Zoekt in het kookboek. Geeft per recept de titel, het id, de maaltijd, het "
      + "hoofdingrediënt, de bereidingstijd, het aantal personen, de waardering, hoe vaak "
      + "het gegeten is en de punten per portie. Zonder zoekterm krijg je het hele "
      + "kookboek (tot 40 recepten). Gebruik dit ook om te tellen: hoeveel vegetarische "
      + "recepten, wat is het lichtste gerecht, wat heb je lang niet gegeten.",
    input_schema: {
      type: "object",
      properties: {
        zoekterm: { type: "string", description: "Woord in de titel of in een ingrediënt." },
        maaltijd: { type: "string", description: "Ontbijt, Lunch, Avondeten of Toetje." },
        hoofd: { type: "string", description: "Vis, Vlees, Kip, Vegetarisch, Vegan, Pasta, Rijst of Soep." },
        max_punten: { type: "number", description: "Hoogste aantal punten per portie." },
        max_tijd: { type: "number", description: "Hoogste bereidingstijd in minuten." },
      },
    },
  },
  {
    name: "recept_details",
    description:
      "Het volledige recept: ingrediënten met hoeveelheden, bereiding, en de punten per "
      + "portie met de bijdrage per ingrediënt. Gebruik het id uit recepten_zoeken.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "weekmenu",
    description:
      "De weekplanning: welk gerecht op welke dag staat, voor hoeveel personen, met de "
      + "punten per portie erbij. Zonder week krijg je de huidige week.",
    input_schema: {
      type: "object",
      properties: {
        week: { type: "string", description: "Weeksleutel als 2026-W36. Leeg = deze week." },
      },
    },
  },
  {
    name: "boodschappenlijst",
    description: "Wat er op de boodschappenlijst staat, per winkel, inclusief wat al afgevinkt is.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "voorraad",
    description:
      "De voorraadlijst met terugkerende artikelen: hoeveel er nog is en bij welk aantal "
      + "het op de boodschappenlijst hoort.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "dag_logboek",
    description:
      "Wat er op één dag gelogd is: alle regels met punten en calorieën, de dagtotalen, "
      + "de beweging en het budget van die dag.",
    input_schema: {
      type: "object",
      properties: { datum: { type: "string", description: "JJJJ-MM-DD. Leeg = vandaag." } },
    },
  },
  {
    name: "tracker_week",
    description:
      "De weeksamenvatting van de tracker: punten per dag, het weekbudget, het "
      + "bufferverbruik en hoeveel dagen de week nog telt.",
    input_schema: {
      type: "object",
      properties: { datum: { type: "string", description: "Een datum in die week. Leeg = deze week." } },
    },
  },
  {
    name: "feitenpakket",
    description:
      "Het feitenpakket van de adviesmodule: twaalf weken aan patronen. Gemiddelden per "
      + "weekdag, verdeling over de maaltijden, wat de meeste punten kost, beweging, "
      + "gewichtstrend en lichaamssamenstelling. Dit is de bron voor elke vraag over "
      + "patronen, trends of 'hoe gaat het'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "gewicht",
    description:
      "De weeglijst: datum, gewicht, de trendlijn en waar aanwezig vetpercentage, "
      + "spiermassa, vochtgehalte en BMI.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "profiel",
    description:
      "Het profiel: dagbudget, weekbuffer, eiwitdoel, streefgewicht, weegdag, lengte en "
      + "de schaal waarop de punten getoond worden.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "product_opzoeken",
    description:
      "Zoekt een product op naam in de eigen basislijst en in Open Food Facts, met de "
      + "voedingswaarden per 100 en de punten. Voor vragen als 'hoeveel punten is een "
      + "handje noten'. Gaat over losse producten, niet over recepten.",
    input_schema: {
      type: "object",
      properties: { naam: { type: "string" } },
      required: ["naam"],
    },
  },
  {
    name: "vaste_maaltijden",
    description:
      "De vaste maaltijden en de favorieten uit de tracker, met hun onderdelen en punten. "
      + "Nodig om een van die twee voor te stellen om te loggen.",
    input_schema: { type: "object", properties: {} },
  },

  // --- Voorstellen. Deze schrijven niets. -----------------------------------
  {
    name: "voorstel_weekmenu",
    description:
      "Zet een voorstel klaar om een gerecht op een dag van het weekmenu te plannen. Er "
      + "verandert niets tot de gebruiker het kaartje bevestigt. Gebruik een recept-id uit "
      + "recepten_zoeken en een dagnaam (Maandag tot en met Zondag).",
    input_schema: {
      type: "object",
      properties: {
        recept_id: { type: "string" },
        dag: { type: "string", description: "Maandag, Dinsdag, ... Zondag." },
        week: { type: "string", description: "Weeksleutel als 2026-W36. Leeg = deze week." },
        personen: { type: "number" },
      },
      required: ["recept_id", "dag"],
    },
  },
  {
    name: "voorstel_boodschap",
    description:
      "Zet een voorstel klaar om iets op de boodschappenlijst te zetten. Er verandert niets "
      + "tot de gebruiker bevestigt.",
    input_schema: {
      type: "object",
      properties: {
        naam: { type: "string" },
        hoeveelheid: { type: "number" },
        eenheid: { type: "string", description: "g, ml, stuk, pak — leeg mag ook." },
      },
      required: ["naam"],
    },
  },
  {
    name: "voorstel_logboek",
    description:
      "Zet een voorstel klaar om iets te loggen in de tracker. Alleen dingen die de app al "
      + "kent: een recept uit het kookboek, een vaste maaltijd of een favoriet. Geef precies "
      + "één van recept_id, maaltijd_id of favoriet_id mee. Er verandert niets tot de "
      + "gebruiker bevestigt. Verzin nooit zelf voedingswaarden.",
    input_schema: {
      type: "object",
      properties: {
        recept_id: { type: "string" },
        maaltijd_id: { type: "string" },
        favoriet_id: { type: "string" },
        eetmoment: { type: "string", description: "ontbijt, lunch, diner of snack." },
        datum: { type: "string", description: "JJJJ-MM-DD. Leeg = vandaag." },
        porties: { type: "number", description: "Aantal porties, standaard 1." },
      },
      required: ["eetmoment"],
    },
  },
];

/**
 * Voert één gereedschap uit.
 *
 * Onbekende namen en onbruikbare invoer leveren een foutmelding op in plaats van
 * een uitzondering: het model mag zich vergissen, en dan is "dat recept bestaat
 * niet" een bruikbaarder antwoord dan een gesprek dat afbreekt.
 */
export async function voerUit(naam: string, invoer: Record<string, unknown>): Promise<Uitkomst> {
  switch (naam) {
    case "recepten_zoeken": return { resultaat: await zoekRecepten(invoer) };
    case "recept_details": return { resultaat: await receptDetails(tekst(invoer.id)) };
    case "weekmenu": return { resultaat: await weekmenu(tekst(invoer.week)) };
    case "boodschappenlijst": return { resultaat: await boodschappen() };
    case "voorraad": return { resultaat: await voorraadlijst() };
    case "dag_logboek": return { resultaat: await dagLogboek(tekst(invoer.datum)) };
    case "tracker_week": return { resultaat: await trackerWeek(tekst(invoer.datum)) };
    case "feitenpakket": return { resultaat: await feiten() };
    case "gewicht": return { resultaat: await gewicht() };
    case "profiel": return { resultaat: await profiel() };
    case "product_opzoeken": return { resultaat: await productOpzoeken(tekst(invoer.naam)) };
    case "vaste_maaltijden": return { resultaat: await vasteMaaltijden() };
    case "voorstel_weekmenu": return voorstelWeekmenu(invoer);
    case "voorstel_boodschap": return voorstelBoodschap(invoer);
    case "voorstel_logboek": return voorstelLogboek(invoer);
    default: return { resultaat: { fout: `Onbekend gereedschap: ${naam}` } };
  }
}

// --- lezen ------------------------------------------------------------------

async function zoekRecepten(invoer: Record<string, unknown>) {
  const [recepten, bib, prof] = await Promise.all([
    getAllRecepten(), getIngredienten(), getProfile(),
  ]);
  const schaal = prof?.points_scale ?? 1;

  const zoekterm = tekst(invoer.zoekterm).toLowerCase();
  const maaltijd = tekst(invoer.maaltijd).toLowerCase();
  const hoofd = tekst(invoer.hoofd).toLowerCase();
  const maxPunten = getal(invoer.max_punten);
  const maxTijd = getal(invoer.max_tijd);

  const rijen = recepten
    .filter((r) => !maaltijd || r.maaltijd.toLowerCase() === maaltijd)
    .filter((r) => !hoofd || r.hoofd.toLowerCase() === hoofd)
    .filter((r) => !maxTijd || r.tijd <= maxTijd)
    .filter((r) => !zoekterm || past(r, zoekterm))
    .map((r) => ({ ...kort(r, bib, schaal) }))
    .filter((r) => maxPunten == null || (r.punten != null && r.punten <= maxPunten));

  return {
    aantal_gevonden: rijen.length,
    aantal_in_kookboek: recepten.length,
    recepten: rijen.slice(0, RECEPTEN_MAX),
    ...(rijen.length > RECEPTEN_MAX
      ? { let_op: `Alleen de eerste ${RECEPTEN_MAX} staan hier; verfijn de zoekterm voor de rest.` }
      : {}),
  };
}

function past(r: Recept, term: string): boolean {
  if (r.titel.toLowerCase().includes(term)) return true;
  return r.ingredienten.some((i) => i.naam.toLowerCase().includes(term));
}

function kort(r: Recept, bib: IngredientBibliotheek, schaal: number) {
  const berekend = punten(r, bib);
  return {
    id: r.id,
    titel: r.titel,
    maaltijd: r.maaltijd,
    hoofd: r.hoofd,
    keuken: r.keuken,
    tijd_minuten: r.tijd,
    personen: r.personen,
    waardering: r.score,
    keer_gegeten: r.gegeten,
    punten: berekend ? toonPunten(berekend.punten, schaal) : null,
    ...(berekend && berekend.nietHerkend.length > 0
      ? { punten_onvolledig: `${berekend.nietHerkend.length} ingrediënten tellen nog niet mee` }
      : {}),
  };
}

function punten(r: Recept, bib: IngredientBibliotheek) {
  if (r.ingredienten.length === 0) return null;
  const berekend = berekenReceptPunten(
    r.ingredienten.map((i) => ({ naam: i.naam, hoev: i.hoev, eenheid: i.eenheid })),
    r.personen, {}, bib
  );
  return { punten: berekend.perPortiePunten, nietHerkend: berekend.nietHerkend };
}

async function receptDetails(id: string) {
  const [recept, bib, prof] = await Promise.all([getRecept(id), getIngredienten(), getProfile()]);
  if (!recept) return { fout: "Geen recept met dit id. Zoek eerst met recepten_zoeken." };

  const berekend = recept.ingredienten.length > 0
    ? berekenReceptPunten(
        recept.ingredienten.map((i) => ({ naam: i.naam, hoev: i.hoev, eenheid: i.eenheid })),
        recept.personen, {}, bib
      )
    : null;
  const schaal = prof?.points_scale ?? 1;

  return {
    ...kort(recept, bib, schaal),
    ingredienten: recept.ingredienten.map((i) => ({
      naam: i.naam, hoeveelheid: i.hoev, eenheid: i.eenheid, winkel: i.winkel || null,
    })),
    bereiding: recept.bereiding || null,
    ...(berekend
      ? {
          per_portie: {
            kcal: Math.round(berekend.perPortieNutrients.kcal),
            eiwit_g: rond(berekend.perPortieNutrients.protein_g),
            verzadigd_vet_g: rond(berekend.perPortieNutrients.satfat_g),
            vezels_g: rond(berekend.perPortieNutrients.fiber_g),
          },
          telt_niet_mee: berekend.nietHerkend,
          maat_onleesbaar: berekend.maatOnbekend,
        }
      : {}),
  };
}

async function weekmenu(gevraagd: string) {
  const sleutel = geldigeWeek(gevraagd) ? gevraagd : weekVan(datumSleutel());
  const [staat, recepten, bib, prof] = await Promise.all([
    getWeek(sleutel, sleutel === weekVan(datumSleutel())),
    getAllRecepten(), getIngredienten(), getProfile(),
  ]);
  const schaal = prof?.points_scale ?? 1;
  const opId = new Map(recepten.map((r) => [r.id, r]));
  const datums = datumsVanWeek(sleutel);

  return {
    week: sleutel,
    dagen: DAGEN.map((dag, n) => {
      const slot = staat.slots[dag];
      const recept = slot ? opId.get(slot.recipeId) : undefined;
      return {
        dag,
        datum: datums[(n + staat.startDag) % 7] ?? null,
        gerecht: recept ? kort(recept, bib, schaal) : null,
        personen: slot?.personen ?? null,
      };
    }),
    lege_dagen: DAGEN.filter((d) => !staat.slots[d]),
  };
}

async function boodschappen() {
  const lijst = await getBoodschappen();
  return {
    aantal: lijst.items.length,
    nog_te_doen: lijst.items.filter((i) => !i.gedaan).length,
    items: lijst.items.map((i) => ({
      naam: i.naam, hoeveelheid: i.hoev, eenheid: i.eenheid,
      winkel: i.winkel || null, afdeling: i.gebied || null,
      gedaan: i.gedaan, herkomst: i.bron,
    })),
  };
}

async function voorraadlijst() {
  const v = await getVoorraad();
  return {
    items: v.items.map((i) => ({
      naam: i.naam, aantal: i.aantal ?? null, eenheid: i.eenheid ?? null,
      drempel: i.drempel ?? null, winkel: i.winkel || null,
      moet_bij: i.aantal != null && i.drempel != null && i.aantal <= i.drempel,
    })),
  };
}

async function dagLogboek(gevraagd: string) {
  const datum = geldigeDatum(gevraagd) ? gevraagd : datumSleutel();
  const [dag, prof] = await Promise.all([getDay(datum), getProfile()]);
  const schaal = prof?.points_scale ?? 1;
  const beweging = dagBewegingspunten(dag.activity);

  return {
    datum,
    punten_gebruikt: toonPunten(dag.totals.points_raw, schaal),
    dagbudget: prof?.daily_budget ?? null,
    verruimd_met_beweging: toonPunten(beweging.meetellend, 1),
    regels: dag.entries.map((e) => ({
      naam: e.name, merk: e.brand ?? null, eetmoment: e.meal,
      hoeveelheid: `${e.amount} ${e.unit}`.trim(),
      punten: toonPunten(e.points_raw, schaal),
      kcal: Math.round(e.nutrients.kcal),
      onderdelen: e.components?.map((c) => c.name) ?? null,
    })),
    beweging: dag.activity.map((a) => ({ soort: a.name, minuten: a.minutes, punten: a.points })),
    totalen: {
      kcal: Math.round(dag.totals.kcal),
      eiwit_g: rond(dag.totals.protein_g),
      verzadigd_vet_g: rond(dag.totals.satfat_g),
      vezels_g: rond(dag.totals.fiber_g),
      suiker_g: rond(dag.totals.sugar_g),
    },
  };
}

async function trackerWeek(gevraagd: string) {
  const peildatum = geldigeDatum(gevraagd) ? gevraagd : datumSleutel();
  const prof = await getProfile();
  if (!prof) return { fout: "Er is nog geen profiel; de tracker is nog niet ingericht." };

  const datums = weekDatums(peildatum, prof.weigh_day);
  const dagen = await getDays(datums);
  return {
    week: vatWeekSamen(dagen, prof, peildatum),
    dagen_te_gaan: dagenTeGaan(peildatum, prof.weigh_day),
  };
}

async function feiten() {
  const { pakket } = await laadFeiten(datumSleutel());
  if (!pakket) {
    return { fout: "Er is nog te weinig gelogd voor een feitenpakket." };
  }
  return pakket;
}

async function gewicht() {
  const [wegingen, prof] = await Promise.all([getWegingen(), getProfile()]);
  const metingen = metTrend(wegingen);
  return {
    aantal: metingen.length,
    laatste_15: metingen.slice(-15),
    streefgewicht: prof?.goal_weight_kg ?? null,
    startgewicht: prof?.start_weight_kg ?? null,
  };
}

async function profiel() {
  const p = await getProfile();
  if (!p) return { fout: "Er is nog geen profiel ingevuld." };
  return {
    naam: p.name, dagbudget: p.daily_budget, weekbuffer: p.weekly_buffer,
    eiwitdoel_g: p.protein_target_g, streefgewicht_kg: p.goal_weight_kg,
    huidig_gewicht_kg: p.current_weight_kg, startgewicht_kg: p.start_weight_kg,
    lengte_cm: p.height_cm, weegdag: p.weigh_day, puntenschaal: p.points_scale,
  };
}

async function productOpzoeken(naam: string) {
  const q = naam.trim();
  if (q.length < 2) return { fout: "Geef een productnaam van minstens twee letters." };

  const basis = zoekBasisproducten(q);
  let extern: Awaited<ReturnType<typeof offZoek>> = [];
  try { extern = await offZoek(q); } catch { /* de eigen lijst blijft bruikbaar */ }

  const prof = await getProfile();
  const schaal = prof?.points_scale ?? 1;
  return {
    resultaten: [...basis, ...extern].slice(0, 8).map((p) => ({
      naam: p.name, merk: p.brand ?? null, bron: p.bron, eenheid: p.eenheid,
      per_100: {
        kcal: Math.round(p.per100.kcal), eiwit_g: rond(p.per100.protein_g),
        verzadigd_vet_g: rond(p.per100.satfat_g), suiker_g: rond(p.per100.sugar_g),
        vezels_g: rond(p.per100.fiber_g),
      },
      punten_per_100: toonPunten(rawPoints(p.per100, 100), schaal),
      standaardportie: p.portie ? `${p.portie.label} (${p.portie.grams} ${p.eenheid})` : null,
    })),
  };
}

async function vasteMaaltijden() {
  const [maaltijden, favorieten, prof] = await Promise.all([
    getMaaltijden(), getFavorieten(), getProfile(),
  ]);
  const schaal = prof?.points_scale ?? 1;
  return {
    vaste_maaltijden: maaltijden.map((m) => ({
      id: m.id, naam: m.name, hoort_bij: m.meal,
      onderdelen: m.components.map((c) => `${c.name} ${c.amount} ${c.unit}`),
      punten: toonPunten(m.components.reduce((s, c) => s + c.points_raw, 0), schaal),
    })),
    favorieten: favorieten.map((f) => ({
      id: f.id, naam: f.name, hoeveelheid: `${f.amount} ${f.unit}`.trim(),
      punten: toonPunten(f.points_raw, schaal),
    })),
  };
}

// --- hulpjes ----------------------------------------------------------------

function tekst(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function getal(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function rond(n: number): number {
  return Math.round(n * 10) / 10;
}
