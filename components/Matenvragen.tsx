"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, Scale } from "lucide-react";
import { STANDAARD_MATEN } from "@/lib/tracker/recept";
import type { Onleesbaar } from "@/lib/maten";

// ---------------------------------------------------------------------------
// "Peper en zout — naar smaak."
//
// Prima instructie voor een kok, niets voor de puntentelling: er valt geen gram
// van te maken, dus het ingredient viel stil buiten het totaal. Dit schermpje
// vraagt er één keer naar, bij het opslaan, met een voorstel al ingevuld.
//
// Er staat bewust ook een uitweg: soms is "naar smaak" precies goed en hoeft
// het niet mee te tellen. Dan blijft het ingredient gewoon in het recept staan
// — je hebt het nodig als je kookt — alleen niet in de punten.
// ---------------------------------------------------------------------------

export type Keuzes = Record<number, { hoev: number; eenheid: string } | null>;

export default function Matenvragen({
  vragen, bezig, onKlaar, onOverslaan,
}: {
  vragen: Onleesbaar[];
  bezig: boolean;
  onKlaar: (keuzes: Keuzes) => void;
  onOverslaan: () => void;
}) {
  const [velden, setVelden] = useState<Record<number, { hoev: string; eenheid: string }>>(() => {
    const start: Record<number, { hoev: string; eenheid: string }> = {};
    for (const v of vragen) start[v.index] = { hoev: String(v.voorstel.hoev), eenheid: v.voorstel.eenheid };
    return start;
  });

  // Het vak verschijnt onder aan een lang formulier; zonder dit staat het buiten
  // beeld en lijkt de opslaanknop niets te doen.
  const vak = useRef<HTMLDivElement | null>(null);
  useEffect(() => { vak.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, []);

  const zet = (index: number, deel: Partial<{ hoev: string; eenheid: string }>) =>
    setVelden((p) => ({ ...p, [index]: { ...p[index], ...deel } }));

  const opslaan = () => {
    const keuzes: Keuzes = {};
    for (const v of vragen) {
      const veld = velden[v.index];
      const hoev = Number(String(veld?.hoev ?? "").replace(",", "."));
      keuzes[v.index] = veld?.eenheid && Number.isFinite(hoev) && hoev > 0
        ? { hoev, eenheid: veld.eenheid }
        : null;
    }
    onKlaar(keuzes);
  };

  return (
    <div style={S.vak} ref={vak}>
      <div style={S.kop}>
        <Scale size={17} style={{ flexShrink: 0 }} />
        <span>
          {vragen.length === 1
            ? "Eén ingrediënt telt niet mee in de punten"
            : `${vragen.length} ingrediënten tellen niet mee in de punten`}
        </span>
      </div>
      <p style={S.uitleg}>
        Bij deze maat valt niet te zeggen hoeveel het is, dus blijft het buiten de
        puntentelling. Vul in wat je ongeveer gebruikt, dan telt het mee. Laat je de
        eenheid leeg, dan blijft het ingredient staan zoals het is — je hebt het bij het
        koken nodig, alleen niet in de punten.
      </p>

      {vragen.map((v) => (
        <div key={v.index} style={S.regel}>
          <div style={S.naam}>
            {v.naam}
            <span style={S.nu}>nu: {v.eenheid ? `"${v.eenheid}"` : "geen maat"}</span>
          </div>
          <div style={S.invoer}>
            <input
              style={S.getal}
              value={velden[v.index]?.hoev ?? ""}
              inputMode="decimal"
              aria-label={`Hoeveelheid van ${v.naam}`}
              onChange={(e) => zet(v.index, { hoev: e.target.value })}
            />
            <select
              style={S.keuze}
              value={velden[v.index]?.eenheid ?? ""}
              aria-label={`Eenheid van ${v.naam}`}
              onChange={(e) => zet(v.index, { eenheid: e.target.value })}
            >
              <option value="">telt niet mee</option>
              {STANDAARD_MATEN.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      ))}

      <button style={S.primair} onClick={opslaan} disabled={bezig}>
        <Check size={16} /> {bezig ? "Opslaan..." : "Aanvullen en opslaan"}
      </button>
      <button style={S.secundair} onClick={onOverslaan} disabled={bezig}>
        Zo opslaan, zonder aanvullen
      </button>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  vak: {
    border: "1px solid var(--accent)", borderRadius: 14, padding: "14px 15px",
    background: "var(--surface)", marginBottom: 14,
  },
  kop: {
    display: "flex", alignItems: "center", gap: 8, fontSize: 14.5, fontWeight: 800,
    letterSpacing: "-0.01em", color: "var(--ink)", marginBottom: 8,
  },
  uitleg: { fontSize: 12.5, lineHeight: 1.6, color: "var(--sub)", margin: "0 0 14px" },
  regel: { marginBottom: 12 },
  naam: { fontSize: 13.5, fontWeight: 700, color: "var(--ink)", marginBottom: 5 },
  nu: { fontSize: 12, fontWeight: 400, color: "var(--sub)", marginLeft: 8 },
  invoer: { display: "flex", gap: 8 },
  getal: {
    width: 80, flexShrink: 0, padding: "9px 11px", borderRadius: 10,
    border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)",
    fontSize: 15, outline: "none",
  },
  keuze: {
    flex: 1, minWidth: 0, padding: "9px 11px", borderRadius: 10,
    border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)",
    fontSize: 15, outline: "none",
  },
  primair: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
    padding: "12px", borderRadius: 11, border: "none", background: "var(--accent)",
    color: "#fff", fontSize: 14.5, fontWeight: 700, cursor: "pointer", marginTop: 4,
  },
  secundair: {
    display: "block", width: "100%", padding: "10px", marginTop: 8, borderRadius: 11,
    border: "1px solid var(--line)", background: "var(--surface)", color: "var(--sub)",
    fontSize: 13.5, fontWeight: 600, cursor: "pointer",
  },
};
