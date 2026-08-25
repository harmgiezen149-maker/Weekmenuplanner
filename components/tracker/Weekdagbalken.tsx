"use client";

import React from "react";
import type { FactPack } from "@/lib/tracker/feiten";
import { WEEKDAGEN } from "@/lib/tracker/feiten";
import { nl } from "@/lib/tracker/datum";

// ---------------------------------------------------------------------------
// Gemiddelde punten per weekdag over het hele venster.
//
// Zelfde beeldtaal als de weekbalken op het weekoverzicht: het dagbudget is een
// ijklijn, geen tweede as, en een weekdag waarop nooit gelogd is krijgt een
// streepje in plaats van een balk van nul. Onder elke balk staat hoeveel dagen
// er in dat gemiddelde zitten — zonder dat getal is een gemiddelde niet te wegen.
// ---------------------------------------------------------------------------

const LETTERS = ["ma", "di", "wo", "do", "vr", "za", "zo"];

const B = 190;
const MARGE = { boven: 20, onder: 42 };

export default function Weekdagbalken({ pakket }: { pakket: FactPack }) {
  const breedte = 340;
  const vlakH = B - MARGE.boven - MARGE.onder;
  const basis = MARGE.boven + vlakH;

  const rijen = WEEKDAGEN.map((naam, i) => ({ naam, letter: LETTERS[i], ...pakket.by_weekday[naam] }));
  const budget = pakket.budget.current_daily_budget;

  const top = Math.max(budget, ...rijen.map((r) => r.avg_points)) * 1.12 || 1;
  const y = (punten: number) => basis - (punten / top) * vlakH;

  const vak = breedte / 7;
  const balkB = vak - 10;

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${breedte} ${B}`} style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}
        role="img"
        aria-label={
          `Gemiddelde punten per weekdag tegen een dagbudget van ${budget}. ` +
          rijen.map((r) => r.days_counted > 0
            ? `${r.naam}: ${nl(r.avg_points)} punten over ${r.days_counted} dagen`
            : `${r.naam}: niet gelogd`).join(", ")
        }
      >
        <line x1={0} x2={breedte} y1={basis} y2={basis} stroke="var(--line)" strokeWidth={1} />

        {rijen.map((r, i) => {
          const x = i * vak + (vak - balkB) / 2;
          const midden = x + balkB / 2;

          if (r.days_counted === 0) {
            return (
              <g key={r.naam}>
                <line x1={x} x2={x + balkB} y1={basis - 3} y2={basis - 3}
                  stroke="var(--line)" strokeWidth={3} strokeDasharray="3 3" strokeLinecap="round" />
                <text x={midden} y={basis + 15} textAnchor="middle"
                  style={{ fontSize: 10, fill: "var(--sub)", fontWeight: 700, opacity: 0.5 }}>{r.letter}</text>
                <title>{`${r.naam}: niet gelogd`}</title>
              </g>
            );
          }

          // Een weekdag telt als "vaak over budget" vanaf de helft van de keren.
          const vaakOver = r.over_budget_rate >= 0.5;
          const hoogte = Math.max(2, basis - y(r.avg_points));
          const labelBinnen = hoogte >= 26;

          return (
            <g key={r.naam}>
              <path d={balkPad(x, basis - hoogte, balkB, hoogte, 4)}
                fill={vaakOver ? "var(--over)" : "var(--accent)"} />
              <text x={midden} y={labelBinnen ? basis - hoogte + 13 : basis - hoogte - 5} textAnchor="middle"
                style={{
                  fontSize: 10.5, fontWeight: 800,
                  fill: labelBinnen ? "var(--surface)" : (vaakOver ? "var(--over)" : "var(--sub)"),
                }}>
                {nl(r.avg_points, 0)}
              </text>
              <text x={midden} y={basis + 15} textAnchor="middle"
                style={{ fontSize: 10, fill: "var(--sub)", fontWeight: 700 }}>{r.letter}</text>
              <text x={midden} y={basis + 27} textAnchor="middle"
                style={{ fontSize: 9, fill: "var(--sub)", fontWeight: 600, opacity: 0.7 }}>
                {r.days_counted}d
              </text>
              <title>
                {`${r.naam}: gemiddeld ${nl(r.avg_points)} punten over ${r.days_counted} gelogde dagen, ` +
                 `${Math.round(r.over_budget_rate * 100)}% daarvan boven budget`}
              </title>
            </g>
          );
        })}

        <line x1={0} x2={breedte} y1={y(budget)} y2={y(budget)}
          stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="5 4" opacity={0.55} />
      </svg>

      <figcaption style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8, fontSize: 11.5, fontWeight: 600, color: "var(--sub)" }}>
        <Merk kleur="var(--accent)" tekst="Meestal binnen budget" />
        <Merk kleur="var(--over)" tekst="Vaker over dan onder" />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <svg width="16" height="10" aria-hidden="true">
            <line x1="0" y1="5" x2="16" y2="5" stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.55" />
          </svg>
          Dagbudget {budget}
        </span>
      </figcaption>
    </figure>
  );
}

function Merk({ kleur, tekst }: { kleur: string; tekst: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <svg width="10" height="10" aria-hidden="true"><rect width="10" height="10" rx="2.5" fill={kleur} /></svg>
      {tekst}
    </span>
  );
}

/** Balk met alleen de bovenkant afgerond; de voet blijft op de nullijn staan. */
function balkPad(x: number, y: number, b: number, h: number, r: number): string {
  const straal = Math.min(r, b / 2, h);
  return [
    `M${x},${y + h}`, `L${x},${y + straal}`, `Q${x},${y} ${x + straal},${y}`,
    `L${x + b - straal},${y}`, `Q${x + b},${y} ${x + b},${y + straal}`,
    `L${x + b},${y + h}`, "Z",
  ].join(" ");
}
