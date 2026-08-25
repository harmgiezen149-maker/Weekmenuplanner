"use client";

import React, { useState } from "react";
import { T } from "./stijl";
import { metricLabel, AFWIJKING_LABEL } from "@/lib/tracker/advies";
import type { Advies, EvaluatieUitkomst } from "@/lib/tracker/advies";
import { nl } from "@/lib/tracker/datum";

// ---------------------------------------------------------------------------
// De adviesgeschiedenis.
//
// Adviezen worden nooit gewist, en dat is precies waarom deze lijst er is: pas
// over meerdere adviezen heen is te zien of er iets beweegt, of dat dezelfde
// invalshoek steeds opnieuw langskomt.
//
// Elke uitkomst staat er zoals hij gemeten is, ook "de andere kant op". Dat is
// informatie, geen oordeel — dus geen rood, geen kruisje, geen toon.
// ---------------------------------------------------------------------------

const UITKOMST: Record<EvaluatieUitkomst, { label: string; kleur: string }> = {
  verbeterd: { label: "Bewogen richting het doel", kleur: "var(--green)" },
  deels: { label: "Deels bewogen", kleur: "var(--accent)" },
  ongewijzigd: { label: "Vrijwel niet bewogen", kleur: "var(--sub)" },
  tegengesteld: { label: "De andere kant op", kleur: "var(--over)" },
  onvoldoende: { label: "Te weinig gelogd om te meten", kleur: "var(--sub)" },
};

const TRIGGER_LABEL: Record<string, string> = {
  weegmoment: "bij je weging",
  afwijking: "uit zichzelf gemeld",
  verzoek: "op je verzoek",
};

const S: Record<string, React.CSSProperties> = {
  rij: { display: "flex", gap: 12, paddingBottom: 16 },
  rail: { display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 12 },
  stip: { width: 9, height: 9, borderRadius: 999, marginTop: 5, flexShrink: 0 },
  lijn: { flex: 1, width: 2, background: "var(--line)", marginTop: 4, borderRadius: 999 },
  inhoud: { flex: 1, minWidth: 0 },
  datum: { fontSize: 11.5, color: "var(--sub)", fontWeight: 700, marginBottom: 3 },
  kop: { fontSize: 14, fontWeight: 700, lineHeight: 1.4, marginBottom: 4 },
  actie: { fontSize: 12.5, color: "var(--sub)", lineHeight: 1.5 },
  uitslag: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, marginTop: 6 },
  meer: { display: "block", width: "100%", background: "none", border: "none", color: "var(--accent)", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "8px 0" },
};

const EERST = 5;

export default function Tijdlijn({ adviezen }: { adviezen: Advies[] }) {
  const [alles, setAlles] = useState(false);
  if (adviezen.length === 0) return null;

  const zichtbaar = alles ? adviezen : adviezen.slice(0, EERST);

  return (
    <section style={T.kaart}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
        <h2 style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: "-0.01em", margin: 0 }}>
          Eerdere adviezen
        </h2>
        <span style={{ fontSize: 11.5, color: "var(--sub)", fontWeight: 600, marginLeft: "auto" }}>
          {adviezen.length} in totaal
        </span>
      </div>

      {zichtbaar.map((a, i) => {
        const uitslag = a.evaluation ? UITKOMST[a.evaluation.uitkomst] : null;
        const laatste = i === zichtbaar.length - 1;
        return (
          <div key={a.id} style={S.rij}>
            <div style={S.rail}>
              <span style={{ ...S.stip, background: uitslag?.kleur ?? "var(--line)" }} />
              {!laatste && <span style={S.lijn} />}
            </div>
            <div style={S.inhoud}>
              <div style={S.datum}>
                {toonDatum(a.created_at.slice(0, 10))} · {TRIGGER_LABEL[a.trigger] ?? a.trigger}
                {a.trigger === "afwijking" && a.aanleiding
                  ? `: ${AFWIJKING_LABEL[a.aanleiding] ?? a.aanleiding}`
                  : ""}
              </div>
              <div style={S.kop}>{a.payload.headline}</div>
              <div style={S.actie}>
                {a.payload.action.title} — gemeten aan {metricLabel(a.payload.action.metric_key)},
                {" "}{a.payload.action.target_direction === "up" ? "omhoog" : "omlaag"} naar{" "}
                {nl(a.payload.action.target_value, 2)}.
              </div>
              {uitslag && a.evaluation && (
                <div style={{ ...S.uitslag, color: uitslag.kleur }}>
                  {uitslag.label}
                  <span style={{ color: "var(--sub)", fontWeight: 600 }}>
                    ({nl(a.evaluation.beginwaarde, 2)} → {nl(a.evaluation.eindwaarde, 2)})
                  </span>
                </div>
              )}
              {!a.evaluation && (
                <div style={{ ...S.uitslag, color: "var(--sub)" }}>Nog niet gemeten</div>
              )}
              {!a.verified && (
                <div style={{ fontSize: 11.5, color: "var(--sub)", marginTop: 4 }}>
                  Niet volledig geverifieerd.
                </div>
              )}
            </div>
          </div>
        );
      })}

      {adviezen.length > EERST && (
        <button style={S.meer} onClick={() => setAlles(!alles)}>
          {alles ? "Toon minder" : `Toon alle ${adviezen.length}`}
        </button>
      )}
    </section>
  );
}

function toonDatum(datum: string): string {
  return new Date(datum + "T12:00:00").toLocaleDateString("nl-NL", {
    day: "numeric", month: "short", year: "numeric",
  });
}
