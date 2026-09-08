"use client";

import React, { useId } from "react";

// Puntenring. Vult mee tot het dagbudget vol is; daarna kleurt hij oranje voor
// het deel dat uit de weekbuffer komt en rood zodra ook die op is.
export default function Ring({
  gebruikt, budget, maat = 108, dikte = 11,
}: { gebruikt: number; budget: number; maat?: number; dikte?: number }) {
  const straal = (maat - dikte) / 2;
  const omtrek = 2 * Math.PI * straal;
  const deel = budget > 0 ? Math.min(1, gebruikt / budget) : 0;
  const over = budget > 0 && gebruikt > budget;

  // Binnen budget krijgt de ring een licht kleurverloop naar het groen van
  // "verdiend met bewegen" — een subtiele wenk dat bewegen deze ring verder
  // laat vullen. Over budget blijft plat goud: dat is geen moment voor een
  // extra visueel accent.
  // Zonder de dubbele punten die useId() teruggeeft: die zijn in een SVG-id
  // toegestaan, maar niet overal even betrouwbaar te verwerken.
  const gradientId = "ring-" + useId().replace(/:/g, "");
  const kleur = over ? "var(--gold)" : `url(#${gradientId})`;
  const rest = Math.max(0, budget - gebruikt);

  return (
    <svg width={maat} height={maat} viewBox={`0 0 ${maat} ${maat}`} style={{ flexShrink: 0 }} role="img"
      aria-label={`${gebruikt} van ${budget} punten gebruikt`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--green)" />
        </linearGradient>
      </defs>
      <circle cx={maat / 2} cy={maat / 2} r={straal} fill="none" stroke="var(--line)" strokeWidth={dikte} />
      <circle
        cx={maat / 2} cy={maat / 2} r={straal} fill="none" stroke={kleur} strokeWidth={dikte}
        strokeLinecap="round" strokeDasharray={omtrek}
        strokeDashoffset={omtrek * (1 - deel)}
        transform={`rotate(-90 ${maat / 2} ${maat / 2})`}
        style={{ transition: "stroke-dashoffset 0.35s ease" }}
      />
      <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 26, fontWeight: 800, fill: "var(--ink)" }}>
        {rest > 0 ? rest : 0}
      </text>
      <text x="50%" y="66%" textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 10, fontWeight: 700, fill: "var(--sub)", letterSpacing: "0.04em" }}>
        {over ? "OVER BUDGET" : "TE GAAN"}
      </text>
    </svg>
  );
}
