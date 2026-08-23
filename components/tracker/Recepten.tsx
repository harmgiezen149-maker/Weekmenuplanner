"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, ChefHat, Loader2, Search } from "lucide-react";
import { T } from "./stijl";
import { toonPunten } from "@/lib/tracker/points";
import { nl } from "@/lib/tracker/datum";
import { MAALTIJDEN_TRACKER, MAALTIJD_LABEL } from "@/lib/tracker/types";
import type { Maaltijd } from "@/lib/tracker/types";
import type { ReceptPunten } from "@/lib/tracker/recept";

export interface ReceptKop {
  id: string;
  titel: string;
  maaltijd: string;
  personen: number;
  aantalIngredienten: number;
}

interface Doorgerekend {
  recept: { id: string; titel: string; personen: number; maaltijd: string };
  punten: ReceptPunten;
  uitCache: boolean;
}

/**
 * Recepten uit het kookboek, doorgerekend naar punten per portie.
 *
 * De ingrediënten worden gematcht tegen de eigen basislijst. Dat lukt niet
 * altijd, en dat hoort zichtbaar te zijn: wat niet herkend is telt niet mee en
 * staat er met naam en toenaam bij. Liever een getal met een kanttekening dan
 * een getal dat doet alsof het klopt.
 */
export default function Recepten({
  maaltijd, datumLabel, schaal, bezig, fout, onLog,
}: {
  maaltijd: Maaltijd;
  datumLabel: string;
  schaal: number;
  bezig: boolean;
  fout: string;
  onLog: (payload: Record<string, unknown>) => void;
}) {
  const [recepten, setRecepten] = useState<ReceptKop[] | null>(null);
  const [term, setTerm] = useState("");
  const [gekozen, setGekozen] = useState<Doorgerekend | null>(null);
  const [laadt, setLaadt] = useState(false);
  const [laadFout, setLaadFout] = useState("");

  useEffect(() => {
    fetch("/api/tracker/recepten", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setRecepten(Array.isArray(d.recepten) ? d.recepten : []))
      .catch(() => setRecepten([]));
  }, []);

  const kies = async (id: string) => {
    setLaadt(true); setLaadFout("");
    try {
      const res = await fetch(`/api/tracker/recepten/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Recept kon niet worden doorgerekend");
      setGekozen(await res.json());
    } catch (e) {
      setLaadFout(e instanceof Error ? e.message : "Er ging iets mis");
    } finally { setLaadt(false); }
  };

  if (gekozen) {
    return (
      <Portie gekozen={gekozen} maaltijd={maaltijd} datumLabel={datumLabel} schaal={schaal}
        bezig={bezig} fout={fout} onLog={onLog} onTerug={() => setGekozen(null)} />
    );
  }

  const zichtbaar = (recepten ?? []).filter((r) =>
    r.titel.toLowerCase().includes(term.trim().toLowerCase()));

  return (
    <>
      {laadFout && <div style={T.fout}>{laadFout}</div>}

      <div style={T.zoekWrap}>
        {laadt
          ? <Loader2 size={17} className="spin" style={{ color: "var(--accent)", flexShrink: 0 }} />
          : <Search size={17} style={{ color: "var(--sub)", flexShrink: 0 }} />}
        <input style={T.zoekInput} value={term} onChange={(e) => setTerm(e.target.value)}
          placeholder="Zoek in je kookboek" aria-label="Zoek een recept" />
      </div>

      {recepten === null && (
        <div style={T.center}><Loader2 size={22} className="spin" style={{ color: "var(--accent)" }} /></div>
      )}

      {recepten !== null && zichtbaar.length === 0 && (
        <div style={T.melding}>
          {recepten.length === 0
            ? "Je kookboek is nog leeg. Voeg eerst een recept toe bij Recepten."
            : `Geen recept gevonden voor "${term.trim()}".`}
        </div>
      )}

      {zichtbaar.length > 0 && (
        <div style={T.kaartStrak}>
          {zichtbaar.map((r) => (
            <button key={r.id} style={T.resultaat} onClick={() => kies(r.id)}>
              <span style={T.resultaatTekst}>
                <span style={T.resultaatNaam}>{r.titel}</span>
                <span style={T.resultaatSub}>
                  {r.maaltijd} · {r.personen} {r.personen === 1 ? "persoon" : "personen"} ·{" "}
                  {r.aantalIngredienten} ingrediënten
                </span>
              </span>
              <ChefHat size={16} style={{ color: "var(--sub)", flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function Portie({
  gekozen, maaltijd, datumLabel, schaal, bezig, fout, onLog, onTerug,
}: {
  gekozen: Doorgerekend;
  maaltijd: Maaltijd;
  datumLabel: string;
  schaal: number;
  bezig: boolean;
  fout: string;
  onLog: (payload: Record<string, unknown>) => void;
  onTerug: () => void;
}) {
  const { recept, punten } = gekozen;
  const [porties, setPorties] = useState("1");
  const [maal, setMaal] = useState<Maaltijd>(maaltijd);

  const aantal = getal(porties);
  const raw = punten.perPortiePunten * aantal;
  const zichtbaar = toonPunten(raw, schaal);

  const log = () => {
    if (aantal <= 0 || bezig) return;
    // De onderdelen gaan mee naar de server, die de punten per onderdeel
    // opnieuw uitrekent en optelt. Zo blijft de suikercorrectie per
    // ingrediënt overeind.
    const factor = aantal / punten.personen;
    onLog({
      name: recept.titel,
      meal: maal,
      source: "recipe",
      ref: recept.id,
      amount: aantal,
      unit: aantal === 1 ? "portie" : "porties",
      components: punten.componenten.map((c) => ({
        ...c,
        amount: c.amount * factor,
        grams: c.grams * factor,
        nutrients: schaalNutrients(c.nutrients, factor),
      })),
    });
  };

  return (
    <>
      <button style={T.terugKnop} onClick={onTerug}>
        <ArrowLeft size={15} /> Terug naar de receptenlijst
      </button>

      {fout && <div style={T.fout}>{fout}</div>}

      <div style={T.kaart}>
        <div style={T.productNaam}>{recept.titel}</div>
        <div style={T.productSub}>
          Uit je kookboek · recept voor {recept.personen}{" "}
          {recept.personen === 1 ? "persoon" : "personen"}
        </div>
      </div>

      <div style={T.live} role="status" aria-live="polite">
        <span style={T.liveGetal}>{zichtbaar}</span>
        <span style={T.liveTekst}>
          {zichtbaar === 1 ? "punt" : "punten"} voor {nl(aantal)}{" "}
          {aantal === 1 ? "portie" : "porties"}<br />
          {datumLabel.toLowerCase()} · {MAALTIJD_LABEL[maal].toLowerCase()}
        </span>
      </div>

      {punten.nietHerkend.length > 0 && (
        <div style={T.waarschuwing}>
          <strong>
            {punten.nietHerkend.length}{" "}
            {punten.nietHerkend.length === 1 ? "ingrediënt telt" : "ingrediënten tellen"} niet mee:
          </strong>{" "}
          {punten.nietHerkend.join(", ")}.{" "}
          {punten.nietHerkend.length === 1
            ? "Dat staat niet in de productlijst"
            : "Die staan niet in de productlijst"}, dus de punten hierboven zijn aan
          de lage kant.
        </div>
      )}

      {punten.onzeker.length > 0 && (
        <div style={T.waarschuwing}>
          <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
          Bij {punten.onzeker.join(", ")} is de hoeveelheid geschat. Kijk hieronder
          of {punten.onzeker.length === 1 ? "dat" : "die"} klopt.
        </div>
      )}

      <div style={T.veldRij}>
        <div style={{ flex: 1 }}>
          <label style={T.label} htmlFor="rc-porties">Aantal porties</label>
          <input id="rc-porties" style={T.veld} value={porties} inputMode="decimal"
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
        {punten.matches.map((m, i) => (
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
            {!m.overgeslagen && (m.score < 50 || m.omrekening.onzeker) && (
              <AlertTriangle size={14} style={{ color: "var(--gold)", flexShrink: 0 }} />
            )}
          </div>
        ))}
      </div>

      <p style={T.hint}>
        De punten komen altijd uit de eigen formule, nooit van de bron van het
        recept. Elk ingrediënt houdt zijn eigen soort, dus groente en magere
        eiwitbronnen tellen ook hier zacht mee.
      </p>

      <button style={{ ...T.primair, opacity: aantal > 0 && !bezig ? 1 : 0.5 }}
        disabled={aantal <= 0 || bezig} onClick={log}>
        {bezig
          ? <><Loader2 size={16} className="spin" /> Opslaan...</>
          : <><Check size={16} /> Toevoegen aan {datumLabel.toLowerCase()}</>}
      </button>
    </>
  );
}

function schaalNutrients(n: ReceptPunten["perPortieNutrients"], f: number) {
  return {
    ...n,
    kcal: n.kcal * f, protein_g: n.protein_g * f, fat_g: n.fat_g * f,
    satfat_g: n.satfat_g * f, carbs_g: n.carbs_g * f,
    sugar_g: n.sugar_g * f, fiber_g: n.fiber_g * f,
  };
}

function getal(s: string): number {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
