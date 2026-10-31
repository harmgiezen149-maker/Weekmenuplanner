"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Bot, Check, Copy, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { T } from "./stijl";

// Claude-koppeling: het adres waarmee Harms AI-dorp op claude.ai bij het
// kookboek kan. Het dorp leest recepten, weekmenu, boodschappen en voorraad, en
// zet er pas iets in nadat Harm daar op "Goedkeuren" heeft gedrukt. De tracker
// (gewicht en eten) blijft er buiten.

export default function ClaudeKoppeling() {
  const [sleutel, setSleutel] = useState<string | null>(null);
  const [laden, setLaden] = useState(true);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [gekopieerd, setGekopieerd] = useState(false);

  const laad = useCallback(async () => {
    try {
      const res = await fetch("/api/claude-koppeling", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Kon de koppeling niet ophalen");
      setSleutel(data.sleutel);
    } catch (e) { setFout(tekstUit(e)); } finally { setLaden(false); }
  }, []);
  useEffect(() => { laad(); }, [laad]);

  const nieuw = async () => {
    if (sleutel && !confirm("Nieuwe sleutel maken? Het oude adres werkt dan meteen niet meer; zet het nieuwe in claude.ai.")) return;
    setBezig(true); setFout("");
    try {
      const res = await fetch("/api/claude-koppeling", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Er ging iets mis");
      setSleutel(data.sleutel);
    } catch (e) { setFout(tekstUit(e)); } finally { setBezig(false); }
  };

  const trekIn = async () => {
    if (!confirm("Koppeling intrekken? Claude kan daarna niet meer bij het kookboek.")) return;
    setBezig(true); setFout("");
    try { await fetch("/api/claude-koppeling", { method: "DELETE" }); setSleutel(null); }
    catch (e) { setFout(tekstUit(e)); } finally { setBezig(false); }
  };

  const adres = sleutel && typeof window !== "undefined" ? `${window.location.origin}/api/mcp/${sleutel}` : "";
  const kopieer = async () => {
    try { await navigator.clipboard.writeText(adres); setGekopieerd(true); setTimeout(() => setGekopieerd(false), 2000); }
    catch { setFout("Kopiëren lukte niet. Selecteer het adres en kopieer het met de hand."); }
  };

  return (
    <>
      <h2 style={T.sectieKop}>Claude-koppeling</h2>
      <p style={T.hint}>
        Laat je AI-dorp op claude.ai bij het kookboek: recepten lezen, het weekmenu en de
        boodschappen bekijken, en — pas nadat jij in het dorp op <strong>Goedkeuren</strong> drukt —
        een recept inplannen, iets op de lijst zetten of een recept toevoegen. Niets wordt
        verwijderd, en je tracker blijft erbuiten.
      </p>
      {fout && <div style={{ ...T.waarschuwing, marginTop: 10 }}>{fout}</div>}
      {laden ? (
        <div style={T.kaart}><Loader2 size={18} className="spin" style={{ color: "var(--accent)" }} /></div>
      ) : !sleutel ? (
        <button style={{ ...T.primair, marginTop: 12, opacity: bezig ? 0.6 : 1 }} onClick={nieuw} disabled={bezig}>
          <Bot size={15} /> Koppeling aanmaken
        </button>
      ) : (
        <div style={{ ...T.kaart, marginTop: 12 }}>
          <div style={T.label}>Adres voor claude.ai</div>
          <code style={S.code}>{adres}</code>
          <button style={{ ...T.primair, marginTop: 10 }} onClick={kopieer}>
            {gekopieerd ? <><Check size={15} /> Gekopieerd</> : <><Copy size={15} /> Adres kopiëren</>}
          </button>
          <ol style={{ ...T.hint, paddingLeft: 18, marginTop: 12 }}>
            <li>Ga op claude.ai naar <strong>Instellingen → Connectors</strong>.</li>
            <li>Kies <strong>Aangepaste connector toevoegen</strong>.</li>
            <li>Naam: <span style={S.bestand}>Kookboek</span> (precies zo, het dorp zoekt op deze naam).</li>
            <li>Plak het adres hierboven en sla op.</li>
          </ol>
          <p style={T.hint}>
            Het adres is de sleutel: deel het met niemand. Uitgelekt? Maak een nieuwe; de oude
            werkt dan meteen niet meer.
          </p>
          <button style={{ ...T.secundair, opacity: bezig ? 0.6 : 1 }} onClick={nieuw} disabled={bezig}>
            <RefreshCw size={15} /> Nieuwe sleutel
          </button>
          <button style={{ ...T.secundair, opacity: bezig ? 0.6 : 1 }} onClick={trekIn} disabled={bezig}>
            <Trash2 size={15} /> Koppeling intrekken
          </button>
        </div>
      )}
    </>
  );
}

const S: Record<string, React.CSSProperties> = {
  code: {
    display: "block", background: "var(--bg)", border: "1px solid var(--line)",
    borderRadius: 8, padding: "8px 10px", fontSize: 11.5, lineHeight: 1.5,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    wordBreak: "break-all", color: "var(--ink)",
  },
  bestand: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.92em", background: "var(--bg)", padding: "1px 5px", borderRadius: 5,
  },
};

function tekstUit(e: unknown): string {
  return e instanceof Error ? e.message : "Er ging iets mis";
}
