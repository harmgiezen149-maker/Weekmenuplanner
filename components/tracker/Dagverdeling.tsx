"use client";

import React from "react";
import type { FactPack, Dagblok } from "@/lib/tracker/feiten";

// ---------------------------------------------------------------------------
// Welk deel van de punten op welk moment van de dag valt.
//
// Eén balk, vijf segmenten, oplopend van licht naar donker. De blokken zijn
// geordend — vroeg tot laat — en dan hoort er één kleurverloop bij en geen
// palet van losse kleuren. Elk segment staat ook in de legenda met zijn
// percentage erbij, zodat het beeld niet van kleur afhangt.
// ---------------------------------------------------------------------------

const BLOKKEN: { sleutel: Dagblok; label: string; kleur: string }[] = [
  { sleutel: "before_10", label: "voor 10:00", kleur: "#cfcbf7" },
  { sleutel: "h10_14", label: "10 – 14", kleur: "#aaa3ef" },
  { sleutel: "h14_18", label: "14 – 18", kleur: "#867ce8" },
  { sleutel: "h18_21", label: "18 – 21", kleur: "#6459e3" },
  { sleutel: "after_21", label: "na 21:00", kleur: "#4338ca" },
];

export default function Dagverdeling({ pakket }: { pakket: FactPack }) {
  const rijen = BLOKKEN.map((b) => ({ ...b, aandeel: pakket.by_time_of_day[b.sleutel] }));
  const totaal = rijen.reduce((s, r) => s + r.aandeel, 0);

  if (totaal === 0) {
    return <p style={{ fontSize: 13, color: "var(--sub)", margin: 0 }}>Nog geen regels met punten in dit venster.</p>;
  }

  return (
    <figure style={{ margin: 0 }}>
      <div
        style={{ display: "flex", height: 26, borderRadius: 8, overflow: "hidden", border: "1px solid var(--line)" }}
        role="img"
        aria-label={
          "Aandeel van de punten per dagdeel: " +
          rijen.map((r) => `${r.label} ${pct(r.aandeel)}`).join(", ")
        }
      >
        {rijen.map((r) => (
          r.aandeel > 0 ? (
            <div key={r.sleutel} title={`${r.label}: ${pct(r.aandeel)}`}
              style={{
                width: `${(r.aandeel / totaal) * 100}%`, background: r.kleur,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              {r.aandeel >= 0.12 && (
                <span style={{ fontSize: 10.5, fontWeight: 800, color: r.aandeel >= 0.3 ? "#fff" : "var(--ink)" }}>
                  {pct(r.aandeel)}
                </span>
              )}
            </div>
          ) : null
        ))}
      </div>

      <figcaption style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 10, fontSize: 11.5, fontWeight: 600, color: "var(--sub)" }}>
        {rijen.map((r) => (
          <span key={r.sleutel} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg width="10" height="10" aria-hidden="true"><rect width="10" height="10" rx="2.5" fill={r.kleur} /></svg>
            {r.label}
            <strong style={{ color: "var(--ink)", fontWeight: 800 }}>{pct(r.aandeel)}</strong>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

function pct(aandeel: number): string {
  return `${Math.round(aandeel * 100)}%`;
}
