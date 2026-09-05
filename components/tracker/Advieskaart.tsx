"use client";

import React from "react";
import { Loader2, Target, ShieldAlert } from "lucide-react";
import { T } from "./stijl";
import { nl } from "@/lib/tracker/datum";
import { metricLabel, AFWIJKING_LABEL } from "@/lib/tracker/advies";
import type { Advies, Afwijking, Weegmoment } from "@/lib/tracker/advies";

// ---------------------------------------------------------------------------
// Het advies bij het weegmoment.
//
// Volgorde is niet vrijblijvend: eerst de waarneming, dan de uitleg, dan de
// achtergrond, en pas daarna de actie. Een advies dat met de actie begint is
// een opdracht; een advies dat met de waarneming begint is een verklaring die
// je kunt natrekken.
//
// Een advies waarvan niet elk getal terug te voeren was op het feitenpakket
// wordt getoond mét die markering. Stilzwijgend accepteren is geen optie, en
// weggooien om één getal ook niet.
// ---------------------------------------------------------------------------

const S: Record<string, React.CSSProperties> = {
  kaart: {
    background: "var(--surface)", border: "1px solid var(--accent)",
    borderRadius: 18, padding: "18px 17px", marginBottom: 12,
  },
  merk: {
    display: "inline-block", fontSize: 10, fontWeight: 800, textTransform: "uppercase",
    letterSpacing: "0.06em", color: "var(--accent)", background: "var(--accent-soft)",
    borderRadius: 5, padding: "3px 8px", marginBottom: 10,
  },
  kop: { fontSize: 17.5, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.3, margin: "0 0 12px" },
  alinea: { fontSize: 14, lineHeight: 1.65, margin: "0 0 11px", color: "var(--ink)" },
  achtergrond: { fontSize: 13.5, lineHeight: 1.65, margin: "0 0 11px", color: "var(--sub)" },

  actie: {
    background: "var(--accent-soft)", borderRadius: 14, padding: "14px 15px", marginTop: 14,
  },
  actieKop: { display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 800, color: "var(--accent)", marginBottom: 6 },
  actieTekst: { fontSize: 13.5, lineHeight: 1.6, color: "var(--ink)", margin: 0 },
  actieMeta: { fontSize: 12, color: "var(--accent)", fontWeight: 600, marginTop: 9, lineHeight: 1.5 },

  voet: { fontSize: 12, color: "var(--sub)", lineHeight: 1.55, marginTop: 12, paddingTop: 11, borderTop: "1px solid var(--line)" },
  bezig: { display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, fontWeight: 600, color: "var(--accent)" },
};

/**
 * Waarom er nu een analyse loopt.
 *
 * Het weegmoment gaat voor: staat die open, dan is dat de aanleiding, ook als
 * er toevallig ook iets afwijkends speelt. Is het geen van beide — de knop
 * "vraag een analyse" — dan wordt er niets beweerd over de aanleiding.
 */
function aanleidingBezig(weegmoment: Weegmoment | null, afwijking: Afwijking | null): string {
  if (weegmoment?.open) return "Je weegmoment wordt geanalyseerd.";
  if (afwijking?.open && afwijking.vlag) {
    const label = AFWIJKING_LABEL[afwijking.vlag] ?? afwijking.vlag;
    return `${hoofdletter(label)} — dat wordt nu geanalyseerd.`;
  }
  return "Je cijfers worden geanalyseerd.";
}

const UITKOMST_LABEL: Record<string, string> = {
  verbeterd: "Bewogen richting het doel",
  deels: "Deels bewogen richting het doel",
  ongewijzigd: "Vrijwel niet bewogen",
  tegengesteld: "De andere kant op bewogen",
  onvoldoende: "Te weinig gelogd om te meten",
};

