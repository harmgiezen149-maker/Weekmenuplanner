"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { T } from "./stijl";
import Weekbalken from "./Weekbalken";
import { nl, verschuifDatum } from "@/lib/tracker/datum";
import type { WeekSamenvatting } from "@/lib/tracker/week";

export default function Weekoverzicht({
  week, dagenTeGaan, peildatum, vandaag, onPeildatum,
}: {
  week: WeekSamenvatting | null;
  dagenTeGaan: number;
  peildatum: string;
  vandaag: string;
  onPeildatum: (d: string) => void;
}) {
  if (!week) {
    return (
      <div style={T.melding}>
        Vul eerst je profiel in bij de instellingen, dan verschijnt hier je weekoverzicht.
      </div>
    );
  }

  const bufferAandeel = week.bufferTotaal > 0
    ? Math.min(100, (week.bufferGebruikt / week.bufferTotaal) * 100)
    : 0;
  const bufferOp = week.bufferRest < 0;
  const dezeWeek = week.start <= vandaag && vandaag <= week.eind;

  return (
    <>
      <div style={T.datumBalk}>
        <button style={T.datumKnop} onClick={() => onPeildatum(verschuifDatum(peildatum, -7))}
          aria-label="Vorige week">
          <ChevronLeft size={18} />
        </button>
        <span style={T.datumLabel}>
          {dezeWeek ? "Deze week" : `${kort(week.start)} – ${kort(week.eind)}`}
        </span>
        {!dezeWeek && (
          <button style={T.vandaagKnop} onClick={() => onPeildatum(vandaag)}>Nu</button>
        )}
        <button
          style={{ ...T.datumKnop, opacity: week.eind >= vandaag ? 0.35 : 1 }}
          disabled={week.eind >= vandaag}
          onClick={() => onPeildatum(verschuifDatum(peildatum, 7))}
          aria-label="Volgende week"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div style={T.kaart}>
        <h2 style={{ ...T.sectieKop, margin: "0 0 4px" }}>Punten per dag</h2>
        <p style={{ ...T.hint, margin: "0 0 12px" }}>
          {kort(week.start)} tot en met {kort(week.eind)}
        </p>
        <Weekbalken week={week} />
      </div>

      <div style={T.kaart}>
        <h2 style={{ ...T.sectieKop, margin: "0 0 12px" }}>Weekbuffer</h2>
        <div style={T.balkKop}>
          <span>{week.bufferGebruikt} van {week.bufferTotaal} gebruikt</span>
          <span style={{ color: bufferOp ? "var(--red)" : "var(--green)" }}>
            {bufferOp ? `${Math.abs(week.bufferRest)} eroverheen` : `${week.bufferRest} over`}
          </span>
        </div>
        <div style={T.balkBaan}>
          <div style={{
            ...T.balkVul,
            width: `${bufferAandeel}%`,
            background: bufferOp ? "var(--red)" : "var(--over)",
          }} />
        </div>
        <p style={T.hint}>
          De buffer vangt op wat je boven je dagbudget eet. Hij reset op je weegdag;
          {dezeWeek
            ? ` deze week zijn er nog ${dagenTeGaan} ${dagenTeGaan === 1 ? "dag" : "dagen"} te gaan.`
            : " deze week is afgesloten."}
        </p>
      </div>

      <div style={T.kaart}>
        <h2 style={{ ...T.sectieKop, margin: "0 0 8px" }}>Gemiddelde</h2>
        <div style={T.uitslagRij}>
          <span style={T.uitslagLabel}>Per gelogde dag</span>
          <span style={T.uitslagWaarde}>
            {week.gemiddeldePunten == null ? "—" : `${nl(week.gemiddeldePunten)} punten`}
          </span>
        </div>
        <div style={T.uitslagRij}>
          <span style={T.uitslagLabel}>Dagen gelogd</span>
          <span style={T.uitslagWaarde}>{week.gelogdeDagen} van 7</span>
        </div>
        <div style={{ ...T.uitslagRij, borderBottom: "none" }}>
          <span style={T.uitslagLabel}>Totaal deze week</span>
          <span style={T.uitslagWaarde}>{week.totaalPunten} punten</span>
        </div>
        <p style={T.hint}>
          Dagen zonder logging tellen niet mee in het gemiddelde — die waren geen dag
          van nul punten, ze zijn alleen niet bijgehouden.
        </p>
      </div>

      <div style={T.kaart}>
        <h2 style={{ ...T.sectieKop, margin: "0 0 12px" }}>Voedingsstoffen deze week</h2>
        <div style={T.macroRij}>
          <span style={T.macro}><span style={T.macroWaarde}>{Math.round(week.macros.kcal)}</span> kcal</span>
          <span style={T.macro}><span style={T.macroWaarde}>{nl(week.macros.protein_g)}</span> g eiwit</span>
          <span style={T.macro}><span style={T.macroWaarde}>{nl(week.macros.fat_g)}</span> g vet</span>
          <span style={T.macro}><span style={T.macroWaarde}>{nl(week.macros.carbs_g)}</span> g koolh.</span>
          <span style={T.macro}><span style={T.macroWaarde}>{nl(week.macros.fiber_g)}</span> g vezels</span>
        </div>
        {week.gelogdeDagen > 0 && (
          <p style={T.hint}>
            Dat is gemiddeld {Math.round(week.macros.kcal / week.gelogdeDagen)} kcal en{" "}
            {nl(week.macros.protein_g / week.gelogdeDagen)} g eiwit per gelogde dag.
          </p>
        )}
      </div>
    </>
  );
}

function kort(datum: string): string {
  return new Date(datum + "T12:00:00")
    .toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}
