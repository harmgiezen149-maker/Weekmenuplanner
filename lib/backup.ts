// ---------------------------------------------------------------------------
// Back-up: alles in één bestand, en datzelfde bestand weer terug.
//
// Het bestand is beschrijvend, niet letterlijk. Er staan recepten, dagen en
// wegingen in — geen Redis-sleutels en geen scores. Dat maakt het bestand
// leesbaar, bestand tegen een wijziging in de sleutelindeling, en terugzetten
// een kwestie van opnieuw opbouwen in plaats van blind kopiëren.
//
// Wat er NIET in gaat:
//   - de productcache uit Open Food Facts en de doorgerekende recepten: dat
//     zijn caches die zichzelf opnieuw vullen, en ze zouden het bestand
//     verdrievoudigen;
//   - het feitenpakket van Inzicht, om dezelfde reden;
//   - accounts en wachtwoorden. Een wachtwoordregel hoort niet in een bestand
//     dat in je downloadmap belandt.
//
// Persoonlijke gegevens zijn van de ingelogde persoon. Log je met z'n tweeën
// in, dan maakt ieder zijn eigen back-up van zijn eigen weeglijst; het gedeelde
// deel zit in allebei.
// ---------------------------------------------------------------------------

import { redis, mgetInStukjes } from "./redis";
import { persoonlijk } from "./persoon";
import type { BackupBestand, BackupTelling } from "./backup-formaat";
import { BACKUP_VERSIE, tel } from "./backup-formaat";
import type { Recept, Boodschappen, GebiedVolgorde, Voorraad, WeekState } from "./types";
import type { Day, FoodTemplate, Maaltijdsjabloon, Product, Profile } from "./tracker/types";
import type { Weging } from "./tracker/gewicht";
import type { Advies, Cooldown } from "./tracker/advies";
import type { IngredientBibliotheek } from "./tracker/ingredienten";
import type { Prijsboek } from "./prijzen";

export { BACKUP_VERSIE } from "./backup-formaat";
export { leesBackup, tel } from "./backup-formaat";
export type { BackupBestand, BackupTelling } from "./backup-formaat";

// -- maken -------------------------------------------------------------------

export async function maakBackup(persoon: { id: string; naam: string }): Promise<BackupBestand> {
  const [gedeeld, eigenPersoonlijk] = await Promise.all([
    leesGedeeld(),
    leesPersoonlijk(),
  ]);
  return {
    app: "kookboek",
    versie: BACKUP_VERSIE,
    gemaakt: new Date().toISOString(),
    persoon,
    gedeeld,
    persoonlijk: eigenPersoonlijk,
  };
}

async function leesGedeeld(): Promise<BackupBestand["gedeeld"]> {
  const receptIds = ((await redis.smembers("recipes:index")) ?? []) as string[];
  // In stukjes: met de foto's erin zijn alle recepten samen zo groot dat één
  // mget de limiet van Upstash overschrijdt. Een back-up die daarop klapt is
  // een back-up die je niet hebt.
  const recepten = (await mgetInStukjes<Recept>(receptIds.map((id) => `recipe:${id}`)))
    .filter((r): r is Recept => r != null);

  const dagDatums = ((await redis.zrange<string[]>("wl:day:index", 0, -1)) ?? []);
  const dagen = (await mgetInStukjes<Day>(dagDatums.map((d) => `wl:day:${d}`)))
    .filter((d): d is Day => d != null);

  const [week, boodschappen, gebiedvolgorde, voorraad, favorieten, recent, maaltijden, ingredienten] =
    await Promise.all([
      redis.get<WeekState>("week:current"),
      redis.get<Boodschappen>("boodschappen:current"),
      redis.get<GebiedVolgorde>("gebiedvolgorde:current"),
      redis.get<Voorraad>("voorraad:current"),
      redis.get<FoodTemplate[]>("wl:favorites"),
      redis.get<FoodTemplate[]>("wl:recent"),
      redis.get<Maaltijdsjabloon[]>("wl:meals"),
      redis.get<IngredientBibliotheek>("wl:ingredienten"),
    ]);
  const prijsboek = await redis.get<Prijsboek>("prijzen:boek");
  const weken = await leesWeken();

  return {
    recepten,
    week: week ?? null,
    weken,
    boodschappen: boodschappen ?? null,
    gebiedvolgorde: gebiedvolgorde ?? null,
    voorraad: voorraad ?? null,
    dagen,
    favorieten: favorieten ?? [],
    recent: recent ?? [],
    maaltijden: maaltijden ?? [],
    ingredienten: ingredienten ?? null,
    prijsboek: prijsboek ?? null,
    eigenProducten: await leesEigenProducten(),
  };
}

/**
 * Zelf ingevoerde producten hangen los aan hun streepjescode, zonder index.
 * Ze worden daarom opgezocht met scan. Dat is de enige plek in de app waar dat
 * nodig is, en het gebeurt alleen bij het maken van een back-up.
 */
