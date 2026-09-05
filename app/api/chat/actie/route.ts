import { NextRequest, NextResponse } from "next/server";
import { getAllRecepten, getRecept, getWeek, saveWeek, getBoodschappen, saveBoodschappen, newId } from "@/lib/data";
import { getIngredienten } from "@/lib/tracker/ingredienten-opslag";
import { berekenReceptPunten } from "@/lib/tracker/recept";
import { schaalComponenten } from "@/lib/tracker/maaltijd";
import { addEntry, getMaaltijden, getFavorieten, geldigeDatum, datumSleutel, nieuwId } from "@/lib/tracker/data";
import { rawPoints } from "@/lib/tracker/points";
import { geldigeWeek, weekVan } from "@/lib/weeksleutel";
import { DAGEN } from "@/lib/types";
import { MAALTIJDEN_TRACKER } from "@/lib/tracker/types";
import type { Entry, Maaltijd } from "@/lib/tracker/types";

export const dynamic = "force-dynamic";

const fout = (bericht: string, status = 400) => NextResponse.json({ error: bericht }, { status });

/**
 * Een voorstel van de chatbot uitvoeren, nadat jij op de knop hebt gedrukt.
 *
 * Alles wordt hier opnieuw nagekeken: bestaat het recept nog, is de dag een
 * echte dag, klopt het eetmoment. Het model heeft het voorstel opgesteld, maar
 * niets van wat het zei wordt op zijn woord geloofd — deze route bouwt de
 * regel zelf op uit gegevens die de app al had.
 *
 * Voedingswaarden komen daarom nooit uit het gesprek. Loggen kan alleen wat de
 * app al kent: een recept, een vaste maaltijd of een favoriet. Een verzonnen
 * kcal-getal komt er langs deze weg niet in.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const soort = String(body?.soort ?? "");
  const gegevens = (body?.gegevens ?? {}) as Record<string, unknown>;

  switch (soort) {
    case "weekmenu": return await planGerecht(gegevens);
    case "boodschap": return await zetOpLijst(gegevens);
    case "logboek": return await logRegel(gegevens);
    default: return fout("Onbekend soort voorstel");
  }
}

/** Een gerecht op een dag van het weekmenu. */
async function planGerecht(g: Record<string, unknown>) {
  const receptId = String(g.receptId ?? "");
  const dag = DAGEN.find((d) => d === String(g.dag ?? ""));
  if (!dag) return fout("Dat is geen dag van de week");

  const recept = await getRecept(receptId);
  if (!recept) return fout("Dat recept staat niet meer in het kookboek");

  const sleutel = geldigeWeek(g.week) ? String(g.week) : weekVan(datumSleutel());
  const staat = await getWeek(sleutel, sleutel === weekVan(datumSleutel()));
  const personen = Number(g.personen) > 0 ? Number(g.personen) : recept.personen;

  await saveWeek(sleutel, {
    ...staat,
    slots: { ...staat.slots, [dag]: { recipeId: recept.id, personen } },
  });

  return NextResponse.json({
    gedaan: `${recept.titel} staat op ${dag.toLowerCase()}`,
    ga_naar: "/?tab=week",
  });
}

/** Eén regel op de boodschappenlijst. */
async function zetOpLijst(g: Record<string, unknown>) {
  const naam = String(g.naam ?? "").trim().slice(0, 80);
  if (!naam) return fout("Zonder naam kan er niets op de lijst");

  const lijst = await getBoodschappen();
  const hoev = Number(g.hoev);
  await saveBoodschappen({
    items: [...lijst.items, {
      id: newId(),
      naam,
      hoev: Number.isFinite(hoev) && hoev > 0 ? hoev : 1,
      eenheid: String(g.eenheid ?? "stuk").trim().slice(0, 20) || "stuk",
      winkel: "", gebied: "", gedaan: false, bron: "hand",
    }],
  });

  return NextResponse.json({ gedaan: `${naam} staat op de boodschappenlijst`, ga_naar: "/?tab=lijst" });
}

/**
 * Iets loggen in de tracker.
 *
 * Bij een recept en een vaste maaltijd gaan de onderdelen mee, zodat de punten
 * de som van de onderdelen zijn en de suikercorrectie per onderdeel blijft
 * gelden — dezelfde regel als overal elders in de app.
 */
