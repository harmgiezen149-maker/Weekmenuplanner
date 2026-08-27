"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Loader2, Pencil, Plus, Search, Sparkles, X } from "lucide-react";
import { comprimeerAfbeelding, fileNaarDataUrl } from "@/lib/afbeelding";
import { scoorRecept, zoekRecept } from "@/lib/receptmatch";
import type { MatchUitslag } from "@/lib/receptmatch";
import type { FotoDag } from "@/lib/weekfoto";
import type { Recept } from "@/lib/types";

// ---------------------------------------------------------------------------
// Het weekmenu van een briefje overnemen.
//
// De foto wordt gelezen door het model; het koppelen aan je recepten gebeurt
// hier, in de browser, met de recepten die dit scherm toch al heeft. Dat is
// geen optimalisatie maar het punt van deze opzet: maak je halverwege alsnog
// het ontbrekende gerecht aan, dan koppelt die dag zichzelf zodra je terugkomt
// — zonder de foto opnieuw te lezen.
//
// Er verandert niets aan je weekmenu tot je onderaan bevestigt. Wat de app
// zeker weet staat vast aangevinkt, waar hij twijfelt stelt hij een vraag, en
// wat hij niet kent laat hij aan jou. Stil het bijna-goede gerecht invullen is
// het ergste wat hier kan gebeuren: dat merk je pas in de winkel.
// ---------------------------------------------------------------------------

/** Een briefje heeft kleine, schuine letters; dat vraagt meer pixels dan een bord eten. */
const BRIEFJE_PIXELS = 1600;

export interface WeekfotoStaat {
  /** Wat er per dag op het briefje stond. Leeg zolang er geen foto gelezen is. */
  dagen: FotoDag[];
  /** Dag → gekozen recept. Bevestigd door jou, of zeker genoeg om vast te zetten. */
  keuze: Record<string, string>;
  /** Dagen die je bewust leeg laat. */
  overgeslagen: string[];
}

export function legeWeekfotoStaat(): WeekfotoStaat {
  return { dagen: [], keuze: {}, overgeslagen: [] };
}

