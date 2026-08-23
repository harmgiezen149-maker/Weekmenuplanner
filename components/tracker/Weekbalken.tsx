"use client";

import React from "react";
import type { WeekSamenvatting } from "@/lib/tracker/week";

// ---------------------------------------------------------------------------
// Punten per dag tegen het dagbudget.
//
// Dagen zonder logging krijgen bewust géén balk van nul: een dag die je vergat
// te loggen was geen dag zonder eten. Ze staan er als lege plek, en tellen ook
// niet mee in het gemiddelde.
//
// Over budget krijgt een eigen kleur én een getal erbij, zodat het ook zonder
// kleur te zien is.
// ---------------------------------------------------------------------------

const DAGLETTERS = ["ma", "di", "wo", "do", "vr", "za", "zo"];

const B = 170;
const MARGE = { boven: 20, onder: 30 };

export default function Weekbalken({ week }: { week: WeekSamenvatting }) {
  const breedte = 340;
  const vlakH = B - MARGE.boven - MARGE.onder;
  const basis = MARGE.boven + vlakH;

  const hoogsteWaarde = Math.max(week.dagbudget, ...week.dagen.map((d) => d.punten));
  const top = hoogsteWaarde * 1.1 || 1;
  const y = (punten: number) => basis - (punten / top) * vlakH;

  // 2 px lucht tussen de balken, zodat aangrenzende dagen niet aan elkaar plakken.
  const vak = breedte / 7;
  const balkB = vak - 10;

  const budgetY = y(week.dagbudget);

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${breedte} ${B}`} style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}
        role="img"
        aria-label={
          `Punten per dag tegen een dagbudget van ${week.dagbudget}. ` +
          week.dagen
            .map((d) => `${DAGLETTERS[index(d.datum)]}: ${d.gelogd ? `${d.punten} punten` : "niet gelogd"}`)
            .join(", ")
        }
      >
        <line x1={0} x2={breedte} y1={basis} y2={basis} stroke="var(--line)" strokeWidth={1} />

        {week.dagen.map((d, i) => {
          const x = i * vak + (vak - balkB) / 2;
          const over = d.overBudget > 0;

          if (!d.gelogd) {
            return (
              <g key={d.datum}>
                <line x1={x} x2={x + balkB} y1={basis - 3} y2={basis - 3}
                  stroke="var(--line)" strokeWidth={3} strokeDasharray="3 3" strokeLinecap="round" />
                <text x={x + balkB / 2} y={basis + 14} textAnchor="middle"
                  style={{ fontSize: 10, fill: "var(--sub)", fontWeight: 700, opacity: 0.5 }}>
                  {DAGLETTERS[index(d.datum)]}
                </text>
                <title>{`${d.datum}: niet gelogd`}</title>
              </g>
            );
          }

          const hoogte = Math.max(2, basis - y(d.punten));
          // Past het label in de balk, dan gaat het erin: erboven zou het bij
          // een dag vlak onder het budget op de budgetlijn belanden.
          const labelBinnen = hoogte >= 26;
          return (
            <g key={d.datum}>
              <path d={balkPad(x, basis - hoogte, balkB, hoogte, 4)}
                fill={over ? "var(--over)" : "var(--accent)"} />
              <text
                x={x + balkB / 2}
                y={labelBinnen ? basis - hoogte + 13 : basis - hoogte - 5}
                textAnchor="middle"
                style={{
                  fontSize: 10.5, fontWeight: 800,
                  fill: labelBinnen ? "var(--surface)" : (over ? "var(--over)" : "var(--sub)"),
                }}>
                {over ? `+${d.overBudget}` : d.punten}
              </text>
              <text x={x + balkB / 2} y={basis + 14} textAnchor="middle"
                style={{ fontSize: 10, fill: "var(--sub)", fontWeight: 700 }}>
                {DAGLETTERS[index(d.datum)]}
              </text>
              <title>
                {`${d.datum}: ${d.punten} punten${over ? `, ${d.overBudget} boven budget` : ""}`}
              </title>
            </g>
          );
        })}

        {/* Het budget als ijklijn, niet als tweede as. */}
        <line x1={0} x2={breedte} y1={budgetY} y2={budgetY}
          stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="5 4" opacity={0.55} />
      </svg>

      <figcaption style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, fontSize: 11.5, fontWeight: 600, color: "var(--sub)" }}>
        <Merk kleur="var(--accent)" tekst="Binnen budget" />
        <Merk kleur="var(--over)" tekst="Uit de weekbuffer" />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <svg width="16" height="10" aria-hidden="true">
            <line x1="0" y1="5" x2="16" y2="5" stroke="var(--ink)" strokeWidth="1.5"
              strokeDasharray="4 3" opacity="0.55" />
          </svg>
          Dagbudget {week.dagbudget}
        </span>
      </figcaption>
    </figure>
  );
}

function Merk({ kleur, tekst }: { kleur: string; tekst: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <svg width="10" height="10" aria-hidden="true">
        <rect width="10" height="10" rx="2.5" fill={kleur} />
      </svg>
      {tekst}
    </span>
  );
}

/** Balk met alleen de bovenkant afgerond; de voet blijft op de nullijn staan. */
function balkPad(x: number, y: number, b: number, h: number, r: number): string {
  const straal = Math.min(r, b / 2, h);
  return [
    `M${x},${y + h}`,
    `L${x},${y + straal}`,
    `Q${x},${y} ${x + straal},${y}`,
    `L${x + b - straal},${y}`,
    `Q${x + b},${y} ${x + b},${y + straal}`,
    `L${x + b},${y + h}`,
    "Z",
  ].join(" ");
}

/** 0 = maandag ... 6 = zondag. */
function index(datum: string): number {
  return (new Date(datum + "T12:00:00").getDay() + 6) % 7;
}
