"use client";

import React, { useState } from "react";
import { Check, Info, Loader2, Trash2 } from "lucide-react";
import { T } from "./stijl";
import { ACTIVITEITEN, dagBewegingspunten, MAX_BEWEGINGSPUNTEN_PER_DAG } from "@/lib/tracker/activiteit";
import type { Activity } from "@/lib/tracker/types";

/**
 * Beweging loggen. Punten verruimen je dagbudget, tot het dagplafond.
 */
export default function Beweging({
  activiteiten, datumLabel, bezig, fout, onVoegToe, onWis,
}: {
  activiteiten: Activity[];
  datumLabel: string;
  bezig: boolean;
  fout: string;
  onVoegToe: (soort: string, minuten: number) => void;
  onWis: (id: string) => void;
}) {
  const [soort, setSoort] = useState(ACTIVITEITEN[0].id);
  const [minuten, setMinuten] = useState("30");

  const duur = getal(minuten);
  const totaal = dagBewegingspunten(activiteiten);

  return (
    <>
      {fout && <div style={T.fout}>{fout}</div>}

      <div style={T.live} role="status" aria-live="polite">
        <span style={T.liveGetal}>{totaal.meetellend}</span>
        <span style={T.liveTekst}>
          {totaal.meetellend === 1 ? "bewegingspunt" : "bewegingspunten"} erbij<br />
          {datumLabel.toLowerCase()}
          {totaal.afgetopt && ` · ${totaal.ruw} verdiend, ${MAX_BEWEGINGSPUNTEN_PER_DAG} tellen mee`}
        </span>
      </div>

      {totaal.afgetopt && (
        <div style={T.waarschuwing}>
          <Info size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
          Er tellen maximaal {MAX_BEWEGINGSPUNTEN_PER_DAG} bewegingspunten per dag mee.
          Schattingen van verbranding vallen structureel te hoog uit; zonder plafond
          eet je je tekort weg met een getal dat je niet kunt controleren.
        </div>
      )}

      <div style={T.veldVak}>
        <label style={T.label} htmlFor="bw-soort">Wat heb je gedaan?</label>
        <select id="bw-soort" style={T.veld} value={soort} onChange={(e) => setSoort(e.target.value)}>
          {ACTIVITEITEN.map((a) => <option key={a.id} value={a.id}>{a.naam}</option>)}
        </select>
      </div>

      <div style={T.veldVak}>
        <label style={T.label} htmlFor="bw-min">Hoe lang (minuten)</label>
        <input id="bw-min" style={T.veld} value={minuten} inputMode="numeric"
          onChange={(e) => setMinuten(e.target.value)} />
        <div style={{ ...T.chips, marginTop: 8 }}>
          {[15, 30, 45, 60].map((m) => (
            <button key={m} type="button" style={T.chip} onClick={() => setMinuten(String(m))}>
              {m} min
            </button>
          ))}
        </div>
      </div>

      <button style={{ ...T.primair, opacity: duur > 0 && !bezig ? 1 : 0.5 }}
        disabled={duur <= 0 || bezig}
        onClick={() => { onVoegToe(soort, duur); setMinuten("30"); }}>
        {bezig
          ? <><Loader2 size={16} className="spin" /> Opslaan...</>
          : <><Check size={16} /> Beweging toevoegen</>}
      </button>

      {activiteiten.length > 0 && (
        <>
          <h2 style={T.lijstKop}>Vandaag bewogen</h2>
          <div style={T.kaartStrak}>
            {activiteiten.map((a) => (
              <div key={a.id} style={T.regel}>
                <div style={T.regelTekst}>
                  <div style={T.regelNaam}>{a.name}</div>
                  <div style={T.regelSub}>{a.minutes} minuten</div>
                </div>
                <span style={T.puntBadge}>{a.points}</span>
                <button style={T.wisKnop} onClick={() => onWis(a.id)}
                  aria-label={`${a.name} verwijderen`}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <p style={T.hint}>
        De verbranding wordt berekend uit je gewicht en de duur, waarna je
        rustverbranding eraf gaat — je verbrandt tijdens dat uur wandelen ook de
        calorieën die je op de bank zou hebben verbruikt, en alleen het verschil
        is extra.
      </p>
    </>
  );
}

function getal(s: string): number {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
