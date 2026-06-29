"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search, Plus, Star, Calendar, ShoppingCart, BookOpen, Camera, Link2,
  PencilLine, X, Trash2, ChevronLeft, ChevronRight, Clock, ChefHat, Check, Loader2,
  Minus, CalendarPlus, ArrowRightLeft, RefreshCw, Eye, EyeOff, ArrowDown, Store, GripVertical,
  Utensils, Repeat, ArrowDownNarrowWide, Image as ImageIcon, ZoomIn, Package,
} from "lucide-react";
import {
  KEUKENS, HOOFDINGREDIENTEN, MOEILIJKHEDEN, MAALTIJDEN, DAGEN, WINKELS, GEEN_WINKEL,
  WINKELGEBIEDEN, GEEN_GEBIED,
  type Recept, type WeekState, type Boodschappen, type BoodschapItem, type GebiedVolgorde,
  type Voorraad, type VoorraadArtikel,
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
  async getGebiedVolgorde(): Promise<GebiedVolgorde> {
    const r = await fetch("/api/gebiedvolgorde", { cache: "no-store" }); return r.json();
  },
  async saveGebiedVolgorde(g: GebiedVolgorde): Promise<GebiedVolgorde> {
    const res = await fetch("/api/gebiedvolgorde", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(g) }); return res.json();
  },
  async getVoorraad(): Promise<Voorraad> {
    const r = await fetch("/api/voorraad", { cache: "no-store" }); return r.json();
  },
  async saveVoorraad(v: Voorraad): Promise<Voorraad> {
    const res = await fetch("/api/voorraad", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) }); return res.json();
  },
  async bepaalGebieden(namen: string[]): Promise<Record<string, string>> {
    try {
      const res = await fetch("/api/gebieden", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ namen }) });
      const data = await res.json();
      return data.gebieden || {};
    } catch { return {}; }
  },
  async importRecept(payload: any): Promise<any> {
    const res = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Import mislukt"); }
    return res.json();
  },
};

const uid = () => "i" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

// ---------------------------------------------------------------------------
// Afbeeldings-helpers. We slaan afbeeldingen op als gecomprimeerde JPEG data-URL,
// zodat ze binnen de Upstash-limiet (~1MB per waarde) passen.
// ---------------------------------------------------------------------------
const MAX_DIM = 1000; // langste zijde in px na compressie

function fileNaarDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

// Schaalt + comprimeert een afbeelding (data-URL) naar een JPEG data-URL.
function comprimeerAfbeelding(bron: string, kwaliteit = 0.82): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > MAX_DIM) { height = Math.round(height * MAX_DIM / width); width = MAX_DIM; }
      else if (height > MAX_DIM) { width = Math.round(width * MAX_DIM / height); height = MAX_DIM; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return rej(new Error("geen canvas"));
      ctx.drawImage(img, 0, 0, width, height);
      res(canvas.toDataURL("image/jpeg", kwaliteit));
    };
    img.onerror = rej;
    img.src = bron;
  });
}

// ============================================================================
// APP
// ============================================================================
export default function App() {
  const [recepten, setRecepten] = useState<Recept[]>([]);
  const [week, setWeek] = useState<WeekState>({ startDag: 0, slots: {} });
  const [boodschappen, setBoodschappen] = useState<Boodschappen>({ items: [] });
  const [gebiedVolgorde, setGebiedVolgorde] = useState<GebiedVolgorde>({});
  const [voorraad, setVoorraad] = useState<Voorraad>({ items: [] });
  const [tab, setTab] = useState("recepten");
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    (async () => {
      const [r, w, b, g, v] = await Promise.all([api.getRecepten(), api.getWeek(), api.getBoodschappen(), api.getGebiedVolgorde(), api.getVoorraad()]);
      setRecepten(r); setWeek(w); setBoodschappen(b); setGebiedVolgorde(g); setVoorraad(v); setLaden(false);
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

  const eersteGebied = useRef(true);
  useEffect(() => {
    if (laden) return;
    if (eersteGebied.current) { eersteGebied.current = false; return; }
    const t = setTimeout(() => api.saveGebiedVolgorde(gebiedVolgorde), 400);
    return () => clearTimeout(t);
  }, [gebiedVolgorde, laden]);

  const eersteVoorraad = useRef(true);
  useEffect(() => {
    if (laden) return;
    if (eersteVoorraad.current) { eersteVoorraad.current = false; return; }
    const t = setTimeout(() => api.saveVoorraad(voorraad), 400);
    return () => clearTimeout(t);
  }, [voorraad, laden]);

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

  // Voegt de ingrediënten van een recept toe aan de boodschappenlijst (los van
  // het weekmenu), geschaald naar het gekozen aantal personen. Bestaat een item
  // met dezelfde naam+eenheid al, dan tellen we de hoeveelheid erbij op.
  const voegReceptToeAanLijst = (recept: Recept, personen: number) => {
    const factor = (personen || recept.personen) / (recept.personen || 1);
    setBoodschappen((p) => {
      const items = [...p.items];
      recept.ingredienten.forEach((i) => {
        const extra = (Number(i.hoev) || 0) * factor;
        const bestaand = items.find(
          (it) => it.naam.toLowerCase() === i.naam.toLowerCase() && it.eenheid.toLowerCase() === (i.eenheid || "").toLowerCase()
        );
        if (bestaand) {
          bestaand.hoev = Math.round((bestaand.hoev + extra) * 10) / 10;
          if (!bestaand.winkel && i.winkel) bestaand.winkel = i.winkel;
          if (!bestaand.gebied && i.gebied) bestaand.gebied = i.gebied;
        } else {
          items.push({ id: uid(), naam: i.naam, hoev: Math.round(extra * 10) / 10, eenheid: i.eenheid, winkel: i.winkel || GEEN_WINKEL, gebied: i.gebied || GEEN_GEBIED, gedaan: false, bron: "hand" });
        }
      });
      return { items };
    });
  };

  // Voegt een generiek voorraadartikel toe aan de boodschappenlijst, met winkel,
  // afdeling en het gekozen aantal. Bestaat een item met dezelfde naam al, dan
  // tellen we het aantal erbij op.
  const voegVoorraadToeAanLijst = (art: VoorraadArtikel, aantal: number) => {
    const n = Math.max(1, Math.round(aantal) || 1);
    setBoodschappen((p) => {
      const bestaand = p.items.find((it) => it.naam.toLowerCase() === art.naam.toLowerCase());
      if (bestaand) {
        return { items: p.items.map((it) => (it === bestaand ? { ...it, hoev: (Number(it.hoev) || 0) + n } : it)) };
      }
      return {
        items: [...p.items, {
          id: uid(), naam: art.naam, hoev: n, eenheid: "",
          winkel: art.winkel || GEEN_WINKEL, gebied: art.gebied || GEEN_GEBIED,
          gedaan: false, bron: "hand",
        }],
      };
    });
  };

  const tabs = [
    { id: "recepten", label: "Recepten", icon: BookOpen },
    { id: "toevoegen", label: "Toevoegen", icon: Plus },
    { id: "week", label: "Weekmenu", icon: Calendar },
    { id: "boodschappen", label: "Lijst", icon: ShoppingCart },
    { id: "voorraad", label: "Voorraad", icon: Package },
    { id: "winkels", label: "Winkels", icon: Store },
  ];

  // Per pagina de maximale inhoudsbreedte op desktop. De header valt hierbuiten
  // en vult altijd de volle breedte; Recepten regelt zijn eigen rasterbreedte.
  const inhoudMaxW: Record<string, number | undefined> = {
    recepten: undefined,   // vol; kaarten in een responsief raster
    toevoegen: 560,        // formulier leesbaar gecentreerd
    week: 800, boodschappen: 800, voorraad: 800, winkels: 800,
  };
  const maxW = inhoudMaxW[tab];

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
          <div style={{ width: "100%", maxWidth: maxW, margin: "0 auto" }}>
            {tab === "recepten" && (
              <ReceptenLijst
                recepten={recepten} week={week} setWeek={setWeek} dagen={dagenInVolgorde}
                onDelete={deleteRecept} onScore={(id, s) => updateRecept(id, { score: s })}
                onUpdate={updateRecept} onNaarLijst={voegReceptToeAanLijst}
              />
            )}
            {tab === "toevoegen" && <Toevoegen onAdd={addRecept} />}
            {tab === "week" && (
              <Weekmenu
                recepten={recepten} week={week} setWeek={setWeek} dagen={dagenInVolgorde}
                onUpdateRecept={updateRecept}
              />
            )}
            {tab === "boodschappen" && (
              <BoodschappenPagina
                recepten={recepten} week={week} dagen={dagenInVolgorde}
                boodschappen={boodschappen} setBoodschappen={setBoodschappen}
                gebiedVolgorde={gebiedVolgorde}
              />
            )}
            {tab === "voorraad" && (
              <VoorraadPagina
                voorraad={voorraad} setVoorraad={setVoorraad}
                onNaarLijst={voegVoorraadToeAanLijst}
              />
            )}
            {tab === "winkels" && (
              <WinkelsPagina gebiedVolgorde={gebiedVolgorde} setGebiedVolgorde={setGebiedVolgorde} />
            )}
          </div>
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
  recept, recepten, week, dagen, setWeek, onClose, onUpdateRecept,
}: {
  recept: Recept; recepten: Recept[]; week: WeekState; dagen: readonly string[];
  setWeek: React.Dispatch<React.SetStateAction<WeekState>>; onClose: () => void;
  onUpdateRecept: (id: string, patch: Partial<Recept>) => Promise<void>;
}) {
  const [conflict, setConflict] = useState<string | null>(null);
  // Recept dat door de wizard loopt voordat het geplaatst wordt; de bijbehorende
  // plaatsings-actie wordt vastgehouden tot de wizard klaar is.
  const [wizard, setWizard] = useState<{ doel: (r: Recept) => void } | null>(null);

  // Voert een plaatsing uit, maar eerst door de wizard als winkel/gebied ontbreekt.
  const metControle = (doe: (r: Recept) => void) => {
    if (mistGegevens(recept)) setWizard({ doel: doe });
    else doe(recept);
  };

  const plaatsOpLegeDag = (dag: string) => {
    metControle((r) => {
      setWeek((p) => ({ ...p, slots: { ...p.slots, [dag]: { recipeId: r.id, personen: r.personen } } }));
      onClose();
    });
  };
  const kiesDag = (dag: string) => { if (week.slots[dag]) setConflict(dag); else plaatsOpLegeDag(dag); };

  const vervang = () => {
    if (!conflict) return;
    metControle((r) => {
      setWeek((p) => ({ ...p, slots: { ...p.slots, [conflict]: { recipeId: r.id, personen: r.personen } } }));
      onClose();
    });
  };
  const verplaatsBestaande = (naarDag: string) => {
    if (!conflict) return;
    metControle((r) => {
      setWeek((p) => {
        const bestaand = p.slots[conflict];
        const slots = { ...p.slots };
        slots[naarDag] = bestaand;
        slots[conflict] = { recipeId: r.id, personen: r.personen };
        return { ...p, slots };
      });
      onClose();
    });
  };

  const legeDagen = dagen.filter((d) => !week.slots[d]);

  if (wizard) {
    return (
      <IngredientenWizard
        recept={recept}
        onUpdateRecept={onUpdateRecept}
        onKlaar={(bijgewerkt) => { wizard.doel(bijgewerkt); setWizard(null); }}
        onAnnuleer={() => setWizard(null)}
      />
    );
  }

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
  recepten, week, setWeek, dagen, onDelete, onScore, onUpdate, onNaarLijst,
}: {
  recepten: Recept[]; week: WeekState; setWeek: React.Dispatch<React.SetStateAction<WeekState>>;
  dagen: readonly string[]; onDelete: (id: string) => void; onScore: (id: string, s: number) => void;
  onUpdate: (id: string, patch: Partial<Recept>) => Promise<void>;
  onNaarLijst: (recept: Recept, personen: number) => void;
}) {
  const [zoek, setZoek] = useState("");
  const [fKeuken, setFKeuken] = useState("");
  const [fHoofd, setFHoofd] = useState("");
  const [fMaaltijd, setFMaaltijd] = useState("");
  const [fMoeil, setFMoeil] = useState("");
  const [fScore, setFScore] = useState(0);
  const [sortering, setSortering] = useState<"naam" | "gegeten" | "score">("naam");
  const [open, setOpen] = useState<Recept | null>(null);
  const [plaats, setPlaats] = useState<Recept | null>(null);
  const [bewerk, setBewerk] = useState<Recept | null>(null);
  const [naarLijst, setNaarLijst] = useState<Recept | null>(null);

  const gefilterd = recepten.filter((r) => {
    if (zoek && !r.titel.toLowerCase().includes(zoek.toLowerCase())) return false;
    if (fKeuken && r.keuken !== fKeuken) return false;
    if (fHoofd && r.hoofd !== fHoofd) return false;
    if (fMaaltijd && r.maaltijd !== fMaaltijd) return false;
    if (fMoeil && r.moeilijkheid !== fMoeil) return false;
    if (fScore && r.score < fScore) return false;
    return true;
  }).sort((a, b) => {
    if (sortering === "gegeten") return (b.gegeten ?? 0) - (a.gegeten ?? 0) || a.titel.localeCompare(b.titel);
    if (sortering === "score") return (b.score ?? 0) - (a.score ?? 0) || a.titel.localeCompare(b.titel);
    return a.titel.localeCompare(b.titel);
  });

  const reset = () => { setFKeuken(""); setFHoofd(""); setFMaaltijd(""); setFMoeil(""); setFScore(0); setZoek(""); };
  const anyFilter = fKeuken || fHoofd || fMaaltijd || fMoeil || fScore || zoek;
  const huidig = open ? recepten.find((r) => r.id === open.id) || open : null;

  return (
    <div>
      <div style={S.searchWrap}>
        <Search size={18} style={{ color: "var(--sub)" }} />
        <input style={S.searchInput} placeholder="Zoek recept..." value={zoek} onChange={(e) => setZoek(e.target.value)} />
      </div>

      <div style={S.filterRow}><Chips opts={MAALTIJDEN} val={fMaaltijd} set={setFMaaltijd} /></div>
      <div style={S.filterRow}><Chips opts={KEUKENS} val={fKeuken} set={setFKeuken} /></div>
      <div style={S.filterRow}><Chips opts={HOOFDINGREDIENTEN} val={fHoofd} set={setFHoofd} /></div>
      <div style={S.filterRow}>
        <Chips opts={MOEILIJKHEDEN} val={fMoeil} set={setFMoeil} />
        <div style={{ flex: 1 }} />
        <ScoreFilter val={fScore} set={setFScore} />
      </div>

      <div style={S.sorteerRij}>
        <span style={S.sorteerLabel}><ArrowDownNarrowWide size={13} /> Sorteer</span>
        <button onClick={() => setSortering("naam")} style={{ ...S.sorteerBtn, ...(sortering === "naam" ? S.sorteerBtnOn : {}) }}>Naam</button>
        <button onClick={() => setSortering("score")} style={{ ...S.sorteerBtn, ...(sortering === "score" ? S.sorteerBtnOn : {}) }}>Score</button>
        <button onClick={() => setSortering("gegeten")} style={{ ...S.sorteerBtn, ...(sortering === "gegeten" ? S.sorteerBtnOn : {}) }}>Vaakst gegeten</button>
      </div>

      {anyFilter ? <button onClick={reset} style={S.resetBtn}><X size={13} /> Filters wissen</button> : null}

      <div style={S.receptGrid}>
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
          onGegeten={(n) => onUpdate(huidig.id, { gegeten: n })}
          onPlaats={() => { setPlaats(huidig); setOpen(null); }}
          onBewerk={() => { setBewerk(huidig); setOpen(null); }}
          onNaarLijst={() => { setNaarLijst(huidig); setOpen(null); }}
        />
      )}

      {bewerk && (
        <BewerkRecept
          recept={bewerk}
          onClose={() => setBewerk(null)}
          onSave={async (patch) => { await onUpdate(bewerk.id, patch); setBewerk(null); }}
        />
      )}

      {plaats && (
        <PlaatsInWeekDialog
          recept={plaats} recepten={recepten} week={week} dagen={dagen} setWeek={setWeek}
          onClose={() => setPlaats(null)} onUpdateRecept={onUpdate}
        />
      )}

      {naarLijst && (
        <NaarLijstDialog
          recept={naarLijst}
          onBevestig={(personen) => { onNaarLijst(naarLijst, personen); setNaarLijst(null); }}
          onClose={() => setNaarLijst(null)}
        />
      )}
    </div>
  );
}

