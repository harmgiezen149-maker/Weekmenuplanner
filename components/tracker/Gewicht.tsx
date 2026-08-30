"use client";

import React, { useState } from "react";
import { Check, Loader2, Pencil, Scale, Trash2, TrendingDown, X } from "lucide-react";
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
  gegevens, vandaag, bezig, fout, herberekend, onWeeg, onWis, onWijzig,
}: {
  gegevens: GewichtGegevens;
  vandaag: string;
  bezig: boolean;
  fout: string;
  herberekend: boolean;
  onWeeg: (kg: number, datum?: string, note?: string) => void;
  onWis: (datum: string) => void;
  /** Een bestaande weging aanpassen; geeft een botsing terug in plaats van te overschrijven. */
  onWijzig: (v: { van: string; naar: string; kg: number; vervang?: boolean })
    => Promise<{ botsing?: { datum: string; kg: number } }>;
}) {
  const { wegingen, profiel, voortgang: v, tempoPerWeek: tempo } = gegevens;
  const laatste = wegingen.length > 0 ? wegingen[wegingen.length - 1] : null;
  // De weging daarvoor, om het echte verschil aan op te hangen.
  const vorige = wegingen.length > 1 ? wegingen[wegingen.length - 2] : null;

  const [kg, setKg] = useState("");
  const [datum, setDatum] = useState(vandaag);
  const kilo = getal(kg);

  // Op de gekozen dag staat al iets. Dat mag — een weging vervangen is de
  // bedoelde manier om er een te corrigeren — maar je hoort het te zien
  // voordat je op opslaan drukt, niet erna.
  const opDieDag = wegingen.find((w) => w.date === datum);

  // Welke weging op dit moment bewerkt wordt, en de vraag die openstaat als de
  // nieuwe datum al bezet is.
  const [bewerk, setBewerk] = useState<{ van: string; kg: string; datum: string } | null>(null);
  const [botsing, setBotsing] = useState<{ datum: string; kg: number } | null>(null);

  const beginBewerken = (w: WegingMetTrend) => {
    setBotsing(null);
    setBewerk({ van: w.date, kg: nlKg(w.kg), datum: w.date });
  };

  const bewaarBewerking = async (vervang = false) => {
    if (!bewerk) return;
    const nieuwKg = getal(bewerk.kg);
    if (nieuwKg <= 0) return;
    const uit = await onWijzig({
      van: bewerk.van, naar: bewerk.datum, kg: nieuwKg, ...(vervang ? { vervang } : {}),
    });
    if (uit.botsing) { setBotsing(uit.botsing); return; }
    setBewerk(null); setBotsing(null);
  };

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
          {opDieDag ? "Weging aanpassen" : "Wegen"}
        </h2>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label style={T.label} htmlFor="gw-kg">Gewicht (kg)</label>
            <input id="gw-kg" style={T.veld} value={kg} inputMode="decimal"
              placeholder={laatste ? nlKg(laatste.kg) : "95,0"}
              onChange={(e) => setKg(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            {/* Een dag overslaan en later invullen mag; vooruit wegen niet, want
                de trendlijn rekent vanaf de laatste meting. */}
            <label style={T.label} htmlFor="gw-datum">Datum</label>
            <input id="gw-datum" type="date" style={T.veld} value={datum} max={vandaag}
              onChange={(e) => setDatum(e.target.value || vandaag)} />
          </div>
        </div>
        <button
          style={{ ...T.primair, opacity: kilo > 0 && !bezig ? 1 : 0.5 }}
          disabled={kilo <= 0 || bezig}
          onClick={() => { onWeeg(kilo, datum); setKg(""); setDatum(vandaag); }}
        >
          {bezig ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
          {opDieDag ? "Vervangen" : "Opslaan"}
        </button>
        <p style={T.hint}>
          {opDieDag
            ? <>Op {korteDatum(datum)} staat al <strong>{nlKg(opDieDag.kg)} kg</strong>. Opslaan vervangt die meting.</>
            : <>Weeg steeds op hetzelfde moment, het liefst &apos;s ochtends. Eén weging per dag: een
              tweede op dezelfde dag vervangt de eerste.</>}
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
              {vorige && laatste.delta_meting_kg != null && laatste.delta_meting_kg !== 0 && (
                <div style={{
                  ...T.ringRegel,
                  fontWeight: 800,
                  color: laatste.delta_meting_kg < 0 ? "var(--green)" : "var(--ink)",
                }}>
                  {laatste.delta_meting_kg < 0 ? "−" : "+"}
                  {nlKg(Math.abs(laatste.delta_meting_kg))} kg
                  <span style={{ fontWeight: 600, color: "var(--sub)" }}>
                    {" "}op de weegschaal sinds {korteDatum(vorige.date)} ({nlKg(vorige.kg)} kg)
                  </span>
                </div>
              )}
            </div>
            <Scale size={34} style={{ color: "var(--line)", flexShrink: 0 }} />
          </div>
          <p style={{ ...T.hint, marginTop: 12 }}>
            De app stuurt op de trend, niet op de losse meting. Een kilo verschil van
            dag tot dag is vocht; de trendlijn haalt dat eruit — daarom loopt het
            trendgewicht achter op wat de weegschaal vanochtend zei.
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
              bewerk?.van === w.date ? (
                <div key={w.date} style={{ ...T.regel, display: "block" }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={T.label}>Gewicht (kg)</label>
                      <input style={T.veld} value={bewerk.kg} inputMode="decimal" autoFocus
                        onChange={(e) => setBewerk({ ...bewerk, kg: e.target.value })} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={T.label}>Datum</label>
                      <input type="date" style={T.veld} value={bewerk.datum} max={vandaag}
                        onChange={(e) => setBewerk({ ...bewerk, datum: e.target.value || bewerk.van })} />
                    </div>
                  </div>

                  {botsing && (
                    <p style={{ ...T.hint, color: "var(--over)" }}>
                      Op {korteDatum(botsing.datum)} staat al <strong>{nlKg(botsing.kg)} kg</strong>.
                      Er kan er maar één per dag zijn — die meting wordt vervangen.
                    </p>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button
                      style={{ ...T.primair, marginTop: 0, opacity: getal(bewerk.kg) > 0 && !bezig ? 1 : 0.5 }}
                      disabled={getal(bewerk.kg) <= 0 || bezig}
                      onClick={() => bewaarBewerking(botsing != null)}
                    >
                      {bezig ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                      {botsing ? "Toch vervangen" : "Opslaan"}
                    </button>
                    <button style={{ ...T.secundair, marginTop: 0, width: "auto", padding: "12px 16px" }}
                      onClick={() => { setBewerk(null); setBotsing(null); }}>
                      <X size={15} /> Annuleren
                    </button>
                  </div>
                </div>
              ) : (
                <div key={w.date} style={T.regel}>
                  <div style={T.regelTekst}>
                    {/* Het verschil op de weegschaal staat naast de meting waar
                        het bij hoort; het verschil in de trend achter de trend.
                        Eerst stond er één los getal achter "trend 89,0" dat de
                        trendsprong was maar bij de meting leek te horen. */}
                    <div style={T.regelNaam}>
                      {nlKg(w.kg)} kg
                      {w.delta_meting_kg != null && w.delta_meting_kg !== 0 && (
                        <span style={{
                          marginLeft: 7, fontSize: 12.5, fontWeight: 700,
                          color: w.delta_meting_kg < 0 ? "var(--green)" : "var(--sub)",
                        }}>
                          {teken(w.delta_meting_kg)}
                        </span>
                      )}
                    </div>
                    <div style={T.regelSub}>
                      {korteDatum(w.date)} · trend {nlKg(w.trend_kg)} kg
                      {w.delta_kg !== 0 && ` (${teken(w.delta_kg)})`}
                    </div>
                  </div>
                  <button style={T.wisKnop} onClick={() => beginBewerken(w)}
                    aria-label={`Weging van ${w.date} aanpassen`}>
                    <Pencil size={15} />
                  </button>
                  <button style={T.wisKnop} onClick={() => onWis(w.date)}
                    aria-label={`Weging van ${w.date} verwijderen`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              )
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** Een verschil met zijn teken ervoor, in kilo. */
function teken(kg: number): string {
  return `${kg < 0 ? "−" : "+"}${nl(Math.abs(kg), 2)}`;
}

function korteDatum(datum: string): string {
  return new Date(datum + "T12:00:00")
    .toLocaleDateString("nl-NL", { day: "numeric", month: "long" });
}

function getal(s: string): number {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
