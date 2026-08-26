"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Check, ClipboardPaste, Link2, Loader2 } from "lucide-react";
import { leesGeplakteLijst } from "@/lib/tracker/koppeling";
import { datumSleutel } from "@/lib/tracker/datum";
import { T } from "./stijl";
import { rawPoints, toonPunten } from "@/lib/tracker/points";
import { nl } from "@/lib/tracker/datum";
import { MAALTIJDEN_TRACKER, MAALTIJD_LABEL } from "@/lib/tracker/types";
import type { Maaltijd, Product } from "@/lib/tracker/types";
import type { ReceptPunten } from "@/lib/tracker/recept";

type Bron = "json-ld" | "html" | "model";

interface ReceptUitslag {
  soort: "recept";
  recept: { titel: string; personen: number };
  punten: ReceptPunten;
  bron: Bron;
  url: string;
}

interface ProductUitslag {
  soort: "product";
  product: Product;
  bron: Bron;
  url: string;
}

type Uitslag = ReceptUitslag | ProductUitslag;

const BRON_UITLEG: Record<Bron, string> = {
  "json-ld": "Uit de receptgegevens van de pagina zelf — die zijn exact.",
  html: "Uit de ingrediëntenlijst op de pagina. Kijk de hoeveelheden even na.",
  model: "Uit de tekst van de pagina afgeleid. Kijk het geheel even na.",
};

const PRODUCT_BRON_UITLEG: Record<Bron, string> = {
  "json-ld": "Uit de productgegevens van de pagina zelf — die zijn exact.",
  html: "Uit de voedingswaardetabel op de pagina.",
  model: "Uit de tekst van de pagina afgeleid. Kijk de waarden even na.",
};

/**
 * Landingspunt voor een gedeelde link.
 *
 * Werkt voor allebei: een receptpagina wordt per portie doorgerekend, een
 * productpagina van een webshop levert een product op. Welke van de twee het
 * is zoekt de app zelf uit — dat hoef je niet te weten voor je plakt.
 *
 * Op Android komt de link binnen via het deelmenu (share_target in het
 * manifest). iOS kent dat niet; daar plak je hem hier, of stuurt een Shortcut
 * hem naar dezelfde route.
 */
