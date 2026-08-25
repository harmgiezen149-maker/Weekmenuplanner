"use client";

import React, { useRef, useState } from "react";
import { Barcode, Camera, Check, Loader2, Receipt, X } from "lucide-react";
import Scanner from "./tracker/Scanner";
import { comprimeerAfbeelding, fileNaarDataUrl } from "@/lib/afbeelding";
import { euroTekst } from "@/lib/prijzen";
import type { BonRegel } from "@/lib/bon";
import { WINKELS } from "@/lib/types";

// Een kassabon of een productfoto omzetten in voorraadartikelen.
//
// Het antwoord van het model is een VOORSTEL, geen invoer: alles staat met een
// vinkje klaar en de naam is aan te passen voor je op toevoegen drukt. Een
// verkeerd gelezen regel hoort niet ongemerkt in je voorraad of je prijsboek te
// belanden — en bij een kassabon van dertig regels valt zo'n regel niet op.

// Een bon met kleine lettertjes heeft meer pixels nodig dan een bord eten.
const BON_PIXELS = 1600;

export type BonKeuze = BonRegel;

export default function Bonscanner({
  onToevoegen, onSluiten,
}: {
  onToevoegen: (regels: BonKeuze[], winkel: string) => void;
  onSluiten: () => void;
}) {
  const kiezer = useRef<HTMLInputElement>(null);
  const [soort, setSoort] = useState<"bon" | "product">("bon");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [winkel, setWinkel] = useState("");
  const [datum, setDatum] = useState("");
  const [regels, setRegels] = useState<BonKeuze[] | null>(null);
  const [aan, setAan] = useState<boolean[]>([]);
  const [prijzenOnthouden, setPrijzenOnthouden] = useState(true);
  const [klaar, setKlaar] = useState("");
  const [scanOpen, setScanOpen] = useState(false);

  const kiesFoto = (welke: "bon" | "product") => {
    setSoort(welke);
    setFout("");
    // capture pas zetten als we weten wat het wordt: bij een bon wil je de
    // camera, bij losse producten vaak een foto die je al had.
    if (kiezer.current) {
      kiezer.current.setAttribute("capture", "environment");
      kiezer.current.click();
    }
  };

  const verwerk = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBezig(true); setFout(""); setKlaar("");
    try {
      const ruw = await fileNaarDataUrl(file);
      const afbeelding = await comprimeerAfbeelding(ruw, 0.85, soort === "bon" ? BON_PIXELS : 1200);
      const res = await fetch("/api/bon", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ afbeelding, soort }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Het lezen ging mis");

      // De route heeft de afdeling al getoetst aan WINKELGEBIEDEN; hier hoeft
      // dat niet nog eens.
      const gelezen: BonKeuze[] = data.regels ?? [];
      setRegels(gelezen);
      setAan(gelezen.map(() => true));
      setWinkel(data.winkel ?? "");
      setDatum(data.datum ?? new Date().toISOString().slice(0, 10));
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Er ging iets mis");
    } finally { setBezig(false); }
  };

  /**
   * Een gescande streepjescode omzetten in een voorraadartikel.
   *
   * De code gaat langs dezelfde route als in de tracker, dus je eigen eerdere
   * invoer telt mee. Levert dat niets op, dan komt er geen artikel bij: een
   * regel met alleen een cijferreeks erin is geen boodschappenlijst.
   */
  const uitCode = async (code: string) => {
    setScanOpen(false);
    setBezig(true); setFout(""); setKlaar("");
    try {
      const res = await fetch(`/api/tracker/barcode/${encodeURIComponent(code)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.gevonden || !data?.product?.name) {
        setFout(`Streepjescode ${code} staat in geen enkele lijst. Voeg het artikel met de hand toe, `
          + "dan onthoudt de app hem voor de volgende keer.");
        return;
      }
      const naam = String(data.product.name);
      setRegels((r) => [...(r ?? []), { naam, aantal: 1, eenheid: "stuk", prijs: null, gebied: "" }]);
      setAan((a) => [...a, true]);
      if (!winkel) setDatum((d) => d || new Date().toISOString().slice(0, 10));
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Er ging iets mis");
    } finally { setBezig(false); }
  };

  const toevoegen = async () => {
    if (!regels) return;
    const gekozen = regels.filter((_, i) => aan[i]);
    if (gekozen.length === 0) return;

    setBezig(true); setFout("");
    try {
      // Prijzen gaan pas het boek in nadat jij de regels hebt nagekeken.
      if (prijzenOnthouden && soort === "bon") {
        const metPrijs = gekozen.filter((r) => r.prijs != null);
        if (metPrijs.length > 0) {
          await fetch("/api/bon", {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ regels: metPrijs, winkel, datum }),
          }).catch(() => { /* de voorraad gaat wel door */ });
        }
      }
      onToevoegen(gekozen, winkel);
      setKlaar(`${gekozen.length} ${gekozen.length === 1 ? "artikel" : "artikelen"} toegevoegd.`);
      setRegels(null); setAan([]);
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Er ging iets mis");
    } finally { setBezig(false); }
  };

  const wijzig = (i: number, patch: Partial<BonKeuze>) =>
    setRegels((r) => (r ? r.map((x, j) => (j === i ? { ...x, ...patch } : x)) : r));

  const aantalAan = aan.filter(Boolean).length;
  const totaal = regels
    ? regels.reduce((som, r, i) => som + (aan[i] && r.prijs != null ? r.prijs : 0), 0)
    : 0;

  return (
    <div style={S.overlay} role="dialog" aria-label="Bon scannen">
      <div style={S.venster}>
        <div style={S.kop}>
          <h2 style={S.titel}>Voorraad snel vullen</h2>
          <button onClick={onSluiten} style={S.sluit} aria-label="Sluiten"><X size={18} /></button>
        </div>

        <div style={S.body}>
          {fout && <div style={S.fout}>{fout}</div>}
          {klaar && <div style={S.gelukt}><Check size={15} /> {klaar}</div>}

          <input ref={kiezer} type="file" accept="image/*" style={{ display: "none" }} onChange={verwerk} />

          {!regels && (
            <>
              <button style={{ ...S.knop, ...S.primair }} onClick={() => kiesFoto("bon")} disabled={bezig}>
                {bezig && soort === "bon"
                  ? <><Loader2 size={16} className="spin" /> Bon lezen...</>
                  : <><Receipt size={16} /> Kassabon fotograferen</>}
              </button>
              <p style={S.hint}>
                Leg de bon plat en zorg dat hij helemaal in beeld staat. Statiegeld, kortingen en
                het totaal worden overgeslagen; de prijzen worden onthouden zodat je
                boodschappenlijst kan laten zien wat hij ongeveer kost.
              </p>

              <button style={S.knop} onClick={() => kiesFoto("product")} disabled={bezig}>
                {bezig && soort === "product"
                  ? <><Loader2 size={16} className="spin" /> Foto lezen...</>
                  : <><Camera size={16} /> Foto van producten</>}
              </button>
              <p style={S.hint}>
                Voor wat je in huis hebt maar niet op een bon staat: leg het op tafel of zet het
                op het aanrecht en maak één foto.
              </p>

              <button style={S.knop} onClick={() => setScanOpen(true)} disabled={bezig}>
                <Barcode size={16} /> Streepjescode scannen
              </button>
              <p style={S.hint}>
                Eén product tegelijk, en exact: waar een foto een gok blijft, leest een
                streepjescode het pak. Onbekende code? Voeg hem met de hand toe — dan kent de app
                hem de volgende keer wel.
              </p>
            </>
          )}

          {scanOpen && (
            <Scanner onCode={uitCode} onHandmatig={() => setScanOpen(false)} />
          )}

          {regels && regels.length > 0 && (
            <>
              <div style={S.metaRij}>
                <select style={S.veld} value={winkel} onChange={(e) => setWinkel(e.target.value)}>
                  <option value="">Winkel…</option>
                  {WINKELS.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
                <input style={S.veld} type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
              </div>

              <div style={S.telRij}>
                <span>{aantalAan} van {regels.length} aangevinkt</span>
                {totaal > 0 && <span style={{ fontWeight: 700 }}>{euroTekst(totaal)}</span>}
              </div>

              {regels.map((r, i) => (
                <div key={i} style={{ ...S.regel, opacity: aan[i] ? 1 : 0.45 }}>
                  <button
                    onClick={() => setAan((a) => a.map((x, j) => (j === i ? !x : x)))}
                    style={{ ...S.vinkje, ...(aan[i] ? S.vinkjeAan : {}) }}
                    aria-label={aan[i] ? `${r.naam} niet toevoegen` : `${r.naam} toevoegen`}
                  >
                    {aan[i] && <Check size={13} />}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input
                      style={S.naamVeld} value={r.naam}
                      onChange={(e) => wijzig(i, { naam: e.target.value })}
                    />
                    <div style={S.regelMeta}>
                      {r.aantal} {r.eenheid}
                      {r.prijs != null && <> · {euroTekst(r.prijs)}</>}
                      {!r.gebied && <> · afdeling onbekend</>}
                    </div>
                  </div>
                </div>
              ))}

              {soort === "bon" && (
                <label style={S.keuzeRij}>
                  <input type="checkbox" checked={prijzenOnthouden}
                    onChange={(e) => setPrijzenOnthouden(e.target.checked)} />
                  <span>Prijzen onthouden voor de raming op je boodschappenlijst</span>
                </label>
              )}

              <button
                style={{ ...S.knop, ...S.primair, opacity: aantalAan > 0 && !bezig ? 1 : 0.5 }}
                onClick={toevoegen} disabled={aantalAan === 0 || bezig}
              >
                {bezig
                  ? <><Loader2 size={16} className="spin" /> Toevoegen...</>
                  : <><Check size={16} /> {aantalAan} toevoegen aan voorraad</>}
              </button>
              <button style={S.knop} onClick={() => { setRegels(null); setAan([]); }}>
                Andere foto
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(16,17,24,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 60, padding: 0 },
  venster: { width: "100%", maxWidth: 480, maxHeight: "92vh", background: "var(--surface)", borderRadius: "20px 20px 0 0", display: "flex", flexDirection: "column", overflow: "hidden" },
  kop: { display: "flex", alignItems: "center", gap: 10, padding: "16px 18px 12px", borderBottom: "1px solid var(--line)" },
  titel: { fontSize: 17, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" },
  sluit: { marginLeft: "auto", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)", borderRadius: 999, background: "var(--bg)", color: "var(--sub)", cursor: "pointer" },
  body: { padding: "14px 18px 22px", overflowY: "auto" },
  knop: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "12px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 14.5, fontWeight: 700, color: "var(--ink)", cursor: "pointer", marginBottom: 8 },
  primair: { background: "var(--accent)", borderColor: "var(--accent)", color: "#fff" },
  hint: { fontSize: 12.5, lineHeight: 1.6, color: "var(--sub)", margin: "0 0 16px" },
  fout: { background: "#fdeeeb", border: "1px solid var(--red)", borderRadius: 12, padding: "10px 13px", fontSize: 13, color: "#a8351f", marginBottom: 12, lineHeight: 1.5 },
  gelukt: { display: "flex", alignItems: "center", gap: 7, background: "#eaf7f1", border: "1px solid var(--green)", borderRadius: 12, padding: "10px 13px", fontSize: 13, color: "#0f6b47", marginBottom: 12 },
  metaRij: { display: "flex", gap: 8, marginBottom: 10 },
  veld: { flex: 1, minWidth: 0, padding: "9px 10px", border: "1px solid var(--line)", borderRadius: 10, fontSize: 14, background: "var(--bg)", color: "var(--ink)" },
  telRij: { display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--sub)", padding: "6px 2px 10px" },
  regel: { display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--line)" },
  vinkje: { flexShrink: 0, width: 22, height: 22, marginTop: 6, borderRadius: 7, border: "1px solid var(--line)", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer", padding: 0 },
  vinkjeAan: { background: "var(--accent)", borderColor: "var(--accent)" },
  naamVeld: { width: "100%", padding: "6px 8px", border: "1px solid transparent", borderRadius: 8, fontSize: 14.5, fontWeight: 600, background: "transparent", color: "var(--ink)" },
  regelMeta: { fontSize: 12, color: "var(--sub)", padding: "1px 9px 0" },
  keuzeRij: { display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "var(--sub)", padding: "14px 2px", lineHeight: 1.5 },
};