export default function Weekfoto({
  recepten, dagen, staat, setStaat, onOvernemen, onMaakRecept, onSluiten,
}: {
  recepten: Recept[];
  /** De week in de volgorde die het weekmenu aanhoudt. */
  dagen: readonly string[];
  staat: WeekfotoStaat;
  setStaat: React.Dispatch<React.SetStateAction<WeekfotoStaat | null>>;
  onOvernemen: (keuze: { dag: string; recipeId: string }[]) => void;
  /** Naar het invoerscherm, met de naam van het briefje alvast ingevuld. */
  onMaakRecept: (titel: string) => void;
  onSluiten: () => void;
}) {
  const kiezer = useRef<HTMLInputElement>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [voorstelBezig, setVoorstelBezig] = useState(false);
  const [picker, setPicker] = useState<{ dag: string; zoek: string } | null>(null);

  const gelezen = staat.dagen.length > 0;

  const verwerk = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBezig(true); setFout("");
    try {
      const ruw = await fileNaarDataUrl(file);
      const afbeelding = await comprimeerAfbeelding(ruw, 0.85, BRIEFJE_PIXELS);
      const res = await fetch("/api/week/foto", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ afbeelding }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Het lezen van de foto ging mis");
      setStaat({ dagen: data.dagen ?? [], keuze: {}, overgeslagen: [] });
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Er ging iets mis");
    } finally { setBezig(false); }
  };

  // Per dag: wat stond er, en welk recept hoort daarbij? Hangt af van je
  // receptenlijst, dus dit wordt vanzelf opnieuw bepaald als je er een
  // toevoegt.
  const regels = useMemo(() => {
    const opBriefje = new Map(staat.dagen.map((d) => [d.dag, d.tekst]));
    return dagen.map((dag) => {
      const tekst = opBriefje.get(dag) ?? "";
      return { dag, tekst, uitslag: tekst ? zoekRecept(tekst, recepten) : null };
    });
  }, [dagen, staat.dagen, recepten]);

  // Wat zeker is, wordt vastgezet. Een dag die je zelf hebt weggehaald of
  // overgeslagen blijft met rust: anders zet de app hem meteen weer terug.
  useEffect(() => {
    const nieuw: Record<string, string> = {};
    for (const r of regels) {
      if (r.uitslag?.zekerheid !== "zeker" || !r.uitslag.beste) continue;
      if (staat.keuze[r.dag] || staat.overgeslagen.includes(r.dag)) continue;
      nieuw[r.dag] = r.uitslag.beste.recept.id;
    }
    if (Object.keys(nieuw).length > 0) {
      setStaat((p) => (p ? { ...p, keuze: { ...nieuw, ...p.keuze } } : p));
    }
  }, [regels, staat.keuze, staat.overgeslagen, setStaat]);

  const kies = (dag: string, recipeId: string) => {
    setStaat((p) => p && ({
      ...p,
      keuze: { ...p.keuze, [dag]: recipeId },
      overgeslagen: p.overgeslagen.filter((d) => d !== dag),
    }));
    setPicker(null);
  };

  const slaOver = (dag: string) => setStaat((p) => {
    if (!p) return p;
    const keuze = { ...p.keuze };
    delete keuze[dag];
    return { ...p, keuze, overgeslagen: [...p.overgeslagen.filter((d) => d !== dag), dag] };
  });

  const herstel = (dag: string) => setStaat((p) => p && ({
    ...p, overgeslagen: p.overgeslagen.filter((d) => d !== dag),
  }));

  /** Dagen waar het briefje niets over zegt en waar je nog niets koos. */
  const openDagen = regels
    .filter((r) => !r.tekst && !staat.keuze[r.dag] && !staat.overgeslagen.includes(r.dag))
    .map((r) => r.dag);

  const vulAan = async () => {
    setVoorstelBezig(true); setFout("");
    try {
      const res = await fetch("/api/week/voorstel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dagen: openDagen }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Er ging iets mis");
      const extra: Record<string, string> = {};
      for (const d of data.dagen ?? []) {
        if (openDagen.includes(d.dag) && d.recept?.id) extra[d.dag] = d.recept.id;
      }
      if (Object.keys(extra).length === 0) {
        setFout("Er viel voor de lege dagen niets voor te stellen. Voeg eerst wat avondgerechten toe.");
        return;
      }
      setStaat((p) => p && ({ ...p, keuze: { ...p.keuze, ...extra } }));
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Er ging iets mis");
    } finally { setVoorstelBezig(false); }
  };

  const klaar = dagen
    .filter((d) => staat.keuze[d])
    .map((d) => ({ dag: d, recipeId: staat.keuze[d] }));

  const titelVan = (id: string) => recepten.find((r) => r.id === id)?.titel ?? "onbekend recept";

  return (
    <div style={S.overlay} role="dialog" aria-label="Weekmenu van een foto">
      <div style={S.venster}>
        <div style={S.kop}>
          <Camera size={17} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <h2 style={S.titel}>Weekmenu van een briefje</h2>
          <button onClick={onSluiten} style={S.sluit} aria-label="Sluiten"><X size={18} /></button>
        </div>

        <div style={S.body}>
          <input ref={kiezer} type="file" accept="image/*" style={{ display: "none" }} onChange={verwerk} />

          {fout && <div style={S.fout}>{fout}</div>}

          {!gelezen && (
            <>
              <p style={S.hint}>
                Fotografeer je briefje met alle dagen in beeld. Lege dagen mogen: die vul je
                hierna zelf in of laat je de app voorstellen.
              </p>
              <button
                style={{ ...S.knop, ...S.primair }}
                disabled={bezig}
                onClick={() => { kiezer.current?.setAttribute("capture", "environment"); kiezer.current?.click(); }}
              >
                {bezig
                  ? <><Loader2 size={16} className="spin" /> Briefje lezen...</>
                  : <><Camera size={16} /> Foto maken</>}
              </button>
              <button
                style={S.knop}
                disabled={bezig}
                onClick={() => { kiezer.current?.removeAttribute("capture"); kiezer.current?.click(); }}
              >
                Foto kiezen die je al had
              </button>
            </>
          )}

          {gelezen && regels.map(({ dag, tekst, uitslag }) => {
            const gekozen = staat.keuze[dag];
            const leeggelaten = staat.overgeslagen.includes(dag);
            return (
              <div key={dag} style={S.regel}>
                <span style={S.dag}>{dag.slice(0, 2)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {tekst && <div style={S.briefje}>&ldquo;{tekst}&rdquo;</div>}

                  {gekozen ? (
                    <>
                      <div style={S.gekozen}><Check size={13} /> {titelVan(gekozen)}</div>
                      <div style={S.acties}>
                        <button style={S.mini} onClick={() => setPicker({ dag, zoek: "" })}>
                          <Pencil size={11} /> Ander gerecht
                        </button>
                        <button style={S.mini} onClick={() => slaOver(dag)}>Laat leeg</button>
                      </div>
                    </>
                  ) : leeggelaten ? (
                    <div style={S.acties}>
                      <span style={S.stil}>blijft leeg</span>
                      <button style={S.mini} onClick={() => herstel(dag)}>Toch invullen</button>
                    </div>
                  ) : !tekst ? (
                    <>
                      <div style={S.stil}>Niets op het briefje.</div>
                      <div style={S.acties}>
                        <button style={S.mini} onClick={() => setPicker({ dag, zoek: "" })}>
                          <Search size={11} /> Kies uit de lijst
                        </button>
                        <button style={S.mini} onClick={() => slaOver(dag)}>Laat leeg</button>
                      </div>
                    </>
                  ) : uitslag?.zekerheid === "misschien" && uitslag.beste ? (
                    <>
                      <div style={S.vraag}>Bedoel je <strong>{uitslag.beste.recept.titel}</strong>?</div>
                      <div style={S.acties}>
                        <button style={{ ...S.mini, ...S.miniJa }} onClick={() => kies(dag, uitslag.beste!.recept.id)}>
                          <Check size={11} /> Ja, deze
                        </button>
                        {/* Bij een rijtje ingrediënten passen er vaak twee even goed.
                            Dan is één vraag stellen en de rest verzwijgen geen keuze. */}
                        {vlakErachter(uitslag).map((a) => (
                          <button key={a.recept.id} style={S.mini} onClick={() => kies(dag, a.recept.id)}>
                            of {a.recept.titel}
                          </button>
                        ))}
                        <button style={S.mini} onClick={() => setPicker({ dag, zoek: tekst })}>
                          <Search size={11} /> Nee, kies uit de lijst
                        </button>
                        <button style={S.mini} onClick={() => onMaakRecept(tekst)}>
                          <Plus size={11} /> Maak aan
                        </button>
                        <button style={S.mini} onClick={() => slaOver(dag)}>Laat leeg</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={S.vraag}>Dit staat niet in je kookboek.</div>
                      <div style={S.acties}>
                        <button style={S.mini} onClick={() => setPicker({ dag, zoek: tekst })}>
                          <Search size={11} /> Kies uit de lijst
                        </button>
                        <button style={{ ...S.mini, ...S.miniJa }} onClick={() => onMaakRecept(tekst)}>
                          <Plus size={11} /> Maak dit gerecht aan
                        </button>
                        <button style={S.mini} onClick={() => slaOver(dag)}>Laat leeg</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {gelezen && (
            <>
              {openDagen.length > 0 && (
                <button style={S.knop} onClick={vulAan} disabled={voorstelBezig}>
                  {voorstelBezig
                    ? <><Loader2 size={15} className="spin" /> Bezig...</>
                    : <><Sparkles size={15} /> Stel iets voor voor de {openDagen.length} lege {openDagen.length === 1 ? "dag" : "dagen"}</>}
                </button>
              )}

              <button
                style={{ ...S.knop, ...S.primair, opacity: klaar.length === 0 ? 0.5 : 1 }}
                disabled={klaar.length === 0}
                onClick={() => onOvernemen(klaar)}
              >
                <Check size={16} /> Zet {klaar.length} {klaar.length === 1 ? "dag" : "dagen"} in het weekmenu
              </button>

              <p style={S.hint}>
                Alleen de dagen hierboven met een gerecht worden gezet; de rest van je weekmenu
                blijft zoals het was. Ga je een gerecht aanmaken, dan blijft dit lijstje staan —
                je komt er vanzelf op terug.
              </p>
            </>
          )}
        </div>
      </div>

      {picker && (
        <Kiezer
          dag={picker.dag}
          zoekStart={picker.zoek}
          recepten={recepten}
          onKies={(id) => kies(picker.dag, id)}
          onMaakRecept={picker.zoek ? () => onMaakRecept(picker.zoek) : undefined}
          onSluiten={() => setPicker(null)}
        />
      )}
    </div>
  );
}

/** De recepten die nauwelijks onderdoen voor de beste — hoogstens twee. */
function vlakErachter(uitslag: MatchUitslag) {
  const beste = uitslag.beste;
  if (!beste) return [];
  return uitslag.alternatieven
    .filter((a) => a.recept.id !== beste.recept.id && beste.score - a.score <= 10)
    .slice(0, 2);
}

/**
 * Een recept kiezen voor één dag.
 *
 * Het zoekveld begint met wat er op het briefje stond: dat is precies de tekst
 * waarvan de app geen recept kon maken, en het scheelt overtypen. Levert dat
 * niets op, dan staat de knop om het gerecht alsnog aan te maken er meteen bij
 * — dat is het echte antwoord op een gerecht dat je nog niet hebt.
 */
function Kiezer({
  dag, zoekStart, recepten, onKies, onMaakRecept, onSluiten,
}: {
  dag: string; zoekStart: string; recepten: Recept[];
  onKies: (id: string) => void;
  onMaakRecept?: () => void;
  onSluiten: () => void;
}) {
  const [zoek, setZoek] = useState(zoekStart);
  const z = zoek.trim().toLowerCase();

  // Zoeken op woorden én op letterlijke tekst. Het veld begint met wat er op
  // het briefje stond, en dat is vaak een rijtje — "spinazie, gehakt, pasta"
  // komt letterlijk in geen enkele titel voor, terwijl er wel degelijk
  // recepten bij passen. Losse letters die je zelf typt blijven het gewone
  // zoeken op een stukje naam.
  const gefilterd = useMemo(() => {
    if (!z) return recepten;
    return recepten
      .map((r) => ({ r, score: scoorRecept(zoek, r) }))
      .filter((x) => x.score > 0
        || x.r.titel.toLowerCase().includes(z)
        || x.r.ingredienten.some((i) => (i.naam || "").toLowerCase().includes(z)))
      .sort((a, b) => b.score - a.score || a.r.titel.localeCompare(b.r.titel))
      .map((x) => x.r);
  }, [recepten, zoek, z]);

  return (
    <div style={S.overlay} onClick={onSluiten}>
      <div style={S.venster} onClick={(e) => e.stopPropagation()}>
        <div style={S.kop}>
          <h2 style={S.titel}>Gerecht voor {dag.toLowerCase()}</h2>
          <button onClick={onSluiten} style={S.sluit} aria-label="Sluiten"><X size={18} /></button>
        </div>
        <div style={S.body}>
          <div style={S.zoekWrap}>
            <Search size={17} style={{ color: "var(--sub)", flexShrink: 0 }} />
            <input
              style={S.zoekInput} value={zoek} autoFocus
              placeholder="Zoek op naam of ingrediënt..."
              onChange={(e) => setZoek(e.target.value)}
            />
          </div>
          {gefilterd.length === 0 && (
            <p style={S.hint}>Geen recept gevonden{zoek ? ` voor "${zoek}"` : ""}.</p>
          )}
          {gefilterd.map((r) => (
            <button key={r.id} onClick={() => onKies(r.id)} style={S.kiesRij}>{r.titel}</button>
          ))}
          {onMaakRecept && (
            <button style={{ ...S.knop, ...S.primair }} onClick={onMaakRecept}>
              <Plus size={16} /> Maak &ldquo;{zoekStart}&rdquo; aan
            </button>
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
  regel: { display: "flex", alignItems: "flex-start", gap: 11, padding: "10px 0", borderBottom: "1px solid var(--line)" },
  dag: { flexShrink: 0, width: 30, fontSize: 11.5, fontWeight: 800, color: "var(--accent)", textTransform: "uppercase", paddingTop: 3 },
  briefje: { fontSize: 12.5, color: "var(--sub)", fontStyle: "italic", marginBottom: 3 },
  gekozen: { display: "flex", alignItems: "center", gap: 5, fontSize: 14.5, fontWeight: 700, color: "var(--ink)" },
  vraag: { fontSize: 13.5, color: "var(--ink)" },
  stil: { fontSize: 12.5, color: "var(--sub)" },
  acties: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 6 },
  mini: { display: "flex", alignItems: "center", gap: 4, padding: "5px 9px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: "var(--ink)", cursor: "pointer" },
  miniJa: { background: "var(--accent)", borderColor: "var(--accent)", color: "#fff" },
  knop: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "12px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 14.5, fontWeight: 700, color: "var(--ink)", cursor: "pointer", marginTop: 10 },
  primair: { background: "var(--accent)", borderColor: "var(--accent)", color: "#fff" },
  hint: { fontSize: 12, lineHeight: 1.6, color: "var(--sub)", margin: "10px 0 0" },
  fout: { background: "#fdeeeb", border: "1px solid var(--red)", borderRadius: 12, padding: "10px 13px", fontSize: 13, color: "#a8351f", marginBottom: 12 },
  zoekWrap: { display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 12, marginBottom: 8 },
  zoekInput: { flex: 1, border: "none", background: "transparent", fontSize: 14, color: "var(--ink)", outline: "none", minWidth: 0 },
  kiesRij: { display: "block", width: "100%", textAlign: "left", padding: "10px 2px", background: "transparent", border: "none", borderBottom: "1px solid var(--line)", fontSize: 14, fontWeight: 600, color: "var(--ink)", cursor: "pointer" },
};
