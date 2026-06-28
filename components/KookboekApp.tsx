"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search, Plus, Star, Calendar, ShoppingCart, BookOpen, Camera, Link2,
  PencilLine, X, Trash2, ChevronLeft, ChevronRight, Clock, ChefHat, Check, Loader2,
  Minus, CalendarPlus, ArrowRightLeft, RefreshCw, Eye, EyeOff, ArrowUp, ArrowDown, Store,
} from "lucide-react";
import {
  KEUKENS, HOOFDINGREDIENTEN, MOEILIJKHEDEN, DAGEN, WINKELS,
  type Recept, type WeekState, type Boodschappen, type BoodschapItem,
} from "@/lib/types";

// ============================================================================
// API helpers
// ============================================================================
const api = {
  async getRecepten(): Promise<Recept[]> {
    const r = await fetch("/api/recipes", { cache: "no-store" }); return r.json();
  },
  async addRecept(r: Partial<Recept>): Promise<Recept> {
    const res = await fetch("/api/recipes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r) }); return res.json();
  },
  async updateRecept(id: string, patch: Partial<Recept>): Promise<Recept> {
    const res = await fetch(`/api/recipes/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }); return res.json();
  },
  async deleteRecept(id: string): Promise<void> {
    await fetch(`/api/recipes/${id}`, { method: "DELETE" });
  },
  async getWeek(): Promise<WeekState> {
    const r = await fetch("/api/week", { cache: "no-store" }); return r.json();
  },
  async saveWeek(w: WeekState): Promise<WeekState> {
    const res = await fetch("/api/week", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(w) }); return res.json();
  },
  async getBoodschappen(): Promise<Boodschappen> {
    const r = await fetch("/api/boodschappen", { cache: "no-store" }); return r.json();
  },
  async saveBoodschappen(b: Boodschappen): Promise<Boodschappen> {
    const res = await fetch("/api/boodschappen", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }); return res.json();
  },
  async importRecept(payload: any): Promise<any> {
    const res = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Import mislukt"); }
    return res.json();
  },
};

const uid = () => "i" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

// ============================================================================
// APP
// ============================================================================
export default function App() {
  const [recepten, setRecepten] = useState<Recept[]>([]);
  const [week, setWeek] = useState<WeekState>({ startDag: 0, slots: {} });
  const [boodschappen, setBoodschappen] = useState<Boodschappen>({ items: [] });
  const [tab, setTab] = useState("recepten");
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    (async () => {
      const [r, w, b] = await Promise.all([api.getRecepten(), api.getWeek(), api.getBoodschappen()]);
      setRecepten(r); setWeek(w); setBoodschappen(b); setLaden(false);
    })();
  }, []);

  const eersteWeek = useRef(true);
  useEffect(() => {
    if (laden) return;
    if (eersteWeek.current) { eersteWeek.current = false; return; }
    api.saveWeek(week);
  }, [week, laden]);

  const eersteBood = useRef(true);
  useEffect(() => {
    if (laden) return;
    if (eersteBood.current) { eersteBood.current = false; return; }
    const t = setTimeout(() => api.saveBoodschappen(boodschappen), 400);
    return () => clearTimeout(t);
  }, [boodschappen, laden]);

  const dagenInVolgorde = useMemo(
    () => [...Array(7)].map((_, i) => DAGEN[(week.startDag + i) % 7]),
    [week.startDag]
  );

  const addRecept = async (r: Partial<Recept>) => {
    const saved = await api.addRecept(r);
    setRecepten((p) => [...p, saved].sort((a, b) => a.titel.localeCompare(b.titel)));
    setTab("recepten");
  };
  const updateRecept = async (id: string, patch: Partial<Recept>) => {
    const updated = await api.updateRecept(id, patch);
    setRecepten((p) => p.map((x) => (x.id === id ? updated : x)));
  };
  const deleteRecept = async (id: string) => {
    await api.deleteRecept(id);
    setRecepten((p) => p.filter((x) => x.id !== id));
  };

  const tabs = [
    { id: "recepten", label: "Recepten", icon: BookOpen },
    { id: "toevoegen", label: "Toevoegen", icon: Plus },
    { id: "week", label: "Weekmenu", icon: Calendar },
    { id: "boodschappen", label: "Lijst", icon: ShoppingCart },
  ];

  return (
    <div style={S.app}>
      <header style={S.header}>
        <ChefHat size={22} style={{ color: "var(--accent)" }} />
        <h1 style={S.appTitle}>Kookboek</h1>
        <span style={S.headerSub}>{recepten.length} recepten</span>
      </header>

      <main style={S.main}>
        {laden ? (
          <div style={S.center}><Loader2 size={26} className="spin" style={{ color: "var(--accent)" }} /></div>
        ) : (
          <>
            {tab === "recepten" && (
              <ReceptenLijst
                recepten={recepten} week={week} setWeek={setWeek} dagen={dagenInVolgorde}
                onDelete={deleteRecept} onScore={(id, s) => updateRecept(id, { score: s })}
              />
            )}
            {tab === "toevoegen" && <Toevoegen onAdd={addRecept} />}
            {tab === "week" && (
              <Weekmenu recepten={recepten} week={week} setWeek={setWeek} dagen={dagenInVolgorde} />
            )}
            {tab === "boodschappen" && (
              <BoodschappenPagina
                recepten={recepten} week={week} dagen={dagenInVolgorde}
                boodschappen={boodschappen} setBoodschappen={setBoodschappen}
              />
            )}
          </>
        )}
      </main>

      <nav style={S.nav}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ ...S.navBtn, ...(tab === t.id ? S.navBtnActive : {}) }}>
            <t.icon size={20} />
            <span style={S.navLabel}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ============================================================================
// PLAATS-IN-WEEK DIALOOG (gedeeld door Recepten)
// ============================================================================
function PlaatsInWeekDialog({
  recept, recepten, week, dagen, setWeek, onClose,
}: {
  recept: Recept; recepten: Recept[]; week: WeekState; dagen: readonly string[];
  setWeek: React.Dispatch<React.SetStateAction<WeekState>>; onClose: () => void;
}) {
  const [conflict, setConflict] = useState<string | null>(null);

  const plaatsOpLegeDag = (dag: string) => {
    setWeek((p) => ({ ...p, slots: { ...p.slots, [dag]: { recipeId: recept.id, personen: recept.personen } } }));
    onClose();
  };
  const kiesDag = (dag: string) => { if (week.slots[dag]) setConflict(dag); else plaatsOpLegeDag(dag); };

  const vervang = () => {
    if (!conflict) return;
    setWeek((p) => ({ ...p, slots: { ...p.slots, [conflict]: { recipeId: recept.id, personen: recept.personen } } }));
    onClose();
  };
  const verplaatsBestaande = (naarDag: string) => {
    if (!conflict) return;
    setWeek((p) => {
      const bestaand = p.slots[conflict];
      const slots = { ...p.slots };
      slots[naarDag] = bestaand;
      slots[conflict] = { recipeId: recept.id, personen: recept.personen };
      return { ...p, slots };
    });
    onClose();
  };

  const legeDagen = dagen.filter((d) => !week.slots[d]);

  return (
    <div style={S.modalBg} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        {!conflict ? (
          <>
            <div style={S.modalHead}>
              <div>
                <span style={S.label}>Plaats in weekmenu</span>
                <h2 style={S.modalTitle}>{recept.titel}</h2>
              </div>
              <button onClick={onClose} style={S.iconBtn} aria-label="Sluiten"><X size={20} /></button>
            </div>
            <p style={S.dialogHint}>Kies een dag. Staat er al een gerecht, dan kun je vervangen of het bestaande verplaatsen.</p>
            {dagen.map((dag) => {
              const slot = week.slots[dag];
              const r = slot && recepten.find((x) => x.id === slot.recipeId);
              return (
                <button key={dag} onClick={() => kiesDag(dag)} style={S.weekPickRow}>
                  <span style={S.weekPickDag}>{dag}</span>
                  {r ? <span style={S.weekPickVol}>{r.titel}</span> : <span style={S.weekPickLeeg}>leeg — tik om te plaatsen</span>}
                </button>
              );
            })}
          </>
        ) : (
          <>
            <div style={S.modalHead}>
              <div>
                <span style={S.label}>{conflict} is al bezet</span>
                <h2 style={S.modalTitle}>{recepten.find((x) => x.id === week.slots[conflict].recipeId)?.titel}</h2>
              </div>
              <button onClick={() => setConflict(null)} style={S.iconBtn} aria-label="Terug"><X size={20} /></button>
            </div>
            <p style={S.dialogHint}>Op {conflict} staat al een gerecht. Wat wil je doen?</p>

            <button onClick={vervang} style={S.primaryBtn}>
              <ArrowRightLeft size={16} /> Vervang door "{recept.titel}"
            </button>

            <div style={{ marginTop: 18 }}>
              <span style={S.label}>Of verplaats het bestaande gerecht naar:</span>
              {legeDagen.length === 0 ? (
                <p style={S.dialogHint}>Geen lege dagen beschikbaar om naartoe te verplaatsen.</p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 8 }}>
                  {legeDagen.map((d) => (
                    <button key={d} onClick={() => verplaatsBestaande(d)} style={S.chip}>{d}</button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// RECEPTENLIJST + FILTERS
// ============================================================================
function ReceptenLijst({
  recepten, week, setWeek, dagen, onDelete, onScore,
}: {
  recepten: Recept[]; week: WeekState; setWeek: React.Dispatch<React.SetStateAction<WeekState>>;
  dagen: readonly string[]; onDelete: (id: string) => void; onScore: (id: string, s: number) => void;
}) {
  const [zoek, setZoek] = useState("");
  const [fKeuken, setFKeuken] = useState("");
  const [fHoofd, setFHoofd] = useState("");
  const [fMoeil, setFMoeil] = useState("");
  const [fScore, setFScore] = useState(0);
  const [open, setOpen] = useState<Recept | null>(null);
  const [plaats, setPlaats] = useState<Recept | null>(null);

  const gefilterd = recepten.filter((r) => {
    if (zoek && !r.titel.toLowerCase().includes(zoek.toLowerCase())) return false;
    if (fKeuken && r.keuken !== fKeuken) return false;
    if (fHoofd && r.hoofd !== fHoofd) return false;
    if (fMoeil && r.moeilijkheid !== fMoeil) return false;
    if (fScore && r.score < fScore) return false;
    return true;
  });

  const reset = () => { setFKeuken(""); setFHoofd(""); setFMoeil(""); setFScore(0); setZoek(""); };
  const anyFilter = fKeuken || fHoofd || fMoeil || fScore || zoek;
  const huidig = open ? recepten.find((r) => r.id === open.id) || open : null;

  return (
    <div>
      <div style={S.searchWrap}>
        <Search size={18} style={{ color: "var(--sub)" }} />
        <input style={S.searchInput} placeholder="Zoek recept..." value={zoek} onChange={(e) => setZoek(e.target.value)} />
      </div>

      <div style={S.filterRow}><Chips opts={KEUKENS} val={fKeuken} set={setFKeuken} /></div>
      <div style={S.filterRow}><Chips opts={HOOFDINGREDIENTEN} val={fHoofd} set={setFHoofd} /></div>
      <div style={S.filterRow}>
        <Chips opts={MOEILIJKHEDEN} val={fMoeil} set={setFMoeil} />
        <div style={{ flex: 1 }} />
        <ScoreFilter val={fScore} set={setFScore} />
      </div>
      {anyFilter ? <button onClick={reset} style={S.resetBtn}><X size={13} /> Filters wissen</button> : null}

      <div style={{ marginTop: 8 }}>
        {recepten.length === 0 && <p style={S.empty}>Nog geen recepten. Voeg er een toe via het tabblad Toevoegen.</p>}
        {recepten.length > 0 && gefilterd.length === 0 && <p style={S.empty}>Geen recepten gevonden. Pas je filters aan.</p>}
        {gefilterd.map((r) => (
          <ReceptKaart key={r.id} r={r} onOpen={() => setOpen(r)} onPlaats={() => setPlaats(r)} />
        ))}
      </div>

      {huidig && (
        <ReceptModal
          r={huidig} onClose={() => setOpen(null)}
          onDelete={() => { onDelete(huidig.id); setOpen(null); }}
          onScore={(s) => onScore(huidig.id, s)}
          onPlaats={() => { setPlaats(huidig); setOpen(null); }}
        />
      )}

      {plaats && (
        <PlaatsInWeekDialog
          recept={plaats} recepten={recepten} week={week} dagen={dagen} setWeek={setWeek}
          onClose={() => setPlaats(null)}
        />
      )}
    </div>
  );
}

function ReceptKaart({ r, onOpen, onPlaats }: { r: Recept; onOpen: () => void; onPlaats: () => void }) {
  return (
    <div style={S.card}>
      <button onClick={onOpen} style={S.cardBody}>
        <div style={S.cardTop}>
          <span style={S.cardTitle}>{r.titel}</span>
          <Sterren n={r.score} small />
        </div>
        <div style={S.cardMeta}>
          <Tag>{r.keuken}</Tag><Tag>{r.hoofd}</Tag>
          <span style={S.metaItem}><Clock size={12} /> {r.tijd}m</span>
          <span style={S.metaItem}><ChefHat size={12} /> {r.moeilijkheid}</span>
        </div>
      </button>
      <button onClick={onPlaats} style={S.cardPlaatsBtn}>
        <CalendarPlus size={15} /> In weekmenu
      </button>
    </div>
  );
}

function ReceptModal({
  r, onClose, onDelete, onScore, onPlaats,
}: {
  r: Recept; onClose: () => void; onDelete: () => void; onScore: (s: number) => void; onPlaats: () => void;
}) {
  return (
    <div style={S.modalBg} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <h2 style={S.modalTitle}>{r.titel}</h2>
          <button onClick={onClose} style={S.iconBtn} aria-label="Sluiten"><X size={20} /></button>
        </div>
        <div style={S.cardMeta}>
          <Tag>{r.keuken}</Tag><Tag>{r.hoofd}</Tag>
          <span style={S.metaItem}><Clock size={12} /> {r.tijd}m</span>
          <span style={S.metaItem}><ChefHat size={12} /> {r.moeilijkheid}</span>
        </div>

        <button onClick={onPlaats} style={{ ...S.primaryBtn, marginTop: 16 }}>
          <CalendarPlus size={16} /> In weekmenu plaatsen
        </button>

        <div style={S.scoreEdit}>
          <span style={S.label}>Jouw score</span>
          <Sterren n={r.score} onSet={onScore} />
        </div>

        <h3 style={S.sectionH}>Ingrediënten ({r.personen} pers.)</h3>
        <ul style={S.ingList}>
          {r.ingredienten.map((i, k) => (
            <li key={k} style={S.ingLi}><span>{i.naam}</span><span style={S.ingAmt}>{i.hoev} {i.eenheid}</span></li>
          ))}
        </ul>

        <h3 style={S.sectionH}>Bereiding</h3>
        <p style={S.bereiding}>{r.bereiding}</p>

        <button onClick={onDelete} style={S.deleteBtn}><Trash2 size={14} /> Recept verwijderen</button>
      </div>
    </div>
  );
}

// ============================================================================
// TOEVOEGEN
// ============================================================================
function Toevoegen({ onAdd }: { onAdd: (r: Partial<Recept>) => void }) {
  const [modus, setModus] = useState("hand");
  return (
    <div>
      <div style={S.segWrap}>
        <SegBtn active={modus === "hand"} onClick={() => setModus("hand")} icon={PencilLine} label="Handmatig" />
        <SegBtn active={modus === "foto"} onClick={() => setModus("foto")} icon={Camera} label="Foto" />
        <SegBtn active={modus === "link"} onClick={() => setModus("link")} icon={Link2} label="Link" />
      </div>
      {modus === "hand" && <HandmatigForm onAdd={onAdd} />}
      {modus === "foto" && <FotoImport onAdd={onAdd} />}
      {modus === "link" && <LinkImport onAdd={onAdd} />}
    </div>
  );
}

function leegRecept(): Partial<Recept> {
  return {
    titel: "", keuken: KEUKENS[0], hoofd: HOOFDINGREDIENTEN[0], moeilijkheid: MOEILIJKHEDEN[0],
    tijd: 30, score: 0, personen: 4, ingredienten: [{ naam: "", hoev: 0, eenheid: "" }], bereiding: "",
  };
}

function HandmatigForm({ onAdd, initial }: { onAdd: (r: Partial<Recept>) => void; initial?: Partial<Recept> }) {
  const [r, setR] = useState<Partial<Recept>>(initial || leegRecept());
  const [bezig, setBezig] = useState(false);
  const set = (k: keyof Recept, v: any) => setR((p) => ({ ...p, [k]: v }));
  const setIng = (i: number, k: string, v: any) => setR((p) => ({ ...p, ingredienten: (p.ingredienten || []).map((ing, idx) => idx === i ? { ...ing, [k]: v } : ing) }));
  const addIng = () => setR((p) => ({ ...p, ingredienten: [...(p.ingredienten || []), { naam: "", hoev: 0, eenheid: "" }] }));
  const delIng = (i: number) => setR((p) => ({ ...p, ingredienten: (p.ingredienten || []).filter((_, idx) => idx !== i) }));

  const opslaan = async () => {
    if (!r.titel?.trim()) return alert("Geef het recept een titel.");
    setBezig(true);
    await onAdd({
      ...r, tijd: Number(r.tijd) || 0, personen: Number(r.personen) || 1,
      ingredienten: (r.ingredienten || []).filter((i) => i.naam.trim()).map((i) => ({ ...i, hoev: Number(i.hoev) || 0 })),
    });
    setBezig(false);
  };

  return (
    <div>
      <Field label="Titel"><input style={S.input} value={r.titel} onChange={(e) => set("titel", e.target.value)} placeholder="bijv. Risotto met paddenstoelen" /></Field>
      <div style={S.grid2}>
        <Field label="Keuken"><Select opts={KEUKENS} val={r.keuken!} set={(v) => set("keuken", v)} /></Field>
        <Field label="Hoofdingrediënt"><Select opts={HOOFDINGREDIENTEN} val={r.hoofd!} set={(v) => set("hoofd", v)} /></Field>
      </div>
      <div style={S.grid2}>
        <Field label="Moeilijkheid"><Select opts={MOEILIJKHEDEN} val={r.moeilijkheid!} set={(v) => set("moeilijkheid", v)} /></Field>
        <Field label="Tijd (min)"><input type="number" style={S.input} value={r.tijd} onChange={(e) => set("tijd", e.target.value)} /></Field>
      </div>
      <div style={S.grid2}>
        <Field label="Personen"><input type="number" style={S.input} value={r.personen} onChange={(e) => set("personen", e.target.value)} /></Field>
        <Field label="Score"><Sterren n={r.score || 0} onSet={(s) => set("score", s)} /></Field>
      </div>

      <Field label="Ingrediënten">
        {(r.ingredienten || []).map((i, idx) => (
          <div key={idx} style={S.ingRow}>
            <input style={{ ...S.input, flex: 2 }} placeholder="naam" value={i.naam} onChange={(e) => setIng(idx, "naam", e.target.value)} />
            <input style={{ ...S.input, flex: 1 }} placeholder="aantal" value={i.hoev} onChange={(e) => setIng(idx, "hoev", e.target.value)} />
            <input style={{ ...S.input, flex: 1 }} placeholder="eenh." value={i.eenheid} onChange={(e) => setIng(idx, "eenheid", e.target.value)} />
            <button onClick={() => delIng(idx)} style={S.iconBtnSm} aria-label="Verwijder"><X size={15} /></button>
          </div>
        ))}
        <button onClick={addIng} style={S.addRowBtn}><Plus size={14} /> Ingrediënt</button>
      </Field>

      <Field label="Bereiding"><textarea style={S.textarea} rows={4} value={r.bereiding} onChange={(e) => set("bereiding", e.target.value)} placeholder="Beschrijf de stappen..." /></Field>

      <button onClick={opslaan} style={S.primaryBtn} disabled={bezig}>
        {bezig ? <><Loader2 size={16} className="spin" /> Opslaan...</> : <><Check size={16} /> Recept opslaan</>}
      </button>
    </div>
  );
}

function FotoImport({ onAdd }: { onAdd: (r: Partial<Recept>) => void }) {
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<Partial<Recept> | null>(null);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const verwerk = async (file: File) => {
    setErr(""); setBusy(true); setParsed(null);
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const fr = new FileReader(); fr.onload = () => res((fr.result as string).split(",")[1]); fr.onerror = rej; fr.readAsDataURL(file);
      });
      const data = await api.importRecept({ type: "foto", mediaType: file.type, data: b64 });
      setParsed(normaliseer(data));
    } catch (e: any) { setErr(e.message || "Kon het recept niet uitlezen."); }
    finally { setBusy(false); }
  };

  if (parsed) return <BevestigImport parsed={parsed} onAdd={onAdd} onCancel={() => setParsed(null)} />;

  return (
    <div style={S.importBox}>
      <Camera size={36} style={{ color: "var(--accent)" }} />
      <p style={S.importText}>Maak of kies een foto van een recept uit een magazine of kookboek.</p>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && verwerk(e.target.files[0])} />
      <button onClick={() => fileRef.current?.click()} style={S.primaryBtn} disabled={busy}>
        {busy ? <><Loader2 size={16} className="spin" /> Bezig met uitlezen...</> : <><Camera size={16} /> Foto kiezen</>}
      </button>
      {err && <p style={S.errText}>{err}</p>}
    </div>
  );
}

function LinkImport({ onAdd }: { onAdd: (r: Partial<Recept>) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<Partial<Recept> | null>(null);
  const [err, setErr] = useState("");

  const verwerk = async () => {
    if (!url.trim()) return;
    setErr(""); setBusy(true); setParsed(null);
    try {
      const data = await api.importRecept({ type: "link", url });
      setParsed(normaliseer(data));
    } catch (e: any) { setErr(e.message || "Kon de pagina niet uitlezen."); }
    finally { setBusy(false); }
  };

  if (parsed) return <BevestigImport parsed={parsed} onAdd={onAdd} onCancel={() => setParsed(null)} />;

  return (
    <div style={S.importBox}>
      <Link2 size={36} style={{ color: "var(--accent)" }} />
      <p style={S.importText}>Plak een link naar een receptpagina.</p>
      <input style={{ ...S.input, width: "100%" }} placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
      <button onClick={verwerk} style={S.primaryBtn} disabled={busy}>
        {busy ? <><Loader2 size={16} className="spin" /> Bezig...</> : <><Link2 size={16} /> Recept ophalen</>}
      </button>
      {err && <p style={S.errText}>{err}</p>}
    </div>
  );
}

function BevestigImport({ parsed, onAdd, onCancel }: { parsed: Partial<Recept>; onAdd: (r: Partial<Recept>) => void; onCancel: () => void }) {
  return (
    <div>
      <div style={S.infoBar}><Check size={15} /> Recept uitgelezen. Controleer en pas aan.<button onClick={onCancel} style={S.linkBtn}>Opnieuw</button></div>
      <HandmatigForm onAdd={onAdd} initial={parsed} />
    </div>
  );
}

function normaliseer(p: any): Partial<Recept> {
  return {
    titel: p.titel || "",
    keuken: KEUKENS.includes(p.keuken) ? p.keuken : KEUKENS[0],
    hoofd: HOOFDINGREDIENTEN.includes(p.hoofd) ? p.hoofd : HOOFDINGREDIENTEN[0],
    moeilijkheid: MOEILIJKHEDEN.includes(p.moeilijkheid) ? p.moeilijkheid : MOEILIJKHEDEN[0],
    tijd: Number(p.tijd) || 30, score: 0, personen: Number(p.personen) || 4,
    ingredienten: Array.isArray(p.ingredienten) && p.ingredienten.length
      ? p.ingredienten.map((i: any) => ({ naam: i.naam || "", hoev: Number(i.hoev) || 0, eenheid: i.eenheid || "" }))
      : [{ naam: "", hoev: 0, eenheid: "" }],
    bereiding: p.bereiding || "",
  };
}

// ============================================================================
// WEEKMENU
// ============================================================================
function Weekmenu({
  recepten, week, setWeek, dagen,
}: {
  recepten: Recept[]; week: WeekState; setWeek: React.Dispatch<React.SetStateAction<WeekState>>; dagen: readonly string[];
}) {
  const [kiesDag, setKiesDag] = useState<string | null>(null);
  const [verplaatsVan, setVerplaatsVan] = useState<string | null>(null);
  const [bevestigLeeg, setBevestigLeeg] = useState(false);

  const setStartDag = (d: number) => setWeek((p) => ({ ...p, startDag: ((d % 7) + 7) % 7 }));
  const setDag = (dag: string, recipeId: string) => {
    const r = recepten.find((x) => x.id === recipeId);
    setWeek((p) => ({ ...p, slots: { ...p.slots, [dag]: { recipeId, personen: r?.personen || 4 } } }));
    setKiesDag(null);
  };
  const wisDag = (dag: string) => setWeek((p) => { const slots = { ...p.slots }; delete slots[dag]; return { ...p, slots }; });
  const setPers = (dag: string, d: number) => setWeek((p) => ({ ...p, slots: { ...p.slots, [dag]: { ...p.slots[dag], personen: Math.max(1, p.slots[dag].personen + d) } } }));
  const leegmaken = () => { setWeek((p) => ({ ...p, slots: {} })); setBevestigLeeg(false); };

  const verplaatsNaar = (doelDag: string) => {
    if (!verplaatsVan || verplaatsVan === doelDag) { setVerplaatsVan(null); return; }
    setWeek((p) => {
      const slots = { ...p.slots };
      const bron = slots[verplaatsVan];
      const doel = slots[doelDag];
      slots[doelDag] = bron;
      if (doel) slots[verplaatsVan] = doel; else delete slots[verplaatsVan];
      return { ...p, slots };
    });
    setVerplaatsVan(null);
  };

  const aantalGepland = dagen.filter((d) => week.slots[d]).length;

  return (
    <div>
      <div style={S.weekHead}>
        <div>
          <span style={S.label}>Startdag</span>
          <div style={S.dayStepper}>
            <button onClick={() => setStartDag(week.startDag + 6)} style={S.iconBtnSm} aria-label="Vorige dag"><ChevronLeft size={16} /></button>
            <span style={S.dayStepperLabel}>{DAGEN[week.startDag]}</span>
            <button onClick={() => setStartDag(week.startDag + 1)} style={S.iconBtnSm} aria-label="Volgende dag"><ChevronRight size={16} /></button>
          </div>
        </div>
        {aantalGepland > 0 && (
          <button onClick={() => setBevestigLeeg(true)} style={S.leegBtn}><Trash2 size={14} /> Leegmaken</button>
        )}
      </div>

      {verplaatsVan && (
        <div style={S.infoBar}>
          <ArrowRightLeft size={15} /> Kies de dag waar "{recepten.find((x) => x.id === week.slots[verplaatsVan]?.recipeId)?.titel}" naartoe moet.
          <button onClick={() => setVerplaatsVan(null)} style={S.linkBtn}>Annuleer</button>
        </div>
      )}

      {dagen.map((dag) => {
        const slot = week.slots[dag];
        const r = slot && recepten.find((x) => x.id === slot.recipeId);
        const isBron = verplaatsVan === dag;
        return (
          <div key={dag} style={S.weekRow}>
            <span style={S.weekDag}>{dag}</span>
            {r ? (
              <div style={{ ...S.weekSlotVol, ...(isBron ? S.weekSlotBron : {}) }}>
                {verplaatsVan && !isBron ? (
                  <button onClick={() => verplaatsNaar(dag)} style={S.weekSlotKies}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.weekRecept}>{r.titel}</div>
                      <div style={S.weekMeta}>Tik om hier te plaatsen (wisselt om)</div>
                    </div>
                  </button>
                ) : (
                  <>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.weekRecept}>{r.titel}</div>
                      <div style={S.weekMeta}>{r.keuken} · {r.tijd}m</div>
                    </div>
                    <div style={S.weekActies}>
                      <div style={S.persWrap}>
                        <button onClick={() => setPers(dag, -1)} style={S.persBtn} aria-label="Minder"><Minus size={13} /></button>
                        <span style={S.persNum}>{slot.personen}p</span>
                        <button onClick={() => setPers(dag, 1)} style={S.persBtn} aria-label="Meer"><Plus size={13} /></button>
                      </div>
                      <button onClick={() => setVerplaatsVan(isBron ? null : dag)} style={S.iconBtnSm} aria-label="Verplaats"><ArrowRightLeft size={15} /></button>
                      <button onClick={() => wisDag(dag)} style={S.iconBtnSm} aria-label="Wis"><X size={15} /></button>
                    </div>
                  </>
                )}
              </div>
            ) : verplaatsVan ? (
              <button onClick={() => verplaatsNaar(dag)} style={S.weekSlotDoel}><ArrowDown size={15} /> Hierheen verplaatsen</button>
            ) : (
              <button onClick={() => setKiesDag(dag)} style={S.weekSlotLeeg}><Plus size={15} /> Kies gerecht</button>
            )}
          </div>
        );
      })}

      {kiesDag && (
        <div style={S.modalBg} onClick={() => setKiesDag(null)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>
              <h2 style={S.modalTitle}>Gerecht voor {kiesDag}</h2>
              <button onClick={() => setKiesDag(null)} style={S.iconBtn} aria-label="Sluiten"><X size={20} /></button>
            </div>
            {recepten.length === 0 && <p style={S.empty}>Voeg eerst recepten toe.</p>}
            {recepten.map((r) => (
              <button key={r.id} onClick={() => setDag(kiesDag, r.id)} style={S.pickRow}>
                <span style={S.cardTitle}>{r.titel}</span>
                <Sterren n={r.score} small />
              </button>
            ))}
          </div>
        </div>
      )}

      {bevestigLeeg && (
        <Bevestig
          titel="Weekmenu leegmaken?"
          tekst="Alle geplande gerechten worden verwijderd. Dit kan niet ongedaan worden gemaakt."
          bevestigLabel="Ja, leegmaken"
          onBevestig={leegmaken} onAnnuleer={() => setBevestigLeeg(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// BOODSCHAPPENLIJST
// ============================================================================
function BoodschappenPagina({
  recepten, week, dagen, boodschappen, setBoodschappen,
}: {
  recepten: Recept[]; week: WeekState; dagen: readonly string[];
  boodschappen: Boodschappen; setBoodschappen: React.Dispatch<React.SetStateAction<Boodschappen>>;
}) {
  const [verbergGedaan, setVerbergGedaan] = useState(false);
  const [bevestigGenereer, setBevestigGenereer] = useState(false);

  const genereerUitWeek = (): BoodschapItem[] => {
    const acc: Record<string, { naam: string; eenheid: string; hoev: number }> = {};
    dagen.forEach((dag) => {
      const slot = week.slots[dag];
      if (!slot) return;
      const r = recepten.find((x) => x.id === slot.recipeId);
      if (!r) return;
      const factor = (slot.personen || r.personen) / (r.personen || 1);
      r.ingredienten.forEach((i) => {
        const key = (i.naam + "|" + i.eenheid).toLowerCase();
        if (!acc[key]) acc[key] = { naam: i.naam, eenheid: i.eenheid, hoev: 0 };
        acc[key].hoev += (Number(i.hoev) || 0) * factor;
      });
    });
    return Object.values(acc).map((v) => ({
      id: uid(), naam: v.naam, hoev: Math.round(v.hoev * 10) / 10, eenheid: v.eenheid, winkel: "AH", gedaan: false,
    }));
  };

  const genereer = () => { setBoodschappen({ items: genereerUitWeek() }); setBevestigGenereer(false); };

  const setItem = (id: string, patch: Partial<BoodschapItem>) =>
    setBoodschappen((p) => ({ items: p.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  const delItem = (id: string) => setBoodschappen((p) => ({ items: p.items.filter((it) => it.id !== id) }));
  const addItem = () =>
    setBoodschappen((p) => ({ items: [...p.items, { id: uid(), naam: "", hoev: 1, eenheid: "", winkel: "AH", gedaan: false }] }));

  const verplaatsItem = (id: string, richting: -1 | 1) => {
    setBoodschappen((p) => {
      const items = [...p.items];
      const idx = items.findIndex((it) => it.id === id);
      if (idx === -1) return p;
      const winkel = items[idx].winkel;
      let doel = -1;
      for (let j = idx + richting; j >= 0 && j < items.length; j += richting) {
        if (items[j].winkel === winkel) { doel = j; break; }
      }
      if (doel === -1) return p;
      [items[idx], items[doel]] = [items[doel], items[idx]];
      return { items };
    });
  };

  const items = boodschappen.items;
  const zichtbaar = verbergGedaan ? items.filter((it) => !it.gedaan) : items;
  const groepen = WINKELS.map((w) => ({ winkel: w, lijst: zichtbaar.filter((it) => it.winkel === w) }))
    .filter((g) => g.lijst.length > 0);

  const aantalDagen = dagen.filter((d) => week.slots[d]).length;
  const aantalGedaan = items.filter((it) => it.gedaan).length;

  return (
    <div>
      <div style={S.boodTopBar}>
        <button onClick={() => (items.length ? setBevestigGenereer(true) : genereer())} style={S.boodTopBtn}>
          <RefreshCw size={14} /> Uit weekmenu
        </button>
        <button onClick={() => setVerbergGedaan((v) => !v)} style={{ ...S.boodTopBtn, ...(verbergGedaan ? S.boodTopBtnOn : {}) }}>
          {verbergGedaan ? <Eye size={14} /> : <EyeOff size={14} />} {verbergGedaan ? "Toon gedaan" : "Verberg gedaan"}
        </button>
      </div>

      {items.length === 0 ? (
        <p style={S.empty}>
          Nog geen boodschappen. Genereer de lijst uit je weekmenu{aantalDagen > 0 ? ` (${aantalDagen} maaltijden gepland)` : ""} of voeg handmatig items toe.
        </p>
      ) : (
        <div style={S.infoBar}>
          <ShoppingCart size={15} /> {items.length} items{aantalGedaan > 0 ? ` · ${aantalGedaan} afgevinkt` : ""}
        </div>
      )}

      {groepen.map((g) => (
        <div key={g.winkel} style={{ marginBottom: 14 }}>
          <div style={S.winkelKop}><Store size={14} /> {g.winkel} <span style={S.winkelAantal}>{g.lijst.length}</span></div>
          {g.lijst.map((it, idx) => (
            <BoodItem
              key={it.id} it={it}
              isEerste={idx === 0} isLaatste={idx === g.lijst.length - 1}
              onToggle={() => setItem(it.id, { gedaan: !it.gedaan })}
              onNaam={(v) => setItem(it.id, { naam: v })}
              onHoev={(v) => setItem(it.id, { hoev: v })}
              onEenheid={(v) => setItem(it.id, { eenheid: v })}
              onWinkel={(v) => setItem(it.id, { winkel: v })}
              onDel={() => delItem(it.id)}
              onUp={() => verplaatsItem(it.id, -1)}
              onDown={() => verplaatsItem(it.id, 1)}
            />
          ))}
        </div>
      ))}

      <button onClick={addItem} style={S.addItemBtn}><Plus size={16} /> Item toevoegen</button>

      {bevestigGenereer && (
        <Bevestig
          titel="Lijst opnieuw genereren?"
          tekst="De huidige boodschappenlijst (inclusief handmatige items, winkels en volgorde) wordt vervangen door een nieuwe lijst uit het weekmenu."
          bevestigLabel="Ja, opnieuw genereren"
          onBevestig={genereer} onAnnuleer={() => setBevestigGenereer(false)}
        />
      )}
    </div>
  );
}

function BoodItem({
  it, isEerste, isLaatste, onToggle, onNaam, onHoev, onEenheid, onWinkel, onDel, onUp, onDown,
}: {
  it: BoodschapItem; isEerste: boolean; isLaatste: boolean;
  onToggle: () => void; onNaam: (v: string) => void; onHoev: (v: number) => void;
  onEenheid: (v: string) => void; onWinkel: (v: string) => void; onDel: () => void;
  onUp: () => void; onDown: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ ...S.boodRow, ...(it.gedaan ? S.boodDone : {}) }}>
      <div style={S.boodMain}>
        <button onClick={onToggle} style={{ ...S.checkbox, ...(it.gedaan ? S.checkboxOn : {}) }} aria-label="Afvinken">
          {it.gedaan && <Check size={13} />}
        </button>
        <button onClick={() => setOpen((o) => !o)} style={S.boodNaamBtn}>
          <span style={{ ...S.boodNaam, ...(it.gedaan ? { textDecoration: "line-through", color: "#a9aec2" } : {}) }}>
            {it.naam || <span style={{ color: "var(--sub)" }}>Naamloos item</span>}
          </span>
          <span style={S.boodHoev}>{it.hoev} {it.eenheid}</span>
        </button>
        <div style={S.boodVolgorde}>
          <button onClick={onUp} disabled={isEerste} style={{ ...S.ordBtn, ...(isEerste ? S.ordBtnUit : {}) }} aria-label="Omhoog"><ArrowUp size={13} /></button>
          <button onClick={onDown} disabled={isLaatste} style={{ ...S.ordBtn, ...(isLaatste ? S.ordBtnUit : {}) }} aria-label="Omlaag"><ArrowDown size={13} /></button>
        </div>
      </div>

      {open && (
        <div style={S.boodEdit}>
          <div style={S.boodEditRow}>
            <input style={{ ...S.input, flex: 3 }} placeholder="naam" value={it.naam} onChange={(e) => onNaam(e.target.value)} />
          </div>
          <div style={S.boodEditRow}>
            <input style={{ ...S.input, flex: 1 }} type="number" placeholder="aantal" value={it.hoev} onChange={(e) => onHoev(Number(e.target.value))} />
            <input style={{ ...S.input, flex: 1 }} placeholder="eenh." value={it.eenheid} onChange={(e) => onEenheid(e.target.value)} />
            <select style={{ ...S.input, flex: 1.4 }} value={it.winkel} onChange={(e) => onWinkel(e.target.value)}>
              {WINKELS.map((w) => <option key={w}>{w}</option>)}
            </select>
          </div>
          <button onClick={onDel} style={S.boodDelBtn}><Trash2 size={13} /> Verwijder item</button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HERBRUIKBARE COMPONENTEN
// ============================================================================
function Bevestig({ titel, tekst, bevestigLabel, onBevestig, onAnnuleer }: {
  titel: string; tekst: string; bevestigLabel: string; onBevestig: () => void; onAnnuleer: () => void;
}) {
  return (
    <div style={S.modalBg} onClick={onAnnuleer}>
      <div style={S.bevestigBox} onClick={(e) => e.stopPropagation()}>
        <h2 style={S.bevestigTitel}>{titel}</h2>
        <p style={S.bevestigTekst}>{tekst}</p>
        <div style={S.bevestigKnoppen}>
          <button onClick={onAnnuleer} style={S.bevestigAnnuleer}>Annuleren</button>
          <button onClick={onBevestig} style={S.bevestigJa}>{bevestigLabel}</button>
        </div>
      </div>
    </div>
  );
}

function Chips({ opts, val, set }: { opts: readonly string[]; val: string; set: (v: string) => void }) {
  return (
    <div style={S.chips}>
      {opts.map((o) => (
        <button key={o} onClick={() => set(val === o ? "" : o)} style={{ ...S.chip, ...(val === o ? S.chipOn : {}) }}>{o}</button>
      ))}
    </div>
  );
}
function ScoreFilter({ val, set }: { val: number; set: (v: number) => void }) {
  return (
    <button onClick={() => set(val >= 5 ? 0 : val + 1)} style={S.scoreFilterBtn}>
      <Star size={13} fill={val ? "#f0a93a" : "none"} color="#f0a93a" /> {val ? `${val}+` : "score"}
    </button>
  );
}
function Sterren({ n, onSet, small }: { n: number; onSet?: (s: number) => void; small?: boolean }) {
  const sz = small ? 13 : 22;
  return (
    <div style={{ display: "flex", gap: small ? 1 : 3 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} onClick={onSet ? (e) => { e.stopPropagation(); onSet(s); } : undefined} style={{ cursor: onSet ? "pointer" : "default", lineHeight: 0 }}>
          <Star size={sz} fill={s <= n ? "#f0a93a" : "none"} color={s <= n ? "#f0a93a" : "#d2d6e4"} />
        </span>
      ))}
    </div>
  );
}
function Tag({ children }: { children: React.ReactNode }) { return <span style={S.tag}>{children}</span>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 14 }}><span style={S.label}>{label}</span>{children}</div>;
}
function Select({ opts, val, set }: { opts: readonly string[]; val: string; set: (v: string) => void }) {
  return <select style={S.input} value={val} onChange={(e) => set(e.target.value)}>{opts.map((o) => <option key={o}>{o}</option>)}</select>;
}
function SegBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return <button onClick={onClick} style={{ ...S.segBtn, ...(active ? S.segBtnOn : {}) }}><Icon size={16} /> {label}</button>;
}

// ============================================================================
// STYLES
// ============================================================================
const S: Record<string, React.CSSProperties> = {
  app: { maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "var(--bg)", color: "var(--ink)", display: "flex", flexDirection: "column", position: "relative" },
  header: { display: "flex", alignItems: "center", gap: 9, padding: "16px 18px 12px", position: "sticky", top: 0, background: "var(--bg)", zIndex: 5, borderBottom: "1px solid var(--line)" },
  appTitle: { fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" },
  headerSub: { marginLeft: "auto", fontSize: 12, color: "var(--sub)", fontWeight: 500 },
  main: { flex: 1, padding: "14px 16px 90px", overflowY: "auto" },
  center: { display: "flex", justifyContent: "center", paddingTop: 60 },

  nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, display: "flex", background: "var(--surface)", borderTop: "1px solid var(--line)", padding: "8px 0 12px", zIndex: 10 },
  navBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", color: "var(--sub)", fontSize: 11, fontWeight: 600, padding: 4, cursor: "pointer" },
  navBtnActive: { color: "var(--accent)" },
  navLabel: { fontSize: 11 },

  searchWrap: { display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", marginBottom: 12 },
  searchInput: { border: "none", outline: "none", flex: 1, fontSize: 15, background: "none", color: "var(--ink)" },

  filterRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8, overflowX: "auto" },
  chips: { display: "flex", gap: 6, flexWrap: "nowrap" },
  chip: { whiteSpace: "nowrap", padding: "6px 12px", borderRadius: 20, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--sub)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  chipOn: { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" },
  scoreFilterBtn: { display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 20, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  resetBtn: { display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "2px 0", marginBottom: 4 },

  card: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, marginBottom: 10, overflow: "hidden" },
  cardBody: { display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "13px 15px 11px", cursor: "pointer" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: 700, color: "var(--ink)" },
  cardMeta: { display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" },
  metaItem: { display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, color: "var(--sub)", fontWeight: 500 },
  tag: { fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "var(--accent-soft)", padding: "3px 8px", borderRadius: 6 },
  cardPlaatsBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: "9px", background: "var(--accent-soft)", color: "var(--accent)", border: "none", borderTop: "1px solid var(--line)", fontSize: 13, fontWeight: 700, cursor: "pointer" },

  empty: { textAlign: "center", color: "var(--sub)", fontSize: 14, padding: "40px 20px", lineHeight: 1.6 },

  modalBg: { position: "fixed", inset: 0, background: "rgba(22,25,39,0.45)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" },
  modal: { background: "var(--bg)", width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", borderRadius: "20px 20px 0 0", padding: "18px 18px 30px" },
  modalHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  modalTitle: { fontSize: 21, fontWeight: 800, margin: 0, lineHeight: 1.2 },
  dialogHint: { fontSize: 13, color: "var(--sub)", margin: "0 0 14px", lineHeight: 1.5 },
  scoreEdit: { display: "flex", alignItems: "center", justifyContent: "space-between", margin: "16px 0", padding: "12px 14px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--line)" },
  sectionH: { fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--sub)", margin: "18px 0 8px" },
  ingList: { listStyle: "none", padding: 0, margin: 0 },
  ingLi: { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 14 },
  ingAmt: { color: "var(--sub)", fontWeight: 600 },
  bereiding: { fontSize: 14, lineHeight: 1.65, color: "#3a3f52", margin: 0, whiteSpace: "pre-wrap" },
  deleteBtn: { display: "inline-flex", alignItems: "center", gap: 6, marginTop: 22, background: "none", border: "1px solid var(--line)", color: "var(--red)", padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" },

  weekPickRow: { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 12px", marginBottom: 7, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 11, cursor: "pointer", textAlign: "left" },
  weekPickDag: { width: 76, fontSize: 13, fontWeight: 700, color: "var(--sub)", flexShrink: 0 },
  weekPickVol: { fontSize: 14, fontWeight: 700, color: "var(--ink)", overflowWrap: "break-word", wordBreak: "break-word", minWidth: 0 },
  weekPickLeeg: { fontSize: 13, color: "var(--sub)", fontStyle: "italic" },

  segWrap: { display: "flex", gap: 6, background: "var(--surface)", padding: 4, borderRadius: 12, border: "1px solid var(--line)", marginBottom: 16 },
  segBtn: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "9px 4px", borderRadius: 9, border: "none", background: "none", color: "var(--sub)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  segBtnOn: { background: "var(--accent)", color: "#fff" },

  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  label: { display: "block", fontSize: 12, fontWeight: 700, color: "var(--sub)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.03em" },
  input: { width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 10, fontSize: 15, background: "var(--surface)", color: "var(--ink)", outline: "none" },
  textarea: { width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 10, fontSize: 15, background: "var(--surface)", color: "var(--ink)", outline: "none", resize: "vertical" },
  ingRow: { display: "flex", gap: 6, marginBottom: 7, alignItems: "center" },
  addRowBtn: { display: "inline-flex", alignItems: "center", gap: 5, background: "var(--accent-soft)", color: "var(--accent)", border: "none", padding: "8px 12px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 2 },
  primaryBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", background: "var(--accent)", color: "#fff", border: "none", padding: "13px", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 8 },

  importBox: { display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center", padding: "30px 20px", background: "var(--surface)", borderRadius: 16, border: "1.5px dashed var(--line)" },
  importText: { fontSize: 14, color: "var(--sub)", margin: 0, lineHeight: 1.5, maxWidth: 280 },
  errText: { color: "var(--red)", fontSize: 13, margin: 0 },
  infoBar: { display: "flex", alignItems: "center", gap: 7, background: "var(--accent-soft)", color: "var(--accent)", padding: "10px 13px", borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 14, flexWrap: "wrap" },
  linkBtn: { marginLeft: "auto", background: "none", border: "none", color: "var(--accent)", fontWeight: 700, fontSize: 13, cursor: "pointer", textDecoration: "underline" },

  weekHead: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14, gap: 10 },
  dayStepper: { display: "flex", alignItems: "center", gap: 10, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: "4px 6px" },
  dayStepperLabel: { fontSize: 14, fontWeight: 700, minWidth: 78, textAlign: "center" },
  leegBtn: { display: "inline-flex", alignItems: "center", gap: 5, background: "var(--surface)", border: "1px solid var(--line)", color: "var(--red)", padding: "8px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  weekRow: { display: "flex", alignItems: "stretch", gap: 10, marginBottom: 9 },
  weekDag: { width: 64, fontSize: 13, fontWeight: 700, color: "var(--sub)", flexShrink: 0, paddingTop: 12 },
  weekSlotLeeg: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px", border: "1.5px dashed var(--line)", borderRadius: 11, background: "none", color: "var(--sub)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  weekSlotDoel: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px", border: "1.5px dashed var(--accent)", borderRadius: 11, background: "var(--accent-soft)", color: "var(--accent)", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  weekSlotVol: { flex: 1, display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 11, padding: "10px 11px" },
  weekSlotBron: { border: "1.5px solid var(--accent)", background: "var(--accent-soft)" },
  weekSlotKies: { flex: 1, display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 },
  weekRecept: { fontSize: 14, fontWeight: 700, lineHeight: 1.3, overflowWrap: "break-word", wordBreak: "break-word" },
  weekMeta: { fontSize: 11, color: "var(--sub)", marginTop: 2 },
  weekActies: { display: "flex", alignItems: "center", gap: 6, flexShrink: 0 },
  persWrap: { display: "flex", alignItems: "center", gap: 4, flexShrink: 0 },
  persBtn: { width: 24, height: 24, borderRadius: 7, border: "1px solid var(--line)", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--ink)", padding: 0 },
  persNum: { fontSize: 12, fontWeight: 700, minWidth: 24, textAlign: "center" },
  pickRow: { display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", padding: "12px 4px", borderBottom: "1px solid var(--line)", background: "none", border: "none", cursor: "pointer" },

  boodTopBar: { display: "flex", gap: 8, marginBottom: 12 },
  boodTopBtn: { flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)", padding: "9px 10px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  boodTopBtnOn: { background: "var(--accent-soft)", color: "var(--accent)", borderColor: "var(--accent)" },
  winkelKop: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--sub)", margin: "4px 2px 8px" },
  winkelAantal: { background: "var(--line)", color: "var(--sub)", borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 700 },
  boodRow: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 11, marginBottom: 7, overflow: "hidden" },
  boodDone: { background: "var(--bg)" },
  boodMain: { display: "flex", alignItems: "center", gap: 10, padding: "11px 12px" },
  checkbox: { width: 22, height: 22, borderRadius: 6, border: "2px solid var(--line)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", background: "var(--surface)", cursor: "pointer", padding: 0 },
  checkboxOn: { background: "var(--green)", borderColor: "var(--green)" },
  boodNaamBtn: { flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "none", border: "none", cursor: "pointer", textAlign: "left", minWidth: 0, padding: 0 },
  boodNaam: { fontSize: 14, fontWeight: 600, overflowWrap: "break-word", wordBreak: "break-word", minWidth: 0 },
  boodHoev: { fontSize: 13, color: "var(--sub)", fontWeight: 600, flexShrink: 0 },
  boodVolgorde: { display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 },
  ordBtn: { width: 24, height: 18, borderRadius: 5, border: "1px solid var(--line)", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--sub)", padding: 0 },
  ordBtnUit: { opacity: 0.3, cursor: "default" },
  boodEdit: { padding: "0 12px 12px", borderTop: "1px solid var(--line)" },
  boodEditRow: { display: "flex", gap: 6, marginTop: 8 },
  boodDelBtn: { display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10, background: "none", border: "1px solid var(--line)", color: "var(--red)", padding: "7px 11px", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer" },
  addItemBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", background: "var(--surface)", border: "1.5px dashed var(--line)", color: "var(--accent)", padding: "12px", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 4 },

  bevestigBox: { background: "var(--surface)", width: "100%", maxWidth: 360, margin: "auto", borderRadius: 16, padding: "22px 20px", alignSelf: "center" },
  bevestigTitel: { fontSize: 18, fontWeight: 800, margin: "0 0 8px" },
  bevestigTekst: { fontSize: 14, color: "var(--sub)", lineHeight: 1.5, margin: "0 0 18px" },
  bevestigKnoppen: { display: "flex", gap: 10 },
  bevestigAnnuleer: { flex: 1, background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink)", padding: "11px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" },
  bevestigJa: { flex: 1, background: "var(--red)", border: "none", color: "#fff", padding: "11px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" },

  iconBtn: { background: "none", border: "none", color: "var(--sub)", cursor: "pointer", padding: 4 },
  iconBtnSm: { width: 30, height: 30, borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--sub)", flexShrink: 0, padding: 0 },
};
