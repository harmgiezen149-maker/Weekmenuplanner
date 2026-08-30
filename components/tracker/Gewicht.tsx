"use client";

import React, { useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2, Pencil, Scale, Trash2, TrendingDown, X } from "lucide-react";
import { T } from "./stijl";
import Trendgrafiek from "./Trendgrafiek";
import { nl, nlKg } from "@/lib/tracker/datum";
import { bmi, bmiKlasse } from "@/lib/tracker/gewicht";
import type { WegingMetTrend, Voortgang } from "@/lib/tracker/gewicht";
import type { Meting } from "./api";
import type { Profile } from "@/lib/tracker/types";

/** De extra velden zoals ze in het formulier staan: ruwe tekst. */
interface Velden {
  vet: string;
  spier: string;
  spierEenheid: "kg" | "pct";
  vocht: string;
}

function legeVelden(): Velden {
  return { vet: "", spier: "", spierEenheid: "kg", vocht: "" };
}

/**
 * De velden omzetten naar wat de server verwacht.
 *
 * Een leeg veld wordt `null` en niet weggelaten: bij het aanpassen van een
 * weging betekent weglaten "laat staan zoals het was", en dan zou een veld dat
 * je bewust leeghaalt gewoon blijven staan.
 */
function meting(v: Velden): Meting {
  return {
    vet_pct: getalOfNull(v.vet),
    vocht_pct: getalOfNull(v.vocht),
    spier: getalOfNull(v.spier),
    spier_eenheid: v.spierEenheid,
  };
}

