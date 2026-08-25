"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { T } from "./stijl";
import Weekdagbalken from "./Weekdagbalken";
import Dagverdeling from "./Dagverdeling";
import Advieskaart from "./Advieskaart";
import { trackerApi } from "./api";
import type { AdviesAntwoord } from "./api";
import { nl, nlKg } from "@/lib/tracker/datum";
import {
  VLAG_LABEL, GUARDRAIL_VLAGGEN, WEEKDAGEN, VENSTER_WEKEN,
  type AdviesDrempel, type FactPack,
} from "@/lib/tracker/feiten";

// ---------------------------------------------------------------------------
// Inzicht — fase A: de feitenlaag, puur en grafisch. Nog geen advies.
//
// Dit scherm haalt zijn eigen gegevens op in plaats van ze via TrackerApp te
// krijgen. Het feitenpakket is groot, wordt maar op één plek gebruikt en heeft
// een eigen verversknop; dat door de gedeelde schil trekken zou beide kanten
// omslachtiger maken.
//
// Toon: beschrijvend, nooit waarderend. Er staat wat er in de cijfers te zien
// is en waar het getal vandaan komt. Geen streaks, geen aansporingen, geen
// oordeel over eten of over de gebruiker.
// ---------------------------------------------------------------------------

const S: Record<string, React.CSSProperties> = {
  kaartKop: { display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 },
  kaartTitel: { fontSize: 14.5, fontWeight: 800, letterSpacing: "-0.01em", margin: 0 },
  kaartSub: { fontSize: 11.5, color: "var(--sub)", fontWeight: 600, marginLeft: "auto" },
  uitleg: { fontSize: 12.5, color: "var(--sub)", lineHeight: 1.55, margin: "10px 0 0" },

  dekking: { display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 },
  dekkingGroot: { fontSize: 30, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.03em" },
  dekkingSub: { fontSize: 12.5, color: "var(--sub)", fontWeight: 600 },

  cijferRaster: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))", gap: 10 },
  cijferVak: { background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 12, padding: "11px 13px" },
  cijferWaarde: { fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15 },
  cijferLabel: { fontSize: 11.5, color: "var(--sub)", fontWeight: 600, marginTop: 3, lineHeight: 1.4 },

  signaal: { display: "flex", gap: 10, padding: "11px 0", borderTop: "1px solid var(--line)" },
  signaalStip: { width: 7, height: 7, borderRadius: 999, marginTop: 6, flexShrink: 0 },
  signaalKop: { fontSize: 13.5, fontWeight: 700, lineHeight: 1.4 },
  signaalBewijs: { fontSize: 12, color: "var(--sub)", marginTop: 3, lineHeight: 1.5 },

  bijdrager: { display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: "1px solid var(--line)" },
  bijdragerNaam: { flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  bijdragerSub: { fontSize: 11.5, color: "var(--sub)", fontWeight: 600, flexShrink: 0 },
  bijdragerPunten: { fontSize: 13, fontWeight: 800, color: "var(--accent)", flexShrink: 0, minWidth: 44, textAlign: "right" },

  verversKnop: { display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--accent)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: "4px 0" },
};

