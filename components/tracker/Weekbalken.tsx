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
//
// Onderaan de staaf staat in het groen wat er die dag met bewegen verdiend is.
// Dat is geen tweede budgetlijn: het dagbudget blijft wat het is, er komt
// alleen ruimte bij. Een streep op "budget plus beweging" zou een budget
// suggereren dat per dag verschuift, en dat is niet hoe het werkt.
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
            .map((d) => `${DAGLETTERS[index(d.datum)]}: ${d.gelogd ? `${d.punten} punten` : "niet gelogd"}` +
            (d.gelogd && d.bewegingspunten > 0 ? `, ${d.bewegingspunten} erbij uit beweging` : ""))
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
          // Het groene voetstuk is niet meer dan er die dag gegeten is: een
          // wandeling van 8 punten op een dag van 5 punten zou anders een
          // staaf opleveren die groter is dan wat er op tafel stond.
          const groen = d.bewegingspunten > 0
            ? Math.min(hoogte, basis - y(Math.min(d.bewegingspunten, d.punten)))
            : 0;
          return (
            <g key={d.datum}>
              <path d={balkPad(x, basis - hoogte, balkB, hoogte, 4)}
                fill={over ? "var(--over)" : "var(--accent)"} />
              {groen > 0 && (
                <path
                  d={groen >= hoogte
                    ? balkPad(x, basis - groen, balkB, groen, 4)
                    : voetPad(x, basis - groen, balkB, groen)}
                  fill="var(--green)"
                />
              )}
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
                {`${d.datum}: ${d.punten} punten${over ? `, ${d.overBudget} boven budget` : ""}` +
                 (d.bewegingspunten > 0
                   ? `, waarvan ${d.bewegingspunten} verdiend met bewegen`
                   : "")}
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
        {week.bewegingspuntenTotaal > 0 && (
          <Merk kleur="var(--green)" tekst="Verdiend met bewegen" />
        )}
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

/**
 * Het groene voetstuk van een staaf.
 *
 * Rechte bovenkant: het is een deel van dezelfde staaf, geen apart blokje.
 * Vult het groen de hele staaf, dan tekent de aanroeper balkPad, zodat de
 * afgeronde kop behouden blijft.
 */
function voetPad(x: number, y: number, b: number, h: number): string {
  return `M${x},${y} L${x + b},${y} L${x + b},${y + h} L${x},${y + h} Z`;
}

/** 0 = maandag ... 6 = zondag. */
function index(datum: string): number {
  return (new Date(datum + "T12:00:00").getDay() + 6) % 7;
}
