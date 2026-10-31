// ---------------------------------------------------------------------------
// Wat Claude in het kookboek mag (Harm, 2026-10-31): lezen, plannen en recepten
// toevoegen. Niets verwijderen, en niet aan de tracker (gewicht en eten zijn
// persoonlijk en blijven hierbuiten).
//
// Lezen: recepten zoeken en lezen, het weekmenu, de boodschappenlijst en de
// voorraad. Veranderen: een recept op een dag van het weekmenu zetten, iets op
// de boodschappenlijst zetten, een recept toevoegen. In het AI-dorp gebeurt
// elke verandering pas nadat Harm op "Goedkeuren" heeft gedrukt.
//
// De gegevenslaag komt van buiten (zie `maakKookboekGereedschap`), zodat de
// tests met een nep-opslag kunnen draaien en de route met de echte.
// ---------------------------------------------------------------------------

import { McpFout, type McpGereedschap } from "./mcp.ts";
import {
  DAGEN, HOOFDINGREDIENTEN, KEUKENS, MAALTIJDEN, MOEILIJKHEDEN, WINKELS,
  type BoodschapItem, type Boodschappen, type Recept, type Voorraad, type WeekState,
} from "./types.ts";
import { datumsVanWeek, geldigeWeek, weekVan } from "./weeksleutel.ts";

export interface KookboekOpslag {
  getAllRecepten(): Promise<Recept[]>;
  getRecept(id: string): Promise<Recept | null>;
  saveRecept(r: Recept): Promise<Recept>;
  getWeek(sleutel: string, huidig?: boolean): Promise<WeekState>;
  saveWeek(sleutel: string, w: WeekState): Promise<WeekState>;
  getBoodschappen(): Promise<Boodschappen>;
  saveBoodschappen(b: Boodschappen): Promise<Boodschappen>;
  getVoorraad(): Promise<Voorraad>;
  newId(): string;
  /** Vandaag als YYYY-MM-DD (Nederlandse tijd). */
  vandaag(): string;
}

const STANDAARD_MAALTIJD = "Avondeten";

function tekst(v: unknown, max = 200): string {
  return String(v ?? "").trim().slice(0, max);
}
function getal(v: unknown, standaard: number, min: number, max: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : standaard;
}
function uitLijst<T extends readonly string[]>(v: unknown, lijst: T, standaard: T[number]): T[number] {
  const s = tekst(v).toLowerCase();
  return lijst.find((x) => x.toLowerCase() === s) ?? standaard;
}
function kort(r: Recept) {
  return { id: r.id, titel: r.titel, keuken: r.keuken, hoofd: r.hoofd, maaltijd: r.maaltijd, moeilijkheid: r.moeilijkheid,
    tijd: r.tijd, score: r.score, personen: r.personen, gegeten: r.gegeten };
}
function zonderFoto(r: Recept) {
  const { afbeelding, ...rest } = r;
  return { ...rest, heeftFoto: !!afbeelding };
}
/** Oude weekmenu's hadden alleen de dag als sleutel; de app leest die als avondeten. */
function slotSleutel(k: string): string {
  return k.includes("|") ? k : `${k}|${STANDAARD_MAALTIJD}`;
}