export default function Inzicht({ peildatum }: { peildatum: string }) {
  const [pakket, setPakket] = useState<FactPack | null>(null);
  const [drempel, setDrempel] = useState<AdviesDrempel | null>(null);
  const [laden, setLaden] = useState(true);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");

  const [advies, setAdvies] = useState<AdviesAntwoord | null>(null);
  const [adviesBezig, setAdviesBezig] = useState(false);
  const [adviesFout, setAdviesFout] = useState("");
  // Het weegmoment mag maar één keer per keer dat dit scherm openstaat worden
  // aangevraagd. De server bewaakt het ook, maar zonder deze grendel zou de
  // dubbele render van de ontwikkelmodus meteen twee aanvragen sturen.
  const gevraagd = useRef(false);

  const haal = useCallback(async (ververs: boolean) => {
    if (ververs) setBezig(true);
    setFout("");
    try {
      const a = await trackerApi.getFeiten(peildatum, ververs);
      setPakket(a.pakket);
      setDrempel(a.drempel);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Er ging iets mis");
    } finally {
      setLaden(false);
      setBezig(false);
    }
  }, [peildatum]);

  useEffect(() => { void haal(false); }, [haal]);

  // Het advies staat los van de cijfers: gaat de modelaanroep mis, dan blijft
  // het dashboard gewoon staan.
  useEffect(() => {
    let afgebroken = false;
    (async () => {
      try {
        const eerst = await trackerApi.getAdvies(peildatum);
        if (afgebroken) return;
        setAdvies(eerst);

        // De trigger uit het ontwerp: na de weging op de weegdag, één keer.
        if (eerst.weegmoment?.open && !gevraagd.current) {
          gevraagd.current = true;
          setAdviesBezig(true);
          const na = await trackerApi.maakAdvies(peildatum);
          if (!afgebroken) setAdvies(na);
        }
      } catch (e) {
        if (!afgebroken) setAdviesFout(e instanceof Error ? e.message : "Het advies kon niet worden opgehaald");
      } finally {
        if (!afgebroken) setAdviesBezig(false);
      }
    })();
    return () => { afgebroken = true; };
  }, [peildatum]);

  if (laden) {
    return <div style={T.center}><Loader2 size={26} className="spin" style={{ color: "var(--accent)" }} /></div>;
  }
  if (fout) return <div style={T.fout}>{fout}</div>;
  if (!pakket) {
    return <div style={T.melding}>Vul eerst je profiel in bij Instellingen, dan kan Inzicht je patroon doorrekenen.</div>;
  }

  const m = pakket.meta;
  const guardrails = pakket.flags.filter((v) => (GUARDRAIL_VLAGGEN as readonly string[]).includes(v));
  const overige = pakket.flags.filter((v) => !(GUARDRAIL_VLAGGEN as readonly string[]).includes(v));

  return (
    <>
      <Advieskaart
        advies={advies?.advies ?? null}
        weegmoment={advies?.weegmoment ?? null}
        bezig={adviesBezig}
        afgekeurd={advies?.afgekeurd ?? null}
        fout={adviesFout}
      />

      {/* -- dekking van het venster -- */}
      <section style={T.kaart}>
        <div style={S.dekking}>
          <span style={S.dekkingGroot}>{m.days_logged}</span>
          <span style={S.dekkingSub}>van {m.days_in_window} dagen gelogd</span>
        </div>
        <div style={T.balkBaan}>
          <div style={{ ...T.balkVul, width: `${Math.round(m.completeness * 100)}%`, background: "var(--accent)" }} />
        </div>
        <p style={S.uitleg}>
          Alle cijfers hieronder gaan over de laatste {VENSTER_WEKEN} weken, tot en met{" "}
          {toonKorteDatum(m.reference_date)}. Dagen zonder logboek tellen nergens als nul mee —
          een dag die je niet bijhield was geen dag zonder eten.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <button style={S.verversKnop} onClick={() => void haal(true)} disabled={bezig}>
            <RefreshCw size={14} className={bezig ? "spin" : undefined} />
            {bezig ? "Bezig met doorrekenen" : "Opnieuw doorrekenen"}
          </button>
        </div>
      </section>

      {/* -- bewijslast: te weinig data voor uitspraken over patronen -- */}
      {drempel && !drempel.genoeg && (
        <div style={T.waarschuwing}>
          <strong>De cijfers staan er, maar een patroon is het nog niet.</strong>{" "}
          {drempel.historieNodig > 0
            ? `Er is nog ${drempel.historieNodig} ${drempel.historieNodig === 1 ? "dag" : "dagen"} historie nodig`
            : `Er zijn nog ${drempel.gelogdNodig} gelogde ${drempel.gelogdNodig === 1 ? "dag" : "dagen"} nodig in de laatste twee weken`}
          {" "}voordat er iets zinnigs over meerdere weken te zeggen valt.
        </div>
      )}

      {/* -- signalen -- */}
      {(guardrails.length > 0 || overige.length > 0) && (
        <section style={T.kaart}>
          <div style={S.kaartKop}>
            <h2 style={S.kaartTitel}>Wat opvalt</h2>
            <span style={S.kaartSub}>{pakket.flags.length} {pakket.flags.length === 1 ? "signaal" : "signalen"}</span>
          </div>

          {guardrails.map((vlag) => (
            <div key={vlag} style={S.signaal}>
              <span style={{ ...S.signaalStip, background: "var(--gold)" }} />
              <div>
                <div style={S.signaalKop}>{VLAG_LABEL[vlag] ?? vlag}</div>
                <div style={S.signaalBewijs}>{vlagBewijs(vlag, pakket)}</div>
              </div>
            </div>
          ))}

          {guardrails.length > 0 && (
            <p style={{ ...S.uitleg, marginTop: 12 }}>
              Te weinig eten of te snel afvallen ondermijnt het resultaat op termijn: spiermassa,
              metabole aanpassing en volhoudbaarheid. Houdt dit aan, dan is het het bespreken waard
              met je huisarts of een diëtist.
            </p>
          )}

          {overige.map((vlag) => (
            <div key={vlag} style={S.signaal}>
              <span style={{ ...S.signaalStip, background: "var(--accent)" }} />
              <div>
                <div style={S.signaalKop}>{VLAG_LABEL[vlag] ?? vlag}</div>
                <div style={S.signaalBewijs}>{vlagBewijs(vlag, pakket)}</div>
              </div>
            </div>
          ))}

          {pakket.flags.includes("logging_gaps") && (
            <p style={{ ...S.uitleg, marginTop: 12 }}>
              Onder de vijf gelogde dagen per week wordt deze analyse onbetrouwbaar. Dat is alles
              wat erover te zeggen valt.
            </p>
          )}
        </section>
      )}

      {/* -- punten per weekdag -- */}
      <section style={T.kaart}>
        <div style={S.kaartKop}>
          <h2 style={S.kaartTitel}>Punten per weekdag</h2>
          <span style={S.kaartSub}>gemiddeld over {VENSTER_WEKEN} weken</span>
        </div>
        <Weekdagbalken pakket={pakket} />
      </section>

      {/* -- verdeling over de dag -- */}
      <section style={T.kaart}>
        <div style={S.kaartKop}>
          <h2 style={S.kaartTitel}>Verdeling over de dag</h2>
          <span style={S.kaartSub}>aandeel van de punten</span>
        </div>
        <Dagverdeling pakket={pakket} />
      </section>

      {/* -- budget en spreiding -- */}
      <section style={T.kaart}>
        <div style={S.kaartKop}>
          <h2 style={S.kaartTitel}>Budget en spreiding</h2>
        </div>
        <div style={S.cijferRaster}>
          <Cijfer waarde={`${Math.round(pakket.budget.adherence_rate * 100)}%`}
            label={`van de ${m.days_logged} gelogde dagen binnen budget`} />
          <Cijfer waarde={nl(pakket.budget.avg_points_per_day)} label="gemiddeld per dag" />
          <Cijfer waarde={nl(pakket.budget.median_points_per_day)} label="mediaan per dag" />
          <Cijfer waarde={`± ${nl(pakket.budget.sd_points_per_day)}`} label="spreiding tussen de dagen" />
        </div>
        <p style={S.uitleg}>
          Ligt de mediaan onder het gemiddelde, dan trekken een paar uitschieters het gemiddelde
          omhoog. De spreiding vertelt hoe ver de dagen uit elkaar liggen — vaak meer dan het
          gemiddelde zelf.
        </p>
      </section>

      {/* -- weekbuffer -- */}
      <section style={T.kaart}>
        <div style={S.kaartKop}>
          <h2 style={S.kaartTitel}>Weekbuffer</h2>
          <span style={S.kaartSub}>{pakket.buffer.weeks_counted} hele weken</span>
        </div>
        <div style={S.cijferRaster}>
          <Cijfer waarde={`${nl(pakket.buffer.avg_weekly_used)} / ${pakket.budget.weekly_buffer}`}
            label="gemiddeld gebruikt per week" />
          <Cijfer waarde={`${pakket.buffer.weeks_fully_used}`}
            label={`${pakket.buffer.weeks_fully_used === 1 ? "week" : "weken"} waarin de buffer helemaal opging`} />
          <Cijfer
            waarde={pakket.buffer.avg_exhaustion_position != null
              ? `dag ${nl(pakket.buffer.avg_exhaustion_position)}`
              : "—"}
            label="moment waarop de buffer op was, geteld vanaf de weegdag" />
        </div>
      </section>

      {/* -- energiebalans -- */}
      <section style={T.kaart}>
        <div style={S.kaartKop}>
          <h2 style={S.kaartTitel}>Logboek tegen weegschaal</h2>
        </div>
        <div style={S.cijferRaster}>
          <Cijfer waarde={perWeek(pakket.energy_reconciliation.expected_change_kg_per_week)}
            label="voorspeld uit het logboek" icoon />
          <Cijfer waarde={perWeek(pakket.energy_reconciliation.actual_change_kg_per_week)}
            label="gemeten op de trendlijn" icoon />
          <Cijfer waarde={pakket.energy_reconciliation.gap_kg_per_week != null
            ? `${nl(Math.abs(pakket.energy_reconciliation.gap_kg_per_week), 2)} kg`
            : "—"} label="verschil per week" />
        </div>
        <p style={S.uitleg}>
          Het logboek voorspelt een verloop uit {pakket.energy_reconciliation.avg_logged_kcal} kcal
          per dag tegen een onderhoudsbehoefte van {pakket.energy_reconciliation.tdee_kcal} kcal.
          Loopt de weegschaal daarop achter, dan zit er meestal iets niet in het logboek — niet in
          je lichaam.
          {pakket.weight.current_trend_kg != null && (
            <> Trendgewicht nu: {nlKg(pakket.weight.current_trend_kg)} kg, streefgewicht{" "}
            {nlKg(pakket.weight.goal_kg)} kg.</>
          )}
        </p>
      </section>

      {/* -- voedingsstoffen -- */}
      <section style={T.kaart}>
        <div style={S.kaartKop}>
          <h2 style={S.kaartTitel}>Voedingsstoffen per dag</h2>
          <span style={S.kaartSub}>gemiddeld</span>
        </div>
        <div style={S.cijferRaster}>
          <Cijfer waarde={`${nl(pakket.nutrition.protein_g_per_kg, 2)} g`} label="eiwit per kilo lichaamsgewicht" />
          <Cijfer waarde={`${nl(pakket.nutrition.fiber_g)} g`} label="vezels" />
          <Cijfer waarde={`${nl(pakket.nutrition.satfat_g)} g`} label="verzadigd vet" />
          <Cijfer waarde={`${nl(pakket.nutrition.effective_sugar_g)} g`} label="effectieve suiker" />
          <Cijfer waarde={`${pakket.nutrition.kcal}`} label="kcal" />
          <Cijfer waarde={`${nl(pakket.activity.avg_weekly_points)} pt`}
            label={`beweging per week, ${nl(pakket.activity.sessions_per_week)} sessies`} />
        </div>
      </section>

      {/* -- recept tegen vrij -- */}
      {(pakket.recipe_vs_freestyle.recipe_days.count > 0
        && pakket.recipe_vs_freestyle.freestyle_days.count > 0) && (
        <section style={T.kaart}>
          <div style={S.kaartKop}>
            <h2 style={S.kaartTitel}>Met en zonder recept</h2>
          </div>
          <div style={S.cijferRaster}>
            <Cijfer waarde={nl(pakket.recipe_vs_freestyle.recipe_days.avg_points)}
              label={`punten op ${pakket.recipe_vs_freestyle.recipe_days.count} dagen met een recept uit je kookboek`} />
            <Cijfer waarde={nl(pakket.recipe_vs_freestyle.freestyle_days.avg_points)}
              label={`punten op ${pakket.recipe_vs_freestyle.freestyle_days.count} dagen zonder`} />
          </div>
        </section>
      )}

      {/* -- top-bijdragers -- */}
      {pakket.top_contributors.length > 0 && (
        <section style={T.kaart}>
          <div style={S.kaartKop}>
            <h2 style={S.kaartTitel}>Waar de punten heen gaan</h2>
            <span style={S.kaartSub}>cumulatief</span>
          </div>
          {pakket.top_contributors.map((c) => (
            <div key={c.name} style={S.bijdrager}>
              <span style={S.bijdragerNaam}>{c.name}</span>
              <span style={S.bijdragerSub}>
                {c.occurrences}× · {nl(c.avg_points)} pt
              </span>
              <span style={S.bijdragerPunten}>{nl(c.total_points, 0)}</span>
            </div>
          ))}
          <p style={S.uitleg}>
            Opgeteld over {VENSTER_WEKEN} weken. Iets kleins dat elke dag terugkomt staat hier
            hoger dan iets groots van één keer — dat is precies wat deze lijst laat zien.
          </p>
        </section>
      )}
    </>
  );
}

