"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, ChefHat, ExternalLink, ScanLine } from "lucide-react";
import { leesDeling } from "@/lib/deellink";

// ---------------------------------------------------------------------------
// Waar een gedeelde pagina heen moet.
//
// Het deelmenu kan maar naar één adres wijzen, en de app heeft twee bruikbare
// bestemmingen: een receptpagina hoort in het kookboek, een productpagina in
// de tracker. Vandaar dit tussenscherm — één tik, en er wordt niets aan het
// model gevraagd tot je gekozen hebt. Automatisch raden zou bij elke gedeelde
// productpagina een receptimport starten die je niet wilde.
// ---------------------------------------------------------------------------

export default function Deelkeuze() {
  const router = useRouter();
  const zoek = useSearchParams();

  const { url, tekst } = leesDeling({
    url: zoek.get("url"),
    text: zoek.get("text"),
    title: zoek.get("title"),
  });

  const naarKookboek = () => {
    const q = url ? `deel=${encodeURIComponent(url)}` : `deelzoek=${encodeURIComponent(tekst)}`;
    router.replace(`/?${q}`);
  };

  return (
    <main style={S.blad}>
      <h1 style={S.kop}>Gedeeld met Kookboek</h1>

      <div style={S.bron}>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" style={S.link}>
            <ExternalLink size={13} /> {kort(url)}
          </a>
        ) : (
          <span style={S.geenLink}>Geen link meegekomen, alleen tekst.</span>
        )}
        {tekst && <div style={S.tekst}>{tekst}</div>}
      </div>

      <p style={S.uitleg}>Wat wil je hiermee?</p>

      <button style={{ ...S.knop, ...S.primair }} onClick={naarKookboek}>
        <ChefHat size={18} />
        <span style={S.knopTekst}>
          <strong>Recept in het kookboek</strong>
          <span style={S.knopSub}>
            {url
              ? "De pagina wordt uitgelezen; je ziet het recept voordat het wordt opgeslagen."
              : "Zoekt op deze naam naar receptpagina's."}
          </span>
        </span>
      </button>

      {url && (
        <button style={S.knop} onClick={() => router.replace(`/tracker/import?url=${encodeURIComponent(url)}`)}>
          <ScanLine size={18} />
          <span style={S.knopTekst}>
            <strong>Product in de tracker</strong>
            <span style={S.knopSub}>Voor een productpagina van een winkel: naam en voedingswaarden.</span>
          </span>
        </button>
      )}

      <button style={S.knop} onClick={() => router.replace("/")}>
        <BookOpen size={18} />
        <span style={S.knopTekst}>
          <strong>Gewoon de app openen</strong>
          <span style={S.knopSub}>Hier gebeurt verder niets mee.</span>
        </span>
      </button>
    </main>
  );
}

/** Een link is op een telefoon vaak breder dan het scherm. */
function kort(url: string): string {
  const zonder = url.replace(/^https?:\/\/(www\.)?/, "");
  return zonder.length > 60 ? `${zonder.slice(0, 57)}...` : zonder;
}

const S: Record<string, React.CSSProperties> = {
  blad: {
    maxWidth: 520, margin: "0 auto", padding: "24px 16px 40px",
    paddingTop: "calc(24px + env(safe-area-inset-top))",
  },
  kop: { fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 14px", color: "var(--ink)" },
  bron: {
    background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12,
    padding: "12px 14px", marginBottom: 18,
  },
  link: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--accent)", textDecoration: "none", wordBreak: "break-all" },
  geenLink: { fontSize: 13, color: "var(--sub)" },
  tekst: { fontSize: 14, fontWeight: 700, color: "var(--ink)", marginTop: 6, lineHeight: 1.4 },
  uitleg: { fontSize: 13, fontWeight: 700, color: "var(--sub)", margin: "0 0 10px" },
  knop: {
    display: "flex", alignItems: "flex-start", gap: 12, width: "100%", textAlign: "left",
    padding: "14px 15px", marginBottom: 10, borderRadius: 14, cursor: "pointer",
    border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)",
  },
  primair: { borderColor: "var(--accent)", boxShadow: "0 1px 0 var(--accent)" },
  knopTekst: { display: "flex", flexDirection: "column", gap: 3, minWidth: 0 },
  knopSub: { fontSize: 12.5, color: "var(--sub)", lineHeight: 1.5, fontWeight: 400 },
};