/**
 * Alle weekmenu's. Net als de eigen producten hebben die geen index, dus ze
 * worden opgezocht met scan — alleen bij het maken van een back-up.
 */
async function leesWeken(): Promise<Record<string, WeekState>> {
  const uit: Record<string, WeekState> = {};
  const sleutels: string[] = [];
  let cursor = "0";
  do {
    const [volgende, gevonden] = await redis.scan(cursor, { match: "week:*", count: 200 });
    cursor = String(volgende);
    sleutels.push(...(gevonden as string[]));
  } while (cursor !== "0" && sleutels.length < 2000);

  // `week:current` is de oude sleutel en zit al in het veld `week`.
  const weeksleutels = sleutels.filter((k) => /^week:\d{4}-W\d{2}$/.test(k));
  if (weeksleutels.length === 0) return uit;

  const rauw = (await redis.mget<(WeekState | null)[]>(...weeksleutels)) ?? [];
  weeksleutels.forEach((k, i) => {
    const w = rauw[i];
    if (w) uit[k.slice("week:".length)] = w;
  });
  return uit;
}

async function leesEigenProducten(): Promise<{ barcode: string; product: Product }[]> {
  const sleutels: string[] = [];
  let cursor = "0";
  do {
    const [volgende, gevonden] = await redis.scan(cursor, { match: "wl:eigen:*", count: 200 });
    cursor = String(volgende);
    sleutels.push(...(gevonden as string[]));
    // Een lus die niet eindigt is erger dan een onvolledige back-up.
  } while (cursor !== "0" && sleutels.length < 5000);

  if (sleutels.length === 0) return [];
  const rauw = (await redis.mget<(Product | null)[]>(...sleutels)) ?? [];
  const uit: { barcode: string; product: Product }[] = [];
  sleutels.forEach((s, i) => {
    const p = rauw[i];
    if (p) uit.push({ barcode: s.slice("wl:eigen:".length), product: p });
  });
  return uit;
}

async function leesPersoonlijk(): Promise<BackupBestand["persoonlijk"]> {
  const [kProfiel, kLog, kIndex, kActief, kGezien, kCooldown] = await Promise.all([
    persoonlijk("profile"), persoonlijk("weight:log"), persoonlijk("advice:index"),
    persoonlijk("advice:active"), persoonlijk("advice:seen"), persoonlijk("advice:cooldown"),
  ]);

  const leden = ((await redis.zrange<string[]>(kLog, 0, -1)) ?? []);
  const wegingen: (Weging & { note?: string })[] = [];
  for (const lid of leden) {
    const scheiding = lid.lastIndexOf(":");
    if (scheiding < 0) continue;
    const date = lid.slice(0, scheiding);
    const kg = Number(lid.slice(scheiding + 1));
    if (!Number.isFinite(kg) || kg <= 0) continue;
    // Ook wat een weegschaal met lichaamsanalyse meegaf: een back-up die het
    // gewicht bewaart en het vetpercentage laat vallen is geen back-up.
    const regel = await redis.get<{
      kg: number; note?: string; vet_pct?: number; spier_kg?: number; vocht_pct?: number;
    }>(await persoonlijk(`weight:${date}`));
    wegingen.push({
      date, kg,
      ...(regel?.note ? { note: regel.note } : {}),
      ...(regel?.vet_pct != null ? { vet_pct: regel.vet_pct } : {}),
      ...(regel?.spier_kg != null ? { spier_kg: regel.spier_kg } : {}),
      ...(regel?.vocht_pct != null ? { vocht_pct: regel.vocht_pct } : {}),
    });
  }

  const adviesIds = ((await redis.zrange<string[]>(kIndex, 0, -1)) ?? []);
  const adviezen = adviesIds.length
    ? ((await redis.mget<(Advies | null)[]>(
        ...(await Promise.all(adviesIds.map((id) => persoonlijk(`advice:${id}`))))
      )) ?? []).filter((a): a is Advies => a != null)
    : [];

  const [profiel, adviesActief, adviesGezien, cooldown] = await Promise.all([
    redis.get<Profile>(kProfiel),
    redis.get<string>(kActief),
    redis.get<string>(kGezien),
    redis.get<Cooldown>(kCooldown),
  ]);

  return {
    profiel: profiel ?? null,
    wegingen,
    adviezen,
    adviesActief: adviesActief ?? null,
    adviesGezien: adviesGezien ?? null,
    cooldown: cooldown ?? null,
  };
}

// -- terugzetten -------------------------------------------------------------

/**
 * Zet een back-up terug.
 *
 * Vervangend, niet aanvullend: wat in de app staat en niet in het bestand,
 * verdwijnt. Een half samengevoegde toestand is namelijk erger dan de toestand
 * waar je vandaan kwam — je weet dan van geen enkel recept meer of het de
 * nieuwe of de oude versie is.
 *
 * De volgorde is met opzet: eerst schrijven, dan pas opruimen wat er niet meer
 * bij hoort. Loopt het halverwege stuk, dan staat de nieuwe inhoud er al en is
 * er hooguit te veel, niet te weinig.
 */
