"use client";

import React, { useState } from "react";
import { Check, Loader2, Scale, Trash2, TrendingDown } from "lucide-react";
import { T } from "./stijl";
import Trendgrafiek from "./Trendgrafiek";
import { nl, nlKg } from "@/lib/tracker/datum";
import type { WegingMetTrend, Voortgang } from "@/lib/tracker/gewicht";
import type { Profile } from "@/lib/tracker/types";

export interface GewichtGegevens {
  wegingen: WegingMetTrend[];
  profiel: Profile | null;
  tempoPerWeek: number | null;
  voortgang: Voortgang | null;
  moetWegen: boolean;
}

export default function Gewicht({
  gegevens, vandaag, bezig, fout, herberekend, onWeeg, onWis,
}: {
  gegevens: GewichtGegevens;
  vandaag: string;
  bezig: boolean;
  fout: string;
  herberekend: boolean;
  onWeeg: (kg: number, note?: string) => void;
  onWis: (datum: string) => void;
}) {
  const { wegingen, profiel, voortgang: v, tempoPerWeek: tempo } = gegevens;
  const laatste = wegingen.length > 0 ? wegingen[wegingen.length - 1] : null;
  const alGewogen = laatste?.date === vandaag;

  const [kg, setKg] = useState("");
  const kilo = getal(kg);

  return (
    <>
      {fout && <div style={T.fout}>{fout}</div>}

      {herberekend && (
        <div style={{ ...T.melding, borderColor: "var(--green)", color: "var(--ink)" }}>
          Je dagbudget is opnieuw berekend en staat nu op{" "}
          <strong>{profiel?.daily_budget} punten</strong>.
        </div>
      )}

      <div style={T.kaart}>
        <h2 style={{ ...T.sectieKop, margin: "0 0 10px" }}>
          {alGewogen ? "Weging van vandaag aanpassen" : "Wegen"}
        </h2>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label style={T.label} htmlFor="gw-kg">Gewicht (kg)</label>
            <input id="gw-kg" style={T.veld} value={kg} inputMode="decimal"
              placeholder={laatste ? nlKg(laatste.kg) : "95,0"}
              onChange={(e) => setKg(e.target.value)} />
          </div>
          <button
            style={{ ...T.primair, width: "auto", marginTop: 0, padding: "12px 18px", opacity: kilo > 0 && !bezig ? 1 : 0.5 }}
            disabled={kilo <= 0 || bezig}
            onClick={() => { onWeeg(kilo); setKg(""); }}
          >
            {bezig ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
            Opslaan
          </button>
        </div>
        <p style={T.hint}>
          Weeg steeds op hetzelfde moment, het liefst 's ochtends. Weeg je twee keer
          op één dag, dan vervangt de nieuwe meting de oude.
        </p>
      </div>

      {wegingen.length === 0 && (
        <div style={T.melding}>
          Nog niets gewogen. Na je eerste weging verschijnt hier een grafiek; na een
          paar wegingen wordt de trendlijn bruikbaar.
        </div>
      )}

      {laatste && (
        <div style={T.kaart}>
          <div style={T.ringWrap}>
            <div style={T.ringCijfers}>
              <div style={T.ringGroot}>{nlKg(laatste.trend_kg)} <span style={{ fontSize: 16 }}>kg</span></div>
              <div style={T.ringSub}>trendgewicht</div>
              <div style={{ ...T.ringRegel, color: "var(--sub)" }}>
                Laatst gewogen: {nlKg(laatste.kg)} kg op {korteDatum(laatste.date)}
              </div>
            </div>
            <Scale size={34} style={{ color: "var(--line)", flexShrink: 0 }} />
          </div>
          <p style={{ ...T.hint, marginTop: 12 }}>
            De app stuurt op de trend, niet op de losse meting. Een kilo verschil van
            dag tot dag is vocht; de trendlijn haalt dat eruit.
          </p>
        </div>
      )}

      {wegingen.length > 1 && (
        <div style={T.kaart}>
          <Trendgrafiek reeks={wegingen} streefKg={profiel?.goal_weight_kg} />
        </div>
      )}

      {v && (
        <div style={T.kaart}>
          <h2 style={{ ...T.sectieKop, margin: "0 0 12px" }}>Naar je streefgewicht</h2>
          <div style={T.balkKop}>
            <span>{nlKg(v.startKg)} kg bij de start</span>
            <span>{nlKg(v.streefKg)} kg doel</span>
          </div>
          <div style={T.balkBaan}>
            <div style={{
              ...T.balkVul,
              width: `${Math.round(v.aandeel * 100)}%`,
              background: v.bereikt ? "var(--green)" : "var(--accent)",
            }} />
          </div>
          <div style={{ ...T.uitslagRij, marginTop: 12 }}>
            <span style={T.uitslagLabel}>Afgevallen</span>
            <span style={T.uitslagWaarde}>{nlKg(v.afgevallenKg)} kg</span>
          </div>
          <div style={T.uitslagRij}>
            <span style={T.uitslagLabel}>Nog te gaan</span>
            <span style={T.uitslagWaarde}>{v.bereikt ? "bereikt" : `${nlKg(v.teGaanKg)} kg`}</span>
          </div>
          <div style={{ ...T.uitslagRij, borderBottom: "none" }}>
            <span style={T.uitslagLabel}>Tempo</span>
            <span style={T.uitslagWaarde}>
              {tempo == null
                ? "nog te weinig wegingen"
                : tempo > 0
                  ? <><TrendingDown size={13} style={{ verticalAlign: -2, color: "var(--green)" }} /> {nl(tempo, 2)} kg per week</>
                  : `${nl(Math.abs(tempo), 2)} kg per week erbij`}
            </span>
          </div>
        </div>
      )}

      {wegingen.length > 0 && (
        <>
          <h2 style={T.lijstKop}>Alle wegingen</h2>
          <div style={T.kaartStrak}>
            {[...wegingen].reverse().map((w) => (
              <div key={w.date} style={T.regel}>
                <div style={T.regelTekst}>
                  <div style={T.regelNaam}>{nlKg(w.kg)} kg</div>
                  <div style={T.regelSub}>
                    {korteDatum(w.date)} · trend {nlKg(w.trend_kg)} kg
                    {w.delta_kg !== 0 && ` · ${w.delta_kg < 0 ? "−" : "+"}${nl(Math.abs(w.delta_kg), 2)}`}
                  </div>
                </div>
                <button style={T.wisKnop} onClick={() => onWis(w.date)}
                  aria-label={`Weging van ${w.date} verwijderen`}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function korteDatum(datum: string): string {
  return new Date(datum + "T12:00:00")
    .toLocaleDateString("nl-NL", { day: "numeric", month: "long" });
}

function getal(s: string): number {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
