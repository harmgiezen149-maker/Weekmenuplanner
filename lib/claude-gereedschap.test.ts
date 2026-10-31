import { strict as assert } from "node:assert";
import { test } from "node:test";
import { verwerkMcp } from "./mcp.ts";
import { maakKookboekGereedschap, type KookboekOpslag } from "./claude-gereedschap.ts";
import type { Boodschappen, Recept, WeekState } from "./types.ts";

function nepOpslag() {
  const recepten = new Map<string, Recept>();
  const weken = new Map<string, WeekState>();
  let boodschappen: Boodschappen = { items: [] };
  let n = 0;
  const r = (id: string, titel: string, extra: Partial<Recept> = {}): Recept => ({
    id, titel, keuken: "Italiaans", hoofd: "Pasta", maaltijd: "Avondeten", moeilijkheid: "Makkelijk", tijd: 25, score: 4,
    personen: 4, gegeten: 2, afbeelding: "data:image/jpeg;base64,AAAA", ingredienten: [{ naam: "spaghetti", hoev: 400, eenheid: "g" }],
    bereiding: "Koken.", ...extra,
  });
  recepten.set("a", r("a", "Spaghetti carbonara"));
  recepten.set("b", r("b", "Thaise curry", { keuken: "Aziatisch", hoofd: "Kip", tijd: 45 }));
  weken.set("2026-W44", { startDag: 0, slots: { Maandag: { recipeId: "a", personen: 2 } } });   // oude sleutel zonder maaltijd
  const db: KookboekOpslag = {
    getAllRecepten: async () => [...recepten.values()],
    getRecept: async (id) => recepten.get(id) ?? null,
    saveRecept: async (x) => { recepten.set(x.id, x); return x; },
    getWeek: async (k) => weken.get(k) ?? { startDag: 0, slots: {} },
    saveWeek: async (k, w) => { weken.set(k, w); return w; },
    getBoodschappen: async () => boodschappen,
    saveBoodschappen: async (b) => { boodschappen = b; return b; },
    getVoorraad: async () => ({ items: [{ id: "v1", naam: "wasmiddel", winkel: "", gebied: "", aantal: 1, drempel: 1 }] }),
    newId: () => "n" + ++n,
    vandaag: () => "2026-10-31",
  };
  return { db, recepten, weken, get boodschappen() { return boodschappen; } };
}

