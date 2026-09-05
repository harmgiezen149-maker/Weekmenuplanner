"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowUp, Check, ExternalLink, Loader2, MessageCircle, Plus, Trash2, X,
} from "lucide-react";
import { leesScherm } from "@/lib/scherm";

// ---------------------------------------------------------------------------
// Het pratende bolletje.
//
// Staat op elk scherm van beide helften, zodat een vraag over het recept dat
// je bekijkt geen omweg is. Eigen stijlen in plaats van die van het kookboek
// of de tracker: dit ding hangt boven allebei, en moet er in allebei hetzelfde
// uitzien. De kleuren komen wel uit dezelfde variabelen, dus het volgt het
// thema mee.
// ---------------------------------------------------------------------------

interface Bron { titel: string; url: string }
interface Voorstel { soort: string; omschrijving: string; gegevens: Record<string, unknown> }
interface Bericht {
  rol: "mens" | "bot";
  tekst: string;
  ts: number;
  bronnen?: Bron[];
  voorstellen?: Voorstel[];
}
interface Gesprek { id: string; titel: string; bijgewerkt: number; berichten: Bericht[] }

const VOORBEELDEN = [
  "Wat staat er deze week op het menu?",
  "Welk recept is het lichtst in punten?",
  "Hoe ging mijn week?",
  "Wat kan ik vanavond eten onder de 12 punten?",
];

/** Op deze paden hoort geen chatknop. */
const VERBORGEN = ["/login"];

export default function Chat() {
  const pad = usePathname();
  const [open, setOpen] = useState(false);

  if (VERBORGEN.some((p) => pad?.startsWith(p))) return null;

  return (
    <>
      {!open && (
        <button style={S.bolletje} onClick={() => setOpen(true)} aria-label="Vraag het de app">
          <MessageCircle size={22} />
        </button>
      )}
      {open && <Paneel pad={pad ?? ""} onSluit={() => setOpen(false)} />}
    </>
  );
}

