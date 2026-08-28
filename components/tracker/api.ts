import type { Day, FoodTemplate, Maaltijdsjabloon, Product, Profile } from "@/lib/tracker/types";
import type { BudgetResultaat } from "@/lib/tracker/budget";
import type { WeekSamenvatting } from "@/lib/tracker/week";
import type { AdviesDrempel, FactPack } from "@/lib/tracker/feiten";
import type { Advies, Afwijking, Weegmoment } from "@/lib/tracker/advies";
import type { GewichtGegevens } from "./Gewicht";

export interface Melding {
  nieuw: boolean;
  trigger: "weegmoment" | "afwijking" | "gereed" | null;
  aanleiding: string | null;
}

export interface AdviesAntwoord {
  advies: Advies | null;
  historie: Advies[];
  weegmoment: Weegmoment | null;
  afwijking?: Afwijking | null;
  gegenereerd?: boolean;
  /** Redenen waarom er geen advies kwam; zie de validatielaag. */
  afgekeurd?: string[];
}

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
      .then(lees<{
        gevonden: boolean; product?: Product;
        bron?: "eigen" | "cache" | "off" | "winkel";
        uitCache?: boolean; offline?: boolean;
      }>),

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

  weeg: (kg: number, datum?: string, note?: string) =>
    fetch("/api/tracker/gewicht", {
      method: "POST", headers: json, body: JSON.stringify({ kg, date: datum, note }),
    }).then(lees<GewichtGegevens & { herberekend: boolean }>),

  /**
   * Een bestaande weging aanpassen.
   *
   * Botst de nieuwe datum met een weging die er al staat, dan is dat geen fout
   * maar een vraag: het antwoord komt terug als `botsing`, zodat het scherm kan
   * vragen of die vervangen mag worden in plaats van hem weg te gooien.
   */
  wijzigWeging: async (v: {
    van: string; naar: string; kg: number; note?: string; vervang?: boolean;
  }): Promise<
    | { gegevens: GewichtGegevens & { herberekend: boolean }; botsing?: undefined }
    | { botsing: { datum: string; kg: number }; gegevens?: undefined }
  > => {
    const res = await fetch("/api/tracker/gewicht", {
      method: "PUT", headers: json, body: JSON.stringify(v),
    });
    if (res.status === 409) {
      const d = await res.json().catch(() => ({} as { botsing?: { datum: string; kg: number } }));
      return { botsing: d.botsing ?? { datum: v.naar, kg: 0 } };
    }
    return { gegevens: await lees<GewichtGegevens & { herberekend: boolean }>(res) };
  },

  wisWeging: (datum: string) =>
    fetch(`/api/tracker/gewicht?datum=${encodeURIComponent(datum)}`, { method: "DELETE" })
      .then(lees<GewichtGegevens>),

  /**
   * Het feitenpakket van Inzicht. Zonder `ververs` komt het uit de cache
   * zolang er niets nieuws gelogd is; de knop op het scherm zet hem aan.
   */
  getFeiten: (datum: string, ververs = false) =>
    fetch(`/api/tracker/feiten?datum=${datum}${ververs ? "&ververs=1" : ""}`, { cache: "no-store" })
      .then(lees<{ pakket: FactPack | null; drempel: AdviesDrempel | null; uitCache: boolean }>),

  /** Het lopende advies plus de historie, zonder iets te genereren. */
  getAdvies: (datum: string) =>
    fetch(`/api/tracker/advies?datum=${datum}`, { cache: "no-store" }).then(lees<AdviesAntwoord>),

  /**
   * Vraagt het advies bij het weegmoment aan. De server bepaalt of dat mag; is
   * het weegmoment al afgehandeld, dan komt hetzelfde antwoord terug zonder
   * modelaanroep.
   */
  maakAdvies: (datum: string) =>
    fetch(`/api/tracker/advies?datum=${datum}`, { method: "POST" }).then(lees<AdviesAntwoord>),

  /**
   * Of er iets klaarstaat op Inzicht. Licht van gewicht: deze route rekent geen
   * advies uit en kost dus nooit een modelaanroep.
   */
  getMelding: (datum: string) =>
    fetch(`/api/tracker/melding?datum=${datum}`, { cache: "no-store" }).then(lees<Melding>),

  /**
   * Analyse op verzoek. Kent geen limiet en geen dempingsregels: die gelden
   * voor wat de module uit zichzelf meldt, niet voor wat je zelf komt vragen.
   */
  vraagAnalyse: (datum: string) =>
    fetch(`/api/tracker/advies?datum=${datum}&trigger=verzoek`, { method: "POST" })
      .then(lees<AdviesAntwoord>),

  /** De volledige adviesgeschiedenis. Kost nooit een modelaanroep. */
  getAdviesHistorie: () =>
    fetch("/api/tracker/advies/historie", { cache: "no-store" })
      .then(lees<{ adviezen: Advies[] }>).then((d) => d.adviezen),

  getWeek: (datum: string) =>
    fetch(`/api/tracker/week?datum=${encodeURIComponent(datum)}`, { cache: "no-store" })
      .then(lees<{ week: WeekSamenvatting | null; profiel: Profile | null; dagenTeGaan: number }>),

  onthoudBijBarcode: (barcode: string, product: unknown) =>
    fetch(`/api/tracker/barcode/${encodeURIComponent(barcode)}`, {
      method: "PUT", headers: json, body: JSON.stringify(product),
    }).then(lees<{ bewaard: boolean }>),

  zoek: (q: string) =>
    fetch(`/api/tracker/zoeken?q=${encodeURIComponent(q)}`, { cache: "no-store" })
      .then(lees<{ resultaten: Product[]; extern: "ok" | "mislukt" | "leeg" }>),
};