export default function Advieskaart({
  advies, weegmoment, afwijking, bezig, afgekeurd, fout,
}: {
  advies: Advies | null;
  weegmoment: Weegmoment | null;
  afwijking: Afwijking | null;
  bezig: boolean;
  afgekeurd: string[] | null;
  fout: string;
}) {
  if (bezig) {
    // Welke van de twee triggers dit is, want een weging kan ook een
    // afwijkingsmelding openen — en dan hier "je weegmoment" zeggen terwijl je
    // weegdag pas zondag is, klopt gewoon niet.
    return (
      <div style={S.kaart}>
        <div style={S.bezig}>
          <Loader2 size={18} className="spin" />
          {aanleidingBezig(weegmoment, afwijking)} Dit duurt een halve minuut.
        </div>
      </div>
    );
  }

  if (fout) return <div style={T.fout}>{fout}</div>;

  if (afgekeurd && afgekeurd.length > 0) {
    return (
      <div style={T.waarschuwing}>
        <strong>Er is deze keer geen advies.</strong> Het antwoord kwam twee keer niet door de
        controle: {afgekeurd.join("; ")}. De cijfers hieronder kloppen gewoon.
      </div>
    );
  }

  if (!advies) {
    // Zonder advies alleen iets zeggen als er iets te wachten valt. Een tracker
    // die nog niet zover is hoeft geen lege plek met een belofte te tonen.
    if (afwijking && !afwijking.open && afwijking.vlag) {
      // Er speelt wel iets, maar een melding is nu niet aan de orde. Dat wordt
      // gezegd, zonder er een aansporing van te maken.
      return (
        <div style={T.melding}>
          {hoofdletter(AFWIJKING_LABEL[afwijking.vlag] ?? afwijking.vlag)} — {afwijking.reden}.
        </div>
      );
    }
    if (!weegmoment?.datum || !weegmoment.reden || weegmoment.reden.includes("al een advies")) return null;
    return (
      <div style={T.melding}>
        Het advies verschijnt na je weging op de weegdag. {hoofdletter(weegmoment.reden)}.
      </div>
    );
  }

  const { payload } = advies;

  return (
    <section style={S.kaart}>
      <span style={S.merk}>
        {advies.trigger === "afwijking" && advies.aanleiding
          ? `Omdat ${AFWIJKING_LABEL[advies.aanleiding] ?? advies.aanleiding}`
          : `Bij je weging van ${toonDatum(advies.weeg_datum ?? advies.fact_pack_ref)}`}
      </span>
      <h2 style={S.kop}>{payload.headline}</h2>

      {payload.observation && <p style={S.alinea}>{payload.observation}</p>}
      {payload.explanation && <p style={S.alinea}>{payload.explanation}</p>}
      {payload.background && <p style={S.achtergrond}>{payload.background}</p>}

      <div style={S.actie}>
        <div style={S.actieKop}><Target size={15} /> {payload.action.title}</div>
        <p style={S.actieTekst}>{payload.action.description}</p>
        <div style={S.actieMeta}>
          Gemeten aan {metricLabel(payload.action.metric_key)}: {payload.action.target_direction === "up" ? "omhoog" : "omlaag"} naar{" "}
          {nl(payload.action.target_value, 2)}, over {payload.action.horizon_days} dagen.
          {advies.metric_start !== 0 && ` Bij uitgifte stond die op ${nl(advies.metric_start, 2)}.`}
        </div>
      </div>

      {advies.evaluation && (
        <div style={S.voet}>
          <strong>{UITKOMST_LABEL[advies.evaluation.uitkomst] ?? advies.evaluation.uitkomst}.</strong>{" "}
          {advies.evaluation.uitkomst === "onvoldoende" ? (
            <>Over de {advies.evaluation.dagen_gemeten} dagen sinds dit advies is te weinig gelogd
            om {metricLabel(payload.action.metric_key)} te kunnen meten.</>
          ) : (
            <>{hoofdletter(metricLabel(payload.action.metric_key))} ging van{" "}
            {nl(advies.evaluation.beginwaarde, 2)} naar {nl(advies.evaluation.eindwaarde, 2)},
            gemeten over {advies.evaluation.dagen_gemeten} dagen tot {toonDatum(advies.evaluation.gemeten_op)}.</>
          )}
        </div>
      )}

      {!advies.verified && (
        <div style={{ ...S.voet, display: "flex", gap: 9 }}>
          <ShieldAlert size={16} style={{ color: "var(--gold)", flexShrink: 0, marginTop: 1 }} />
          {/* Wat dit betekent hoort erbij te staan. "Niet terug te voeren op
              het feitenpakket" is waar, maar zegt een lezer niets — en een
              waarschuwing die je niet begrijpt lees je de volgende keer over. */}
          <span>
            <strong>Niet elk getal komt uit je eigen cijfers.</strong>{" "}
            {advies.onverklaarbare_getallen.map((n) => nl(n, 2)).join(", ")}
            {advies.onverklaarbare_getallen.length === 1 ? " staat" : " staan"} niet in wat de app
            over je heeft gemeten. Meestal is dat een vuistregel van buiten of iets dat het model
            zelf heeft uitgerekend; het kan kloppen, maar de app kan het niet nakijken. De cijfers
            in de grafieken hieronder zijn wél nagerekend.
          </span>
        </div>
      )}

      {payload.data_caveat && (
        <div style={S.voet}>Wat deze analyse niet ziet: {payload.data_caveat}</div>
      )}
    </section>
  );
}

function toonDatum(datum: string): string {
  return new Date(datum + "T12:00:00").toLocaleDateString("nl-NL", { day: "numeric", month: "long" });
}

function hoofdletter(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
