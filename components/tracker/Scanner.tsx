"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Keyboard } from "lucide-react";
import { T } from "./stijl";

// De BarcodeDetector API zit in Chrome op Android maar niet in Safari op iOS.
// TypeScript kent hem niet, dus het minimale contract staat hier.
interface GedetecteerdeCode { rawValue: string }
interface BarcodeDetectorAchtig {
  detect(bron: CanvasImageSource): Promise<GedetecteerdeCode[]>;
}
type BarcodeDetectorConstructor = new (opties?: { formats?: string[] }) => BarcodeDetectorAchtig;

const FORMATEN = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];

type Status =
  | { soort: "start" }
  | { soort: "zoekt" }
  | { soort: "bezig"; code: string }
  | { soort: "fout"; bericht: string; handmatig?: boolean };

/**
 * Streepjescode scannen met de camera.
 *
 * Waar de browser BarcodeDetector heeft (Chrome op Android) wordt die gebruikt.
 * Safari op iOS heeft hem niet; daar wordt @zxing/browser dynamisch bijgeladen,
 * zodat die bundel alleen wordt opgehaald wanneer hij echt nodig is.
 */
export default function Scanner({
  onCode, onHandmatig,
}: {
  onCode: (code: string) => void;
  onHandmatig: (code?: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<Status>({ soort: "start" });
  const [handmatigeCode, setHandmatigeCode] = useState("");

  // In een ref zodat de opruimfunctie er altijd bij kan, ook als het
  // component tussentijds opnieuw rendert.
  const stoppen = useRef<(() => void) | null>(null);
  const gevonden = useRef(false);

  const meldCode = useCallback((code: string) => {
    const schoon = code.replace(/\D/g, "");
    if (gevonden.current || schoon.length < 6) return;
    gevonden.current = true;
    setStatus({ soort: "bezig", code: schoon });
    stoppen.current?.();
    onCode(schoon);
  }, [onCode]);

  useEffect(() => {
    let afgebroken = false;
    let stream: MediaStream | null = null;
    let animatie = 0;

    (async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setStatus({
          soort: "fout",
          bericht: "Deze browser geeft geen toegang tot de camera. Scannen werkt alleen op een beveiligde verbinding (https).",
          handmatig: true,
        });
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (e) {
        if (afgebroken) return;
        const geweigerd = e instanceof DOMException && e.name === "NotAllowedError";
        setStatus({
          soort: "fout",
          bericht: geweigerd
            ? "Geen toegang tot de camera. Sta camera toe voor deze site en probeer het opnieuw."
            : "De camera kon niet worden gestart.",
          handmatig: true,
        });
        return;
      }

      if (afgebroken) { stream.getTracks().forEach((t) => t.stop()); return; }

      const video = videoRef.current;
      if (!video) { stream.getTracks().forEach((t) => t.stop()); return; }
      video.srcObject = stream;
      await video.play().catch(() => {});
      if (afgebroken) return;
      setStatus({ soort: "zoekt" });

      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
        .BarcodeDetector;

      if (Detector) {
        const detector = new Detector({ formats: FORMATEN });
        const kijk = async () => {
          if (afgebroken || gevonden.current) return;
          try {
            const codes = await detector.detect(video);
            if (codes.length > 0) { meldCode(codes[0].rawValue); return; }
          } catch {
            // Een enkel mislukt frame is geen probleem; volgende ronde opnieuw.
          }
          animatie = requestAnimationFrame(kijk);
        };
        animatie = requestAnimationFrame(kijk);
        stoppen.current = () => {
          cancelAnimationFrame(animatie);
          stream?.getTracks().forEach((t) => t.stop());
        };
        return;
      }

      // Geen BarcodeDetector (Safari op iOS): zxing bijladen.
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (afgebroken) return;
        const lezer = new BrowserMultiFormatReader();
        const bediening = await lezer.decodeFromVideoElement(video, (resultaat) => {
          if (resultaat) meldCode(resultaat.getText());
        });
        stoppen.current = () => {
          bediening.stop();
          stream?.getTracks().forEach((t) => t.stop());
        };
      } catch {
        if (afgebroken) return;
        setStatus({
          soort: "fout",
          bericht: "De scanner kon niet worden geladen. Voer de code hieronder in.",
          handmatig: true,
        });
        stream?.getTracks().forEach((t) => t.stop());
      }
    })();

    return () => {
      afgebroken = true;
      cancelAnimationFrame(animatie);
      stoppen.current?.();
      stoppen.current = null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [meldCode]);

  const mislukt = status.soort === "fout";

  return (
    <>
      {!mislukt && (
        <div style={T.scanKader}>
          <video ref={videoRef} style={T.scanVideo} muted playsInline />
          <div style={T.scanVenster} />
          <div style={T.scanLijn} />
          <div style={T.scanStatus} role="status" aria-live="polite">
            {status.soort === "start" && "Camera starten..."}
            {status.soort === "zoekt" && "Richt op de streepjescode"}
            {status.soort === "bezig" && "Product opzoeken..."}
          </div>
        </div>
      )}

      {mislukt && <div style={T.waarschuwing}>{status.bericht}</div>}

      {status.soort === "bezig" && (
        <div style={{ ...T.melding, display: "flex", alignItems: "center", gap: 10 }}>
          <Loader2 size={17} className="spin" style={{ color: "var(--accent)" }} />
          Code {status.code} opzoeken...
        </div>
      )}

      <div style={{ ...T.veldVak, marginTop: 14 }}>
        <label style={T.label} htmlFor="sc-code">Of tik de code van de verpakking over</label>
        <input id="sc-code" style={T.veld} value={handmatigeCode} inputMode="numeric"
          placeholder="8712100844256"
          onChange={(e) => setHandmatigeCode(e.target.value.replace(/\D/g, ""))} />
        <button
          style={{ ...T.secundair, opacity: handmatigeCode.length >= 6 ? 1 : 0.5 }}
          disabled={handmatigeCode.length < 6}
          onClick={() => onCode(handmatigeCode)}
        >
          Code opzoeken
        </button>
      </div>

      <button style={T.secundair} onClick={() => onHandmatig()}>
        <Keyboard size={16} /> Liever handmatig invullen
      </button>
    </>
  );
}
