// ---------------------------------------------------------------------------
// De vorm van een back-upbestand, en het lezen ervan.
//
// Bewust los van lib/backup.ts: dat bestand praat met Redis en is daardoor niet
// te testen zonder database. Wat hier staat is pure logica — welke velden er in
// een back-up horen en wat een geldig bestand is — en heeft een testbestand
// naast zich staan.
// ---------------------------------------------------------------------------

import type {
  Boodschappen, GebiedVolgorde, Recept, Voorraad, WeekState,
} from "./types";
import type { Day, FoodTemplate, Maaltijdsjabloon, Product, Profile } from "./tracker/types";
import type { Weging } from "./tracker/gewicht";
import type { Advies, Cooldown } from "./tracker/advies";
import type { IngredientBibliotheek } from "./tracker/ingredienten";
import type { Prijsboek } from "./prijzen";

export const BACKUP_VERSIE = 1;

export interface BackupBestand {
  app: "kookboek";
  versie: number;
  gemaakt: string;
  persoon: { id: string; naam: string };
  gedeeld: {
    recepten: Recept[];
    /** Het weekmenu uit back-ups van voor het plannen van meerdere weken. */
    week: WeekState | null;
    /** Alle weekmenu's, op ISO-weeksleutel. */
    weken: Record<string, WeekState> | null;
    boodschappen: Boodschappen | null;
    gebiedvolgorde: GebiedVolgorde | null;
    voorraad: Voorraad | null;
    dagen: Day[];
    favorieten: FoodTemplate[];
    recent: FoodTemplate[];
    maaltijden: Maaltijdsjabloon[];
    ingredienten: IngredientBibliotheek | null;
    eigenProducten: { barcode: string; product: Product }[];
    /** Ontbreekt in back-ups van voor het prijsboek; dan gewoon null. */
    prijsboek: Prijsboek | null;
  };
  persoonlijk: {
    profiel: Profile | null;
    wegingen: (Weging & { note?: string })[];
    adviezen: Advies[];
    adviesActief: string | null;
    adviesGezien: string | null;
    cooldown: Cooldown | null;
  };
}

export interface BackupTelling {
  recepten: number;
  dagen: number;
  wegingen: number;
  adviezen: number;
  eigenProducten: number;
}

export function tel(b: BackupBestand): BackupTelling {
  return {
    recepten: b.gedeeld.recepten.length,
    dagen: b.gedeeld.dagen.length,
    wegingen: b.persoonlijk.wegingen.length,
    adviezen: b.persoonlijk.adviezen.length,
    eigenProducten: b.gedeeld.eigenProducten.length,
  };
}

/**
 * Controleert of een ingelezen bestand een back-up van deze app is.
 *
 * Ruim: een back-up van een oudere versie hoort te werken, en een ontbrekend
 * onderdeel wordt aangevuld met leeg in plaats van geweigerd. Streng op één
 * punt: is dit geen kookboek-back-up, dan gaat er niets overheen.
 */
export function leesBackup(ruw: unknown): { bestand: BackupBestand } | { fout: string } {
  if (!ruw || typeof ruw !== "object") return { fout: "Dat bestand bevat geen leesbare JSON." };
  const b = ruw as Partial<BackupBestand>;
  if (b.app !== "kookboek") {
    return { fout: "Dit lijkt geen back-up van Kookboek te zijn." };
  }
  if (typeof b.versie !== "number" || b.versie > BACKUP_VERSIE) {
    return {
      fout: `Deze back-up komt uit een nieuwere versie van de app (${b.versie}). Werk de app eerst bij.`,
    };
  }
  const g = (b.gedeeld ?? {}) as Partial<BackupBestand["gedeeld"]>;
  const p = (b.persoonlijk ?? {}) as Partial<BackupBestand["persoonlijk"]>;

  return {
    bestand: {
      app: "kookboek",
      versie: b.versie,
      gemaakt: typeof b.gemaakt === "string" ? b.gemaakt : "",
      persoon: b.persoon ?? { id: "", naam: "" },
      gedeeld: {
        recepten: lijst(g.recepten),
        week: g.week ?? null,
        weken: g.weken && typeof g.weken === "object" ? g.weken : null,
        boodschappen: g.boodschappen ?? null,
        gebiedvolgorde: g.gebiedvolgorde ?? null,
        voorraad: g.voorraad ?? null,
        dagen: lijst(g.dagen),
        favorieten: lijst(g.favorieten),
        recent: lijst(g.recent),
        maaltijden: lijst(g.maaltijden),
        ingredienten: g.ingredienten ?? null,
        eigenProducten: lijst(g.eigenProducten),
        prijsboek: g.prijsboek ?? null,
      },
      persoonlijk: {
        profiel: p.profiel ?? null,
        wegingen: lijst(p.wegingen),
        adviezen: lijst(p.adviezen),
        adviesActief: p.adviesActief ?? null,
        adviesGezien: p.adviesGezien ?? null,
        cooldown: p.cooldown ?? null,
      },
    },
  };
}

function lijst<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
