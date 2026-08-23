"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, ClipboardPaste, Link2, Loader2 } from "lucide-react";
import { T } from "./stijl";
import { toonPunten } from "@/lib/tracker/points";
import { nl } from "@/lib/tracker/datum";
import { MAALTIJDEN_TRACKER, MAALTIJD_LABEL } from "@/lib/tracker/types";
import type { Maaltijd } from "@/lib/tracker/types";
import type { ReceptPunten } from "@/lib/tracker/recept";

interface Uitslag {
  recept: { titel: string; personen: number };
  punten: ReceptPunten;
  bron: "json-ld" | "html" | "model";
  url: string;
}

const BRON_UITLEG: Record<Uitslag["bron"], string> = {
  "json-ld": "Uit de receptgegevens van de pagina zelf — die zijn exact.",
  html: "Uit de ingrediëntenlijst op de pagina. Kijk de hoeveelheden even na.",
  model: "Uit de tekst van de pagina afgeleid. Kijk het geheel even na.",
};

/**
 * Landingspunt voor een gedeelde receptlink.
 *
 * Op Android komt de link binnen via het deelmenu (share_target in het
 * manifest). iOS kent dat niet; daar plak je hem hier, of stuurt een Shortcut
 * hem naar dezelfde route.
 */
export default function Import({
  gedeeldeUrl, datumLabel, schaal, bezig, fout, onLog,
}: {
  gedeeldeUrl: string;
  datumLabel: string;
  schaal: number;
  bezig: boolean;
  fout: string;
  onLog: (payload: Record<string, unknown>) => void;
}) {
  const [url, setUrl] = useState(gedeeldeUrl);
  const [laadt, setLaadt] = useState(false);
  const [eigenFout, setEigenFout] = useState("");
  const [uitslag, setUitslag] = useState<Uitslag | null>(null);
  const [porties, setPorties] = useState("1");
  const [maal, setMaal] = useState<Maaltijd>("diner");

  const haalOp = useCallback(async (adres: string) => {
    if (!adres.trim()) return;
    setLaadt(true); setEigenFout(""); setUitslag(null);
    try {
      const res = await fetch("/api/tracker/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: adres.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Importeren mislukt");
      setUitslag(data);
    } catch (e) {
      setEigenFout(e instanceof Error ? e.message : "Er ging iets mis");
    } finally { setLaadt(false); }
  }, []);

  // Kwam de link via het deelmenu binnen, dan meteen ophalen.
  useEffect(() => {
    if (gedeeldeUrl) { setUrl(gedeeldeUrl); haalOp(gedeeldeUrl); }
  }, [gedeeldeUrl, haalOp]);

  const plak = async () => {
    try {
      const tekst = await navigator.clipboard.readText();
      setUrl(tekst);
      haalOp(tekst);
    } catch {
      setEigenFout("Je browser gaf geen toegang tot het klembord. Plak de link zelf in het veld.");
    }
  };

  const aantal = getal(porties);
  const raw = (uitslag?.punten.perPortiePunten ?? 0) * aantal;
  const punten = toonPunten(raw, schaal);

  return (
    <>
      {(fout || eigenFout) && <div style={T.fout}>{fout || eigenFout}</div>}

      <div style={T.veldVak}>
        <label style={T.label} htmlFor="im-url">Link naar het recept</label>
        <input id="im-url" style={T.veld} value={url} inputMode="url"
          placeholder="https://..." onChange={(e) => setUrl(e.target.value)} />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button style={{ ...T.primair, marginTop: 0, opacity: url.trim() && !laadt ? 1 : 0.5 }}
            disabled={!url.trim() || laadt} onClick={() => haalOp(url)}>
            {laadt
              ? <><Loader2 size={16} className="spin" /> Ophalen...</>
              : <><Link2 size={16} /> Recept ophalen</>}
          </button>
          <button style={{ ...T.secundair, marginTop: 0, width: "auto", padding: "12px 14px" }}
            onClick={plak} aria-label="Link uit klembord plakken">
            <ClipboardPaste size={16} />
          </button>
        </div>
        <p style={T.hint}>
          Op Android kun je een receptpagina rechtstreeks vanuit je browser naar deze
          app delen. Op iOS bestaat dat niet: kopieer de link en gebruik de plakknop.
        </p>
      </div>

      {uitslag && (
        <>
          <div style={T.kaart}>
            <div style={T.productNaam}>{uitslag.recept.titel}</div>
            <div style={T.productSub}>
              Recept voor {uitslag.recept.personen}{" "}
              {uitslag.recept.personen === 1 ? "persoon" : "personen"} · {BRON_UITLEG[uitslag.bron]}
            </div>
          </div>

          <div style={T.live} role="status" aria-live="polite">
            <span style={T.liveGetal}>{punten}</span>
            <span style={T.liveTekst}>
              {punten === 1 ? "punt" : "punten"} voor {nl(aantal)}{" "}
              {aantal === 1 ? "portie" : "porties"}<br />
              {datumLabel.toLowerCase()} · {MAALTIJD_LABEL[maal].toLowerCase()}
            </span>
          </div>

          {uitslag.punten.nietHerkend.length > 0 && (
            <div style={T.waarschuwing}>
              <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
              Niet meegeteld: {uitslag.punten.nietHerkend.join(", ")}. De punten
              hierboven zijn dus aan de lage kant.
            </div>
          )}

          <div style={T.veldRij}>
            <div style={{ flex: 1 }}>
              <label style={T.label} htmlFor="im-porties">Aantal porties</label>
              <input id="im-porties" style={T.veld} value={porties} inputMode="decimal"
                onChange={(e) => setPorties(e.target.value)} />
            </div>
          </div>

          <div style={T.veldVak}>
            <span style={T.label}>Maaltijd</span>
            <div style={T.chips}>
              {MAALTIJDEN_TRACKER.map((m) => (
                <button key={m} type="button" onClick={() => setMaal(m)}
                  style={{ ...T.chip, ...(maal === m ? T.chipAan : {}) }}>
                  {MAALTIJD_LABEL[m]}
                </button>
              ))}
            </div>
          </div>

          <h2 style={T.lijstKop}>Zo is het gerekend</h2>
          <div style={T.kaartStrak}>
            {uitslag.punten.matches.map((m, i) => (
              <div key={`${m.ingredient}-${i}`} style={T.regel}>
                <div style={T.regelTekst}>
                  <div style={{
                    ...T.regelNaam,
                    color: m.overgeslagen ? "var(--sub)" : "var(--ink)",
                    textDecoration: m.overgeslagen ? "line-through" : "none",
                  }}>
                    {m.ingredient}
                  </div>
                  <div style={T.regelSub}>
                    {m.overgeslagen
                      ? "niet herkend, telt niet mee"
                      : `${m.product!.name} · ${m.omrekening.aanname}`}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p style={T.hint}>
            De punten komen uit de eigen formule, berekend uit de ingrediënten.
            Een puntwaarde die op de bronpagina staat wordt nooit overgenomen.
          </p>

          <button style={{ ...T.primair, opacity: aantal > 0 && !bezig ? 1 : 0.5 }}
            disabled={aantal <= 0 || bezig}
            onClick={() => {
              const factor = aantal / uitslag.punten.personen;
              onLog({
                name: uitslag.recept.titel,
                meal: maal,
                source: "link",
                ref: uitslag.url,
                amount: aantal,
                unit: aantal === 1 ? "portie" : "porties",
                components: uitslag.punten.componenten.map((c) => ({
                  ...c,
                  amount: c.amount * factor,
                  grams: c.grams * factor,
                  nutrients: Object.fromEntries(
                    Object.entries(c.nutrients).map(([k, v]) =>
                      [k, typeof v === "number" ? v * factor : v])
                  ),
                })),
              });
            }}>
            {bezig
              ? <><Loader2 size={16} className="spin" /> Opslaan...</>
              : <><Check size={16} /> Toevoegen aan {datumLabel.toLowerCase()}</>}
          </button>
        </>
      )}
    </>
  );
}

function getal(s: string): number {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