function NaarLijstDialog({
  recept, onBevestig, onClose,
}: {
  recept: Recept; onBevestig: (personen: number) => void; onClose: () => void;
}) {
  const [personen, setPersonen] = useState(recept.personen || 4);
  return (
    <div style={S.modalBg} onClick={onClose}>
      <div style={S.bevestigBox} onClick={(e) => e.stopPropagation()}>
        <h2 style={S.bevestigTitel}>Aan boodschappenlijst</h2>
        <p style={S.bevestigTekst}>
          De ingrediënten van "{recept.titel}" worden aan je boodschappenlijst toegevoegd, los van het weekmenu. Voor hoeveel personen?
        </p>
        <div style={S.naarLijstPers}>
          <button onClick={() => setPersonen((n) => Math.max(1, n - 1))} style={S.persBtn} aria-label="Minder"><Minus size={16} /></button>
          <span style={S.naarLijstPersNum}>{personen} pers.</span>
          <button onClick={() => setPersonen((n) => n + 1)} style={S.persBtn} aria-label="Meer"><Plus size={16} /></button>
        </div>
        <div style={S.bevestigKnoppen}>
          <button onClick={onClose} style={S.bevestigAnnuleer}>Annuleren</button>
          <button onClick={() => onBevestig(personen)} style={{ ...S.bevestigJa, background: "var(--accent)" }}>Toevoegen</button>
        </div>
      </div>
    </div>
  );
}

function ReceptKaart({ r, onOpen, onPlaats }: { r: Recept; onOpen: () => void; onPlaats: () => void }) {
  return (
    <div className="card" style={S.card}>
      <button onClick={onOpen} style={S.cardBody}>
        {r.afbeelding && (
          <div style={S.cardAfbWrap}><img src={r.afbeelding} alt={r.titel} style={S.cardAfb} loading="lazy" /></div>
        )}
        <div style={S.cardTop}>
          <span className="recept-titel" style={S.cardTitle} title={r.titel}>{r.titel}</span>
          <Sterren n={r.score} small />
        </div>
        <div style={S.cardMeta}>
          <Tag tone="maaltijd">{r.maaltijd || "Avondeten"}</Tag>
          <Tag>{r.keuken}</Tag><Tag>{r.hoofd}</Tag>
          <span style={S.metaItem}><Clock size={12} /> {r.tijd}m</span>
          <span style={S.metaItem}><ChefHat size={12} /> {r.moeilijkheid}</span>
          {(r.gegeten ?? 0) > 0 && <span style={S.metaItem}><Repeat size={12} /> {r.gegeten}×</span>}
        </div>
      </button>
      <button onClick={onPlaats} style={S.cardPlaatsBtn}>
        <CalendarPlus size={15} /> In weekmenu
      </button>
    </div>
  );
}