function getalOfNull(s: string): number | null {
  const n = Number(String(s).replace(",", "."));
  return s.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

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
  onWeeg: (kg: number, datum?: string, meting?: Meting, note?: string) => void;
  onWis: (datum: string) => void;
  /** Een bestaande weging aanpassen; geeft een botsing terug in plaats van te overschrijven. */
  onWijzig: (v: { van: string; naar: string; kg: number; vervang?: boolean } & Meting)
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
  const [bewerk, setBewerk] = useState<
    { van: string; kg: string; datum: string } & Velden | null
  >(null);

  // De extra metingen van een weegschaal met lichaamsanalyse. Dichtgeklapt,
  // want de meeste wegingen zijn één getal en een rij lege velden maakt van
  // wegen een formulier.
  const [meerOpen, setMeerOpen] = useState(false);
  const [velden, setVelden] = useState<Velden>(legeVelden());
  const [botsing, setBotsing] = useState<{ datum: string; kg: number } | null>(null);

  const beginBewerken = (w: WegingMetTrend) => {
    setBotsing(null);
    setBewerk({
      van: w.date, kg: nlKg(w.kg), datum: w.date,
      vet: w.vet_pct != null ? nlKg(w.vet_pct) : "",
      spier: w.spier_kg != null ? nlKg(w.spier_kg) : "",
      spierEenheid: "kg",
      vocht: w.vocht_pct != null ? nlKg(w.vocht_pct) : "",
    });
  };

  const bewaarBewerking = async (vervang = false) => {
    if (!bewerk) return;
    const nieuwKg = getal(bewerk.kg);
    if (nieuwKg <= 0) return;
    const uit = await onWijzig({
      van: bewerk.van, naar: bewerk.datum, kg: nieuwKg, ...(vervang ? { vervang } : {}),
      ...meting(bewerk),
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
        <button style={T.meerKnop} onClick={() => setMeerOpen((o) => !o)} aria-expanded={meerOpen}>
          {meerOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Meer van je weegschaal
          {!meerOpen && ingevuld(velden) > 0 && ` (${ingevuld(velden)} ingevuld)`}
        </button>

        {meerOpen && <MeerVelden waarden={velden} onWijzig={(v) => setVelden((p) => ({ ...p, ...v }))} />}

        <button
          style={{ ...T.primair, opacity: kilo > 0 && !bezig ? 1 : 0.5 }}
          disabled={kilo <= 0 || bezig}
          onClick={() => {
            onWeeg(kilo, datum, meting(velden));
            setKg(""); setDatum(vandaag); setVelden(legeVelden());
          }}
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
          <Samenstelling weging={laatste} lengteCm={profiel?.height_cm} />

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

                  <MeerVelden
                    waarden={bewerk}
                    onWijzig={(v) => setBewerk({ ...bewerk, ...v })}
                  />

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
                    {(w.vet_pct != null || w.spier_kg != null || w.vocht_pct != null) && (
                      <div style={T.regelSub}>
                        {[
                          w.vet_pct != null ? `vet ${nlKg(w.vet_pct)}%` : "",
                          w.spier_kg != null ? `spier ${nlKg(w.spier_kg)} kg` : "",
                          w.vocht_pct != null ? `vocht ${nlKg(w.vocht_pct)}%` : "",
                        ].filter(Boolean).join(" · ")}
                      </div>
                    )}
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

/** Hoeveel van de extra velden is ingevuld. */
function ingevuld(v: Velden): number {
  return [v.vet, v.spier, v.vocht].filter((x) => x.trim() !== "").length;
}

/**
 * De extra metingen van een weegschaal met lichaamsanalyse.
 *
 * Bij spiermassa staat een keuze tussen kilo en procent, want die twee reeksen
 * overlappen bijna volledig: 38 kan 38 kilo spier zijn of 38 procent van je
 * gewicht. Uit het getal alleen valt dat niet af te leiden, en fout opgeslagen
 * is het jarenlang fout.
 */
function MeerVelden({
  waarden, onWijzig,
}: {
  waarden: Velden;
  onWijzig: (v: Partial<Velden>) => void;
}) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={T.veldRij}>
        <div style={{ flex: 1 }}>
          <label style={T.label}>Vet (%)</label>
          <input style={T.veld} value={waarden.vet} inputMode="decimal" placeholder="—"
            onChange={(e) => onWijzig({ vet: e.target.value })} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={T.label}>Vocht (%)</label>
          <input style={T.veld} value={waarden.vocht} inputMode="decimal" placeholder="—"
            onChange={(e) => onWijzig({ vocht: e.target.value })} />
        </div>
      </div>
      <div style={T.veldRij}>
        <div style={{ flex: 1 }}>
          <label style={T.label}>Spiermassa</label>
          <input style={T.veld} value={waarden.spier} inputMode="decimal" placeholder="—"
            onChange={(e) => onWijzig({ spier: e.target.value })} />
        </div>
        <div style={{ width: 104 }}>
          <label style={T.label}>Eenheid</label>
          <select style={T.veld} value={waarden.spierEenheid}
            onChange={(e) => onWijzig({ spierEenheid: e.target.value as "kg" | "pct" })}>
            <option value="kg">kg</option>
            <option value="pct">%</option>
          </select>
        </div>
      </div>
      <p style={T.hint}>
        Alles optioneel. Meet je weegschaal het niet, laat het leeg — een leeg veld
        betekent &ldquo;niet gemeten&rdquo; en telt nergens als nul mee. BMI hoef je niet in te
        vullen: die rekent de app uit je gewicht en je lengte.
      </p>
    </div>
  );
}

/**
 * BMI en lichaamssamenstelling van de laatste weging.
 *
 * BMI komt uit je eigen lengte en niet van de weegschaal: die rekent met de
 * lengte die in het apparaat staat, en twee BMI's die elkaar tegenspreken is
 * erger dan één die je kunt narekenen.
 */
function Samenstelling({
  weging, lengteCm,
}: {
  weging: WegingMetTrend; lengteCm?: number;
}) {
  const index = bmi(weging.kg, lengteCm);
  const heeftIets = index != null || weging.vet_pct != null
    || weging.spier_kg != null || weging.vocht_pct != null;
  if (!heeftIets) return null;

  return (
    <div style={T.samenstelling}>
      {index != null && (
        <Meetwaarde label={`BMI · ${bmiKlasse(index)}`} waarde={nlKg(index)} verschil={null} />
      )}
      {weging.vet_pct != null && (
        <Meetwaarde label="Vet" waarde={`${nlKg(weging.vet_pct)}%`} verschil={weging.delta_vet_pct} />
      )}
      {weging.spier_kg != null && (
        <Meetwaarde label="Spiermassa" waarde={`${nlKg(weging.spier_kg)} kg`} verschil={weging.delta_spier_kg} />
      )}
      {weging.vocht_pct != null && (
        <Meetwaarde label="Vocht" waarde={`${nlKg(weging.vocht_pct)}%`} verschil={weging.delta_vocht_pct} />
      )}
    </div>
  );
}

/**
 * Eén meetwaarde met het verschil sinds de vorige keer.
 *
 * Het verschil krijgt geen kleur. Bij gewicht is omlaag de bedoeling, maar bij
 * spiermassa is omlaag juist ongewenst en bij vocht hangt het van de dag af —
 * groen en rood zouden hier een oordeel geven dat er niet is.
 */
function Meetwaarde({
  label, waarde, verschil,
}: {
  label: string; waarde: string; verschil: number | null;
}) {
  return (
    <div style={T.meetVak}>
      <div style={T.meetWaarde}>
        {waarde}
        {verschil != null && verschil !== 0 && (
          <span style={T.meetVerschil}>{teken(verschil)}</span>
        )}
      </div>
      <div style={T.meetLabel}>{label}</div>
    </div>
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