export default function Import({
  gedeeldeUrl, datumLabel, schaal, bezig, fout, onLog, onKiesProduct,
}: {
  gedeeldeUrl: string;
  datumLabel: string;
  schaal: number;
  bezig: boolean;
  fout: string;
  onLog: (payload: Record<string, unknown>) => void;
  /** Een gevonden product gaat naar de portiekiezer. */
  onKiesProduct: (p: Product) => void;
}) {
  const [url, setUrl] = useState(gedeeldeUrl);
  const [laadt, setLaadt] = useState(false);
  const [eigenFout, setEigenFout] = useState("");
  const [uitslag, setUitslag] = useState<Uitslag | null>(null);
  const [porties, setPorties] = useState("1");
  const [maal, setMaal] = useState<Maaltijd>("diner");
  const [beweging, setBeweging] = useState<{ geboekt: number; melding: string } | null>(null);
  const [bewegingBezig, setBewegingBezig] = useState(false);

  /**
   * Ziet de gedeelde tekst eruit als een training?
   *
   * Wordt hier gedaan en niet op de server: dan verschijnt de knop meteen, en
   * er gaat pas iets naar de app als je erop drukt. De herkenning is dezelfde
   * functie die het plakveld in Instellingen gebruikt.
   */
  const alsBeweging = useMemo(() => {
    const tekst = (gedeeldeUrl || url).trim();
    if (!tekst || tekst.length > 2000) return null;
    const { herkend } = leesGeplakteLijst(tekst, datumSleutel());
    return herkend.length > 0 ? herkend : null;
  }, [gedeeldeUrl, url]);

  const boekBeweging = async () => {
    if (!alsBeweging || bewegingBezig) return;
    setBewegingBezig(true); setEigenFout("");
    try {
      const res = await fetch("/api/tracker/beweging/plakken", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tekst: (gedeeldeUrl || url).trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Er ging iets mis");
      const n = (data.geboekt ?? []).length;
      setBeweging({
        geboekt: n,
        melding: n > 0
          ? `${n === 1 ? "Eén activiteit" : `${n} activiteiten`} toegevoegd aan je logboek.`
          : data.overgeslagen > 0
            ? "Deze stond er al in."
            : "Er viel niets te boeken.",
      });
    } catch (e) {
      setEigenFout(e instanceof Error ? e.message : "Er ging iets mis");
    } finally { setBewegingBezig(false); }
  };

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
      if (data.soort === "product") {
        setUitslag(data);
        return;
      }
      setUitslag(data);
    } catch (e) {
      setEigenFout(e instanceof Error ? e.message : "Er ging iets mis");
    } finally { setLaadt(false); }
  }, []);

  // Kwam er iets via het deelmenu binnen, dan meteen ophalen — tenzij het een
  // training blijkt te zijn. Die hoort niet als receptpagina opgehaald te
  // worden, en zeker geen modelaanroep te kosten.
  useEffect(() => {
    if (!gedeeldeUrl) return;
    setUrl(gedeeldeUrl);
    const { herkend } = leesGeplakteLijst(gedeeldeUrl, datumSleutel());
    if (herkend.length === 0) haalOp(gedeeldeUrl);
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
  const perPortie = uitslag?.soort === "recept" ? uitslag.punten.perPortiePunten : 0;
  const punten = toonPunten(perPortie * aantal, schaal);

  return (
    <>
      {(fout || eigenFout) && <div style={T.fout}>{fout || eigenFout}</div>}

      {alsBeweging && !beweging && (
        <div style={{ ...T.kaart, borderColor: "var(--accent)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Activity size={16} style={{ color: "var(--accent)" }} />
            <strong style={{ fontSize: 14.5 }}>Dit lijkt een training</strong>
          </div>
          {alsBeweging.map((r, i) => (
            <div key={i} style={T.uitslagRij}>
              <span style={T.uitslagLabel}>{r.datum} · {r.soort.naam}</span>
              <span style={T.uitslagWaarde}>{r.minuten} min</span>
            </div>
          ))}
          <button
            style={{ ...T.primair, opacity: bewegingBezig ? 0.6 : 1 }}
            onClick={boekBeweging} disabled={bewegingBezig}
          >
            {bewegingBezig
              ? <><Loader2 size={15} className="spin" /> Toevoegen...</>
              : <><Check size={15} /> Bij mijn beweging zetten</>}
          </button>
          <p style={T.hint}>
            Klopt dit niet, negeer deze kaart dan — hieronder kun je gewoon een recept of product
            ophalen.
          </p>
        </div>
      )}

      {beweging && (
        <div style={{ ...T.melding, marginBottom: 12 }}>{beweging.melding}</div>
      )}

      <div style={T.veldVak}>
        <label style={T.label} htmlFor="im-url">Link naar een recept of product</label>
        <input id="im-url" style={T.veld} value={url} inputMode="url"
          placeholder="https://..." onChange={(e) => setUrl(e.target.value)} />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button style={{ ...T.primair, marginTop: 0, opacity: url.trim() && !laadt ? 1 : 0.5 }}
            disabled={!url.trim() || laadt} onClick={() => haalOp(url)}>
            {laadt
              ? <><Loader2 size={16} className="spin" /> Ophalen...</>
              : <><Link2 size={16} /> Ophalen</>}
          </button>
          <button style={{ ...T.secundair, marginTop: 0, width: "auto", padding: "12px 14px" }}
            onClick={plak} aria-label="Link uit klembord plakken">
            <ClipboardPaste size={16} />
          </button>
        </div>
        <p style={T.hint}>
          Werkt voor een receptpagina én voor een productpagina van een webshop; de
          app zoekt zelf uit welke van de twee het is. Op Android kun je een pagina
          rechtstreeks vanuit je browser naar deze app delen. Op iOS bestaat dat
          niet: kopieer de link en gebruik de plakknop.
        </p>
      </div>

      {uitslag?.soort === "product" && (
        <>
          <div style={T.kaart}>
            <div style={T.productNaam}>{uitslag.product.name}</div>
            <div style={T.productSub}>
              {uitslag.product.brand ? `${uitslag.product.brand} · ` : ""}
              {PRODUCT_BRON_UITLEG[uitslag.bron]}
            </div>
            <div style={T.macroRij}>
              <span style={T.macro}>
                <span style={T.macroWaarde}>{Math.round(uitslag.product.per100.kcal)}</span>{" "}
                kcal/100 {uitslag.product.eenheid}
              </span>
              <span style={T.macro}>
                <span style={T.macroWaarde}>{nl(uitslag.product.per100.protein_g)}</span> g eiwit
              </span>
              <span style={T.macro}>
                <span style={T.macroWaarde}>{nl(uitslag.product.per100.sugar_g)}</span> g suiker
              </span>
              <span style={T.macro}>
                <span style={T.macroWaarde}>
                  {toonPunten(rawPoints(uitslag.product.per100, 100), schaal)}
                </span> pt per 100 {uitslag.product.eenheid}
              </span>
            </div>
          </div>

          {uitslag.product.barcode && (
            <div style={{ ...T.melding, borderColor: "var(--green)" }}>
              Streepjescode <strong style={{ color: "var(--ink)" }}>{uitslag.product.barcode}</strong>{" "}
              stond op de pagina en is bewaard. Scan je dit product later, dan wordt
              het meteen gevonden.
            </div>
          )}

          <button style={T.primair} onClick={() => onKiesProduct(uitslag.product)}>
            <Check size={16} /> Hoeveelheid kiezen en toevoegen
          </button>

          <p style={T.hint}>
            De punten komen uit de eigen formule, berekend uit de voedingswaarden op
            de pagina. Prijzen en bonusteksten worden genegeerd.
          </p>
        </>
      )}

      {uitslag?.soort === "recept" && (
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
