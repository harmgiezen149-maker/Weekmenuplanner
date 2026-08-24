import { NextRequest, NextResponse } from "next/server";
import { getRecept } from "@/lib/data";
import { berekenReceptPunten, receptVingerafdruk } from "@/lib/tracker/recept";
import {
  addEntry, cacheReceptPunten, entryNaarTemplate, geldigeDatum, getReceptPunten,
  nieuwId, noteerRecent
} from "@/lib/tracker/data";
import { getIngredienten } from "@/lib/tracker/ingredienten-opslag";
import type { ReceptPunten } from "@/lib/tracker/recept";
import type { Entry, Maaltijd } from "@/lib/tracker/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Maaltijdnamen van het kookboek naar die van de tracker.
const MAALTIJD_MAP: Record<string, Maaltijd> = {
  Ontbijt: "ontbijt",
  Lunch: "lunch",
  Avondeten: "diner",
  Toetje: "snack",
};

/**
 * Zet een dagmenu uit de weekplanner in het logboek.
 *
 * Elk gerecht wordt doorgerekend naar punten per portie en als één regel
 * gelogd, met de ingrediënten als onderdelen eronder. De punten zijn de som
 * per ingrediënt, zodat de suikercorrectie per product blijft gelden.
 *
 * Er wordt één portie per gerecht gelogd: het weekmenu zegt voor hoeveel
 * personen er gekookt wordt, niet hoeveel jij ervan eet.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const datum = body?.datum;
  if (!geldigeDatum(datum)) {
    return NextResponse.json({ error: "Ongeldige datum" }, { status: 400 });
  }

  const gerechten = Array.isArray(body?.gerechten) ? body.gerechten : [];
  if (gerechten.length === 0) {
    return NextResponse.json({ error: "Geen gerechten meegegeven" }, { status: 400 });
  }

  // Één keer ophalen voor alle gerechten van de dag.
  const eigen = await getIngredienten();

  const toegevoegd: string[] = [];
  const mislukt: string[] = [];
  let nietHerkend: string[] = [];

  for (const g of gerechten) {
    const id = String(g?.id ?? "");
    const recept = id ? await getRecept(id) : null;
    if (!recept) { mislukt.push(id || "onbekend"); continue; }

    const ingredienten = recept.ingredienten.map((i) => ({
      naam: i.naam, hoev: i.hoev, eenheid: i.eenheid,
    }));
    const hash = receptVingerafdruk(ingredienten, recept.personen, eigen.revisie);

    let punten = await getReceptPunten<ReceptPunten>(id, hash);
    if (!punten) {
      punten = berekenReceptPunten(ingredienten, recept.personen, {}, eigen);
      await cacheReceptPunten(id, hash, punten);
    }

    if (punten.componenten.length === 0) { mislukt.push(recept.titel); continue; }
    nietHerkend = [...nietHerkend, ...punten.nietHerkend];

    // Één portie: de componenten worden door het aantal personen gedeeld.
    const factor = 1 / punten.personen;
    const componenten = punten.componenten.map((c) => ({
      ...c,
      amount: c.amount * factor,
      grams: c.grams * factor,
      points_raw: c.points_raw * factor,
      nutrients: {
        ...c.nutrients,
        kcal: c.nutrients.kcal * factor,
        protein_g: c.nutrients.protein_g * factor,
        fat_g: c.nutrients.fat_g * factor,
        satfat_g: c.nutrients.satfat_g * factor,
        carbs_g: c.nutrients.carbs_g * factor,
        sugar_g: c.nutrients.sugar_g * factor,
        fiber_g: c.nutrients.fiber_g * factor,
      },
    }));

    const totaalPunten = componenten.reduce((s, c) => s + c.points_raw, 0);
    const nutrients = componenten.reduce((n, c) => ({
      kcal: n.kcal + c.nutrients.kcal,
      protein_g: n.protein_g + c.nutrients.protein_g,
      fat_g: n.fat_g + c.nutrients.fat_g,
      satfat_g: n.satfat_g + c.nutrients.satfat_g,
      carbs_g: n.carbs_g + c.nutrients.carbs_g,
      sugar_g: n.sugar_g + c.nutrients.sugar_g,
      fiber_g: n.fiber_g + c.nutrients.fiber_g,
      category: "default" as const,
    }), {
      kcal: 0, protein_g: 0, fat_g: 0, satfat_g: 0,
      carbs_g: 0, sugar_g: 0, fiber_g: 0, category: "default" as const,
    });

    const entry: Entry = {
      id: nieuwId(),
      ts: Date.now(),
      meal: MAALTIJD_MAP[String(g?.maaltijd ?? "")] ?? "diner",
      source: "recipe",
      name: recept.titel,
      amount: 1,
      unit: "portie",
      grams: componenten.reduce((s, c) => s + c.grams, 0),
      nutrients,
      points_raw: totaalPunten,
      ref: recept.id,
      components: componenten,
    };

    await addEntry(datum, entry);
    await noteerRecent(entryNaarTemplate(entry)).catch(() => {});
    toegevoegd.push(recept.titel);
  }

  return NextResponse.json({
    toegevoegd,
    mislukt,
    nietHerkend: [...new Set(nietHerkend)],
  });
}