function Cijfer({ waarde, label, icoon }: { waarde: string; label: string; icoon?: boolean }) {
  return (
    <div style={S.cijferVak}>
      <div style={{ ...S.cijferWaarde, display: "flex", alignItems: "center", gap: 5 }}>
        {icoon && <Richting waarde={waarde} />}
        {waarde}
      </div>
      <div style={S.cijferLabel}>{label}</div>
    </div>
  );
}

/** Pijl bij een verloop, zodat de richting ook zonder het minteken leesbaar is. */
function Richting({ waarde }: { waarde: string }) {
  if (waarde === "—") return null;
  if (waarde.startsWith("−")) return <TrendingDown size={15} style={{ color: "var(--green)" }} />;
  if (waarde.startsWith("+")) return <TrendingUp size={15} style={{ color: "var(--over)" }} />;
  return <Minus size={15} style={{ color: "var(--sub)" }} />;
}

/** Kilo's per week met een echt minteken, of een streepje als het niet te zeggen is. */
function perWeek(kg: number | null): string {
  if (kg == null) return "—";
  if (kg === 0) return "0 kg";
  const teken = kg < 0 ? "−" : "+";
  return `${teken}${nl(Math.abs(kg), 2)} kg`;
}

function toonKorteDatum(datum: string): string {
  return new Date(datum + "T12:00:00").toLocaleDateString("nl-NL", { day: "numeric", month: "long" });
}

