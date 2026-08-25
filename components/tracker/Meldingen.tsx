"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Check, Loader2, Send } from "lucide-react";
import { T } from "./stijl";
import type { Meldingvoorkeur } from "@/lib/tracker/herinnering";

// Meldingen aan- en uitzetten. Twee soorten, allebei apart, allebei standaard
// uit: een app die ongevraagd op je vergrendelscherm verschijnt is een app die
// je uitzet.

type Toestand = "onbekend" | "kan-niet" | "geweigerd" | "uit" | "aan";

export default function Meldingen() {
  const [toestand, setToestand] = useState<Toestand>("onbekend");
  const [voorkeur, setVoorkeur] = useState<Meldingvoorkeur>({ weegdag: false, logboek: false });
  const [apparaten, setApparaten] = useState(0);
  const [sleutel, setSleutel] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [melding, setMelding] = useState("");

  const laad = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setToestand("kan-niet");
      return;
    }
    try {
      const res = await fetch("/api/push", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Kon de meldingen niet ophalen");
      setSleutel(data.sleutel ?? "");
      setVoorkeur(data.voorkeur ?? { weegdag: false, logboek: false });
      setApparaten((data.apparaten ?? []).length);

      const reg = await navigator.serviceWorker.ready;
      const abo = await reg.pushManager.getSubscription();
      if (Notification.permission === "denied") setToestand("geweigerd");
      else setToestand(abo && Notification.permission === "granted" ? "aan" : "uit");
    } catch (e) {
      setFout(tekst(e));
      setToestand("uit");
    }
  }, []);

  useEffect(() => { laad(); }, [laad]);

  const aanzetten = async () => {
    if (bezig) return;
    setBezig(true); setFout(""); setMelding("");
    try {
      const toestemming = await Notification.requestPermission();
      if (toestemming !== "granted") {
        setToestand(toestemming === "denied" ? "geweigerd" : "uit");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const abo = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: naarBytes(sleutel),
      });
      const res = await fetch("/api/push", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          abonnement: JSON.parse(JSON.stringify(abo)),
          // Aanzetten zonder dat er iets aan staat levert nooit een melding op,
          // dus de weegdag gaat meteen mee. De rest kies je zelf.
          voorkeur: { ...voorkeur, weegdag: true },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Aanmelden lukte niet");
      setVoorkeur(data.voorkeur);
      setApparaten((data.apparaten ?? []).length);
      setToestand("aan");
      setMelding("Meldingen staan aan op dit apparaat.");
    } catch (e) {
      setFout(tekst(e));
    } finally { setBezig(false); }
  };

  const uitzetten = async () => {
    if (bezig) return;
    setBezig(true); setFout(""); setMelding("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const abo = await reg.pushManager.getSubscription();
      if (abo) {
        await fetch(`/api/push?endpoint=${encodeURIComponent(abo.endpoint)}`, { method: "DELETE" });
        await abo.unsubscribe();
      }
      setToestand("uit");
      setApparaten((n) => Math.max(0, n - 1));
      setMelding("Dit apparaat krijgt geen meldingen meer.");
    } catch (e) {
      setFout(tekst(e));
    } finally { setBezig(false); }
  };

  const wissel = async (soort: keyof Meldingvoorkeur) => {
    const nieuw = { ...voorkeur, [soort]: !voorkeur[soort] };
    setVoorkeur(nieuw);   // meteen zichtbaar; de server volgt
    setFout("");
    try {
      const res = await fetch("/api/push", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voorkeur: nieuw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Opslaan lukte niet");
      setVoorkeur(data.voorkeur);
    } catch (e) {
      setVoorkeur(voorkeur);  // terugdraaien, anders liegt het scherm
      setFout(tekst(e));
    }
  };

  const proef = async () => {
    setBezig(true); setFout(""); setMelding("");
    try {
      const res = await fetch("/api/push/proef", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Versturen lukte niet");
      setMelding(`Verstuurd naar ${data.verstuurd} apparaat${data.verstuurd === 1 ? "" : "en"}.`);
    } catch (e) {
      setFout(tekst(e));
    } finally { setBezig(false); }
  };

  return (
    <>
      <h2 style={T.sectieKop}>Meldingen</h2>

      {fout && <div style={T.fout}>{fout}</div>}
      {melding && <div style={{ ...T.melding, marginBottom: 12 }}>{melding}</div>}

      {toestand === "onbekend" && (
        <div style={T.kaart}>
          <Loader2 size={18} className="spin" style={{ color: "var(--accent)" }} />
        </div>
      )}

      {toestand === "kan-niet" && (
        <div style={T.melding}>
          Deze browser kan geen meldingen tonen. Op een iPhone werkt het alleen als je Kookboek
          eerst via Safari op je beginscherm zet.
        </div>
      )}

      {toestand === "geweigerd" && (
        <div style={T.waarschuwing}>
          Je hebt meldingen voor deze app geblokkeerd. Dat kan de app zelf niet ongedaan maken:
          zet het aan bij de instellingen van je browser of telefoon, onder Meldingen.
        </div>
      )}

      {toestand === "uit" && (
        <>
          <button style={{ ...T.primair, opacity: bezig ? 0.6 : 1 }} onClick={aanzetten} disabled={bezig}>
            {bezig
              ? <><Loader2 size={15} className="spin" /> Even geduld...</>
              : <><Bell size={15} /> Meldingen aanzetten op dit apparaat</>}
          </button>
          <p style={T.hint}>
            Je krijgt hooguit één melding per soort per dag, en alleen als er iets ontbreekt.
            Staat alles ingevuld, dan blijft het stil.
          </p>
        </>
      )}

      {toestand === "aan" && (
        <>
          <div style={T.kaartStrak}>
            <Schakelaar
              aan={voorkeur.weegdag}
              titel="Weegdag"
              uitleg="Op je weegdag, als er nog geen weging staat."
              onWissel={() => wissel("weegdag")}
            />
            <Schakelaar
              aan={voorkeur.logboek}
              titel="Dagboek"
              uitleg="Aan het eind van de dag, als je nog niets hebt gelogd. Blijft weg als je een week lang niet logt."
              onWissel={() => wissel("logboek")}
            />
          </div>

          <p style={T.hint}>
            {apparaten === 1
              ? "Aangemeld op dit apparaat."
              : `Aangemeld op ${apparaten} apparaten.`}{" "}
            De meldingen gaan 's ochtends en 's avonds uit; op het gratis abonnement van Vercel
            kan dat tot een uur later worden.
          </p>

          <button style={{ ...T.secundair, opacity: bezig ? 0.6 : 1 }} onClick={proef} disabled={bezig}>
            <Send size={15} /> Proefmelding sturen
          </button>
          <button style={T.secundair} onClick={uitzetten} disabled={bezig}>
            <BellOff size={15} /> Uitzetten op dit apparaat
          </button>
        </>
      )}
    </>
  );
}

function Schakelaar({
  aan, titel, uitleg, onWissel,
}: { aan: boolean; titel: string; uitleg: string; onWissel: () => void }) {
  return (
    <button type="button" onClick={onWissel} style={{ ...T.regel, width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid var(--line)", cursor: "pointer" }}>
      <div style={T.regelTekst}>
        <div style={T.regelNaam}>{titel}</div>
        <div style={{ ...T.regelSub, whiteSpace: "normal" }}>{uitleg}</div>
      </div>
      <span style={{
        flexShrink: 0, width: 26, height: 26, borderRadius: 999,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: aan ? "var(--accent)" : "var(--bg)",
        border: `1px solid ${aan ? "var(--accent)" : "var(--line)"}`,
        color: "#fff",
      }} aria-hidden>
        {aan && <Check size={15} />}
      </span>
    </button>
  );
}

/**
 * De publieke sleutel komt als base64url binnen; de browser wil bytes.
 */
function naarBytes(sleutel: string): Uint8Array<ArrayBuffer> {
  const opvulling = "=".repeat((4 - (sleutel.length % 4)) % 4);
  const gewoon = (sleutel + opvulling).replace(/-/g, "+").replace(/_/g, "/");
  const ruw = atob(gewoon);
  const uit = new Uint8Array(new ArrayBuffer(ruw.length));
  for (let i = 0; i < ruw.length; i++) uit[i] = ruw.charCodeAt(i);
  return uit;
}

function tekst(e: unknown): string {
  return e instanceof Error ? e.message : "Er ging iets mis";
}
