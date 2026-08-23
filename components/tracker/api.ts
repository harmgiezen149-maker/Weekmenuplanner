import type { Day, FoodTemplate, Maaltijdsjabloon, Product, Profile } from "@/lib/tracker/types";
import type { BudgetResultaat } from "@/lib/tracker/budget";
import type { WeekSamenvatting } from "@/lib/tracker/week";
import type { GewichtGegevens } from "./Gewicht";

export interface ProfielAntwoord {
  profiel: Profile | null;
  budget: BudgetResultaat | null;
}

async function lees<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const e = await res.json().catch(() => ({} as { error?: string }));
    throw new Error(e.error || "Er ging iets mis");
  }
  return res.json() as Promise<T>;
}

const json = { "Content-Type": "application/json" };

export const trackerApi = {
  getProfiel: () =>
    fetch("/api/tracker/profiel", { cache: "no-store" }).then(lees<ProfielAntwoord>),

  saveProfiel: (p: Partial<Profile>) =>
    fetch("/api/tracker/profiel", { method: "PUT", headers: json, body: JSON.stringify(p) })
      .then(lees<ProfielAntwoord>),

  getDag: (datum: string) =>
    fetch(`/api/tracker/dag/${datum}`, { cache: "no-store" }).then(lees<Day>),

  addRegel: (datum: string, entry: unknown) =>
    fetch(`/api/tracker/dag/${datum}`, { method: "POST", headers: json, body: JSON.stringify(entry) })
      .then(lees<Day>),

  wisRegel: (datum: string, id: string) =>
    fetch(`/api/tracker/dag/${datum}?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      .then(lees<Day>),

  /** Favorieten en recent in één keer: het invoerscherm toont ze samen. */
  getSnel: () =>
    fetch("/api/tracker/favorieten", { cache: "no-store" })
      .then(lees<{ favorieten: FoodTemplate[]; recent: FoodTemplate[] }>),

  bewaarFavoriet: (t: unknown) =>
    fetch("/api/tracker/favorieten", { method: "POST", headers: json, body: JSON.stringify(t) })
      .then(lees<{ favorieten: FoodTemplate[] }>).then((d) => d.favorieten),

  wisFavoriet: (id: string) =>
    fetch(`/api/tracker/favorieten?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      .then(lees<{ favorieten: FoodTemplate[] }>).then((d) => d.favorieten),

  barcode: (code: string) =>
    fetch(`/api/tracker/barcode/${encodeURIComponent(code)}`, { cache: "no-store" })
      .then(lees<{ gevonden: boolean; product?: Product; uitCache?: boolean; offline?: boolean }>),

  voegBewegingToe: (datum: string, soort: string, minuten: number) =>
    fetch("/api/tracker/beweging", { method: "POST", headers: json, body: JSON.stringify({ datum, soort, minuten }) })
      .then(lees<Day>),

  wisBeweging: (datum: string, id: string) =>
    fetch(`/api/tracker/beweging?datum=${datum}&id=${encodeURIComponent(id)}`, { method: "DELETE" })
      .then(lees<Day>),

  getMaaltijden: () =>
    fetch("/api/tracker/maaltijden", { cache: "no-store" })
      .then(lees<{ maaltijden: Maaltijdsjabloon[] }>).then((d) => d.maaltijden),

  bewaarMaaltijd: (m: unknown) =>
    fetch("/api/tracker/maaltijden", { method: "POST", headers: json, body: JSON.stringify(m) })
      .then(lees<{ maaltijden: Maaltijdsjabloon[] }>).then((d) => d.maaltijden),

  wisMaaltijd: (id: string) =>
    fetch(`/api/tracker/maaltijden?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      .then(lees<{ maaltijden: Maaltijdsjabloon[] }>).then((d) => d.maaltijden),

  getGewicht: () =>
    fetch("/api/tracker/gewicht", { cache: "no-store" }).then(lees<GewichtGegevens>),

  weeg: (kg: number, note?: string) =>
    fetch("/api/tracker/gewicht", { method: "POST", headers: json, body: JSON.stringify({ kg, note }) })
      .then(lees<GewichtGegevens & { herberekend: boolean }>),

  wisWeging: (datum: string) =>
    fetch(`/api/tracker/gewicht?datum=${encodeURIComponent(datum)}`, { method: "DELETE" })
      .then(lees<GewichtGegevens>),

  getWeek: (datum: string) =>
    fetch(`/api/tracker/week?datum=${encodeURIComponent(datum)}`, { cache: "no-store" })
      .then(lees<{ week: WeekSamenvatting | null; profiel: Profile | null; dagenTeGaan: number }>),

  zoek: (q: string) =>
    fetch(`/api/tracker/zoeken?q=${encodeURIComponent(q)}`, { cache: "no-store" })
      .then(lees<{ resultaten: Product[]; extern: "ok" | "mislukt" | "leeg" }>),
};