/**
 * De cijfers waar een signaal op rust, in één zin. Een signaal zonder de
 * getallen erbij is een oordeel; met de getallen erbij is het een waarneming
 * die je zelf kunt natrekken.
 */
function vlagBewijs(vlag: string, p: FactPack): string {
  const pct = (a: number) => `${Math.round(a * 100)}%`;

  switch (vlag) {
    case "weekend_drift": {
      const weekend = gewogenGemiddelde(p, [5, 6]);
      const doordeweeks = gewogenGemiddelde(p, [0, 1, 2, 3, 4]);
      return `Zaterdag en zondag samen ${nl(weekend)} punten per dag, tegen ${nl(doordeweeks)} van maandag tot vrijdag.`;
    }
    case "evening_load":
      return `${pct(p.by_time_of_day.after_21)} van de punten valt na 21:00.`;
    case "low_protein":
      return `${nl(p.nutrition.protein_g_per_kg, 2)} g eiwit per kilo lichaamsgewicht; als richtlijn wordt 1,2 g aangehouden.`;
    case "low_fiber":
      return `${nl(p.nutrition.fiber_g)} g vezels per dag; als richtlijn wordt 25 g aangehouden.`;
    case "high_variance":
      return `Spreiding van ${nl(p.budget.sd_points_per_day)} punten bij een gemiddelde van ${nl(p.budget.avg_points_per_day)}.`;
    case "logging_gaps":
      return `Gelogde dagen in de laatste vier weken: ${p.recent.logged_days_per_week_last_4.join(", ")}.`;
    case "plateau":
      return `Het trendgewicht beweegt ${nl(Math.abs(p.weight.trend_change_kg_per_week ?? 0), 2)} kg per week, bij ${pct(p.budget.adherence_rate)} naleving.`;
    case "energy_gap":
      return `Het logboek voorspelt ${perWeek(p.energy_reconciliation.expected_change_kg_per_week)} per week, de trendlijn laat ${perWeek(p.energy_reconciliation.actual_change_kg_per_week)} zien.`;
    case "buffer_early":
      return `De buffer was gemiddeld op dag ${nl(p.buffer.avg_exhaustion_position ?? 0)} van de week op, in ${p.buffer.weeks_fully_used} van ${p.buffer.weeks_counted} weken.`;
    case "underconsumption":
      return `${p.recent.days_under_80pct_budget_last_7} van de laatste ${p.recent.logged_days_last_7} gelogde dagen bleef onder 80% van het dagbudget van ${p.budget.current_daily_budget} punten.`;
    case "rapid_loss":
      return `Het trendgewicht daalt met ${nl(Math.abs(p.weight.trend_change_kg_per_week ?? 0), 2)} kg per week.`;
    default:
      return "";
  }
}

/** Gemiddelde punten over een aantal weekdagen, gewogen naar gelogde dagen. */
function gewogenGemiddelde(p: FactPack, indexen: number[]): number {
  let punten = 0;
  let dagen = 0;
  for (const i of indexen) {
    const rij = p.by_weekday[WEEKDAGEN[i]];
    if (!rij) continue;
    punten += rij.avg_points * rij.days_counted;
    dagen += rij.days_counted;
  }
  return dagen > 0 ? punten / dagen : 0;
}