function Paneel({ pad, onSluit }: { pad: string; onSluit: () => void }) {
  const [gesprek, setGesprek] = useState<Gesprek | null>(null);
  const [lijst, setLijst] = useState<{ id: string; titel: string; bijgewerkt: number }[]>([]);
  const [lijstOpen, setLijstOpen] = useState(false);
  const [vraag, setVraag] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const onder = useRef<HTMLDivElement | null>(null);

  // Bij openen het laatste gesprek terughalen. Doorpraten waar je gebleven was
  // is bijna altijd wat je wilt; een nieuw gesprek is één tik.
  useEffect(() => {
    (async () => {
      try {
        const d = await (await fetch("/api/chat", { cache: "no-store" })).json();
        const gesprekken = Array.isArray(d.gesprekken) ? d.gesprekken : [];
        setLijst(gesprekken);
        if (gesprekken[0]) {
          const g = await (await fetch(`/api/chat?id=${gesprekken[0].id}`, { cache: "no-store" })).json();
          if (g.gesprek) setGesprek(g.gesprek);
        }
      } catch { /* zonder geschiedenis begin je gewoon opnieuw */ }
    })();
  }, []);

  useEffect(() => {
    onder.current?.scrollIntoView({ behavior: "smooth" });
  }, [gesprek?.berichten.length, bezig]);

  const stuur = async (tekst: string) => {
    const vandaag = tekst.trim();
    if (!vandaag || bezig) return;
    setVraag(""); setFout(""); setBezig(true);

    // De eigen vraag staat er meteen; anders lijkt de app te hangen.
    const nu = Date.now();
    setGesprek((g) => ({
      id: g?.id ?? "", titel: g?.titel ?? vandaag, bijgewerkt: nu,
      berichten: [...(g?.berichten ?? []), { rol: "mens", tekst: vandaag, ts: nu }],
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bericht: vandaag,
          gesprek: gesprek?.id || undefined,
          scherm: leesScherm() || schermUitPad(pad),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Er ging iets mis");
      setGesprek((g) => ({
        id: d.gesprek, titel: d.titel ?? g?.titel ?? vandaag, bijgewerkt: Date.now(),
        berichten: [...(g?.berichten ?? []), d.bericht],
      }));
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Er ging iets mis");
    } finally { setBezig(false); }
  };

  const nieuw = () => { setGesprek(null); setLijstOpen(false); setFout(""); };

  const kies = async (id: string) => {
    setLijstOpen(false);
    try {
      const g = await (await fetch(`/api/chat?id=${id}`, { cache: "no-store" })).json();
      if (g.gesprek) setGesprek(g.gesprek);
    } catch { setFout("Dat gesprek kon niet geopend worden"); }
  };

  const wis = async (id: string) => {
    try {
      const d = await (await fetch(`/api/chat?id=${id}`, { method: "DELETE" })).json();
      setLijst(Array.isArray(d.gesprekken) ? d.gesprekken : []);
      if (gesprek?.id === id) setGesprek(null);
    } catch { /* stil; de lijst klopt dan even niet */ }
  };

  const berichten = gesprek?.berichten ?? [];

  return (
    <div style={S.laag} role="dialog" aria-label="Vraag het de app">
      <header style={S.kop}>
        <button style={S.kopKnop} onClick={() => setLijstOpen((v) => !v)}
          aria-label="Eerdere gesprekken">
          <MessageCircle size={18} />
        </button>
        <span style={S.kopTitel}>{gesprek?.titel || "Vraag het de app"}</span>
        <button style={S.kopKnop} onClick={nieuw} aria-label="Nieuw gesprek">
          <Plus size={18} />
        </button>
        <button style={S.kopKnop} onClick={onSluit} aria-label="Sluiten">
          <X size={18} />
        </button>
      </header>

      {lijstOpen && (
        <div style={S.lijst}>
          {lijst.length === 0 && <div style={S.leegLijst}>Nog geen eerdere gesprekken.</div>}
          {lijst.map((g) => (
            <div key={g.id} style={S.lijstRij}>
              <button style={S.lijstKnop} onClick={() => kies(g.id)}>
                <span style={S.lijstTitel}>{g.titel}</span>
                <span style={S.lijstDatum}>{datum(g.bijgewerkt)}</span>
              </button>
              <button style={S.wisKnop} onClick={() => wis(g.id)} aria-label={`${g.titel} verwijderen`}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={S.stroom}>
        {berichten.length === 0 && (
          <div style={S.welkom}>
            <p style={S.welkomTekst}>
              Vraag me iets over je kookboek, je weekmenu, je boodschappen of je tracker.
              Ik kijk in je eigen gegevens, en zoek het op internet op als het daar niet
              in staat — met de bron erbij.
            </p>
            {VOORBEELDEN.map((v) => (
              <button key={v} style={S.voorbeeld} onClick={() => stuur(v)}>{v}</button>
            ))}
          </div>
        )}

        {berichten.map((b, n) => (
          <Beurt key={`${b.ts}-${n}`} bericht={b} />
        ))}

        {bezig && (
          <div style={{ ...S.bel, ...S.belBot, ...S.bezig }}>
            <Loader2 size={15} className="spin" /> aan het kijken...
          </div>
        )}
        {fout && <div style={S.fout}>{fout}</div>}
        <div ref={onder} />
      </div>

      <form style={S.balk} onSubmit={(e) => { e.preventDefault(); stuur(vraag); }}>
        <input style={S.veld} value={vraag} onChange={(e) => setVraag(e.target.value)}
          placeholder="Stel je vraag" aria-label="Je vraag" autoFocus />
        <button style={{ ...S.stuur, opacity: vraag.trim() && !bezig ? 1 : 0.4 }}
          disabled={!vraag.trim() || bezig} aria-label="Versturen">
          <ArrowUp size={18} />
        </button>
      </form>
    </div>
  );
}

function Beurt({ bericht }: { bericht: Bericht }) {
  const vanMij = bericht.rol === "mens";
  return (
    <>
      <div style={{ ...S.bel, ...(vanMij ? S.belMens : S.belBot) }}>
        {regels(bericht.tekst)}
      </div>

      {bericht.voorstellen?.map((v, n) => (
        <Voorstelkaart key={n} voorstel={v} />
      ))}

      {bericht.bronnen && bericht.bronnen.length > 0 && (
        <div style={S.bronnen}>
          <span style={S.bronnenKop}>Van internet:</span>
          {bericht.bronnen.map((b) => (
            <a key={b.url} href={b.url} target="_blank" rel="noreferrer" style={S.bron}>
              <ExternalLink size={11} /> {b.titel}
            </a>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Een voorstel. Er gebeurt niets tot je op de knop drukt, en wat er dan
 * gebeurt wordt op de server opnieuw nagekeken.
 */
function Voorstelkaart({ voorstel }: { voorstel: Voorstel }) {
  const [bezig, setBezig] = useState(false);
  const [klaar, setKlaar] = useState("");
  const [fout, setFout] = useState("");

  const doe = async () => {
    setBezig(true); setFout("");
    try {
      const res = await fetch("/api/chat/actie", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soort: voorstel.soort, gegevens: voorstel.gegevens }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Het lukte niet");
      setKlaar(d.gedaan || "Gedaan");
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Het lukte niet");
    } finally { setBezig(false); }
  };

  if (klaar) {
    return (
      <div style={{ ...S.voorstel, ...S.voorstelKlaar }}>
        <Check size={15} style={{ flexShrink: 0 }} /> {klaar}
      </div>
    );
  }

  return (
    <div style={S.voorstel}>
      <span style={S.voorstelTekst}>{hoofdletter(voorstel.omschrijving)}</span>
      {fout && <span style={S.voorstelFout}>{fout}</span>}
      <button style={S.voorstelKnop} onClick={doe} disabled={bezig}>
        {bezig ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Doen
      </button>
    </div>
  );
}

/** Regels en streepjeslijstjes; meer opmaak heeft een antwoord hier niet nodig. */
function regels(tekst: string) {
  return tekst.split("\n").map((r, n) => {
    const kaal = r.trim();
    if (kaal === "") return <div key={n} style={{ height: 6 }} />;
    if (/^[-*•]\s+/.test(kaal)) {
      return <div key={n} style={S.punt}>• {kaal.replace(/^[-*•]\s+/, "")}</div>;
    }
    return <div key={n}>{kaal}</div>;
  });
}

function hoofdletter(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function datum(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

/** Als geen enkel scherm zichzelf heeft aangemeld: dan maar het pad. */
function schermUitPad(pad: string): string {
  if (pad.startsWith("/tracker/week")) return "het weekoverzicht van de tracker";
  if (pad.startsWith("/tracker/inzicht")) return "de inzichtpagina van de tracker";
  if (pad.startsWith("/tracker/gewicht")) return "het weegscherm";
  if (pad.startsWith("/tracker/toevoegen")) return "het scherm om iets te loggen";
  if (pad.startsWith("/tracker")) return "het dagoverzicht van de tracker";
  return "het kookboek";
}

const S: Record<string, React.CSSProperties> = {
  bolletje: {
    position: "fixed", right: 16, bottom: "calc(86px + env(safe-area-inset-bottom))",
    width: 52, height: 52, borderRadius: 26, border: "none", background: "var(--accent)",
    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 6px 20px rgba(22,25,39,0.28)", cursor: "pointer", zIndex: 60,
  },
  laag: {
    position: "fixed", inset: 0, zIndex: 70, background: "var(--bg)",
    display: "flex", flexDirection: "column",
    paddingBottom: "env(safe-area-inset-bottom)",
  },
  kop: {
    display: "flex", alignItems: "center", gap: 6, padding: "12px 12px",
    paddingTop: "calc(12px + env(safe-area-inset-top))",
    borderBottom: "1px solid var(--line)", background: "var(--surface)",
  },
  kopTitel: {
    flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 800, letterSpacing: "-0.01em",
    color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  kopKnop: {
    width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
    border: "none", background: "none", color: "var(--sub)", cursor: "pointer", flexShrink: 0,
  },
  lijst: { borderBottom: "1px solid var(--line)", background: "var(--surface)", maxHeight: "40vh", overflowY: "auto" },
  lijstRij: { display: "flex", alignItems: "center", borderBottom: "1px solid var(--line)" },
  lijstKnop: {
    flex: 1, minWidth: 0, textAlign: "left", padding: "10px 14px", border: "none",
    background: "none", cursor: "pointer", display: "block",
  },
  lijstTitel: { display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  lijstDatum: { display: "block", fontSize: 11.5, color: "var(--sub)", marginTop: 2 },
  leegLijst: { padding: "12px 14px", fontSize: 13, color: "var(--sub)" },
  wisKnop: { width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "none", color: "var(--sub)", cursor: "pointer" },

  stroom: { flex: 1, overflowY: "auto", padding: "14px 12px 4px", display: "flex", flexDirection: "column", gap: 8 },
  welkom: { padding: "6px 2px 4px" },
  welkomTekst: { fontSize: 13.5, lineHeight: 1.6, color: "var(--sub)", margin: "0 0 12px" },
  voorbeeld: {
    display: "block", width: "100%", textAlign: "left", marginBottom: 7,
    padding: "10px 13px", borderRadius: 12, border: "1px solid var(--line)",
    background: "var(--surface)", color: "var(--ink)", fontSize: 13.5, cursor: "pointer",
  },

  bel: { maxWidth: "88%", padding: "10px 13px", borderRadius: 14, fontSize: 14, lineHeight: 1.55 },
  belMens: { alignSelf: "flex-end", background: "var(--accent)", color: "#fff", borderBottomRightRadius: 4 },
  belBot: { alignSelf: "flex-start", background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)", borderBottomLeftRadius: 4 },
  bezig: { display: "flex", alignItems: "center", gap: 8, color: "var(--sub)", fontSize: 13 },
  punt: { paddingLeft: 4 },

  bronnen: { alignSelf: "flex-start", maxWidth: "88%", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", padding: "0 2px" },
  bronnenKop: { fontSize: 11.5, fontWeight: 700, color: "var(--sub)" },
  bron: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--accent)", textDecoration: "none", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },

  voorstel: {
    alignSelf: "flex-start", maxWidth: "88%", display: "flex", alignItems: "center",
    flexWrap: "wrap", gap: 8, padding: "10px 12px", borderRadius: 12,
    border: "1px solid var(--accent)", background: "var(--surface)",
  },
  voorstelKlaar: { borderColor: "var(--line)", color: "var(--sub)", fontSize: 13 },
  voorstelTekst: { flex: 1, minWidth: 120, fontSize: 13.5, fontWeight: 700, color: "var(--ink)" },
  voorstelFout: { width: "100%", fontSize: 12, color: "var(--red)" },
  voorstelKnop: {
    display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px",
    borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff",
    fontSize: 13, fontWeight: 700, cursor: "pointer",
  },

  fout: { alignSelf: "stretch", padding: "10px 12px", borderRadius: 10, background: "#fdeeeb", border: "1px solid var(--red)", color: "#a8351f", fontSize: 13 },

  balk: { display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--line)", background: "var(--surface)" },
  veld: {
    flex: 1, minWidth: 0, padding: "11px 13px", borderRadius: 12,
    border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)",
    fontSize: 15, outline: "none",
  },
  stuur: {
    width: 44, flexShrink: 0, borderRadius: 12, border: "none",
    background: "var(--accent)", color: "#fff", display: "flex",
    alignItems: "center", justifyContent: "center", cursor: "pointer",
  },
};