const INFO = { name: "kookboek", version: "1" };
async function roep(db: KookboekOpslag, name: string, args: Record<string, unknown> = {}) {
  const uit = (await verwerkMcp({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, maakKookboekGereedschap(db), INFO)) as { result: { content: { text: string }[]; isError?: boolean } };
  return { fout: !!uit.result.isError, tekst: uit.result.content[0].text, data: uit.result.isError ? null : JSON.parse(uit.result.content[0].text) };
}

test("MCP: initialize, tools/list en meldingen", async () => {
  const { db } = nepOpslag();
  const g = maakKookboekGereedschap(db);
  const init = (await verwerkMcp({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }, g, INFO)) as { result: { protocolVersion: string } };
  assert.equal(init.result.protocolVersion, "2025-06-18");
  assert.equal(await verwerkMcp({ jsonrpc: "2.0", method: "notifications/initialized" }, g, INFO), null);
  const lijst = (await verwerkMcp({ jsonrpc: "2.0", id: 2, method: "tools/list" }, g, INFO)) as { result: { tools: { name: string; annotations: { readOnlyHint: boolean } }[] } };
  const namen = lijst.result.tools.map((t) => t.name);
  assert.deepEqual(namen, ["search_recipes", "get_recipe", "get_week_menu", "get_shopping_list", "get_pantry", "plan_recipe", "add_to_shopping_list", "add_recipe"]);
  assert.equal(lijst.result.tools.find((t) => t.name === "get_recipe")!.annotations.readOnlyHint, true);
  assert.equal(lijst.result.tools.find((t) => t.name === "plan_recipe")!.annotations.readOnlyHint, false);
  assert.ok(!namen.some((n) => /delete|tracker|weight|gewicht/i.test(n)), "niets verwijderen, niet bij de tracker");
  const onbekend = (await verwerkMcp({ jsonrpc: "2.0", id: 3, method: "resources/list" }, g, INFO)) as { error: { code: number } };
  assert.equal(onbekend.error.code, -32601);
});

test("recepten zoeken en lezen, zonder foto", async () => {
  const { db } = nepOpslag();
  const z = await roep(db, "search_recipes", { main: "Kip" });
  assert.deepEqual(z.data.recepten.map((r: Recept) => r.titel), ["Thaise curry"]);
  const z2 = await roep(db, "search_recipes", { query: "spaghetti" });
  assert.equal(z2.data.aantal, 2); // in de titel van de één, als ingrediënt bij de ander
  const r = await roep(db, "get_recipe", { id: "a" });
  assert.equal(r.data.titel, "Spaghetti carbonara");
  assert.equal(r.data.afbeelding, undefined);
  assert.equal(r.data.heeftFoto, true);
  assert.equal((await roep(db, "get_recipe", { id: "zz" })).fout, true);
});

test("weekmenu lezen: oude sleutels tellen als avondeten, met datums", async () => {
  const { db } = nepOpslag();
  const w = await roep(db, "get_week_menu", { week: "2026-W44" });
  assert.equal(w.data.week, "2026-W44");
  assert.deepEqual(w.data.dagen[0], { dag: "Maandag", datum: "2026-10-26", maaltijd: "Avondeten", receptId: "a", titel: "Spaghetti carbonara", personen: 2 });
  assert.equal(w.data.legeDagen.length, 6);
});

test("inplannen: niet overschrijven zonder toestemming, sleutels netjes", async () => {
  const s = nepOpslag();
  const bezet = await roep(s.db, "plan_recipe", { recipeId: "b", day: "Maandag", week: "2026-W44" });
  assert.equal(bezet.fout, true);
  assert.match(bezet.tekst, /Spaghetti carbonara/);
  const ok = await roep(s.db, "plan_recipe", { recipeId: "b", day: "Woensdag", week: "2026-W44", servings: 3 });
  assert.equal(ok.data.gedaan, true);
  assert.deepEqual(s.weken.get("2026-W44")!.slots, {
    "Maandag|Avondeten": { recipeId: "a", personen: 2 },
    "Woensdag|Avondeten": { recipeId: "b", personen: 3 },
  });
  const vervang = await roep(s.db, "plan_recipe", { recipeId: "b", day: "Maandag", week: "2026-W44", replace: true });
  assert.equal(vervang.data.gedaan, true);
  assert.equal((await roep(s.db, "plan_recipe", { recipeId: "b", day: "Monday" })).fout, true);
  // zonder week: deze week (2026-10-31 valt in 2026-W44)
  await roep(s.db, "plan_recipe", { recipeId: "a", day: "Zondag" });
  assert.ok(s.weken.get("2026-W44")!.slots["Zondag|Avondeten"]);
});

test("boodschappen toevoegen en recept toevoegen", async () => {
  const s = nepOpslag();
  const b = await roep(s.db, "add_to_shopping_list", { items: [{ name: "melk", amount: 2, unit: "l", store: "ah" }, { name: "" }] });
  assert.deepEqual(b.data.toegevoegd, ["2 l melk"]);
  assert.equal(s.boodschappen.items[0].winkel, "AH");
  assert.equal(s.boodschappen.items[0].bron, "hand");
  const r = await roep(s.db, "add_recipe", { title: "Linzensoep", cuisine: "Midden-Oosters", main: "Soep", ingredients: [{ name: "linzen", amount: 250, unit: "g" }], preparation: "Trekken." });
  assert.equal(r.data.gedaan, true);
  const opgeslagen = s.recepten.get(r.data.id)!;
  assert.equal(opgeslagen.hoofd, "Soep");
  assert.equal(opgeslagen.afbeelding, "");
});
