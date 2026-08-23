"use client";

import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, Settings, Scale } from "lucide-react";
import { T } from "./stijl";
import Ring from "./Ring";
import { toonPunten } from "@/lib/tracker/points";
import { MAALTIJDEN_TRACKER, MAALTIJD_LABEL } from "@/lib/tracker/types";
import { nl, verschuifDatum } from "@/lib/tracker/datum";
import type { Day, Entry, Maaltijd, Profile } from "@/lib/tracker/types";

const NL_DATUM = new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long" });

export function toonDatum(datum: string, vandaag: string): string {
  if (datum === vandaag) return "Vandaag";
  const d = new Date(datum + "T12:00:00");
  const gisteren = new Date(vandaag + "T12:00:00");
  gisteren.setDate(gisteren.getDate() - 1);
  if (d.toDateString() === gisteren.toDateString()) return "Gisteren";
  return NL_DATUM.format(d);
}

export default function Dagoverzicht({
  dag, profiel, datum, vandaag, buffer, moetWegen,
  onDatum, onWis, onToevoegen, onInstellingen, onWegen,
}: {
  dag: Day;
  profiel: Profile | null;
  datum: string;
  vandaag: string;
  /** Restant van de weekbuffer en het aantal dagen dat de week nog telt. */
  buffer: { rest: number; totaal: number; dagenTeGaan: number } | null;
  moetWegen: boolean;
  onDatum: (d: string) => void;
  onWis: (id: string) => void;
  onToevoegen: (m: Maaltijd) => void;
  onInstellingen: () => void;
  onWegen: () => void;
}) {
  const schaal = profiel?.points_scale ?? 1;
  const budget = profiel?.daily_budget ?? 0;

  // Eén afronding over het dagtotaal, niet per regel: zo stapelen
  // afrondingsfouten zich niet op over een dag met tien items.
  const gebruikt = toonPunten(dag.totals.points_raw, schaal);
  const rest = budget - gebruikt;

  const perMaaltijd = useMemo(() => {
    const groepen: Record<Maaltijd, Entry[]> = { ontbijt: [], lunch: [], diner: [], snack: [] };
    for (const e of dag.entries) (groepen[e.meal] ?? groepen.snack).push(e);
    return groepen;
  }, [dag.entries]);

  const verschuif = (dagen: number) => onDatum(verschuifDatum(datum, dagen));

  const eiwitDoel = profiel?.protein_target_g ?? 0;
  const eiwit = Math.round(dag.totals.protein_g);

  return (
    <>
      <div style={T.datumBalk}>
        <button style={T.datumKnop} onClick={() => verschuif(-1)} aria-label="Vorige dag">
          <ChevronLeft size={18} />
        </button>
        <span style={T.datumLabel}>{toonDatum(datum, vandaag)}</span>
        {datum !== vandaag && (
          <button style={T.vandaagKnop} onClick={() => onDatum(vandaag)}>Vandaag</button>
        )}
        <button
          style={{ ...T.datumKnop, opacity: datum >= vandaag ? 0.35 : 1 }}
          onClick={() => verschuif(1)}
          disabled={datum >= vandaag}
          aria-label="Volgende dag"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {moetWegen && profiel && (
        <button style={T.weegPrompt} onClick={onWegen}>
          <Scale size={20} style={{ flexShrink: 0 }} />
          <span style={{ textAlign: "left" }}>
            <span style={T.weegPromptKop}>Het is je weegdag</span>
            <span style={T.weegPromptSub}>
              Eén getal is genoeg. Daarna reset de weekbuffer en kijkt de app of je
              budget nog klopt.
            </span>
          </span>
        </button>
      )}

      {!profiel && (
        <div style={T.melding}>
          <strong style={{ color: "var(--ink)" }}>Nog geen profiel ingevuld.</strong><br />
          Vul je lengte, gewicht en activiteitsniveau in, dan berekent de app je dagbudget.
          <button style={T.primair} onClick={onInstellingen}>
            <Settings size={16} /> Naar instellingen
          </button>
        </div>
      )}

      {profiel && (
        <div style={T.kaart}>
          <div style={T.ringWrap}>
            <Ring gebruikt={gebruikt} budget={budget} />
            <div style={T.ringCijfers}>
              <div style={T.ringGroot}>{gebruikt}</div>
              <div style={T.ringSub}>van {budget} punten</div>
              <div style={{ ...T.ringRegel, color: rest < 0 ? "var(--red)" : "var(--green)" }}>
                {rest >= 0 ? `${rest} punten te gaan` : `${Math.abs(rest)} punten over budget`}
              </div>
            </div>
          </div>

          {buffer && (
            <div style={T.balkWrap}>
              <div style={T.balkKop}>
                <span>Weekbuffer</span>
                <span style={{ color: buffer.rest < 0 ? "var(--red)" : "var(--sub)" }}>
                  {buffer.rest < 0
                    ? `${Math.abs(buffer.rest)} eroverheen`
                    : `${buffer.rest} van ${buffer.totaal} over`}
                  {` · nog ${buffer.dagenTeGaan} ${buffer.dagenTeGaan === 1 ? "dag" : "dagen"}`}
                </span>
              </div>
              <div style={T.balkBaan}>
                <div style={{
                  ...T.balkVul,
                  width: `${Math.min(100, buffer.totaal > 0 ? ((buffer.totaal - buffer.rest) / buffer.totaal) * 100 : 0)}%`,
                  background: buffer.rest < 0 ? "var(--red)" : "var(--over)",
                }} />
              </div>
            </div>
          )}

          {eiwitDoel > 0 && (
            <div style={T.balkWrap}>
              <div style={T.balkKop}>
                <span>Eiwit</span>
                <span style={{ color: eiwit >= eiwitDoel ? "var(--green)" : "var(--sub)" }}>
                  {eiwit} / {eiwitDoel} g
                </span>
              </div>
              <div style={T.balkBaan}>
                <div style={{
                  ...T.balkVul,
                  width: `${Math.min(100, eiwitDoel > 0 ? (eiwit / eiwitDoel) * 100 : 0)}%`,
                  background: eiwit >= eiwitDoel ? "var(--green)" : "var(--accent)",
                }} />
              </div>
            </div>
          )}

          <div style={T.macroRij}>
            <span style={T.macro}><span style={T.macroWaarde}>{Math.round(dag.totals.kcal)}</span> kcal</span>
            <span style={T.macro}><span style={T.macroWaarde}>{nl(dag.totals.protein_g)}</span> g eiwit</span>
            <span style={T.macro}><span style={T.macroWaarde}>{nl(dag.totals.fat_g)}</span> g vet</span>
            <span style={T.macro}><span style={T.macroWaarde}>{nl(dag.totals.carbs_g)}</span> g koolh.</span>
            <span style={T.macro}><span style={T.macroWaarde}>{nl(dag.totals.fiber_g)}</span> g vezels</span>
          </div>
        </div>
      )}

      {MAALTIJDEN_TRACKER.map((m) => {
        const regels = perMaaltijd[m];
        const punten = toonPunten(regels.reduce((s, e) => s + e.points_raw, 0), schaal);
        return (
          <section key={m} style={T.kaartStrak}>
            <header style={T.maaltijdKop}>
              <span style={T.maaltijdNaam}>{MAALTIJD_LABEL[m]}</span>
              <span style={T.maaltijdPunten}>{punten} pt</span>
            </header>

            {regels.length === 0 && <div style={T.maaltijdLeeg}>Nog niets gelogd.</div>}

            {regels.map((e) => (
              <div key={e.id} style={T.regel}>
                <div style={T.regelTekst}>
                  <div style={T.regelNaam}>{e.name}</div>
                  <div style={T.regelSub}>
                    {toonHoeveelheid(e)}
                    {e.brand ? ` · ${e.brand}` : ""}
                    {` · ${Math.round(e.nutrients.kcal)} kcal`}
                  </div>
                </div>
                <span style={T.puntBadge}>{toonPunten(e.points_raw, schaal)}</span>
                <button style={T.wisKnop} onClick={() => onWis(e.id)} aria-label={`${e.name} verwijderen`}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}

            <button style={T.maaltijdPlus} onClick={() => onToevoegen(m)}>
              <Plus size={15} /> Toevoegen
            </button>
          </section>
        );
      })}
    </>
  );
}

function toonHoeveelheid(e: Entry): string {
  const hoev = nl(e.amount);
  return e.unit ? `${hoev} ${e.unit}` : hoev;
}