function ReceptModal({
  r, onClose, onDelete, onScore, onPlaats, onBewerk, onNaarLijst, onGegeten,
}: {
  r: Recept; onClose: () => void; onDelete: () => void; onScore: (s: number) => void; onPlaats: () => void; onBewerk: () => void; onNaarLijst: () => void; onGegeten: (n: number) => void;
}) {
  const [zoom, setZoom] = useState(false);
  return (
    <div style={S.modalBg} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <h2 style={S.modalTitle}>{r.titel}</h2>
          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            <button onClick={onBewerk} style={S.iconBtn} aria-label="Bewerken"><PencilLine size={19} /></button>
            <button onClick={onClose} style={S.iconBtn} aria-label="Sluiten"><X size={20} /></button>
          </div>
        </div>

        {r.afbeelding && (
          <button onClick={() => setZoom(true)} style={S.detailAfbWrap}>
            <img src={r.afbeelding} alt={r.titel} style={S.detailAfb} />
            <span style={S.detailAfbZoom}><ZoomIn size={16} /></span>
          </button>
        )}

        <div style={S.cardMeta}>
          <Tag tone="maaltijd">{r.maaltijd || "Avondeten"}</Tag>
          <Tag>{r.keuken}</Tag><Tag>{r.hoofd}</Tag>
          <span style={S.metaItem}><Clock size={12} /> {r.tijd}m</span>
          <span style={S.metaItem}><ChefHat size={12} /> {r.moeilijkheid}</span>
        </div>

        {zoom && r.afbeelding && <AfbeeldingZoom src={r.afbeelding} onClose={() => setZoom(false)} />}

        <div style={S.modalKnopRij}>
          <button onClick={onPlaats} style={S.primaryBtn}>
            <CalendarPlus size={16} /> In weekmenu
          </button>
          <button onClick={onNaarLijst} style={S.secondaryBtn}>
            <ShoppingCart size={16} /> Naar lijst
          </button>
        </div>

        <div style={S.scoreEdit}>
          <span style={S.label}>Jouw score</span>
          <Sterren n={r.score} onSet={onScore} />
        </div>

        <div style={S.gegetenRij}>
          <div>
            <span style={S.label}>Keer gegeten</span>
            <span style={S.gegetenNum}>{r.gegeten ?? 0}×</span>
          </div>
          <div style={S.gegetenKnoppen}>
            <button onClick={() => onGegeten(Math.max(0, (r.gegeten ?? 0) - 1))} style={S.persBtn} aria-label="Minder"><Minus size={15} /></button>
            <button onClick={() => onGegeten((r.gegeten ?? 0) + 1)} style={S.gegetenPlus}><Utensils size={14} /> +1 gegeten</button>
          </div>
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
// BEWERK RECEPT (hergebruikt HandmatigForm, voorgevuld)
// ============================================================================
function BewerkRecept({
  recept, onClose, onSave,
}: {
  recept: Recept; onClose: () => void; onSave: (patch: Partial<Recept>) => Promise<void>;
}) {
  return (
    <div style={S.modalBg} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <div>
            <span style={S.label}>Recept bewerken</span>
            <h2 style={S.modalTitle}>{recept.titel}</h2>
          </div>
          <button onClick={onClose} style={S.iconBtn} aria-label="Sluiten"><X size={20} /></button>
        </div>
        <HandmatigForm onAdd={onSave} initial={recept} opslaanLabel="Wijzigingen opslaan" />
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
    titel: "", keuken: KEUKENS[0], hoofd: HOOFDINGREDIENTEN[0], maaltijd: "Avondeten", moeilijkheid: MOEILIJKHEDEN[0],
    tijd: 30, score: 0, personen: 4, gegeten: 0, afbeelding: "", ingredienten: [{ naam: "", hoev: 0, eenheid: "" }], bereiding: "",
  };
}

function AfbeeldingKiezer({ waarde, onChange }: { waarde: string; onChange: (v: string) => void }) {
  const [bezig, setBezig] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const kies = async (file: File) => {
    setErr(""); setBezig(true);
    try {
      const raw = await fileNaarDataUrl(file);
      const klein = await comprimeerAfbeelding(raw);
      onChange(klein);
    } catch {
      setErr("Kon de afbeelding niet verwerken.");
    } finally { setBezig(false); }
  };

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => e.target.files?.[0] && kies(e.target.files[0])} />
      {waarde ? (
        <div style={S.afbVoorbeeldWrap}>
          <img src={waarde} alt="Recept" style={S.afbVoorbeeld} />
          <div style={S.afbKnoppen}>
            <button onClick={() => fileRef.current?.click()} style={S.afbKnop} disabled={bezig}>
              {bezig ? <Loader2 size={14} className="spin" /> : <ImageIcon size={14} />} Vervangen
            </button>
            <button onClick={() => onChange("")} style={{ ...S.afbKnop, color: "var(--red)" }}><X size={14} /> Verwijderen</button>
          </div>
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()} style={S.afbLeeg} disabled={bezig}>
          {bezig ? <><Loader2 size={16} className="spin" /> Bezig...</> : <><ImageIcon size={18} /> Afbeelding kiezen</>}
        </button>
      )}
      {err && <p style={S.errText}>{err}</p>}
    </div>
  );
}

function HandmatigForm({ onAdd, initial, opslaanLabel }: { onAdd: (r: Partial<Recept>) => void; initial?: Partial<Recept>; opslaanLabel?: string }) {
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
      <Field label="Afbeelding">
        <AfbeeldingKiezer waarde={r.afbeelding || ""} onChange={(v) => set("afbeelding", v)} />
      </Field>
      <div style={S.grid2}>
        <Field label="Keuken"><Select opts={KEUKENS} val={r.keuken!} set={(v) => set("keuken", v)} /></Field>
        <Field label="Hoofdingrediënt"><Select opts={HOOFDINGREDIENTEN} val={r.hoofd!} set={(v) => set("hoofd", v)} /></Field>
      </div>
      <div style={S.grid2}>
        <Field label="Maaltijd"><Select opts={MAALTIJDEN} val={r.maaltijd!} set={(v) => set("maaltijd", v)} /></Field>
        <Field label="Moeilijkheid"><Select opts={MOEILIJKHEDEN} val={r.moeilijkheid!} set={(v) => set("moeilijkheid", v)} /></Field>
      </div>
      <div style={S.grid2}>
        <Field label="Tijd (min)"><input type="number" style={S.input} value={r.tijd} onChange={(e) => set("tijd", e.target.value)} /></Field>
        <Field label="Personen"><input type="number" style={S.input} value={r.personen} onChange={(e) => set("personen", e.target.value)} /></Field>
      </div>
      <div style={S.grid2}>
        <Field label="Score"><Sterren n={r.score || 0} onSet={(s) => set("score", s)} /></Field>
        <Field label="Keer gegeten"><input type="number" style={S.input} value={r.gegeten ?? 0} onChange={(e) => set("gegeten", Number(e.target.value))} /></Field>
      </div>

      <Field label="Ingrediënten">
        {(r.ingredienten || []).map((i, idx) => (
          <div key={idx} style={S.ingBlok}>
            <div style={S.ingRow}>
              <input style={{ ...S.input, flex: 2 }} placeholder="naam" value={i.naam} onChange={(e) => setIng(idx, "naam", e.target.value)} />
              <input style={{ ...S.input, flex: 1 }} placeholder="aantal" value={i.hoev} onChange={(e) => setIng(idx, "hoev", e.target.value)} />
              <input style={{ ...S.input, flex: 1 }} placeholder="eenh." value={i.eenheid} onChange={(e) => setIng(idx, "eenheid", e.target.value)} />
              <button onClick={() => delIng(idx)} style={S.iconBtnSm} aria-label="Verwijder"><X size={15} /></button>
            </div>
            <div style={S.ingRow2}>
              <select style={{ ...S.input, ...S.ingSelect }} value={i.winkel || ""} onChange={(e) => setIng(idx, "winkel", e.target.value)}>
                <option value="">Winkel…</option>
                {WINKELS.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
              <select style={{ ...S.input, ...S.ingSelect }} value={i.gebied || ""} onChange={(e) => setIng(idx, "gebied", e.target.value)}>
                <option value="">Afdeling…</option>
                {WINKELGEBIEDEN.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
        ))}
        <button onClick={addIng} style={S.addRowBtn}><Plus size={14} /> Ingrediënt</button>
      </Field>

      <Field label="Bereiding"><textarea style={S.textarea} rows={4} value={r.bereiding} onChange={(e) => set("bereiding", e.target.value)} placeholder="Beschrijf de stappen..." /></Field>

      <button onClick={opslaan} style={S.primaryBtn} disabled={bezig}>
        {bezig ? <><Loader2 size={16} className="spin" /> Opslaan...</> : <><Check size={16} /> {opslaanLabel || "Recept opslaan"}</>}
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
      const raw = await fileNaarDataUrl(file);
      const b64 = raw.split(",")[1];
      const res = await api.importRecept({ type: "foto", mediaType: file.type, data: b64 });
      const recept = normaliseer(res.recept || res);
      // Bewaar de gebruikte foto (gecomprimeerd) als receptafbeelding.
      recept.afbeelding = await comprimeerAfbeelding(raw).catch(() => "");
      setParsed(recept);
    } catch (e: any) { setErr(e.message || "Kon het recept niet uitlezen."); }
    finally { setBusy(false); }
  };

  if (parsed) return <BevestigImport parsed={parsed} onAdd={onAdd} onCancel={() => setParsed(null)} />;

  return (
    <div style={S.importBox}>
      <Camera size={36} style={{ color: "var(--accent)" }} />
      <p style={S.importText}>Maak of kies een foto van een recept uit een magazine of kookboek. De foto wordt bewaard als afbeelding bij het recept.</p>
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
  const [afbKeuze, setAfbKeuze] = useState<string[] | null>(null);
  const [err, setErr] = useState("");

  const verwerk = async () => {
    if (!url.trim()) return;
    setErr(""); setBusy(true); setParsed(null); setAfbKeuze(null);
    try {
      const res = await api.importRecept({ type: "link", url });
      const recept = normaliseer(res.recept || res);
      setParsed(recept);
      if (Array.isArray(res.afbeeldingen) && res.afbeeldingen.length) setAfbKeuze(res.afbeeldingen);
    } catch (e: any) { setErr(e.message || "Kon de pagina niet uitlezen."); }
    finally { setBusy(false); }
  };

  if (parsed) {
    return (
      <BevestigImport
        parsed={parsed} onAdd={onAdd}
        afbKeuze={afbKeuze}
        onCancel={() => { setParsed(null); setAfbKeuze(null); }}
      />
    );
  }

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

function BevestigImport({
  parsed, onAdd, onCancel, afbKeuze,
}: {
  parsed: Partial<Recept>; onAdd: (r: Partial<Recept>) => void; onCancel: () => void; afbKeuze?: string[] | null;
}) {
  const [recept, setRecept] = useState<Partial<Recept>>(parsed);
  const [bezigAfb, setBezigAfb] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const kiesAfb = async (url: string) => {
    setBezigAfb(url);
    try {
      const res = await api.importRecept({ type: "afbeelding-proxy", url });
      const klein = await comprimeerAfbeelding(res.dataUrl);
      setRecept((p) => ({ ...p, afbeelding: klein }));
      setFormKey((k) => k + 1); // herinitialiseer het formulier met de nieuwe afbeelding
    } catch {
      // stil falen; gebruiker kan een andere kiezen of handmatig uploaden
    } finally { setBezigAfb(null); }
  };

  return (
    <div>
      <div style={S.infoBar}><Check size={15} /> Recept uitgelezen. Controleer en pas aan.<button onClick={onCancel} style={S.linkBtn}>Opnieuw</button></div>

      {afbKeuze && afbKeuze.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <span style={S.label}>Kies een afbeelding van de site</span>
          <div style={S.afbKeuzeStrip}>
            {afbKeuze.map((url) => (
              <button key={url} onClick={() => kiesAfb(url)} style={S.afbKeuzeItem}>
                <img src={url} alt="" style={S.afbKeuzeImg} loading="lazy" />
                {bezigAfb === url && <div style={S.afbKeuzeBezig}><Loader2 size={18} className="spin" /></div>}
                {recept.afbeelding && bezigAfb !== url && <span style={S.afbKeuzeCheck} />}
              </button>
            ))}
          </div>
        </div>
      )}

      <HandmatigForm key={formKey} onAdd={onAdd} initial={recept} />
    </div>
  );
}

function normaliseer(p: any): Partial<Recept> {
  return {
    titel: p.titel || "",
    keuken: KEUKENS.includes(p.keuken) ? p.keuken : KEUKENS[0],
    hoofd: HOOFDINGREDIENTEN.includes(p.hoofd) ? p.hoofd : HOOFDINGREDIENTEN[0],
    maaltijd: MAALTIJDEN.includes(p.maaltijd) ? p.maaltijd : "Avondeten",
    moeilijkheid: MOEILIJKHEDEN.includes(p.moeilijkheid) ? p.moeilijkheid : MOEILIJKHEDEN[0],
    tijd: Number(p.tijd) || 30, score: 0, personen: Number(p.personen) || 4, gegeten: 0, afbeelding: p.afbeelding || "",
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
  recepten, week, setWeek, dagen, onUpdateRecept,
}: {
  recepten: Recept[]; week: WeekState; setWeek: React.Dispatch<React.SetStateAction<WeekState>>; dagen: readonly string[];
  onUpdateRecept: (id: string, patch: Partial<Recept>) => Promise<void>;
}) {
  const [kiesDag, setKiesDag] = useState<string | null>(null);
  const [verplaatsVan, setVerplaatsVan] = useState<string | null>(null);
  const [bevestigLeeg, setBevestigLeeg] = useState(false);
  const [kook, setKook] = useState<{ recept: Recept; personen: number } | null>(null);
  // Wizard die ontbrekende winkel/gebied opvraagt voordat een gerecht geplaatst wordt.
  const [wizard, setWizard] = useState<{ recept: Recept; dag: string } | null>(null);

  const plaatsOpDag = (dag: string, recept: Recept) => {
    setWeek((p) => ({ ...p, slots: { ...p.slots, [dag]: { recipeId: recept.id, personen: recept.personen || 4 } } }));
  };

  const setStartDag = (d: number) => setWeek((p) => ({ ...p, startDag: ((d % 7) + 7) % 7 }));
  const setDag = (dag: string, recipeId: string) => {
    const r = recepten.find((x) => x.id === recipeId);
    if (!r) return;
    setKiesDag(null);
    // Controleer of alle ingrediënten een winkel én gebied hebben.
    if (mistGegevens(r)) {
      setWizard({ recept: r, dag });
    } else {
      plaatsOpDag(dag, r);
    }
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
                    <button onClick={() => setKook({ recept: r, personen: slot.personen })} style={S.weekSlotOpen}>
                      <div style={S.weekRecept}>{r.titel}</div>
                      <div style={S.weekMeta}>{r.keuken} · {r.tijd}m · tik om te koken</div>
                    </button>
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
        <KiesGerechtModal
          dag={kiesDag} recepten={recepten}
          onKies={(id) => setDag(kiesDag, id)}
          onClose={() => setKiesDag(null)}
        />
      )}

      {bevestigLeeg && (
        <Bevestig
          titel="Weekmenu leegmaken?"
          tekst="Alle geplande gerechten worden verwijderd. Dit kan niet ongedaan worden gemaakt."
          bevestigLabel="Ja, leegmaken"
          onBevestig={leegmaken} onAnnuleer={() => setBevestigLeeg(false)}
        />
      )}

      {kook && (
        <KookWeergave recept={kook.recept} personen={kook.personen} onClose={() => setKook(null)} />
      )}

      {wizard && (
        <IngredientenWizard
          recept={wizard.recept}
          onUpdateRecept={onUpdateRecept}
          onKlaar={(bijgewerkt) => { plaatsOpDag(wizard.dag, bijgewerkt); setWizard(null); }}
          onAnnuleer={() => setWizard(null)}
        />
      )}
    </div>
  );
}