export async function zetBackupTerug(bestand: BackupBestand): Promise<BackupTelling> {
  await herstelGedeeld(bestand.gedeeld);
  await herstelPersoonlijk(bestand.persoonlijk);
  return tel(bestand);
}

async function herstelGedeeld(g: BackupBestand["gedeeld"]): Promise<void> {
  for (const r of g.recepten) {
    if (!r?.id) continue;
    await redis.set(`recipe:${r.id}`, r);
    await redis.sadd("recipes:index", r.id);
  }
  const behouden = new Set(g.recepten.map((r) => r.id));
  for (const id of ((await redis.smembers("recipes:index")) ?? []) as string[]) {
    if (behouden.has(id)) continue;
    await redis.del(`recipe:${id}`);
    await redis.srem("recipes:index", id);
  }

  for (const d of g.dagen) {
    if (!d?.date) continue;
    await redis.set(`wl:day:${d.date}`, d);
    const gevuld = (d.entries?.length ?? 0) > 0 || (d.activity?.length ?? 0) > 0;
    if (gevuld) {
      await redis.zadd("wl:day:index", {
        score: Date.parse(d.date + "T00:00:00Z"), member: d.date,
      });
    } else {
      await redis.zrem("wl:day:index", d.date);
    }
  }
  const dagenTerug = new Set(g.dagen.map((d) => d.date));
  for (const datum of ((await redis.zrange<string[]>("wl:day:index", 0, -1)) ?? [])) {
    if (dagenTerug.has(datum)) continue;
    await redis.del(`wl:day:${datum}`);
    await redis.zrem("wl:day:index", datum);
  }

  await zetOfWis("week:current", g.week);
  for (const [sleutel, w] of Object.entries(g.weken ?? {})) {
    if (/^\d{4}-W\d{2}$/.test(sleutel) && w) await redis.set(`week:${sleutel}`, w);
  }
  await zetOfWis("boodschappen:current", g.boodschappen);
  await zetOfWis("gebiedvolgorde:current", g.gebiedvolgorde);
  await zetOfWis("voorraad:current", g.voorraad);
  await zetOfWis("wl:ingredienten", g.ingredienten);
  await zetOfWis("prijzen:boek", g.prijsboek);
  await redis.set("wl:favorites", g.favorieten);
  await redis.set("wl:recent", g.recent);
  await redis.set("wl:meals", g.maaltijden);

  for (const e of g.eigenProducten) {
    if (e?.barcode && e.product) await redis.set(`wl:eigen:${e.barcode}`, e.product);
  }
}

async function herstelPersoonlijk(p: BackupBestand["persoonlijk"]): Promise<void> {
  const [kProfiel, kLog, kIndex, kActief, kGezien, kCooldown] = await Promise.all([
    persoonlijk("profile"), persoonlijk("weight:log"), persoonlijk("advice:index"),
    persoonlijk("advice:active"), persoonlijk("advice:seen"), persoonlijk("advice:cooldown"),
  ]);

  await zetOfWis(kProfiel, p.profiel);

  // De weeglijst wordt in zijn geheel opnieuw opgebouwd: een oude weging die
  // niet in de back-up staat hoort er ook niet meer te zijn.
  await redis.del(kLog);
  for (const w of p.wegingen) {
    if (!w?.date || !Number.isFinite(w.kg) || w.kg <= 0) continue;
    await redis.zadd(kLog, {
      score: Date.parse(w.date + "T00:00:00Z"),
      member: `${w.date}:${w.kg.toFixed(1)}`,
    });
    await redis.set(await persoonlijk(`weight:${w.date}`), {
      kg: w.kg,
      ...(w.note ? { note: w.note } : {}),
      ...(w.vet_pct != null ? { vet_pct: w.vet_pct } : {}),
      ...(w.spier_kg != null ? { spier_kg: w.spier_kg } : {}),
      ...(w.vocht_pct != null ? { vocht_pct: w.vocht_pct } : {}),
    });
  }

  await redis.del(kIndex);
  for (const a of p.adviezen) {
    if (!a?.id) continue;
    await redis.set(await persoonlijk(`advice:${a.id}`), a);
    await redis.zadd(kIndex, {
      score: Date.parse(a.created_at) || 0, member: a.id,
    });
  }

  await zetOfWis(kActief, p.adviesActief);
  await zetOfWis(kGezien, p.adviesGezien);
  await zetOfWis(kCooldown, p.cooldown);
}

/** Leeg in de back-up betekent leeg in de app, niet "laat maar staan". */
async function zetOfWis(sleutel: string, waarde: unknown): Promise<void> {
  if (waarde == null) await redis.del(sleutel);
  else await redis.set(sleutel, waarde);
}