async function logRegel(g: Record<string, unknown>) {
  const eetmoment = String(g.eetmoment ?? "");
  if (!MAALTIJDEN_TRACKER.includes(eetmoment as Maaltijd)) return fout("Onbekend eetmoment");
  const maaltijd = eetmoment as Maaltijd;

  const datum = geldigeDatum(g.datum) ? String(g.datum) : datumSleutel();
  const porties = Number(g.porties) > 0 ? Number(g.porties) : 1;
  const id = String(g.id ?? "");

  const entry = await bouw(String(g.bron ?? ""), id, maaltijd, porties);
  if (!entry) return fout("Dat staat niet (meer) in de app; er is niets gelogd");

  await addEntry(datum, entry);
  return NextResponse.json({
    gedaan: `${entry.name} staat in het logboek van ${datum}`,
    ga_naar: `/tracker?datum=${datum}`,
  });
}

async function bouw(
  bron: string, id: string, maaltijd: Maaltijd, porties: number
): Promise<Entry | null> {
  const basis = { id: nieuwId(), ts: Date.now(), meal: maaltijd };

  if (bron === "recept") {
    const [recept, bib] = await Promise.all([getRecept(id), getIngredienten()]);
    if (!recept || recept.ingredienten.length === 0) return null;
    const berekend = berekenReceptPunten(
      recept.ingredienten.map((i) => ({ naam: i.naam, hoev: i.hoev, eenheid: i.eenheid })),
      recept.personen, {}, bib
    );
    const componenten = schaalComponenten(berekend.componenten, porties / berekend.personen);
    return {
      ...basis, source: "recipe", name: recept.titel, ref: recept.id,
      amount: porties, unit: porties === 1 ? "portie" : "porties",
      grams: componenten.reduce((s, c) => s + c.grams, 0),
      nutrients: telOp(componenten),
      points_raw: componenten.reduce((s, c) => s + c.points_raw, 0),
      components: componenten,
    };
  }

  if (bron === "maaltijd") {
    const sjabloon = (await getMaaltijden()).find((m) => m.id === id);
    if (!sjabloon) return null;
    const componenten = schaalComponenten(sjabloon.components, porties);
    return {
      ...basis, source: "meal", name: sjabloon.name, ref: sjabloon.id,
      amount: porties, unit: porties === 1 ? "portie" : "porties",
      grams: componenten.reduce((s, c) => s + c.grams, 0),
      nutrients: telOp(componenten),
      points_raw: componenten.reduce((s, c) => s + c.points_raw, 0),
      components: componenten,
    };
  }

  if (bron === "favoriet") {
    const favoriet = (await getFavorieten()).find((f) => f.id === id);
    if (!favoriet) return null;
    const grams = favoriet.grams * porties;
    const nutrients = schaal(favoriet.nutrients, porties);
    return {
      ...basis, source: "favorite", name: favoriet.name,
      ...(favoriet.brand ? { brand: favoriet.brand } : {}),
      ...(favoriet.ref ? { ref: favoriet.ref } : {}),
      amount: favoriet.amount * porties, unit: favoriet.unit,
      grams, nutrients, points_raw: rawPoints(nutrients, grams),
    };
  }

  return null;
}

function telOp(componenten: { nutrients: Entry["nutrients"] }[]): Entry["nutrients"] {
  return componenten.reduce((t, c) => ({
    ...t,
    kcal: t.kcal + c.nutrients.kcal,
    protein_g: t.protein_g + c.nutrients.protein_g,
    fat_g: t.fat_g + c.nutrients.fat_g,
    satfat_g: t.satfat_g + c.nutrients.satfat_g,
    carbs_g: t.carbs_g + c.nutrients.carbs_g,
    sugar_g: t.sugar_g + c.nutrients.sugar_g,
    fiber_g: t.fiber_g + c.nutrients.fiber_g,
  }), { kcal: 0, protein_g: 0, fat_g: 0, satfat_g: 0, carbs_g: 0, sugar_g: 0, fiber_g: 0 });
}

function schaal(n: Entry["nutrients"], f: number): Entry["nutrients"] {
  return {
    ...n,
    kcal: n.kcal * f, protein_g: n.protein_g * f, fat_g: n.fat_g * f,
    satfat_g: n.satfat_g * f, carbs_g: n.carbs_g * f, sugar_g: n.sugar_g * f,
    fiber_g: n.fiber_g * f,
    ...(n.added_sugar_g != null ? { added_sugar_g: n.added_sugar_g * f } : {}),
  };
}