// Controleert of een recept ingrediënten heeft zonder winkel of gebied.
function mistGegevens(r: Recept): boolean {
  return r.ingredienten.some((i) => i.naam.trim() && (!i.winkel || !i.gebied));
}

// ============================================================================
// INGREDIËNTEN-WIZARD — vraagt per ontbrekend ingrediënt winkel + gebied.
// Het gebied wordt vooraf via AI bepaald; alleen bij twijfel zelf kiezen.
// ============================================================================
function IngredientenWizard({
  recept, onUpdateRecept, onKlaar, onAnnuleer,
}: {
  recept: Recept;
  onUpdateRecept: (id: string, patch: Partial<Recept>) => Promise<void>;
  onKlaar: (bijgewerkt: Recept) => void;
  onAnnuleer: () => void;
}) {
  // Werkkopie van de ingrediënten die we onderweg bijwerken.
  const [ingredienten, setIngredienten] = useState(() => recept.ingredienten.map((i) => ({ ...i })));
  const [laden, setLaden] = useState(true);
  const [idx, setIdx] = useState(0);
  // De lijst met indices die we behandelen wordt ÉÉN keer vastgezet zodra de
  // AI-gebieden binnen zijn. Daarna verandert hij niet meer terwijl je hem doorloopt,
  // ook al raken items onderweg "compleet". Zo blijft de stap-indexering kloppen.
  const [teDoen, setTeDoen] = useState<number[] | null>(null);

  // Bij openen: AI-gebieden ophalen, daarna de te-behandelen-lijst vastzetten.
  useEffect(() => {
    (async () => {
      const namen = recept.ingredienten.filter((i) => i.naam.trim() && !i.gebied).map((i) => i.naam);
      let verrijkt = recept.ingredienten.map((i) => ({ ...i }));
      if (namen.length) {
        const gebieden = await api.bepaalGebieden(namen).catch(() => ({} as Record<string, string>));
        verrijkt = verrijkt.map((i) => (!i.gebied && gebieden[i.naam] ? { ...i, gebied: gebieden[i.naam] } : i));
      }
      // welke items missen nu nog winkel of gebied? die behandelen we, in vaste volgorde
      const indices = verrijkt
        .map((i, k) => ({ i, k }))
        .filter(({ i }) => i.naam.trim() && (!i.winkel || !i.gebied))
        .map(({ k }) => k);
      setIngredienten(verrijkt);
      setTeDoen(indices);
      setLaden(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const huidigeIdx = teDoen && idx < teDoen.length ? teDoen[idx] : null;
  const huidig = huidigeIdx != null ? ingredienten[huidigeIdx] : null;

  const setVeld = (k: number, patch: Partial<typeof ingredienten[number]>) =>
    setIngredienten((prev) => prev.map((i, ii) => (ii === k ? { ...i, ...patch } : i)));

  const rondAf = async (verseIngredienten: typeof ingredienten) => {
    await onUpdateRecept(recept.id, { ingredienten: verseIngredienten });
    onKlaar({ ...recept, ingredienten: verseIngredienten });
  };

  const volgende = async () => {
    if (!teDoen) return;
    if (idx + 1 < teDoen.length) {
      setIdx(idx + 1);
    } else {
      // laatste item afgerond → opslaan in het recept en plaatsen
      await rondAf(ingredienten);
    }
  };

  // Als na het laden blijkt dat er niets (meer) te behandelen is, meteen afronden
  // en plaatsen — anders zou het recept nooit in het weekmenu komen.
  useEffect(() => {
    if (!laden && teDoen && teDoen.length === 0) {
      rondAf(ingredienten);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laden, teDoen]);

  if (laden) {
    return (
      <div style={S.modalBg}>
        <div style={S.bevestigBox}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", padding: "10px 0" }}>
            <Loader2 size={22} className="spin" style={{ color: "var(--accent)" }} />
            <span style={{ fontWeight: 600 }}>Afdelingen bepalen...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!huidig) {
    // niets (meer) te doen — het afrond-effect hierboven plaatst het recept
    return null;
  }

  const actieveIdx = huidigeIdx as number; // veilig: huidig is hier niet-null
  const gebiedDuidelijk = !!huidig.gebied;

  return (
    <div style={S.modalBg}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <div>
            <span style={S.label}>Ingrediënt {idx + 1} van {teDoen?.length ?? 0} · {recept.titel}</span>
            <h2 style={S.modalTitle}>{huidig.naam}</h2>
          </div>
          <button onClick={onAnnuleer} style={S.iconBtn} aria-label="Annuleren"><X size={20} /></button>
        </div>

        <span style={S.label}>In welke winkel koop je dit?</span>
        <div style={S.wizWinkelGrid}>
          {WINKELS.map((w) => (
            <button key={w} onClick={() => setVeld(actieveIdx, { winkel: w })}
              style={{ ...S.wizWinkelBtn, ...(huidig.winkel === w ? S.wizWinkelBtnOn : {}) }}>
              <Store size={16} /> {w}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 18 }}>
          <span style={S.label}>
            Afdeling {gebiedDuidelijk && <span style={S.wizAiHint}>· voorgesteld</span>}
          </span>
          {gebiedDuidelijk ? (
            <div style={S.wizGebiedGekozen}>
              <span>{huidig.gebied}</span>
              <button onClick={() => setVeld(actieveIdx, { gebied: "" })} style={S.wizGebiedWijzig}>Wijzig</button>
            </div>
          ) : (
            <div style={S.wizGebiedKeuze}>
              {WINKELGEBIEDEN.map((g) => (
                <button key={g} onClick={() => setVeld(actieveIdx, { gebied: g })} style={S.wizGebiedChip}>{g}</button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={volgende}
          disabled={!huidig.winkel || !huidig.gebied}
          style={{ ...S.primaryBtn, marginTop: 22, ...(!huidig.winkel || !huidig.gebied ? { opacity: 0.5 } : {}) }}
        >
          {idx + 1 < (teDoen?.length ?? 0) ? <>Volgende <ChevronRight size={16} /></> : <><Check size={16} /> Klaar en plaatsen</>}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// KOOKWEERGAVE — recept klaarmaken vanuit het weekmenu, geschaald naar personen
// ============================================================================
function KookWeergave({ recept, personen, onClose }: { recept: Recept; personen: number; onClose: () => void }) {
  const [afgevinkt, setAfgevinkt] = useState<Record<number, boolean>>({});
  const [zoom, setZoom] = useState(false);
  const factor = (personen || recept.personen) / (recept.personen || 1);
  const schaal = (h: number) => {
    const v = (Number(h) || 0) * factor;
    return Math.round(v * 100) / 100;
  };
  const geschaald = factor !== 1;

  return (
    <div style={S.modalBg} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <div>
            <span style={S.label}>Klaarmaken</span>
            <h2 style={S.modalTitle}>{recept.titel}</h2>
          </div>
          <button onClick={onClose} style={S.iconBtn} aria-label="Sluiten"><X size={20} /></button>
        </div>

        {recept.afbeelding && (
          <button onClick={() => setZoom(true)} style={S.detailAfbWrap}>
            <img src={recept.afbeelding} alt={recept.titel} style={S.detailAfb} />
            <span style={S.detailAfbZoom}><ZoomIn size={16} /></span>
          </button>
        )}
        {zoom && recept.afbeelding && <AfbeeldingZoom src={recept.afbeelding} onClose={() => setZoom(false)} />}

        <div style={S.cardMeta}>
          <Tag tone="maaltijd">{recept.maaltijd || "Avondeten"}</Tag>
          <Tag>{recept.keuken}</Tag>
          <span style={S.metaItem}><Clock size={12} /> {recept.tijd}m</span>
          <span style={S.metaItem}><ChefHat size={12} /> {recept.moeilijkheid}</span>
        </div>

        <h3 style={S.sectionH}>
          Ingrediënten · {personen} pers.
          {geschaald && <span style={S.kookSchaalHint}> (recept is voor {recept.personen})</span>}
        </h3>
        <ul style={S.kookIngList}>
          {recept.ingredienten.map((i, k) => {
            const done = afgevinkt[k];
            return (
              <li key={k}>
                <button onClick={() => setAfgevinkt((p) => ({ ...p, [k]: !p[k] }))} style={S.kookIngRij}>
                  <span style={{ ...S.checkbox, ...(done ? S.checkboxOn : {}) }}>{done && <Check size={13} />}</span>
                  <span style={{ ...S.kookIngNaam, ...(done ? { textDecoration: "line-through", color: "#a9aec2" } : {}) }}>{i.naam}</span>
                  <span style={S.kookIngAmt}>{schaal(i.hoev)} {i.eenheid}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <h3 style={S.sectionH}>Bereiding</h3>
        <p style={S.kookBereiding}>{recept.bereiding}</p>
      </div>
    </div>
  );
}

// ============================================================================
// KIES GERECHT (met zoekveld) — gebruikt in het weekmenu
// ============================================================================
function KiesGerechtModal({
  dag, recepten, onKies, onClose,
}: {
  dag: string; recepten: Recept[]; onKies: (id: string) => void; onClose: () => void;
}) {
  const [zoek, setZoek] = useState("");
  const gefilterd = recepten.filter((r) =>
    !zoek || r.titel.toLowerCase().includes(zoek.toLowerCase())
  );
  return (
    <div style={S.modalBg} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <h2 style={S.modalTitle}>Gerecht voor {dag}</h2>
          <button onClick={onClose} style={S.iconBtn} aria-label="Sluiten"><X size={20} /></button>
        </div>
        {recepten.length === 0 ? (
          <p style={S.empty}>Voeg eerst recepten toe.</p>
        ) : (
          <>
            <div style={{ ...S.searchWrap, marginTop: 4 }}>
              <Search size={18} style={{ color: "var(--sub)" }} />
              <input style={S.searchInput} placeholder="Zoek op naam..." value={zoek} onChange={(e) => setZoek(e.target.value)} autoFocus />
            </div>
            {gefilterd.length === 0 && <p style={S.empty}>Geen recept gevonden voor "{zoek}".</p>}
            {gefilterd.map((r) => (
              <button key={r.id} onClick={() => onKies(r.id)} style={S.pickRow}>
                <span style={S.cardTitle}>{r.titel}</span>
                <Sterren n={r.score} small />
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// BOODSCHAPPENLIJST
// ============================================================================
function BoodschappenPagina({
  recepten, week, dagen, boodschappen, setBoodschappen, gebiedVolgorde,
}: {
  recepten: Recept[]; week: WeekState; dagen: readonly string[];
  boodschappen: Boodschappen; setBoodschappen: React.Dispatch<React.SetStateAction<Boodschappen>>;
  gebiedVolgorde: GebiedVolgorde;
}) {
  const [verbergGedaan, setVerbergGedaan] = useState(false);
  const [bevestigGenereer, setBevestigGenereer] = useState(false);
  const [bevestigWisAlles, setBevestigWisAlles] = useState(false);
  const [filterWinkel, setFilterWinkel] = useState<string | null>(null); // null = alle winkels

  const genereerUitWeek = (): BoodschapItem[] => {
    const acc: Record<string, { naam: string; eenheid: string; hoev: number; winkel: string; gebied: string }> = {};
    dagen.forEach((dag) => {
      const slot = week.slots[dag];
      if (!slot) return;
      const r = recepten.find((x) => x.id === slot.recipeId);
      if (!r) return;
      const factor = (slot.personen || r.personen) / (r.personen || 1);
      r.ingredienten.forEach((i) => {
        const key = (i.naam + "|" + i.eenheid).toLowerCase();
        if (!acc[key]) acc[key] = { naam: i.naam, eenheid: i.eenheid, hoev: 0, winkel: i.winkel || GEEN_WINKEL, gebied: i.gebied || GEEN_GEBIED };
        acc[key].hoev += (Number(i.hoev) || 0) * factor;
        // vul winkel/gebied aan als nog leeg
        if (!acc[key].winkel && i.winkel) acc[key].winkel = i.winkel;
        if (!acc[key].gebied && i.gebied) acc[key].gebied = i.gebied;
      });
    });
    return Object.values(acc).map((v) => ({
      id: uid(), naam: v.naam, hoev: Math.round(v.hoev * 10) / 10, eenheid: v.eenheid,
      winkel: v.winkel, gebied: v.gebied, gedaan: false, bron: "week" as const,
    }));
  };

  // Verversen: vervang alleen de week-items, laat handmatige items staan. Bestaande
  // winkel/gebied/gedaan van een week-item worden hergebruikt als naam+eenheid matchen.
  const genereer = () => {
    setBoodschappen((p) => {
      const oudWeek = p.items.filter((it) => it.bron === "week");
      const hand = p.items.filter((it) => it.bron !== "week");
      const nieuwWeek = genereerUitWeek().map((nw) => {
        const match = oudWeek.find(
          (o) => o.naam.toLowerCase() === nw.naam.toLowerCase() && (o.eenheid || "").toLowerCase() === (nw.eenheid || "").toLowerCase()
        );
        return match
          ? { ...nw, winkel: nw.winkel || match.winkel, gebied: nw.gebied || match.gebied, gedaan: match.gedaan }
          : nw;
      });
      return { items: [...nieuwWeek, ...hand] };
    });
    setBevestigGenereer(false);
  };

  const wisAlles = () => { setBoodschappen({ items: [] }); setBevestigWisAlles(false); };

  const setItem = (id: string, patch: Partial<BoodschapItem>) =>
    setBoodschappen((p) => ({ items: p.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  const delItem = (id: string) => setBoodschappen((p) => ({ items: p.items.filter((it) => it.id !== id) }));
  const addItem = () =>
    setBoodschappen((p) => ({ items: [...p.items, { id: uid(), naam: "", hoev: 1, eenheid: "", winkel: GEEN_WINKEL, gebied: GEEN_GEBIED, gedaan: false, bron: "hand" }] }));

  // Gebied-volgorde voor een winkel: opgeslagen volgorde, anders de standaard.
  const gebiedIndex = (w: string, gebied: string): number => {
    const volg = (gebiedVolgorde[w] && gebiedVolgorde[w].length) ? gebiedVolgorde[w] : (WINKELGEBIEDEN as readonly string[]);
    const i = volg.indexOf(gebied);
    return i === -1 ? 999 : i; // onbekend/leeg gebied achteraan
  };

  const items = boodschappen.items;
  const zichtbaar = verbergGedaan ? items.filter((it) => !it.gedaan) : items;

  const alleGroepKeys: string[] = [GEEN_WINKEL, ...WINKELS];
  const groepLabel = (k: string) => (k === GEEN_WINKEL ? "Niet toegewezen" : k);

  // Filter bepaalt welke winkelgroepen zichtbaar zijn (null = alle).
  const zichtbareKeys = filterWinkel === null ? alleGroepKeys : [filterWinkel];

  // Bouw per winkel een lijst van gebied-secties, gesorteerd op de looproute.
  const groepen = zichtbareKeys.map((w) => {
    const winkelItems = zichtbaar.filter((it) => (it.winkel || GEEN_WINKEL) === w);
    // groepeer per gebied
    const perGebied: Record<string, BoodschapItem[]> = {};
    winkelItems.forEach((it) => {
      const g = it.gebied || GEEN_GEBIED;
      (perGebied[g] ||= []).push(it);
    });
    const secties = Object.entries(perGebied)
      .map(([gebied, lijst]) => ({ gebied, lijst }))
      .sort((a, b) => gebiedIndex(w, a.gebied) - gebiedIndex(w, b.gebied));
    return { winkel: w, aantal: winkelItems.length, secties };
  });

  const aantalDagen = dagen.filter((d) => week.slots[d]).length;
  const aantalGedaan = items.filter((it) => it.gedaan).length;

  return (
    <div>
      <div style={S.boodTopBar}>
        <button
          onClick={() => (items.some((it) => it.bron === "week") ? setBevestigGenereer(true) : genereer())}
          style={S.boodTopBtn}
        >
          <RefreshCw size={14} /> Weekmenu verversen
        </button>
        <button onClick={() => setVerbergGedaan((v) => !v)} style={{ ...S.boodTopBtn, ...(verbergGedaan ? S.boodTopBtnOn : {}) }}>
          {verbergGedaan ? <Eye size={14} /> : <EyeOff size={14} />} {verbergGedaan ? "Toon gedaan" : "Verberg gedaan"}
        </button>
      </div>
      {items.length > 0 && (
        <button onClick={() => setBevestigWisAlles(true)} style={S.wisAllesBtn}>
          <Trash2 size={14} /> Hele lijst leegmaken
        </button>
      )}

      {items.length === 0 ? (
        <p style={S.empty}>
          Nog geen boodschappen. Genereer de lijst uit je weekmenu{aantalDagen > 0 ? ` (${aantalDagen} maaltijden gepland)` : ""} of voeg handmatig items toe.
        </p>
      ) : (
        <div style={S.infoBar}>
          <ShoppingCart size={15} /> {items.length} items{aantalGedaan > 0 ? ` · ${aantalGedaan} afgevinkt` : ""}
        </div>
      )}

      {items.length > 0 && (
        <div style={S.filterRow}>
          <div style={S.chips}>
            <button onClick={() => setFilterWinkel(null)} style={{ ...S.chip, ...(filterWinkel === null ? S.chipOn : {}) }}>Alle</button>
            {alleGroepKeys.map((w) => {
              const aantal = items.filter((it) => (it.winkel || GEEN_WINKEL) === w).length;
              return (
                <button key={w || "geen"} onClick={() => setFilterWinkel(filterWinkel === w ? null : w)}
                  style={{ ...S.chip, ...(filterWinkel === w ? S.chipOn : {}) }}>
                  {groepLabel(w)} {aantal > 0 ? `(${aantal})` : ""}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {items.length > 0 && groepen.filter((g) => g.aantal > 0).map((g) => (
        <div key={g.winkel || "geen"} style={{ marginBottom: 16 }}>
          <div style={{ ...S.winkelKop, ...(g.winkel === GEEN_WINKEL ? S.winkelKopGeen : {}) }}>
            <Store size={14} /> {groepLabel(g.winkel)} <span style={S.winkelAantal}>{g.aantal}</span>
          </div>
          {g.secties.map((sec) => (
            <div key={sec.gebied || "geen-gebied"} style={{ marginBottom: 6 }}>
              <div style={S.gebiedKop}>{sec.gebied || "Onbekende afdeling"}</div>
              {sec.lijst.map((it) => (
                <BoodItem
                  key={it.id} it={it}
                  onToggle={() => setItem(it.id, { gedaan: !it.gedaan })}
                  onNaam={(v) => setItem(it.id, { naam: v })}
                  onHoev={(v) => setItem(it.id, { hoev: v })}
                  onEenheid={(v) => setItem(it.id, { eenheid: v })}
                  onWinkel={(v) => setItem(it.id, { winkel: v })}
                  onGebied={(v) => setItem(it.id, { gebied: v })}
                  onDel={() => delItem(it.id)}
                />
              ))}
            </div>
          ))}
        </div>
      ))}

      <button onClick={addItem} style={S.addItemBtn}><Plus size={16} /> Item toevoegen</button>

      {bevestigGenereer && (
        <Bevestig
          titel="Weekmenu verversen?"
          tekst="De items uit het weekmenu worden opnieuw berekend en vervangen. Handmatig toegevoegde items blijven staan. Winkel en afdeling van bestaande weekmenu-items blijven behouden waar mogelijk."
          bevestigLabel="Ja, verversen"
          onBevestig={genereer} onAnnuleer={() => setBevestigGenereer(false)}
        />
      )}

      {bevestigWisAlles && (
        <Bevestig
          titel="Hele lijst leegmaken?"
          tekst="Alle items worden verwijderd, ook de handmatig toegevoegde. Dit kan niet ongedaan worden gemaakt."
          bevestigLabel="Ja, alles wissen"
          onBevestig={wisAlles} onAnnuleer={() => setBevestigWisAlles(false)}
        />
      )}
    </div>
  );
}

function BoodItem({
  it, onToggle, onNaam, onHoev, onEenheid, onWinkel, onGebied, onDel,
}: {
  it: BoodschapItem;
  onToggle: () => void; onNaam: (v: string) => void; onHoev: (v: number) => void;
  onEenheid: (v: string) => void; onWinkel: (v: string) => void; onGebied: (v: string) => void; onDel: () => void;
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
      </div>

      {open && (
        <div style={S.boodEdit}>
          <div style={S.boodEditRow}>
            <input style={{ ...S.input, flex: 3 }} placeholder="naam" value={it.naam} onChange={(e) => onNaam(e.target.value)} />
          </div>
          <div style={S.boodEditRow}>
            <input style={{ ...S.input, flex: 1 }} type="number" placeholder="aantal" value={it.hoev} onChange={(e) => onHoev(Number(e.target.value))} />
            <input style={{ ...S.input, flex: 1 }} placeholder="eenh." value={it.eenheid} onChange={(e) => onEenheid(e.target.value)} />
          </div>
          <div style={S.boodEditRow}>
            <select style={{ ...S.input, flex: 1 }} value={it.winkel} onChange={(e) => onWinkel(e.target.value)}>
              <option value="">Geen winkel</option>
              {WINKELS.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
            <select style={{ ...S.input, flex: 1.6 }} value={it.gebied} onChange={(e) => onGebied(e.target.value)}>
              <option value="">Geen afdeling</option>
              {WINKELGEBIEDEN.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <button onClick={onDel} style={S.boodDelBtn}><Trash2 size={13} /> Verwijder item</button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// VOORRAAD-PAGINA — terugkerende generieke artikelen, gesorteerd per afdeling.
// Vink een artikel aan om het aan de boodschappenlijst toe te voegen.
// ============================================================================
function VoorraadPagina({
  voorraad, setVoorraad, onNaarLijst,
}: {
  voorraad: Voorraad;
  setVoorraad: React.Dispatch<React.SetStateAction<Voorraad>>;
  onNaarLijst: (art: VoorraadArtikel, aantal: number) => void;
}) {
  const [nieuwNaam, setNieuwNaam] = useState("");
  const [nieuwWinkel, setNieuwWinkel] = useState("");
  const [nieuwGebied, setNieuwGebied] = useState("");
  const [toegevoegd, setToegevoegd] = useState<Record<string, boolean>>({});
  // Gekozen aantal per artikel (standaard 1).
  const [aantallen, setAantallen] = useState<Record<string, number>>({});
  const aantalVan = (id: string) => aantallen[id] ?? 1;
  const setAantal = (id: string, n: number) => setAantallen((a) => ({ ...a, [id]: Math.max(1, n) }));

  const voegToe = () => {
    const naam = nieuwNaam.trim();
    if (!naam) return;
    setVoorraad((p) => ({
      items: [...p.items, { id: uid(), naam, winkel: nieuwWinkel, gebied: nieuwGebied }],
    }));
    setNieuwNaam(""); setNieuwWinkel(""); setNieuwGebied("");
  };

  const verwijder = (id: string) =>
    setVoorraad((p) => ({ items: p.items.filter((a) => a.id !== id) }));

  const wijzig = (id: string, patch: Partial<VoorraadArtikel>) =>
    setVoorraad((p) => ({ items: p.items.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));

  const vink = (art: VoorraadArtikel) => {
    if (toegevoegd[art.id]) return; // al toegevoegd deze sessie
    onNaarLijst(art, aantalVan(art.id));
    setToegevoegd((t) => ({ ...t, [art.id]: true }));
  };

  // Groepeer per afdeling, in de vaste volgorde van WINKELGEBIEDEN; onbekende
  // afdeling ("") komt onderaan.
  const groepen = useMemo(() => {
    const orde = [...WINKELGEBIEDEN, ""];
    return orde
      .map((g) => ({ gebied: g, items: voorraad.items.filter((a) => (a.gebied || "") === g).sort((a, b) => a.naam.localeCompare(b.naam)) }))
      .filter((grp) => grp.items.length > 0);
  }, [voorraad.items]);

  return (
    <div>
      <p style={S.winkelsIntro}>
        Terugkerende artikelen zoals wasmiddel of aluminiumfolie. Vink een artikel aan om het aan je boodschappenlijst toe te voegen — winkel en afdeling gaan automatisch mee.
      </p>

      {/* Nieuw artikel toevoegen */}
      <div style={S.voorraadNieuw}>
        <input
          style={{ ...S.input, marginBottom: 7 }} placeholder="Nieuw artikel (bijv. wasmiddel)"
          value={nieuwNaam} onChange={(e) => setNieuwNaam(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && voegToe()}
        />
        <div style={S.voorraadNieuwRij}>
          <select style={{ ...S.input, ...S.ingSelect }} value={nieuwWinkel} onChange={(e) => setNieuwWinkel(e.target.value)}>
            <option value="">Winkel…</option>
            {WINKELS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <select style={{ ...S.input, ...S.ingSelect }} value={nieuwGebied} onChange={(e) => setNieuwGebied(e.target.value)}>
            <option value="">Afdeling…</option>
            {WINKELGEBIEDEN.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <button onClick={voegToe} disabled={!nieuwNaam.trim()} style={{ ...S.voorraadAddBtn, ...(!nieuwNaam.trim() ? { opacity: 0.5 } : {}) }}>
            <Plus size={16} />
          </button>
        </div>
      </div>

      {voorraad.items.length === 0 ? (
        <div style={S.leeg}><Package size={30} style={{ color: "var(--sub)" }} /><p>Nog geen vaste artikelen. Voeg er hierboven een toe.</p></div>
      ) : (
        groepen.map((grp) => (
          <div key={grp.gebied || "overig"} style={{ marginBottom: 16 }}>
            <div style={S.gebiedKop}>{grp.gebied || "Geen afdeling"}</div>
            {grp.items.map((art) => (
              <div key={art.id} style={S.voorraadRij}>
                <button
                  onClick={() => vink(art)}
                  style={{ ...S.checkbox, ...(toegevoegd[art.id] ? S.checkboxOn : {}), flexShrink: 0 }}
                  aria-label="Aan lijst toevoegen"
                >
                  {toegevoegd[art.id] && <Check size={13} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...S.voorraadNaam, ...(toegevoegd[art.id] ? { color: "var(--green)" } : {}) }}>{art.naam}</div>
                  <div style={S.voorraadMeta}>
                    <select style={S.voorraadInlineSel} value={art.winkel} onChange={(e) => wijzig(art.id, { winkel: e.target.value })}>
                      <option value="">Winkel…</option>
                      {WINKELS.map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                    <select style={S.voorraadInlineSel} value={art.gebied} onChange={(e) => wijzig(art.id, { gebied: e.target.value })}>
                      <option value="">Afdeling…</option>
                      {WINKELGEBIEDEN.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
                {!toegevoegd[art.id] && (
                  <div style={S.voorraadStepper}>
                    <button onClick={() => setAantal(art.id, aantalVan(art.id) - 1)} style={S.voorraadStepBtn} aria-label="Minder"><Minus size={14} /></button>
                    <span style={S.voorraadAantal}>{aantalVan(art.id)}</span>
                    <button onClick={() => setAantal(art.id, aantalVan(art.id) + 1)} style={S.voorraadStepBtn} aria-label="Meer"><Plus size={14} /></button>
                  </div>
                )}
                <button onClick={() => verwijder(art.id)} style={S.iconBtnSm} aria-label="Verwijder"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

// ============================================================================
// WINKELS-PAGINA — per winkel de volgorde van winkelgebieden (looproute)
// ============================================================================
function WinkelsPagina({
  gebiedVolgorde, setGebiedVolgorde,
}: {
  gebiedVolgorde: GebiedVolgorde; setGebiedVolgorde: React.Dispatch<React.SetStateAction<GebiedVolgorde>>;
}) {
  const [winkel, setWinkel] = useState<string>(WINKELS[0]);

  // De volgorde voor de gekozen winkel: opgeslagen volgorde, aangevuld met
  // eventueel ontbrekende gebieden, zodat altijd alle gebieden zichtbaar zijn.
  const volgordeVoor = (w: string): string[] => {
    const opgeslagen = gebiedVolgorde[w] || [];
    const rest = WINKELGEBIEDEN.filter((g) => !opgeslagen.includes(g));
    return [...opgeslagen.filter((g) => (WINKELGEBIEDEN as readonly string[]).includes(g)), ...rest];
  };

  const huidige = volgordeVoor(winkel);

  const verplaats = (index: number, richting: -1 | 1) => {
    const doel = index + richting;
    if (doel < 0 || doel >= huidige.length) return;
    const nieuw = [...huidige];
    [nieuw[index], nieuw[doel]] = [nieuw[doel], nieuw[index]];
    setGebiedVolgorde((p) => ({ ...p, [winkel]: nieuw }));
  };

  const resetWinkel = () => setGebiedVolgorde((p) => ({ ...p, [winkel]: [...WINKELGEBIEDEN] }));

  return (
    <div>
      <p style={S.winkelsIntro}>
        Zet per winkel de afdelingen in de vololgorde waarin je er doorheen loopt. Je boodschappenlijst sorteert items daarna automatisch op deze looproute.
      </p>

      <div style={S.filterRow}>
        <div style={S.chips}>
          {WINKELS.map((w) => (
            <button key={w} onClick={() => setWinkel(w)} style={{ ...S.chip, ...(winkel === w ? S.chipOn : {}) }}>{w}</button>
          ))}
        </div>
      </div>

      <div style={S.winkelsKopRij}>
        <span style={S.winkelsKop}><Store size={14} /> Looproute {winkel}</span>
        <button onClick={resetWinkel} style={S.resetBtn}><RefreshCw size={13} /> Standaard</button>
      </div>

      {huidige.map((g, k) => (
        <div key={g} style={S.gebiedRij}>
          <span style={S.gebiedNr}>{k + 1}</span>
          <span style={S.gebiedNaam}>{g}</span>
          <div style={S.gebiedKnoppen}>
            <button onClick={() => verplaats(k, -1)} disabled={k === 0} style={{ ...S.ordBtn, ...(k === 0 ? S.ordBtnUit : {}) }} aria-label="Omhoog"><ChevronLeft size={14} style={{ transform: "rotate(90deg)" }} /></button>
            <button onClick={() => verplaats(k, 1)} disabled={k === huidige.length - 1} style={{ ...S.ordBtn, ...(k === huidige.length - 1 ? S.ordBtnUit : {}) }} aria-label="Omlaag"><ChevronRight size={14} style={{ transform: "rotate(90deg)" }} /></button>
          </div>
        </div>
      ))}
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
// Fullscreen zoom-weergave met in/uitzoomen en slepen om te pannen.
function AfbeeldingZoom({ src, onClose }: { src: string; onClose: () => void }) {
  const [schaal, setSchaal] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const sleep = useRef<{ x: number; y: number } | null>(null);

  const start = (x: number, y: number) => { sleep.current = { x: x - pos.x, y: y - pos.y }; };
  const beweeg = (x: number, y: number) => {
    if (!sleep.current || schaal === 1) return;
    setPos({ x: x - sleep.current.x, y: y - sleep.current.y });
  };
  const stop = () => { sleep.current = null; };

  return (
    <div style={S.zoomBg} onClick={onClose}
      onMouseMove={(e) => beweeg(e.clientX, e.clientY)} onMouseUp={stop}
      onTouchMove={(e) => e.touches[0] && beweeg(e.touches[0].clientX, e.touches[0].clientY)} onTouchEnd={stop}>
      <img
        src={src} alt="" draggable={false}
        style={{ ...S.zoomImg, transform: `translate(${pos.x}px, ${pos.y}px) scale(${schaal})`, cursor: schaal > 1 ? "grab" : "default" }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => { e.stopPropagation(); start(e.clientX, e.clientY); }}
        onTouchStart={(e) => { e.stopPropagation(); e.touches[0] && start(e.touches[0].clientX, e.touches[0].clientY); }}
      />
      <div style={S.zoomKnoppen} onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setSchaal((s) => Math.max(1, Math.round((s - 0.5) * 10) / 10))} style={S.zoomKnop}><Minus size={18} /></button>
        <span style={S.zoomLabel}>{Math.round(schaal * 100)}%</span>
        <button onClick={() => setSchaal((s) => Math.min(5, Math.round((s + 0.5) * 10) / 10))} style={S.zoomKnop}><Plus size={18} /></button>
        <button onClick={() => { setSchaal(1); setPos({ x: 0, y: 0 }); }} style={S.zoomKnop} aria-label="Reset"><RefreshCw size={16} /></button>
      </div>
      <button onClick={onClose} style={S.zoomSluit} aria-label="Sluiten"><X size={22} /></button>
    </div>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: "maaltijd" }) {
  return <span style={{ ...S.tag, ...(tone === "maaltijd" ? S.tagMaaltijd : {}) }}>{children}</span>;
}
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
  app: { width: "100%", margin: "0 auto", minHeight: "100vh", background: "var(--bg)", color: "var(--ink)", display: "flex", flexDirection: "column", position: "relative" },
  header: { display: "flex", alignItems: "center", gap: 9, padding: "16px 18px 12px", position: "sticky", top: 0, background: "var(--bg)", zIndex: 5, borderBottom: "1px solid var(--line)" },
  appTitle: { fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" },
  headerSub: { marginLeft: "auto", fontSize: 12, color: "var(--sub)", fontWeight: 500 },
  main: { flex: 1, padding: "14px 16px 90px", overflowY: "auto" },
  center: { display: "flex", justifyContent: "center", paddingTop: 60 },

  nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, display: "flex", background: "var(--surface)", borderTop: "1px solid var(--line)", padding: "8px 0 12px", zIndex: 10 },
  navBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", color: "var(--sub)", fontSize: 10, fontWeight: 600, padding: "4px 2px", cursor: "pointer" },
  navBtnActive: { color: "var(--accent)" },
  navLabel: { fontSize: 10 },

  searchWrap: { display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", marginBottom: 12 },
  searchInput: { border: "none", outline: "none", flex: 1, fontSize: 15, background: "none", color: "var(--ink)" },

  filterRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8, overflowX: "auto" },
  chips: { display: "flex", gap: 6, flexWrap: "nowrap" },
  chip: { whiteSpace: "nowrap", padding: "6px 12px", borderRadius: 20, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--sub)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  chipOn: { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" },
  scoreFilterBtn: { display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 20, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  resetBtn: { display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "2px 0", marginBottom: 4 },

  card: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" },
  receptGrid: { marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 10, alignItems: "start" },
  cardBody: { display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "13px 15px 11px", cursor: "pointer" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: 700, color: "var(--ink)" },
  cardMeta: { display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" },
  metaItem: { display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, color: "var(--sub)", fontWeight: 500 },
  tag: { fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "var(--accent-soft)", padding: "3px 8px", borderRadius: 6 },
  tagMaaltijd: { color: "#fff", background: "var(--accent)" },

  // Afbeeldingen
  cardAfbWrap: { width: "100%", height: 150, borderRadius: 10, overflow: "hidden", marginBottom: 10, background: "var(--bg)" },
  cardAfb: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  detailAfbWrap: { position: "relative", display: "block", width: "100%", maxHeight: 240, overflow: "hidden", borderRadius: 12, margin: "4px 0 12px", padding: 0, border: "none", background: "var(--bg)", cursor: "zoom-in" },
  detailAfb: { width: "100%", maxHeight: 240, objectFit: "cover", display: "block" },
  detailAfbZoom: { position: "absolute", right: 10, bottom: 10, width: 32, height: 32, borderRadius: 8, background: "rgba(22,25,39,0.6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" },
  afbVoorbeeldWrap: { border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", background: "var(--surface)" },
  afbVoorbeeld: { width: "100%", maxHeight: 200, objectFit: "cover", display: "block" },
  afbKnoppen: { display: "flex", gap: 8, padding: 8, borderTop: "1px solid var(--line)" },
  afbKnop: { flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink)", padding: "8px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  afbLeeg: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "20px", border: "1.5px dashed var(--line)", borderRadius: 10, background: "var(--surface)", color: "var(--accent)", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  afbKeuzeStrip: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 },
  afbKeuzeItem: { position: "relative", flexShrink: 0, width: 92, height: 92, borderRadius: 10, overflow: "hidden", border: "1px solid var(--line)", padding: 0, cursor: "pointer", background: "var(--bg)" },
  afbKeuzeImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  afbKeuzeBezig: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.7)", color: "var(--accent)" },
  afbKeuzeCheck: { position: "absolute", top: 5, right: 5, width: 16, height: 16 },

  zoomBg: { position: "fixed", inset: 0, background: "rgba(10,12,20,0.92)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", touchAction: "none" },
  zoomImg: { maxWidth: "100%", maxHeight: "100%", objectFit: "contain", transition: "transform 0.05s linear", userSelect: "none" },
  zoomKnoppen: { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 8, background: "rgba(22,25,39,0.85)", padding: "8px 12px", borderRadius: 30 },
  zoomKnop: { width: 38, height: 38, borderRadius: 19, border: "none", background: "rgba(255,255,255,0.12)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  zoomLabel: { color: "#fff", fontSize: 13, fontWeight: 700, minWidth: 44, textAlign: "center" },
  zoomSluit: { position: "fixed", top: 16, right: 16, width: 40, height: 40, borderRadius: 20, border: "none", background: "rgba(255,255,255,0.12)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  cardPlaatsBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: "9px", background: "var(--accent-soft)", color: "var(--accent)", border: "none", borderTop: "1px solid var(--line)", fontSize: 13, fontWeight: 700, cursor: "pointer" },

  empty: { gridColumn: "1 / -1", textAlign: "center", color: "var(--sub)", fontSize: 14, padding: "40px 20px", lineHeight: 1.6 },

  modalBg: { position: "fixed", inset: 0, background: "rgba(22,25,39,0.45)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" },
  modal: { background: "var(--bg)", width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", borderRadius: "20px 20px 0 0", padding: "18px 18px 30px" },
  modalHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  modalTitle: { fontSize: 21, fontWeight: 800, margin: 0, lineHeight: 1.2 },
  dialogHint: { fontSize: 13, color: "var(--sub)", margin: "0 0 14px", lineHeight: 1.5 },
  scoreEdit: { display: "flex", alignItems: "center", justifyContent: "space-between", margin: "16px 0", padding: "12px 14px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--line)" },
  sorteerRij: { display: "flex", alignItems: "center", gap: 6, marginTop: 4, marginBottom: 4, overflowX: "auto" },
  sorteerLabel: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--sub)", flexShrink: 0, marginRight: 2 },
  sorteerBtn: { whiteSpace: "nowrap", padding: "5px 11px", borderRadius: 20, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--sub)", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  sorteerBtnOn: { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" },
  gegetenRij: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "12px 0", padding: "12px 14px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--line)" },
  gegetenNum: { fontSize: 18, fontWeight: 800, display: "block", marginTop: 2 },
  gegetenKnoppen: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  gegetenPlus: { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--green)", color: "#fff", border: "none", padding: "10px 14px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" },
  sectionH: { fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--sub)", margin: "18px 0 8px" },
  ingList: { listStyle: "none", padding: 0, margin: 0 },
  ingLi: { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 14 },
  ingAmt: { color: "var(--sub)", fontWeight: 600 },
  bereiding: { fontSize: 14, lineHeight: 1.65, color: "#3a3f52", margin: 0, whiteSpace: "pre-wrap" },
  kookSchaalHint: { fontWeight: 500, textTransform: "none", letterSpacing: 0, color: "var(--sub)" },
  kookIngList: { listStyle: "none", padding: 0, margin: 0 },
  kookIngRij: { display: "flex", alignItems: "center", gap: 11, width: "100%", background: "none", border: "none", borderBottom: "1px solid var(--line)", padding: "12px 2px", cursor: "pointer", textAlign: "left" },
  kookIngNaam: { flex: 1, fontSize: 15, fontWeight: 600, minWidth: 0, overflowWrap: "break-word", wordBreak: "break-word" },
  kookIngAmt: { fontSize: 15, color: "var(--accent)", fontWeight: 700, flexShrink: 0 },
  kookBereiding: { fontSize: 15, lineHeight: 1.75, color: "#3a3f52", margin: 0, whiteSpace: "pre-wrap" },
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
  ingBlok: { marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--line)" },
  ingRow2: { display: "flex", gap: 6, alignItems: "center" },
  ingSelect: { flex: 1, fontSize: 13, padding: "8px 8px", color: "var(--sub)", minWidth: 0 },
  addRowBtn: { display: "inline-flex", alignItems: "center", gap: 5, background: "var(--accent-soft)", color: "var(--accent)", border: "none", padding: "8px 12px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 2 },
  primaryBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", background: "var(--accent)", color: "#fff", border: "none", padding: "13px", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 8 },
  modalKnopRij: { display: "flex", gap: 8, marginTop: 16 },
  secondaryBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", background: "var(--accent-soft)", color: "var(--accent)", border: "none", padding: "13px", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 8 },
  naarLijstPers: { display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "12px", background: "var(--bg)", borderRadius: 12, marginBottom: 18 },
  naarLijstPersNum: { fontSize: 16, fontWeight: 700, minWidth: 70, textAlign: "center" },

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
  weekSlotOpen: { flex: 1, minWidth: 0, display: "block", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 },
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
  wisAllesBtn: { display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--red)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "2px 4px", marginBottom: 12, marginTop: -2 },
  winkelKop: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--sub)", margin: "4px 2px 8px" },
  winkelKopGeen: { color: "var(--accent)" },
  winkelLeeg: { fontSize: 12, color: "var(--sub)", fontStyle: "italic", padding: "10px 12px", border: "1.5px dashed var(--line)", borderRadius: 11, textAlign: "center" },
  gebiedKop: { fontSize: 11, fontWeight: 700, color: "var(--sub)", margin: "2px 4px 4px", letterSpacing: "0.02em" },
  leeg: { display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "40px 20px", color: "var(--sub)", textAlign: "center", fontSize: 14 },
  voorraadNieuw: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 12, marginBottom: 18 },
  voorraadNieuwRij: { display: "flex", gap: 6, alignItems: "center" },
  voorraadAddBtn: { flexShrink: 0, width: 42, height: 38, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" },
  voorraadRij: { display: "flex", alignItems: "center", gap: 11, padding: "10px 4px", borderBottom: "1px solid var(--line)" },
  voorraadNaam: { fontSize: 15, fontWeight: 600, overflowWrap: "break-word", wordBreak: "break-word" },
  voorraadMeta: { display: "flex", gap: 6, marginTop: 5 },
  voorraadInlineSel: { flex: 1, minWidth: 0, fontSize: 12, padding: "5px 6px", color: "var(--sub)", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 7 },
  voorraadStepper: { display: "flex", alignItems: "center", gap: 2, flexShrink: 0, background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, padding: 2 },
  voorraadStepBtn: { width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--ink)", cursor: "pointer", padding: 0 },
  voorraadAantal: { minWidth: 22, textAlign: "center", fontSize: 14, fontWeight: 700 },

  // Winkels-pagina
  winkelsIntro: { fontSize: 13, color: "var(--sub)", lineHeight: 1.5, margin: "0 0 14px" },
  winkelsKopRij: { display: "flex", alignItems: "center", justifyContent: "space-between", margin: "12px 2px 10px" },
  winkelsKop: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink)" },
  gebiedRij: { display: "flex", alignItems: "center", gap: 10, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 11, padding: "11px 12px", marginBottom: 7 },
  gebiedNr: { width: 22, height: 22, borderRadius: 11, background: "var(--accent-soft)", color: "var(--accent)", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  gebiedNaam: { flex: 1, fontSize: 14, fontWeight: 600, minWidth: 0 },
  gebiedKnoppen: { display: "flex", gap: 4, flexShrink: 0 },
  ordBtn: { width: 30, height: 30, borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--sub)", padding: 0 },
  ordBtnUit: { opacity: 0.3, cursor: "default" },

  // Wizard
  wizWinkelGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 },
  wizWinkelBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "14px", borderRadius: 11, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  wizWinkelBtnOn: { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" },
  wizAiHint: { fontWeight: 500, textTransform: "none", letterSpacing: 0, color: "var(--green)" },
  wizGebiedGekozen: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 11, fontSize: 15, fontWeight: 600 },
  wizGebiedWijzig: { background: "none", border: "none", color: "var(--accent)", fontWeight: 700, fontSize: 13, cursor: "pointer", textDecoration: "underline" },
  wizGebiedKeuze: { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 4 },
  wizGebiedChip: { padding: "8px 12px", borderRadius: 20, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  winkelAantal: { background: "var(--line)", color: "var(--sub)", borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 700 },
  boodRow: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 11, marginBottom: 7, overflow: "hidden" },
  boodRowDragging: { opacity: 0.4, borderStyle: "dashed", borderColor: "var(--accent)" },
  boodDone: { background: "var(--bg)" },
  boodMain: { display: "flex", alignItems: "center", gap: 8, padding: "11px 12px" },
  greep: { display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 32, flexShrink: 0, color: "var(--sub)", cursor: "grab", touchAction: "none", marginLeft: -4 },
  checkbox: { width: 22, height: 22, borderRadius: 6, border: "2px solid var(--line)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", background: "var(--surface)", cursor: "pointer", padding: 0 },
  checkboxOn: { background: "var(--green)", borderColor: "var(--green)" },
  boodNaamBtn: { flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "none", border: "none", cursor: "pointer", textAlign: "left", minWidth: 0, padding: 0 },
  boodNaam: { fontSize: 14, fontWeight: 600, overflowWrap: "break-word", wordBreak: "break-word", minWidth: 0 },
  boodHoev: { fontSize: 13, color: "var(--sub)", fontWeight: 600, flexShrink: 0 },
  winkelActief: { background: "var(--accent-soft)", borderRadius: 12, padding: "2px 4px 4px", margin: "0 -4px 14px", outline: "1.5px dashed var(--accent)" },
  dropLijn: { height: 3, background: "var(--accent)", borderRadius: 2, margin: "3px 4px" },
  dragGhost: { position: "fixed", left: "50%", transform: "translate(-50%, -50%)", width: "min(448px, 92vw)", display: "flex", alignItems: "center", gap: 10, background: "var(--surface)", border: "1.5px solid var(--accent)", borderRadius: 11, padding: "11px 12px", boxShadow: "0 8px 24px rgba(22,25,39,0.18)", zIndex: 100, pointerEvents: "none" },
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
