"use client";

import React from "react";
import { nl, nlKg } from "@/lib/tracker/datum";
import type { WegingMetTrend } from "@/lib/tracker/gewicht";

// ---------------------------------------------------------------------------
// Gewicht over tijd: losse metingen als terugtredende punten, de trendlijn als
// hoofdfiguur. Dagschommelingen van een kilo zijn vocht, geen vet, dus de
// trend is het getal waar je op stuurt en krijgt daarom het meeste gewicht in
// het beeld.
//
// De twee reeksen verschillen niet alleen in kleur maar ook in vorm — punten
// tegen lijn — zodat het onderscheid ook zonder kleur leesbaar blijft.
// ---------------------------------------------------------------------------

const B = 260;              // tekenhoogte
const MARGE = { boven: 16, rechts: 42, onder: 22, links: 8 };

export default function Trendgrafiek({
  reeks, streefKg,
}: {
  reeks: WegingMetTrend[];
  streefKg?: number;
}) {
  if (reeks.length === 0) return null;

  const breedte = 340;
  const vlakB = breedte - MARGE.links - MARGE.rechts;
  const vlakH = B - MARGE.boven - MARGE.onder;

  const waarden = reeks.flatMap((w) => [w.kg, w.trend_kg]);
  // Het streefgewicht doet alleen mee in de schaal als het dichtbij ligt;
  // anders wordt de grafiek platgedrukt door een doel dat nog ver weg is.
  const min0 = Math.min(...waarden);
  const max0 = Math.max(...waarden);
  const toonStreef = streefKg != null && streefKg > min0 - (max0 - min0 || 2) - 1;

  const min = Math.min(min0, toonStreef ? streefKg! : min0);
  const max = Math.max(max0, toonStreef ? streefKg! : max0);
  const speling = Math.max(0.5, (max - min) * 0.15);
  const onder = min - speling;
  const boven = max + speling;

  const x = (i: number) =>
    MARGE.links + (reeks.length === 1 ? vlakB / 2 : (i / (reeks.length - 1)) * vlakB);
  const y = (kg: number) =>
    MARGE.boven + vlakH - ((kg - onder) / (boven - onder || 1)) * vlakH;

  const trendPad = reeks.map((w, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(w.trend_kg)}`).join(" ");
  const laatste = reeks[reeks.length - 1];
  const eerste = reeks[0];

  // Twee ijkwaarden op de as: meer regels maken het beeld drukker zonder
  // meer te vertellen.
  const assen = [boven - speling, onder + speling];

  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox={`0 0 ${breedte} ${B}`} style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}
        role="img"
        aria-label={
          `Gewicht van ${nlKg(eerste.kg)} kilo op ${eerste.date} naar ${nlKg(laatste.kg)} kilo op ` +
          `${laatste.date}. Trend nu ${nlKg(laatste.trend_kg)} kilo.`
        }
      >
        {assen.map((kg) => (
          <g key={kg}>
            <line x1={MARGE.links} x2={breedte - MARGE.rechts} y1={y(kg)} y2={y(kg)}
              stroke="var(--line)" strokeWidth={1} />
            <text x={breedte - MARGE.rechts + 6} y={y(kg)} dominantBaseline="middle"
              style={{ fontSize: 10, fill: "var(--sub)", fontWeight: 600 }}>
              {nl(kg)}
            </text>
          </g>
        ))}

        {toonStreef && (
          <g>
            <line x1={MARGE.links} x2={breedte - MARGE.rechts} y1={y(streefKg!)} y2={y(streefKg!)}
              stroke="var(--green)" strokeWidth={1.5} strokeDasharray="5 4" />
            <text x={breedte - MARGE.rechts + 6} y={y(streefKg!)} dominantBaseline="middle"
              style={{ fontSize: 10, fill: "var(--green)", fontWeight: 700 }}>
              doel
            </text>
          </g>
        )}

        {/* De trendlijn is de hoofdfiguur. */}
        <path d={trendPad} fill="none" stroke="var(--accent)" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" />

        {/* Losse metingen: kleiner, grijs, met een rand in de achtergrondkleur
            zodat ze leesbaar blijven waar ze de lijn kruisen. */}
        {reeks.map((w, i) => (
          <circle key={w.date} cx={x(i)} cy={y(w.kg)} r={4}
            fill="var(--sub)" stroke="var(--surface)" strokeWidth={2}>
            <title>{`${w.date}: ${nlKg(w.kg)} kg (trend ${nlKg(w.trend_kg)} kg)`}</title>
          </circle>
        ))}

        {/* Alleen de laatste waarde krijgt een label; een getal bij elk punt
            maakt het beeld onleesbaar. */}
        <circle cx={x(reeks.length - 1)} cy={y(laatste.trend_kg)} r={5}
          fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
        <text x={x(reeks.length - 1) - 10} y={y(laatste.trend_kg) + 4} textAnchor="end"
          style={{ fontSize: 12, fill: "var(--ink)", fontWeight: 800 }}>
          {nlKg(laatste.trend_kg)}
        </text>

        <text x={MARGE.links} y={B - 4}
          style={{ fontSize: 10, fill: "var(--sub)", fontWeight: 600 }}>
          {korteDatum(eerste.date)}
        </text>
        <text x={breedte - MARGE.rechts} y={B - 4} textAnchor="end"
          style={{ fontSize: 10, fill: "var(--sub)", fontWeight: 600 }}>
          {korteDatum(laatste.date)}
        </text>
      </svg>

      <figcaption style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 11.5, fontWeight: 600, color: "var(--sub)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <svg width="16" height="10" aria-hidden="true">
            <line x1="0" y1="5" x2="16" y2="5" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Trend
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <svg width="16" height="10" aria-hidden="true">
            <circle cx="8" cy="5" r="3.5" fill="var(--sub)" />
          </svg>
          Weging
        </span>
      </figcaption>
    </figure>
  );
}

function korteDatum(datum: string): string {
  const d = new Date(datum + "T12:00:00");
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}