export function maakKookboekGereedschap(db: KookboekOpslag): McpGereedschap[] {
  const welkeWeek = (v: unknown) => {
    const nu = weekVan(db.vandaag());
    const s = tekst(v, 10);
    return { sleutel: geldigeWeek(s) ? s : nu, huidig: !geldigeWeek(s) || s === nu };
  };

  return [
    {
      name: "search_recipes", title: "Recepten zoeken", alleenLezen: true,
      description: "Search the household's recipes. All filters are optional. Returns a short list (id, title, cuisine, main ingredient, meal, difficulty, minutes, score 0-5, servings, times eaten).",
      inputSchema: { type: "object", properties: {
        query: { type: "string", description: "words in the title or an ingredient" },
        cuisine: { type: "string", enum: [...KEUKENS] },
        main: { type: "string", enum: [...HOOFDINGREDIENTEN] },
        meal: { type: "string", enum: [...MAALTIJDEN] },
        maxMinutes: { type: "number" },
        limit: { type: "number", description: "max results, default 25" },
      } },
      run: async (a) => {
        const q = tekst(a.query).toLowerCase();
        const lijst = (await db.getAllRecepten()).filter((r) =>
          (!q || r.titel.toLowerCase().includes(q) || r.ingredienten.some((i) => i.naam.toLowerCase().includes(q)))
          && (!a.cuisine || r.keuken === a.cuisine)
          && (!a.main || r.hoofd === a.main)
          && (!a.meal || r.maaltijd === a.meal)
          && (!a.maxMinutes || r.tijd <= Number(a.maxMinutes)));
        return { aantal: lijst.length, recepten: lijst.slice(0, getal(a.limit, 25, 1, 100)).map(kort) };
      },
    },
    {
      name: "get_recipe", title: "Recept lezen", alleenLezen: true,
      description: "Read one recipe in full: ingredients (name, amount, unit) and preparation.",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      run: async (a) => {
        const r = await db.getRecept(tekst(a.id, 80));
        if (!r) throw new McpFout("Dat recept bestaat niet (meer).");
        return zonderFoto(r);
      },
    },
    {
      name: "get_week_menu", title: "Weekmenu lezen", alleenLezen: true,
      description: "Read the week menu. week is an ISO week like 2026-W45; leave it out for this week. Returns each planned day with date, meal, recipe and servings.",
      inputSchema: { type: "object", properties: { week: { type: "string", description: "ISO week, e.g. 2026-W45" } } },
      run: async (a) => {
        const { sleutel, huidig } = welkeWeek(a.week);
        const w = await db.getWeek(sleutel, huidig);
        const datums = datumsVanWeek(sleutel);
        const recepten = new Map((await db.getAllRecepten()).map((r) => [r.id, r]));
        const dagen = Object.entries(w.slots || {}).map(([k, slot]) => {
          const [dag, maaltijd] = slotSleutel(k).split("|");
          const i = DAGEN.indexOf(dag as (typeof DAGEN)[number]);
          return { dag, datum: i >= 0 ? datums[i] : "", maaltijd, receptId: slot.recipeId, titel: recepten.get(slot.recipeId)?.titel ?? "(recept bestaat niet meer)", personen: slot.personen };
        }).sort((x, y) => x.datum.localeCompare(y.datum) || x.maaltijd.localeCompare(y.maaltijd));
        return { week: sleutel, vandaag: db.vandaag(), dagen, legeDagen: DAGEN.filter((d) => !dagen.some((x) => x.dag === d)) };
      },
    },
    {
      name: "get_shopping_list", title: "Boodschappenlijst lezen", alleenLezen: true,
      description: "Read the shopping list: name, amount, unit, store, and whether it's already ticked off.",
      inputSchema: { type: "object", properties: {} },
      run: async () => {
        const b = await db.getBoodschappen();
        return { items: b.items.map((i) => ({ naam: i.naam, hoev: i.hoev, eenheid: i.eenheid, winkel: i.winkel, gedaan: i.gedaan })) };
      },
    },
    {
      name: "get_pantry", title: "Voorraad lezen", alleenLezen: true,
      description: "Read the pantry: household items, how many are left and when they go on the shopping list.",
      inputSchema: { type: "object", properties: {} },
      run: async () => {
        const v = await db.getVoorraad();
        return { items: v.items.map((i) => ({ naam: i.naam, aantal: i.aantal ?? null, eenheid: i.eenheid ?? "", drempel: i.drempel ?? null, winkel: i.winkel })) };
      },
    },
    {
      name: "plan_recipe", title: "Recept inplannen", alleenLezen: false,
      description: "Put a recipe on a day of the week menu. day is a Dutch day name (Maandag..Zondag). Refuses to overwrite a planned meal unless replace is true. Does not change the shopping list (the app builds that from the menu when asked).",
      inputSchema: { type: "object", properties: {
        recipeId: { type: "string" },
        day: { type: "string", enum: [...DAGEN] },
        week: { type: "string", description: "ISO week, e.g. 2026-W45; leave out for this week" },
        meal: { type: "string", enum: [...MAALTIJDEN], description: "default Avondeten" },
        servings: { type: "number" },
        replace: { type: "boolean" },
      }, required: ["recipeId", "day"] },
      run: async (a) => {
        const r = await db.getRecept(tekst(a.recipeId, 80));
        if (!r) throw new McpFout("Dat recept bestaat niet (meer).");
        const dag = uitLijst(a.day, DAGEN, DAGEN[0]);
        if (tekst(a.day).toLowerCase() !== dag.toLowerCase()) throw new McpFout("Geef de dag als Maandag, Dinsdag, … Zondag.");
        const maaltijd = uitLijst(a.meal, MAALTIJDEN, STANDAARD_MAALTIJD);
        const { sleutel, huidig } = welkeWeek(a.week);
        const w = await db.getWeek(sleutel, huidig);
        const slots: WeekState["slots"] = {};
        for (const [k, v] of Object.entries(w.slots || {})) slots[slotSleutel(k)] = v;
        const plek = `${dag}|${maaltijd}`;
        if (slots[plek] && !a.replace) {
          const al = await db.getRecept(slots[plek].recipeId);
          throw new McpFout(`Op ${dag} (${maaltijd}) staat al "${al?.titel ?? "een recept"}". Vraag of het vervangen mag (replace: true).`);
        }
        slots[plek] = { recipeId: r.id, personen: getal(a.servings, r.personen || 4, 1, 30) };
        await db.saveWeek(sleutel, { startDag: w.startDag ?? 0, slots });
        return { gedaan: true, week: sleutel, dag, maaltijd, recept: r.titel, personen: slots[plek].personen };
      },
    },
    {
      name: "add_to_shopping_list", title: "Op de boodschappenlijst zetten", alleenLezen: false,
      description: "Add items to the shopping list (added as hand-written items). store is one of Lidl, Jumbo, AH, Anders, or leave it out.",
      inputSchema: { type: "object", properties: {
        items: { type: "array", maxItems: 40, items: { type: "object", properties: {
          name: { type: "string" }, amount: { type: "number" }, unit: { type: "string" }, store: { type: "string", enum: [...WINKELS] },
        }, required: ["name"] } },
      }, required: ["items"] },
      run: async (a) => {
        const nieuw: BoodschapItem[] = (Array.isArray(a.items) ? a.items : []).slice(0, 40)
          .map((i: Record<string, unknown>) => ({
            id: db.newId(), naam: tekst(i?.name, 80), hoev: getal(i?.amount, 1, 0, 10000), eenheid: tekst(i?.unit, 20),
            winkel: i?.store ? uitLijst(i.store, WINKELS, "Anders") : "", gebied: "", gedaan: false, bron: "hand" as const,
          }))
          .filter((i) => i.naam);
        if (!nieuw.length) throw new McpFout("Geen artikelen om toe te voegen.");
        const b = await db.getBoodschappen();
        await db.saveBoodschappen({ items: [...b.items, ...nieuw] });
        return { gedaan: true, toegevoegd: nieuw.map((i) => `${i.hoev} ${i.eenheid} ${i.naam}`.replace(/\s+/g, " ").trim()) };
      },
    },
    {
      name: "add_recipe", title: "Recept toevoegen", alleenLezen: false,
      description: "Add a new recipe to the cookbook (without a photo). Use the listed values for cuisine, main, meal and difficulty.",
      inputSchema: { type: "object", properties: {
        title: { type: "string" },
        cuisine: { type: "string", enum: [...KEUKENS] },
        main: { type: "string", enum: [...HOOFDINGREDIENTEN] },
        meal: { type: "string", enum: [...MAALTIJDEN] },
        difficulty: { type: "string", enum: [...MOEILIJKHEDEN] },
        minutes: { type: "number" },
        servings: { type: "number" },
        ingredients: { type: "array", items: { type: "object", properties: { name: { type: "string" }, amount: { type: "number" }, unit: { type: "string" } }, required: ["name"] } },
        preparation: { type: "string" },
      }, required: ["title", "ingredients", "preparation"] },
      run: async (a) => {
        const titel = tekst(a.title, 120);
        if (!titel) throw new McpFout("Een recept heeft een titel nodig.");
        const r: Recept = {
          id: db.newId(), titel,
          keuken: uitLijst(a.cuisine, KEUKENS, "Overig"),
          hoofd: uitLijst(a.main, HOOFDINGREDIENTEN, "Vegetarisch"),
          maaltijd: uitLijst(a.meal, MAALTIJDEN, STANDAARD_MAALTIJD),
          moeilijkheid: uitLijst(a.difficulty, MOEILIJKHEDEN, "Makkelijk"),
          tijd: getal(a.minutes, 30, 1, 1440), score: 0, personen: getal(a.servings, 4, 1, 30), gegeten: 0,
          afbeelding: "",
          ingredienten: (Array.isArray(a.ingredients) ? a.ingredients : []).slice(0, 60).map((i: Record<string, unknown>) => ({
            naam: tekst(i?.name, 80), hoev: getal(i?.amount, 0, 0, 10000), eenheid: tekst(i?.unit, 20),
          })).filter((i) => i.naam),
          bereiding: tekst(a.preparation, 8000),
        };
        await db.saveRecept(r);
        return { gedaan: true, id: r.id, titel: r.titel };
      },
    },
  ];
}
