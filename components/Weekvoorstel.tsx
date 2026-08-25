"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Check, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { euroTekst } from "@/lib/prijzen";
import type { Voorstel } from "@/lib/weekvoorstel";

// Een voorgesteld weekmenu, met per dag waarom.
//
// Het voorstel verandert niets tot je op overnemen drukt. Dat is het verschil
// tussen een hulpmiddel en een app die het beter denkt te weten: je ziet eerst
// wat er zou komen te staan, inclusief de reden, en beslist dan zelf.

export default function Weekvoorstel({
  dagen, onOvernemen, onSluiten,
}: {
  dagen: readonly string[];
  onOvernemen: (keuze: { dag: string; recipeId: string }[]) => void;
  onSluiten: () => void;
}) {
  const [voorstel, setVoorstel] = useState<Voorstel | null>(null);
  const [variatie, setVariatie] = useState(0);
  const [bezig, setBezig] = useState(true);
  const [fout, setFout] = useState("");

  const haal = useCallback(async (v: number) => {
    setBezig(true); setFout("");
    try {
      const res = await fetch("/api/week/voorstel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dagen, variatie: v }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Er ging iets mis");
      setVoorstel(data);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Er ging iets mis");
    } finally { setBezig(false); }
  }, [dagen]);

  useEffect(() => { haal(0); }, [haal]);

  const anders = () => {
    const v = variatie + 1;
    setVariatie(v);
    haal(v);
  };

  return (
    <div style={S.overlay} role="dialog" aria-label="Weekmenu voorstellen">
      <div style={S.venster}>
        <div style={S.kop}>
          <Sparkles size={17} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <h2 style={S.titel}>Voorgesteld weekmenu</h2>
          <button onClick={onSluiten} style={S.sluit} aria-label="Sluiten"><X size={18} /></button>
        </div>

        <div style={S.body}>
          {fout && <div style={S.fout}>{fout}</div>}

          {bezig && !voorstel && (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <Loader2 size={22} className="spin" style={{ color: "var(--accent)" }} />
            </div>
          )}

          {voorstel && voorstel.dagen.length === 0 && (
            <p style={S.hint}>
              {voorstel.opmerkingen[0] ?? "Er valt nog niets voor te stellen."}
            </p>
          )}

          {voorstel && voorstel.dagen.length > 0 && (
            <>
              <div style={{ ...S.samen, opacity: bezig ? 0.5 : 1 }}>
                {voorstel.gemiddeldePunten != null && (
                  <span>Gemiddeld <strong>{voorstel.gemiddeldePunten} punten</strong> per portie</span>
                )}
                {voorstel.totaalEuro != null && (
                  <span>Ongeveer <strong>{euroTekst(voorstel.totaalEuro)}</strong> aan ingrediënten</span>
                )}
              </div>

              <div style={{ opacity: bezig ? 0.5 : 1 }}>
                {voorstel.dagen.map((d) => (
                  <div key={d.dag} style={S.regel}>
                    <span style={S.dag}>{d.dag.slice(0, 2)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.receptNaam}>{d.recept.titel}</div>
                      <div style={S.waarom}>
                        {d.waarom}
                        {d.recept.punten != null && <> · {d.recept.punten} pt</>}
                        {d.recept.euro != null && <> · {euroTekst(d.recept.euro)}</>}
                      </div>
                      {d.goedkoper && (
                        <div style={S.goedkoper}>
                          {euroTekst(d.goedkoper.scheelt)} goedkoper: {d.goedkoper.recept.titel}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {voorstel.opmerkingen.map((o, i) => (
                <p key={i} style={S.hint}>{o}</p>
              ))}

              <button
                style={{ ...S.knop, ...S.primair, opacity: bezig ? 0.6 : 1 }}
                disabled={bezig}
                onClick={() => onOvernemen(
                  voorstel.dagen.map((d) => ({ dag: d.dag, recipeId: d.recept.id }))
                )}
              >
                <Check size={16} /> Overnemen in het weekmenu
              </button>
              <button style={S.knop} onClick={anders} disabled={bezig}>
                {bezig
                  ? <><Loader2 size={15} className="spin" /> Even geduld...</>
                  : <><RefreshCw size={15} /> Stel iets anders voor</>}
              </button>
              <p style={S.hint}>
                Overnemen vervangt wat er nu in deze week staat. Daarna pas je per dag aan wat je
                anders wilt — het voorstel is een startpunt, geen voorschrift.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(16,17,24,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 60 },
  venster: { width: "100%", maxWidth: 480, maxHeight: "92vh", background: "var(--surface)", borderRadius: "20px 20px 0 0", display: "flex", flexDirection: "column", overflow: "hidden" },
  kop: { display: "flex", alignItems: "center", gap: 9, padding: "16px 18px 12px", borderBottom: "1px solid var(--line)" },
  titel: { fontSize: 17, fontWeight: 800, margin: 0, letterSpacing: "-0.02em", flex: 1 },
  sluit: { width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)", borderRadius: 999, background: "var(--bg)", color: "var(--sub)", cursor: "pointer", flexShrink: 0 },
  body: { padding: "14px 18px 22px", overflowY: "auto" },
  samen: { display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 12.5, color: "var(--sub)", marginBottom: 12 },
  regel: { display: "flex", alignItems: "flex-start", gap: 11, padding: "9px 0", borderBottom: "1px solid var(--line)" },
  dag: { flexShrink: 0, width: 30, fontSize: 11.5, fontWeight: 800, color: "var(--accent)", textTransform: "uppercase", paddingTop: 2 },
  receptNaam: { fontSize: 14.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  waarom: { fontSize: 12, color: "var(--sub)", marginTop: 2 },
  goedkoper: { fontSize: 11.5, color: "var(--green)", marginTop: 3 },
  knop: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "12px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 14.5, fontWeight: 700, color: "var(--ink)", cursor: "pointer", marginTop: 10 },
  primair: { background: "var(--accent)", borderColor: "var(--accent)", color: "#fff" },
  hint: { fontSize: 12, lineHeight: 1.6, color: "var(--sub)", margin: "10px 0 0" },
  fout: { background: "#fdeeeb", border: "1px solid var(--red)", borderRadius: 12, padding: "10px 13px", fontSize: 13, color: "#a8351f", marginBottom: 12 },
};
