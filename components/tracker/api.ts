import type { Day, Profile } from "@/lib/tracker/types";
import type { BudgetResultaat } from "@/lib/tracker/budget";

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
};
