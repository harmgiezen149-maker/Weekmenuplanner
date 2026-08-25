import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildFactPack, vensterDatums, adviesDrempel, feitenVingerafdruk, heeftGuardrail,
  VENSTER_DAGEN,
} from "./feiten.ts";
import { berekenTotalen } from "./points.ts";
import type { Activity, Day, Entry, Nutrients, Profile } from "./types.ts";
import type { Weging } from "./gewicht.ts";

// 2026-08-25 is een dinsdag; 2026-08-23 een zondag.
const PEILDATUM = "2026-08-25";
const NU = new Date("2026-08-25T09:00:00.000Z");

function profiel(over: Partial<Profile> = {}): Profile {
  return {
    name: "Test", sex: "man", birthdate: "1985-01-01", height_cm: 180,
    activity_factor: 1.375, start_weight_kg: 95, current_weight_kg: 90,
    goal_weight_kg: 80, weigh_day: 6, points_scale: 1,
    budget_basis_weight_kg: 90, daily_budget: 40, weekly_buffer: 28,
    protein_target_g: 128, created_at: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

let teller = 0;

function voedingswaarden(over: Partial<Nutrients> = {}): Nutrients {
  return {
    kcal: 500, protein_g: 20, fat_g: 15, satfat_g: 5,
    carbs_g: 50, sugar_g: 8, fiber_g: 5, category: "default", ...over,
  };
}

/** Eén regel op een datum en een uur, met de punten die je wilt testen. */
function regel(datum: string, uur: number, punten: number, over: Partial<Entry> = {}): Entry {
  const d = new Date(datum + "T00:00:00");
  d.setHours(uur, 0, 0, 0);
  teller++;
  return {
    id: `e${teller}`, ts: d.getTime(), meal: "diner", source: "manual",
    name: "Testproduct", amount: 100, unit: "g", grams: 100,
    nutrients: voedingswaarden(), points_raw: punten, ...over,
  };
}

function dag(datum: string, entries: Entry[], activity: Activity[] = []): Day {
  return { date: datum, entries, activity, totals: berekenTotalen(entries), buffer_used: 0 };
}

/**
 * Bouwt een reeks dagen over het hele venster. `maak` krijgt de datum en de
 * index vanaf de oudste dag; null betekent: die dag is niet gelogd.
 */
function reeks(maak: (datum: string, i: number) => Entry[] | null, dagen = VENSTER_DAGEN): Day[] {
  const uit: Day[] = [];
  vensterDatums(PEILDATUM, dagen).forEach((datum, i) => {
    const entries = maak(datum, i);
    if (entries) uit.push(dag(datum, entries));
  });
  return uit;
}

function bouw(dagen: Day[], wegingen: Weging[] = [], over: Partial<Profile> = {}) {
  return buildFactPack({ peildatum: PEILDATUM, dagen, wegingen, profiel: profiel(over), nu: NU });
}

/** Elke dag één regel van `punten`, om een vlakke basis te leggen. */
function vlakkeReeks(punten: number, dagen = VENSTER_DAGEN): Day[] {
  return reeks((datum) => [regel(datum, 12, punten)], dagen);
}

// -- venster en volledigheid -------------------------------------------------

test("het venster is twaalf weken en eindigt op de peildatum", () => {
  const datums = vensterDatums(PEILDATUM);
  assert.equal(datums.length, 84);
  assert.equal(datums[83], PEILDATUM);
  assert.equal(datums[0], "2026-06-03");
  assert.deepEqual(datums, [...datums].sort());
});

test("volledigheid telt alleen dagen met regels", () => {
  const p = bouw(reeks((datum, i) => (i % 2 === 0 ? [regel(datum, 12, 30)] : null)));
  assert.equal(p.meta.days_in_window, 84);
  assert.equal(p.meta.days_logged, 42);
  assert.equal(p.meta.completeness, 0.5);
  assert.equal(p.meta.window_start, "2026-06-03");
});

test("een dag zonder regels telt niet als een dag van nul punten", () => {
  // Twee dagen van 40, de rest niet gelogd. Het gemiddelde is 40, niet 40/84.
  const p = bouw(reeks((datum, i) => (i >= 82 ? [regel(datum, 12, 40)] : null)));
  assert.equal(p.budget.avg_points_per_day, 40);
  assert.equal(p.meta.days_logged, 2);
});

// -- budget ------------------------------------------------------------------

test("naleving is het aandeel gelogde dagen binnen het dagbudget", () => {
  // Negen van de tien dagen op 30 punten, één op 60 bij een budget van 40.
  const p = bouw(reeks((datum, i) => {
    if (i < 74) return null;
    return [regel(datum, 12, i === 83 ? 60 : 30)];
  }));
  assert.equal(p.meta.days_logged, 10);
  assert.equal(p.budget.adherence_rate, 0.9);
  assert.equal(p.budget.current_daily_budget, 40);
  assert.equal(p.budget.weekly_buffer, 28);
});

test("bewegingspunten verruimen het budget van die dag", () => {
  const beweging: Activity = { id: "a1", ts: Date.now(), name: "Wandelen", met: 3.5, minutes: 60, points: 5 };
  const dagen = [dag(PEILDATUM, [regel(PEILDATUM, 12, 44)], [beweging])];
  // 44 punten bij een budget van 40 plus 5 bewegingspunten: binnen budget.
  assert.equal(bouw(dagen).budget.adherence_rate, 1);
  // Zonder de beweging valt dezelfde dag erbuiten.
  assert.equal(bouw([dag(PEILDATUM, [regel(PEILDATUM, 12, 44)])]).budget.adherence_rate, 0);
});

test("gemiddelde, mediaan en spreiding staan los van elkaar", () => {
  const punten = [10, 20, 30, 40, 100];
  const p = bouw(reeks((datum, i) => (i >= 79 ? [regel(datum, 12, punten[i - 79])] : null)));
  assert.equal(p.budget.avg_points_per_day, 40);
  assert.equal(p.budget.median_points_per_day, 30);
  // Populatie-standaardafwijking van die reeks is 31,6.
  assert.equal(p.budget.sd_points_per_day, 31.6);
});

test("de puntenschaal werkt door in het hele pakket", () => {
  const dagen = vlakkeReeks(40);
  assert.equal(bouw(dagen).budget.avg_points_per_day, 40);
  assert.equal(bouw(dagen, [], { points_scale: 0.75 }).budget.avg_points_per_day, 30);
});

// -- weekdagen en dagdelen ---------------------------------------------------

test("punten per weekdag tellen alleen de gelogde dagen van die weekdag", () => {
  const p = bouw(reeks((datum, i) => {
    const weekend = [5, 6].includes(new Date(datum + "T12:00:00").getDay() % 7 === 0 ? 6 : (new Date(datum + "T12:00:00").getDay() + 6) % 7);
    return [regel(datum, 12, weekend ? 60 : 30)];
  }));
  assert.equal(p.by_weekday.maandag.avg_points, 30);
  assert.equal(p.by_weekday.zaterdag.avg_points, 60);
  assert.equal(p.by_weekday.zondag.avg_points, 60);
  assert.equal(p.by_weekday.zaterdag.over_budget_rate, 1);
  assert.equal(p.by_weekday.maandag.over_budget_rate, 0);
  const geteld = Object.values(p.by_weekday).reduce((s, r) => s + r.days_counted, 0);
  assert.equal(geteld, 84);
});

test("de dagverdeling is een aandeel van de punten, niet van het aantal regels", () => {
  const p = bouw([dag(PEILDATUM, [
    regel(PEILDATUM, 8, 10),
    regel(PEILDATUM, 22, 30),
  ])]);
  assert.equal(p.by_time_of_day.before_10, 0.25);
  assert.equal(p.by_time_of_day.after_21, 0.75);
  assert.equal(p.by_time_of_day.h10_14, 0);
  const som = Object.values(p.by_time_of_day).reduce((s, n) => s + n, 0);
  assert.equal(som, 1);
});

test("de dagverdeling verdeelt de blokken op de juiste uurgrenzen", () => {
  const p = bouw([dag(PEILDATUM, [
    regel(PEILDATUM, 9, 10), regel(PEILDATUM, 10, 10), regel(PEILDATUM, 14, 10),
    regel(PEILDATUM, 18, 10), regel(PEILDATUM, 21, 10),
  ])]);
  assert.deepEqual(p.by_time_of_day, {
    before_10: 0.2, h10_14: 0.2, h14_18: 0.2, h18_21: 0.2, after_21: 0.2,
  });
});

// -- weekbuffer --------------------------------------------------------------

test("alleen volledige trackerweken tellen mee in de buffer", () => {
  // Weegdag zondag: de week van 23 augustus loopt door tot na de peildatum en
  // valt daarom af. Van 3 juni tot 25 augustus blijven elf hele weken over.
  const p = bouw(vlakkeReeks(30));
  assert.equal(p.buffer.weeks_counted, 11);
  assert.equal(p.recent.complete_weeks, 11);
});

test("het uitputtingsmoment staat als kalenderdag en als plaats in de week", () => {
  // Alleen zondag 16 augustus gelogd, 30 punten over budget: de buffer van 28
  // is meteen op. Zondag is kalenderdag 7 en de eerste dag van deze week.
  const p = bouw([dag("2026-08-16", [regel("2026-08-16", 12, 70)])]);
  assert.equal(p.buffer.weeks_fully_used, 1);
  assert.equal(p.buffer.avg_exhaustion_day, 7);
  assert.equal(p.buffer.avg_exhaustion_position, 1);
  assert.equal(p.buffer.avg_weekly_used, 2.7); // 30 verdeeld over elf weken
});

test("een buffer die nooit opgaat levert geen uitputtingsmoment op", () => {
  const p = bouw(vlakkeReeks(30));
  assert.equal(p.buffer.avg_exhaustion_day, null);
  assert.equal(p.buffer.avg_exhaustion_position, null);
  assert.equal(p.buffer.weeks_fully_used, 0);
});

// -- voeding, bijdragers en bronnen ------------------------------------------

test("eiwit staat per kilo lichaamsgewicht", () => {
  const p = bouw(vlakkeReeks(30).map((d) => ({
    ...d,
    totals: { ...d.totals, protein_g: 90 },
  })));
  assert.equal(p.nutrition.protein_g_per_kg, 1); // 90 g bij 90 kg
});

test("effectieve suiker volgt de categorie van het product", () => {
  // Magere kwark: 8 g totale suiker, 5 g per 100 g geldt als van nature aanwezig.
  const kwark = regel(PEILDATUM, 9, 2, {
    grams: 200,
    nutrients: voedingswaarden({ sugar_g: 16, category: "dairy_plain" }),
  });
  const p = bouw([dag(PEILDATUM, [kwark])]);
  assert.equal(p.nutrition.effective_sugar_g, 6); // 16 - (5 * 2)
});

test("top-bijdragers staan op cumulatieve punten, niet op frequentie", () => {
  const dagen = reeks((datum, i) => {
    if (i < 80) return null;
    return [
      regel(datum, 12, 5, { name: "Koffie" }),
      ...(i === 83 ? [regel(datum, 19, 30, { name: "Pizza" })] : []),
    ];
  });
  const p = bouw(dagen);
  assert.equal(p.top_contributors[0].name, "Pizza");
  assert.equal(p.top_contributors[0].total_points, 30);
  assert.equal(p.top_contributors[0].occurrences, 1);
  assert.equal(p.top_contributors[1].name, "Koffie");
  assert.equal(p.top_contributors[1].occurrences, 4);
  assert.equal(p.top_contributors[1].avg_points, 5);
});

test("top-bijdragers zijn er hooguit vijftien", () => {
  const p = bouw([dag(PEILDATUM, Array.from({ length: 30 }, (_, i) =>
    regel(PEILDATUM, 12, i + 1, { name: `Product ${i}` })))]);
  assert.equal(p.top_contributors.length, 15);
  assert.equal(p.top_contributors[0].name, "Product 29");
});

test("de bronmix telt alle acht bronnen, ook de lege", () => {
  const p = bouw([dag(PEILDATUM, [
    regel(PEILDATUM, 8, 5, { source: "barcode" }),
    regel(PEILDATUM, 12, 5, { source: "recipe" }),
    regel(PEILDATUM, 19, 5, { source: "recipe" }),
  ])]);
  assert.equal(p.source_mix.barcode, 1);
  assert.equal(p.source_mix.recipe, 2);
  assert.equal(p.source_mix.photo, 0);
  assert.equal(Object.keys(p.source_mix).length, 8);
});

test("dagen met een recept worden apart van vrije dagen gemiddeld", () => {
  const p = bouw(reeks((datum, i) => {
    if (i < 80) return null;
    return i % 2 === 0
      ? [regel(datum, 18, 30, { source: "recipe" })]
      : [regel(datum, 18, 50)];
  }));
  assert.equal(p.recipe_vs_freestyle.recipe_days.count, 2);
  assert.equal(p.recipe_vs_freestyle.recipe_days.avg_points, 30);
  assert.equal(p.recipe_vs_freestyle.freestyle_days.count, 2);
  assert.equal(p.recipe_vs_freestyle.freestyle_days.avg_points, 50);
});

test("beweging wordt gedeeld door de weken waarin gelogd is, niet door twaalf", () => {
  const beweging: Activity = { id: "a1", ts: Date.now(), name: "Fietsen", met: 6, minutes: 60, points: 4 };
  // Eén gelogde week, met twee sessies van vier punten. Het dagplafond van zes
  // punten geldt ook hier: acht ruwe punten tellen als zes.
  const p = bouw([
    dag(PEILDATUM, [regel(PEILDATUM, 12, 30)], [beweging, { ...beweging, id: "a2" }]),
  ]);
  assert.equal(p.activity.avg_weekly_points, 6);
  assert.equal(p.activity.sessions_per_week, 2);
});

// -- gewicht en energiebalans ------------------------------------------------

const WEKELIJKS: Weging[] = [
  { date: "2026-07-26", kg: 90 }, { date: "2026-08-02", kg: 89.5 },
  { date: "2026-08-09", kg: 89 }, { date: "2026-08-16", kg: 88.5 },
  { date: "2026-08-23", kg: 88 },
];

test("de trendlijn wordt over de hele reeks berekend, niet vanaf de vensterrand", () => {
  const p = bouw(vlakkeReeks(30), WEKELIJKS);
  assert.equal(p.weight.entries.length, 5);
  assert.equal(p.weight.current_trend_kg, 89.03);
  assert.equal(p.weight.total_change_kg, -0.97);
  assert.equal(p.weight.trend_change_kg_per_week, -0.28);
  assert.equal(p.weight.goal_kg, 80);
});

test("een te korte of te dicht op elkaar liggende reeks levert geen weektempo op", () => {
  assert.equal(bouw([], []).weight.trend_change_kg_per_week, null);
  assert.equal(bouw([], [{ date: "2026-08-24", kg: 90 }]).weight.trend_change_kg_per_week, null);
  // Drie dagen achter elkaar wegen zegt niets over een weektempo.
  const kort: Weging[] = [
    { date: "2026-08-23", kg: 90 }, { date: "2026-08-24", kg: 89 }, { date: "2026-08-25", kg: 88 },
  ];
  assert.equal(bouw([], kort).weight.trend_change_kg_per_week, null);
});

test("de energiebalans zet het logboek tegen de onderhoudsbehoefte", () => {
  // 41 jaar, 90 kg, 180 cm, man: BMR 1825, onderhoud 1825 x 1,375 = 2509.
  const dagen = vlakkeReeks(30).map((d) => ({ ...d, totals: { ...d.totals, kcal: 2000 } }));
  const p = bouw(dagen, WEKELIJKS);
  assert.equal(p.energy_reconciliation.tdee_kcal, 2509);
  assert.equal(p.energy_reconciliation.avg_logged_kcal, 2000);
  assert.equal(p.energy_reconciliation.expected_change_kg_per_week, -0.46);
  assert.equal(p.energy_reconciliation.actual_change_kg_per_week, -0.28);
  // Het gat: je valt 0,18 kg per week minder af dan het logboek voorspelt.
  assert.equal(p.energy_reconciliation.gap_kg_per_week, 0.18);
});

// -- vlaggen: de zes scenario's uit het overdrachtsdocument -------------------

test("scenario 1 — weekend boven de doordeweekse dagen geeft weekend_drift", () => {
  const p = bouw(reeks((datum) => {
    const weekdag = (new Date(datum + "T12:00:00").getDay() + 6) % 7;
    return [regel(datum, 12, weekdag >= 5 ? 49 : 35)];
  }));
  assert.ok(p.flags.includes("weekend_drift"));
  assert.equal(p.by_weekday.zaterdag.avg_points, 49);
  assert.equal(p.by_weekday.maandag.avg_points, 35);
});

test("een vlak weekend geeft geen weekend_drift", () => {
  const p = bouw(vlakkeReeks(35));
  assert.ok(!p.flags.includes("weekend_drift"));
});

test("scenario 2 — een gat tussen logboek en weegschaal geeft energy_gap", () => {
  // Naleving 0,9 en toch een vlak trendgewicht: het logboek mist iets.
  const dagen = reeks((datum, i) => [regel(datum, 12, i > 0 && i % 10 === 0 ? 60 : 30)])
    .map((d) => ({ ...d, totals: { ...d.totals, kcal: 2000 } }));
  const vlak: Weging[] = WEKELIJKS.map((w) => ({ ...w, kg: 90 }));
  const p = bouw(dagen, vlak);
  assert.equal(p.budget.adherence_rate, 0.9);
  assert.equal(p.energy_reconciliation.gap_kg_per_week, 0.46);
  assert.ok(p.flags.includes("energy_gap"));
});

test("scenario 3 — stilstand bij goede naleving geeft plateau", () => {
  const dagen = vlakkeReeks(30);
  const vlak: Weging[] = WEKELIJKS.map((w) => ({ ...w, kg: 90 }));
  const p = bouw(dagen, vlak);
  assert.equal(p.budget.adherence_rate, 1);
  assert.equal(p.weight.trend_change_kg_per_week, 0);
  assert.ok(p.flags.includes("plateau"));
});

test("scenario 4 — structureel te weinig geeft underconsumption, ook op weinig data", () => {
  // Zes gelogde dagen op 28 punten: 70% van een budget van 40.
  const p = bouw(reeks((datum, i) => (i >= 78 ? [regel(datum, 12, 28)] : null)));
  assert.equal(p.meta.days_logged, 6);
  assert.equal(p.recent.days_under_80pct_budget_last_7, 6);
  assert.ok(p.flags.includes("underconsumption"));
  assert.ok(heeftGuardrail(p.flags));
  // De patroonvlaggen blijven weg: zes dagen is geen patroon.
  assert.ok(!p.flags.includes("weekend_drift"));
  assert.ok(!p.flags.includes("low_protein"));
});

test("scenario 5 — te snelle afname geeft rapid_loss", () => {
  const snel: Weging[] = [
    { date: "2026-08-11", kg: 95 }, { date: "2026-08-18", kg: 91 }, { date: "2026-08-25", kg: 87 },
  ];
  const p = bouw(vlakkeReeks(40), snel);
  assert.equal(p.weight.trend_change_kg_per_week, -1.37);
  assert.ok(p.flags.includes("rapid_loss"));
  assert.ok(heeftGuardrail(p.flags));
});

test("scenario 6 — te weinig data levert geen advies maar wel cijfers", () => {
  // Zes gelogde dagen verspreid over drie weken.
  const p = bouw(reeks((datum, i) => (i >= 63 && i % 3 === 0 ? [regel(datum, 12, 30)] : null)));
  const drempel = adviesDrempel(p);
  assert.equal(p.meta.days_logged, 7);
  assert.equal(drempel.genoeg, false);
  assert.ok(drempel.gelogdNodig > 0);
  // De cijfers zelf zijn er gewoon.
  assert.equal(p.budget.avg_points_per_day, 30);
});

test("de bewijslast is gehaald bij een volledig gevuld venster", () => {
  const drempel = adviesDrempel(bouw(vlakkeReeks(30)));
  assert.equal(drempel.genoeg, true);
  assert.equal(drempel.historieNodig, 0);
  assert.equal(drempel.gelogdNodig, 0);
});

// -- overige vlaggen ---------------------------------------------------------

test("weinig gelogde dagen in twee van de laatste vier weken geeft logging_gaps", () => {
  // Alleen de zondagen gelogd: één dag per week.
  const p = bouw(reeks((datum) =>
    ((new Date(datum + "T12:00:00").getDay() + 6) % 7 === 6 ? [regel(datum, 12, 30)] : null)));
  assert.ok(p.flags.includes("logging_gaps"));
  assert.deepEqual(p.recent.logged_days_per_week_last_4, [1, 1, 1, 1]);
});

test("een volledig gelogd venster geeft geen logging_gaps", () => {
  assert.ok(!bouw(vlakkeReeks(30)).flags.includes("logging_gaps"));
});

test("een groot aandeel na negenen geeft evening_load", () => {
  const p = bouw(reeks((datum) => [regel(datum, 12, 20), regel(datum, 22, 10)]));
  assert.equal(p.by_time_of_day.after_21, 0.33);
  assert.ok(p.flags.includes("evening_load"));
});

test("sterk uiteenlopende dagen geven high_variance", () => {
  const p = bouw(reeks((datum, i) => [regel(datum, 12, i % 2 === 0 ? 10 : 70)]));
  assert.equal(p.budget.avg_points_per_day, 40);
  assert.equal(p.budget.sd_points_per_day, 30);
  assert.ok(p.flags.includes("high_variance"));
});

test("patroonvlaggen blijven weg onder veertien gelogde dagen", () => {
  const p = bouw(reeks((datum, i) => (i >= 74 ? [regel(datum, 12, 90)] : null)));
  assert.equal(p.meta.days_logged, 10);
  assert.ok(!p.flags.includes("high_variance"));
  assert.ok(!p.flags.includes("low_fiber"));
  assert.ok(!p.flags.includes("evening_load"));
});

// -- eigenschappen van de laag zelf ------------------------------------------

test("buildFactPack is puur: dezelfde invoer geeft hetzelfde pakket", () => {
  const dagen = vlakkeReeks(35);
  const a = buildFactPack({ peildatum: PEILDATUM, dagen, wegingen: WEKELIJKS, profiel: profiel(), nu: NU });
  const b = buildFactPack({ peildatum: PEILDATUM, dagen, wegingen: WEKELIJKS, profiel: profiel(), nu: NU });
  assert.deepEqual(a, b);
});

test("buildFactPack laat de meegegeven dagen ongemoeid", () => {
  const dagen = vlakkeReeks(35);
  const kopie = JSON.parse(JSON.stringify(dagen));
  bouw(dagen, WEKELIJKS);
  assert.deepEqual(dagen, kopie);
});

test("een leeg logboek levert een geldig pakket zonder vlaggen op", () => {
  const p = bouw([]);
  assert.equal(p.meta.days_logged, 0);
  assert.equal(p.meta.completeness, 0);
  assert.equal(p.meta.first_logged_date, null);
  assert.equal(p.budget.avg_points_per_day, 0);
  assert.equal(p.nutrition.protein_g_per_kg, 0);
  assert.deepEqual(p.top_contributors, []);
  assert.deepEqual(p.flags, []);
  assert.equal(adviesDrempel(p).genoeg, false);
});

test("de vingerafdruk verandert zodra er iets gelogd wordt", () => {
  const dagen = vlakkeReeks(30);
  const basis = { peildatum: PEILDATUM, wegingen: WEKELIJKS, profiel: profiel() };
  const a = feitenVingerafdruk({ ...basis, dagen });
  assert.equal(a, feitenVingerafdruk({ ...basis, dagen }));

  const extra = [...dagen.slice(0, -1), dag(PEILDATUM, [regel(PEILDATUM, 12, 30), regel(PEILDATUM, 19, 10)])];
  assert.notEqual(a, feitenVingerafdruk({ ...basis, dagen: extra }));
  // Ook een gewijzigd budget hoort het pakket ongeldig te maken.
  assert.notEqual(a, feitenVingerafdruk({ ...basis, dagen, profiel: profiel({ daily_budget: 45 }) }));
});

test("de feitenlaag blijft ruim binnen een halve seconde op twaalf weken data", () => {
  const dagen = reeks((datum) =>
    Array.from({ length: 12 }, (_, i) => regel(datum, 7 + i, 4, { name: `Product ${i % 5}` })));
  const wegingen: Weging[] = vensterDatums(PEILDATUM)
    .filter((_, i) => i % 7 === 0)
    .map((date, i) => ({ date, kg: 92 - i * 0.2 }));

  const start = performance.now();
  const p = buildFactPack({ peildatum: PEILDATUM, dagen, wegingen, profiel: profiel(), nu: NU });
  const duur = performance.now() - start;

  assert.equal(p.meta.days_logged, 84);
  assert.ok(duur < 500, `feitenlaag duurde ${duur.toFixed(1)} ms`);
});

// -- instelbaar venster voor de evaluatielus ---------------------------------

test("een korter venster rekent met dezelfde regels over minder dagen", () => {
  const dagen = vlakkeReeks(35);
  const kort = buildFactPack({
    peildatum: PEILDATUM, dagen, wegingen: [], profiel: profiel(),
    vensterDagen: 14, nu: NU,
  });
  assert.equal(kort.meta.days_in_window, 14);
  assert.equal(kort.meta.days_logged, 14);
  assert.equal(kort.meta.window_start, "2026-08-12");
  assert.equal(kort.meta.window_weeks, 2);
  // Dezelfde rekenregels: het gemiddelde over veertien vlakke dagen is gelijk
  // aan dat over vierentachtig. Zonder die gelijkheid zou de evaluatielus het
  // verschil tussen twee formules meten in plaats van tussen twee weken.
  assert.equal(kort.budget.avg_points_per_day, bouw(dagen).budget.avg_points_per_day);
});

test("het venster staat standaard op twaalf weken", () => {
  const p = bouw(vlakkeReeks(35));
  assert.equal(p.meta.days_in_window, VENSTER_DAGEN);
  assert.equal(p.meta.window_weeks, 12);
});
