"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search, Plus, Star, Calendar, ShoppingCart, BookOpen, Camera, Link2,
  PencilLine, X, Trash2, ChevronLeft, ChevronRight, Clock, ChefHat, Check, Loader2,
  Minus, CalendarPlus, ArrowRightLeft, RefreshCw, Eye, EyeOff, ArrowDown, Store, GripVertical,
  Utensils, Repeat, ArrowDownNarrowWide, Image as ImageIcon, ZoomIn, Package, Sparkles, Info,
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
  async lijstOpschonen(items: { id: string; naam: string; hoev: number; eenheid: string }[]): Promise<{
    samenvoegingen: { ids: string[]; zeker: boolean; naamKeuzes: string[]; voorstelNaam: string; eenheid: string }[];
    verpakkingen: { id: string; zeker: boolean; huidig: string; voorstel: string }[];
    geenKey?: boolean;
  }> {
    const res = await fetch("/api/lijst-opschonen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
    if (!res.ok) {
      const e = await res.json().catch(() => ({} as any));
      throw new Error(e.error || "Opschonen mislukt");
    }
    return res.json();
  },
  async importRecept(payload: any): Promise<any> {
    const res = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Import mislukt"); }
    return res.json();
  },
};

const uid = () => "i" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

// Hoeveelheden op de boodschappenlijst: artikelen zonder eenheid of in stuks
// kun je alleen heel kopen, dus die ronden we naar boven af. Meetbare eenheden
// (gram, ml, ...) houden één decimaal.
const STUKS_EENHEDEN = ["", "st", "st.", "stuk", "stuks", "x"];
const rondLijstAantal = (hoev: number, eenheid: string): number =>
  STUKS_EENHEDEN.includes((eenheid || "").trim().toLowerCase())
    ? Math.ceil(hoev)
    : Math.round(hoev * 10) / 10;

// Weekplanning-slots: sleutel is "dag|maaltijd" zodat een dag naast het
// avondeten optioneel ook een ontbijt, lunch of toetje kan hebben. Oude data
// (sleutel = alleen de dag) wordt bij het laden gemigreerd naar avondeten.
const HOOFD_MAALTIJD = "Avondeten";
const EXTRA_MAALTIJDEN = ["Ontbijt", "Lunch", "Toetje"] as const;
const slotKey = (dag: string, maaltijd: string) => `${dag}|${maaltijd}`;

// Herkent standaard kruiden/smaakmakers die vrijwel iedereen in huis heeft
// (zout, peper en varianten). Gebruikt bij de controlevraag na het importeren.
const isStandaardKruid = (naam: string): boolean => {
  const n = (naam || "").trim().toLowerCase()
    .replace(/\(.*?\)/g, "")            // "(naar smaak)" weghalen
    .replace(/\s+naar smaak$/, "")
    .replace(/^snufje\s+/, "")
    .replace(/^vers\s?gemalen\s+/, "")
    .trim();
  return [
    "zout", "peper", "zout en peper", "peper en zout",
    "zwarte peper", "witte peper", "zeezout", "grof zout", "fijn zout",
  ].includes(n);
};

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
// maxDim: langste zijde; hoger voor foto's die de AI moet kunnen lezen.
function comprimeerAfbeelding(bron: string, kwaliteit = 0.82, maxDim = MAX_DIM): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; }
      else if (height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; }
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
      // Migratie: oude slot-sleutels (alleen de dagnaam) worden avondeten.
      const slots: Record<string, { recipeId: string; personen: number }> = {};
      Object.entries(w.slots || {}).forEach(([k, v2]) => { slots[k.includes("|") ? k : slotKey(k, HOOFD_MAALTIJD)] = v2 as any; });
      setRecepten(r); setWeek({ ...w, slots }); setBoodschappen(b); setGebiedVolgorde(g); setVoorraad(v); setLaden(false);
    })();
  }, []);

  const eersteWeek = useRef(true);
  useEffect(() => {
    if (laden) return;
    if (eersteWeek.current) { eersteWeek.current = false; return; }
    api.saveWeek(week);
  }, [week, laden]);

  // --- Boodschappenlijst: opslaan + near-realtime synchronisatie -------------
  // Meerdere personen kunnen tegelijk in de lijst werken. We pollen de server
  // elke paar seconden en voegen wijzigingen per item samen via een drieweg-
  // vergelijking (basis = laatst bekende serverstand). Zo blijven vinkjes van
  // beide kanten behouden, ook als jullie tegelijk afvinken.
  const eersteBood = useRef(true);
  const boodBasis = useRef<Boodschappen | null>(null); // laatst bekende serverstand
  const boodLokaal = useRef<Boodschappen>({ items: [] }); // actuele lokale stand (voor de poll)

  useEffect(() => { boodLokaal.current = boodschappen; }, [boodschappen]);
  useEffect(() => {
    if (!laden && boodBasis.current === null) boodBasis.current = boodschappen;
  }, [laden, boodschappen]);

  useEffect(() => {
    if (laden) return;
    if (eersteBood.current) { eersteBood.current = false; return; }
    const t = setTimeout(async () => {
      const opgeslagen = await api.saveBoodschappen(boodschappen).catch(() => null);
      if (opgeslagen) boodBasis.current = opgeslagen;
    }, 350);
    return () => clearTimeout(t);
  }, [boodschappen, laden]);

  // Drieweg-merge per item: serverwijzigingen overnemen tenzij hetzelfde veld
  // lokaal óók is gewijzigd (dan wint lokaal; dat wordt zo weer opgeslagen).
  const mergeBoodschappen = (basis: Boodschappen, lokaal: Boodschappen, server: Boodschappen): Boodschappen => {
    const bij = (l: Boodschappen) => new Map(l.items.map((it) => [it.id, it]));
    const B = bij(basis), L = bij(lokaal), S = bij(server);
    const items: BoodschapItem[] = [];
    // 1) lokale items behouden/mergen
    for (const li of lokaal.items) {
      const bi = B.get(li.id);
      const si = S.get(li.id);
      if (!bi) { items.push(li); continue; }           // lokaal nieuw → houden
      if (!si) {
        // op de server verwijderd; alleen volgen als lokaal ongewijzigd
        if (JSON.stringify(li) === JSON.stringify(bi)) continue;
        items.push(li);
        continue;
      }
      // veld-voor-veld: server wint als basis→server veranderde en lokaal niet
      const gemerged: BoodschapItem = { ...li };
      (Object.keys(li) as (keyof BoodschapItem)[]).forEach((veld) => {
        const serverAnders = JSON.stringify(si[veld]) !== JSON.stringify(bi[veld]);
        const lokaalAnders = JSON.stringify(li[veld]) !== JSON.stringify(bi[veld]);
        if (serverAnders && !lokaalAnders) (gemerged as any)[veld] = si[veld];
      });
      items.push(gemerged);
    }
    // 2) items die de ander toevoegde (op server, niet in basis of lokaal)
    for (const si of server.items) {
      if (!B.has(si.id) && !L.has(si.id)) items.push(si);
    }
    return { items };
  };

  // Poll: elke 3,5s de serverstand ophalen (alleen als het tabblad zichtbaar is).
  useEffect(() => {
    if (laden) return;
    const interval = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const server = await api.getBoodschappen().catch(() => null);
      if (!server) return;
      const basis = boodBasis.current || { items: [] };
      const lokaal = boodLokaal.current;
      if (JSON.stringify(server) === JSON.stringify(basis)) return; // niets veranderd bij de ander
      const gemerged = mergeBoodschappen(basis, lokaal, server);
      boodBasis.current = server;
      if (JSON.stringify(gemerged) !== JSON.stringify(lokaal)) {
        setBoodschappen(gemerged);
      }
    }, 3500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laden]);

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
          items.push({ id: uid(), naam: i.naam, hoev: rondLijstAantal(extra, i.eenheid), eenheid: i.eenheid, winkel: i.winkel || GEEN_WINKEL, gebied: i.gebied || GEEN_GEBIED, gedaan: false, bron: "hand" });
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

  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <div style={S.app}>
      <header style={S.header}>
        <ChefHat size={22} style={{ color: "var(--accent)" }} />
        <h1 style={S.appTitle}>Kookboek</h1>
        <div style={S.headerRechts}>
          <button onClick={() => setInfoOpen(true)} style={S.infoKnop} aria-label="Over deze app"><Info size={15} /></button>
          <span style={S.headerSub}>{recepten.length} recepten</span>
        </div>
      </header>

      {infoOpen && <InfoModal onClose={() => setInfoOpen(false)} />}

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

  // Het maaltijd-slot waarin dit recept hoort: een toetje-recept gaat naar het
  // toetje-slot van de gekozen dag, een lunch naar het lunch-slot, enzovoort.
  const doelMaaltijd = (EXTRA_MAALTIJDEN as readonly string[]).includes(recept.maaltijd)
    ? recept.maaltijd
    : HOOFD_MAALTIJD;
  const keyVoor = (dag: string) => slotKey(dag, doelMaaltijd);

  // Voert een plaatsing uit, maar eerst door de wizard als winkel/gebied ontbreekt.
  const metControle = (doe: (r: Recept) => void) => {
    if (mistGegevens(recept)) setWizard({ doel: doe });
    else doe(recept);
  };

  const plaatsOpLegeDag = (dag: string) => {
    metControle((r) => {
      setWeek((p) => ({ ...p, slots: { ...p.slots, [keyVoor(dag)]: { recipeId: r.id, personen: r.personen } } }));
      onClose();
    });
  };
  const kiesDag = (dag: string) => { if (week.slots[keyVoor(dag)]) setConflict(dag); else plaatsOpLegeDag(dag); };

  const vervang = () => {
    if (!conflict) return;
    metControle((r) => {
      setWeek((p) => ({ ...p, slots: { ...p.slots, [keyVoor(conflict)]: { recipeId: r.id, personen: r.personen } } }));
      onClose();
    });
  };
  const verplaatsBestaande = (naarDag: string) => {
    if (!conflict) return;
    metControle((r) => {
      setWeek((p) => {
        const bestaand = p.slots[keyVoor(conflict)];
        const slots = { ...p.slots };
        slots[keyVoor(naarDag)] = bestaand;
        slots[keyVoor(conflict)] = { recipeId: r.id, personen: r.personen };
        return { ...p, slots };
      });
      onClose();
    });
  };

  const legeDagen = dagen.filter((d) => !week.slots[keyVoor(d)]);

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
                <span style={S.label}>Plaats in weekmenu · als {doelMaaltijd.toLowerCase()}</span>
                <h2 style={S.modalTitle}>{recept.titel}</h2>
              </div>
              <button onClick={onClose} style={S.iconBtn} aria-label="Sluiten"><X size={20} /></button>
            </div>
            <p style={S.dialogHint}>Kies een dag. Staat er al een gerecht, dan kun je vervangen of het bestaande verplaatsen.</p>
            {dagen.map((dag) => {
              const slot = week.slots[keyVoor(dag)];
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
                <h2 style={S.modalTitle}>{recepten.find((x) => x.id === week.slots[keyVoor(conflict)]?.recipeId)?.titel}</h2>
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
  const MIN_TIJD = 0;   // linker schuif helemaal links = geen minimum
  const MAX_TIJD = 120; // rechter schuif helemaal rechts = geen maximum
  const [fTijdMin, setFTijdMin] = useState(MIN_TIJD);
  const [fTijd, setFTijd] = useState(MAX_TIJD);
  const [sortering, setSortering] = useState<"naam" | "gegeten" | "score">("naam");
  const [open, setOpen] = useState<Recept | null>(null);
  const [plaats, setPlaats] = useState<Recept | null>(null);
  const [bewerk, setBewerk] = useState<Recept | null>(null);
  const [naarLijst, setNaarLijst] = useState<Recept | null>(null);

  const gefilterd = recepten.filter((r) => {
    if (zoek) {
      const z = zoek.toLowerCase();
      const inTitel = r.titel.toLowerCase().includes(z);
      const inIngredient = r.ingredienten.some((i) => (i.naam || "").toLowerCase().includes(z));
      if (!inTitel && !inIngredient) return false;
    }
    if (fKeuken && r.keuken !== fKeuken) return false;
    if (fHoofd && r.hoofd !== fHoofd) return false;
    if (fMaaltijd && r.maaltijd !== fMaaltijd) return false;
    if (fMoeil && r.moeilijkheid !== fMoeil) return false;
    if (fScore && r.score < fScore) return false;
    if (fTijdMin > MIN_TIJD && (Number(r.tijd) || 0) < fTijdMin) return false;
    if (fTijd < MAX_TIJD && (Number(r.tijd) || 0) > fTijd) return false;
    return true;
  }).sort((a, b) => {
    if (sortering === "gegeten") return (b.gegeten ?? 0) - (a.gegeten ?? 0) || a.titel.localeCompare(b.titel);
    if (sortering === "score") return (b.score ?? 0) - (a.score ?? 0) || a.titel.localeCompare(b.titel);
    return a.titel.localeCompare(b.titel);
  });

  const reset = () => { setFKeuken(""); setFHoofd(""); setFMaaltijd(""); setFMoeil(""); setFScore(0); setFTijdMin(MIN_TIJD); setFTijd(MAX_TIJD); setZoek(""); };
  const anyFilter = fKeuken || fHoofd || fMaaltijd || fMoeil || fScore || fTijdMin > MIN_TIJD || fTijd < MAX_TIJD || zoek;
  const huidig = open ? recepten.find((r) => r.id === open.id) || open : null;

  return (
    <div>
      <div style={S.searchWrap}>
        <Search size={18} style={{ color: "var(--sub)" }} />
        <input style={S.searchInput} placeholder="Zoek op naam of ingrediënt..." value={zoek} onChange={(e) => setZoek(e.target.value)} />
      </div>

      <div style={S.filterRow}><Chips opts={MAALTIJDEN} val={fMaaltijd} set={setFMaaltijd} /></div>
      <div style={S.filterRow}><Chips opts={KEUKENS} val={fKeuken} set={setFKeuken} /></div>
      <div style={S.filterRow}><Chips opts={HOOFDINGREDIENTEN} val={fHoofd} set={setFHoofd} /></div>
      <div style={S.filterRow}>
        <Chips opts={MOEILIJKHEDEN} val={fMoeil} set={setFMoeil} />
        <div style={{ flex: 1 }} />
        <ScoreFilter val={fScore} set={setFScore} />
      </div>

      <div style={S.tijdRij}>
        <span style={S.tijdLabel}><Clock size={13} /> Bereidingstijd</span>
        <div className="dubbelSlider" style={S.tijdDubbel}>
          <div style={S.tijdSpoor} />
          <div style={{
            ...S.tijdVulling,
            left: `${(fTijdMin / MAX_TIJD) * 100}%`,
            width: `${((fTijd - fTijdMin) / MAX_TIJD) * 100}%`,
          }} />
          <input
            type="range" min={MIN_TIJD} max={MAX_TIJD} step={5} value={fTijdMin}
            onChange={(e) => setFTijdMin(Math.min(Number(e.target.value), fTijd - 5))}
            aria-label="Minimale bereidingstijd"
          />
          <input
            type="range" min={MIN_TIJD} max={MAX_TIJD} step={5} value={fTijd}
            onChange={(e) => setFTijd(Math.max(Number(e.target.value), fTijdMin + 5))}
            aria-label="Maximale bereidingstijd"
          />
        </div>
        <span style={S.tijdWaarde}>
          {fTijdMin <= MIN_TIJD && fTijd >= MAX_TIJD ? "alle"
            : fTijdMin <= MIN_TIJD ? `≤ ${fTijd} min`
            : fTijd >= MAX_TIJD ? `≥ ${fTijdMin} min`
            : `${fTijdMin}–${fTijd} min`}
        </span>
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
  const [modus, setModus] = useState("link");
  return (
    <div>
      <div style={S.segWrap}>
        <SegBtn active={modus === "link"} onClick={() => setModus("link")} icon={Link2} label="Link" />
        <SegBtn active={modus === "foto"} onClick={() => setModus("foto")} icon={Camera} label="Foto" />
        <SegBtn active={modus === "hand"} onClick={() => setModus("hand")} icon={PencilLine} label="Handmatig" />
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
  const [fotos, setFotos] = useState<string[]>([]); // data-URLs, al gecomprimeerd
  const [toevoegBezig, setToevoegBezig] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Voeg één of meer foto's toe. We comprimeren direct (max 1400px) zodat het
  // totaal binnen de uploadlimiet blijft maar kleine tekst leesbaar blijft.
  const voegFotos = async (files: FileList) => {
    setErr(""); setToevoegBezig(true);
    try {
      const nieuwe: string[] = [];
      for (const file of Array.from(files)) {
        const raw = await fileNaarDataUrl(file);
        nieuwe.push(await comprimeerAfbeelding(raw, 0.8, 1400));
      }
      setFotos((p) => [...p, ...nieuwe]);
    } catch {
      setErr("Kon een foto niet verwerken.");
    } finally {
      setToevoegBezig(false);
      if (fileRef.current) fileRef.current.value = ""; // zelfde bestand opnieuw kunnen kiezen
    }
  };

  const verwijderFoto = (idx: number) => setFotos((p) => p.filter((_, i) => i !== idx));

  const verwerk = async () => {
    if (!fotos.length) return;
    setErr(""); setBusy(true); setParsed(null);
    try {
      const res = await api.importRecept({
        type: "foto",
        fotos: fotos.map((f) => ({ mediaType: "image/jpeg", data: f.split(",")[1] })),
      });
      const recept = normaliseer(res.recept || res);
      // De eerste foto wordt de receptafbeelding (kleiner opgeslagen).
      recept.afbeelding = await comprimeerAfbeelding(fotos[0]).catch(() => "");
      setParsed(recept);
    } catch (e: any) { setErr(e.message || "Kon het recept niet uitlezen."); }
    finally { setBusy(false); }
  };

  if (parsed) return <BevestigImport parsed={parsed} onAdd={onAdd} onCancel={() => setParsed(null)} />;

  return (
    <div style={S.importBox}>
      <Camera size={36} style={{ color: "var(--accent)" }} />
      <p style={S.importText}>
        Maak of kies foto's van een recept uit een magazine of kookboek. Staat het recept op meerdere pagina's? Voeg dan alle pagina's toe voordat je het laat uitlezen.
      </p>
      <input
        ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }}
        onChange={(e) => e.target.files?.length && voegFotos(e.target.files)}
      />

      {fotos.length > 0 && (
        <div style={S.fotoStrip}>
          {fotos.map((f, idx) => (
            <div key={idx} style={S.fotoStripItem}>
              <img src={f} alt={`Pagina ${idx + 1}`} style={S.fotoStripImg} />
              <span style={S.fotoStripNr}>{idx + 1}</span>
              <button onClick={() => verwijderFoto(idx)} style={S.fotoStripDel} aria-label="Verwijder foto"><X size={13} /></button>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => fileRef.current?.click()} style={fotos.length ? S.secondaryBtn : S.primaryBtn} disabled={busy || toevoegBezig}>
        {toevoegBezig
          ? <><Loader2 size={16} className="spin" /> Foto verwerken...</>
          : <><Camera size={16} /> {fotos.length ? "Nog een foto toevoegen" : "Foto's kiezen"}</>}
      </button>

      {fotos.length > 0 && (
        <button onClick={verwerk} style={S.primaryBtn} disabled={busy || toevoegBezig}>
          {busy
            ? <><Loader2 size={16} className="spin" /> Bezig met uitlezen...</>
            : <><Check size={16} /> Recept uitlezen ({fotos.length} {fotos.length === 1 ? "foto" : "foto's"})</>}
        </button>
      )}

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
  // zoeken op gerechtnaam
  const [zoekTerm, setZoekTerm] = useState("");
  const [zoekBezig, setZoekBezig] = useState(false);
  const [opties, setOpties] = useState<{ titel: string; url: string; bron: string; omschrijving: string }[] | null>(null);
  const [ophalenUrl, setOphalenUrl] = useState<string | null>(null); // welke optie wordt nu opgehaald

  const verwerk = async (doelUrl: string) => {
    if (!doelUrl.trim()) return;
    setErr(""); setBusy(true); setParsed(null); setAfbKeuze(null); setOphalenUrl(doelUrl);
    try {
      const res = await api.importRecept({ type: "link", url: doelUrl });
      const recept = normaliseer(res.recept || res);
      setParsed(recept);
      if (Array.isArray(res.afbeeldingen) && res.afbeeldingen.length) setAfbKeuze(res.afbeeldingen);
    } catch (e: any) { setErr(e.message || "Kon de pagina niet uitlezen."); }
    finally { setBusy(false); setOphalenUrl(null); }
  };

  const zoek = async () => {
    if (!zoekTerm.trim()) return;
    setErr(""); setZoekBezig(true); setOpties(null);
    try {
      const res = await api.importRecept({ type: "zoek", query: zoekTerm });
      if (Array.isArray(res.opties) && res.opties.length) setOpties(res.opties);
      else setErr("Geen recepten gevonden. Probeer een andere zoekterm.");
    } catch (e: any) { setErr(e.message || "Zoeken mislukt."); }
    finally { setZoekBezig(false); }
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
      <Search size={36} style={{ color: "var(--accent)" }} />
      <p style={S.importText}>Zoek een recept op naam, of plak zelf een link naar een receptpagina.</p>

      {/* Zoeken op gerechtnaam */}
      <div style={S.zoekLinkRij}>
        <input
          style={{ ...S.input, flex: 1 }} placeholder="bijv. shakshuka of lasagne"
          value={zoekTerm} onChange={(e) => setZoekTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && zoek()}
        />
        <button onClick={zoek} disabled={zoekBezig || !zoekTerm.trim()} style={S.zoekLinkBtn}>
          {zoekBezig ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
        </button>
      </div>
      {zoekBezig && <p style={S.zoekBezigTekst}>Recepten zoeken op internet…</p>}

      {/* Zoekresultaten als keuzekaartjes */}
      {opties && (
        <div style={S.zoekOpties}>
          {opties.map((o) => (
            <button key={o.url} onClick={() => verwerk(o.url)} disabled={busy} style={S.zoekOptie}>
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <div style={S.zoekOptieTitel}>{o.titel}</div>
                {o.omschrijving && <div style={S.zoekOptieOms}>{o.omschrijving}</div>}
                <div style={S.zoekOptieBron}>{o.bron || (() => { try { return new URL(o.url).hostname; } catch { return ""; } })()}</div>
              </div>
              {ophalenUrl === o.url
                ? <Loader2 size={18} className="spin" style={{ color: "var(--accent)", flexShrink: 0 }} />
                : <ChevronRight size={18} style={{ color: "var(--sub)", flexShrink: 0 }} />}
            </button>
          ))}
        </div>
      )}

      <div style={S.zoekOf}><span style={S.zoekOfLijn} />of<span style={S.zoekOfLijn} /></div>

      {/* Zelf een link plakken */}
      <input style={{ ...S.input, width: "100%" }} placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
      <button onClick={() => verwerk(url)} style={S.primaryBtn} disabled={busy || !url.trim()}>
        {busy && ophalenUrl === url ? <><Loader2 size={16} className="spin" /> Bezig...</> : <><Link2 size={16} /> Recept ophalen</>}
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

  // Zet automatisch de eerste (beste) site-afbeelding op het recept zodra het
  // bevestigingsscherm opent, zodat er standaard een afbeelding meekomt. De
  // gebruiker kan via de strip alsnog een andere kiezen of hem verwijderen.
  const autoGedaan = useRef(false);
  useEffect(() => {
    if (autoGedaan.current) return;
    if (!parsed.afbeelding && afbKeuze && afbKeuze.length > 0) {
      autoGedaan.current = true;
      kiesAfb(afbKeuze[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kruiden-controle: staan er standaard smaakmakers (zout, peper) in het
  // geïmporteerde recept, vraag dan of ze mee moeten. Weglaten voorkomt dat ze
  // straks op de boodschappenlijst belanden.
  const kruiden = (recept.ingredienten || []).filter((i) => isStandaardKruid(i.naam));
  const [kruidenBeantwoord, setKruidenBeantwoord] = useState(false);

  const laatKruidenWeg = () => {
    setRecept((p) => ({ ...p, ingredienten: (p.ingredienten || []).filter((i) => !isStandaardKruid(i.naam)) }));
    setFormKey((k) => k + 1);
    setKruidenBeantwoord(true);
  };

  return (
    <div>
      <div style={S.infoBar}><Check size={15} /> Recept uitgelezen. Controleer en pas aan.<button onClick={onCancel} style={S.linkBtn}>Opnieuw</button></div>

      {!kruidenBeantwoord && kruiden.length > 0 && (
        <div style={S.kruidenVraag}>
          <p style={S.kruidenVraagTekst}>
            Dit recept bevat standaard kruiden: <strong>{kruiden.map((k) => k.naam).join(", ")}</strong>. Meenemen in het recept (en dus straks op de boodschappenlijst)?
          </p>
          <div style={S.kruidenVraagKnoppen}>
            <button onClick={laatKruidenWeg} style={S.kruidenWegBtn}>Weglaten</button>
            <button onClick={() => setKruidenBeantwoord(true)} style={S.kruidenMeeBtn}><Check size={14} /> Meenemen</button>
          </div>
        </div>
      )}

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
  const [kook, setKook] = useState<{ recept: Recept; personen: number } | null>(null);
  // Wizard die ontbrekende winkel/gebied opvraagt voordat een gerecht geplaatst wordt.
  const [wizard, setWizard] = useState<{ recept: Recept; slot: string } | null>(null);
  // Evaluatie bij leegmaken: per uniek gerecht score vragen en gegeten ophogen.
  const [evaluatie, setEvaluatie] = useState<{ recept: Recept; keren: number }[] | null>(null);
  // Voor welke dag het "maaltijd toevoegen"-menu open staat.
  const [plusDag, setPlusDag] = useState<string | null>(null);

  const plaatsOpSlot = (key: string, recept: Recept) => {
    setWeek((p) => ({ ...p, slots: { ...p.slots, [key]: { recipeId: recept.id, personen: recept.personen || 4 } } }));
  };

  const setStartDag = (d: number) => setWeek((p) => ({ ...p, startDag: ((d % 7) + 7) % 7 }));
  const setSlot = (key: string, recipeId: string) => {
    const r = recepten.find((x) => x.id === recipeId);
    if (!r) return;
    setKiesDag(null);
    // Controleer of alle ingrediënten een winkel én gebied hebben.
    if (mistGegevens(r)) {
      setWizard({ recept: r, slot: key });
    } else {
      plaatsOpSlot(key, r);
    }
  };
  const wisSlot = (key: string) => setWeek((p) => { const slots = { ...p.slots }; delete slots[key]; return { ...p, slots }; });
  const setPers = (key: string, d: number) => setWeek((p) => ({ ...p, slots: { ...p.slots, [key]: { ...p.slots[key], personen: Math.max(1, p.slots[key].personen + d) } } }));

  // Leegmaken start de evaluatie: per uniek gerecht (met het aantal keren dat
  // het gepland stond, alle maaltijden meegeteld) score vragen en gegeten
  // ophogen. Daarna pas echt legen.
  const startLeegmaken = () => {
    const telling = new Map<string, number>();
    Object.values(week.slots).forEach((slot) => {
      if (slot?.recipeId) telling.set(slot.recipeId, (telling.get(slot.recipeId) || 0) + 1);
    });
    const lijst = [...telling.entries()]
      .map(([id, keren]) => ({ recept: recepten.find((r) => r.id === id), keren }))
      .filter((x): x is { recept: Recept; keren: number } => !!x.recept);
    if (lijst.length === 0) {
      setWeek((p) => ({ ...p, slots: {} }));
      return;
    }
    setEvaluatie(lijst);
  };

  const leegmaken = () => { setWeek((p) => ({ ...p, slots: {} })); setEvaluatie(null); };

  // Verplaatsen wisselt de avondeten-slots van twee dagen om.
  const verplaatsNaar = (doelDag: string) => {
    if (!verplaatsVan || verplaatsVan === doelDag) { setVerplaatsVan(null); return; }
    setWeek((p) => {
      const slots = { ...p.slots };
      const bronKey = slotKey(verplaatsVan, HOOFD_MAALTIJD);
      const doelKey = slotKey(doelDag, HOOFD_MAALTIJD);
      const bron = slots[bronKey];
      const doel = slots[doelKey];
      slots[doelKey] = bron;
      if (doel) slots[bronKey] = doel; else delete slots[bronKey];
      return { ...p, slots };
    });
    setVerplaatsVan(null);
  };

  const aantalGepland = Object.keys(week.slots).length;

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
          <button onClick={startLeegmaken} style={S.leegBtn}><Trash2 size={14} /> Leegmaken</button>
        )}
      </div>

      {verplaatsVan && (
        <div style={S.infoBar}>
          <ArrowRightLeft size={15} /> Kies de dag waar "{recepten.find((x) => x.id === week.slots[slotKey(verplaatsVan, HOOFD_MAALTIJD)]?.recipeId)?.titel}" naartoe moet.
          <button onClick={() => setVerplaatsVan(null)} style={S.linkBtn}>Annuleer</button>
        </div>
      )}

      {dagen.map((dag) => {
        const hoofdKey = slotKey(dag, HOOFD_MAALTIJD);
        const slot = week.slots[hoofdKey];
        const r = slot && recepten.find((x) => x.id === slot.recipeId);
        const isBron = verplaatsVan === dag;
        const extras = EXTRA_MAALTIJDEN
          .map((m) => ({ maaltijd: m, key: slotKey(dag, m), slot: week.slots[slotKey(dag, m)] }))
          .filter((e) => e.slot);
        const nogToeTeVoegen = EXTRA_MAALTIJDEN.filter((m) => !week.slots[slotKey(dag, m)]);
        return (
          <div key={dag} style={S.weekBlok}>
            <div style={S.weekRow}>
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
                        {r.afbeelding
                          ? <img src={r.afbeelding} alt="" style={S.weekThumb} />
                          : <span style={S.weekThumbLeeg}><ChefHat size={18} /></span>}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={S.weekRecept}>{r.titel}</div>
                          <div style={S.weekMeta}>{r.keuken} · {r.tijd}m · tik om te koken</div>
                        </div>
                      </button>
                      <div style={S.weekActies}>
                        <div style={S.persWrap}>
                          <button onClick={() => setPers(hoofdKey, -1)} style={S.persBtn} aria-label="Minder"><Minus size={13} /></button>
                          <span style={S.persNum}>{slot.personen}p</span>
                          <button onClick={() => setPers(hoofdKey, 1)} style={S.persBtn} aria-label="Meer"><Plus size={13} /></button>
                        </div>
                        <button onClick={() => setVerplaatsVan(isBron ? null : dag)} style={S.iconBtnSm} aria-label="Verplaats"><ArrowRightLeft size={15} /></button>
                        <button onClick={() => wisSlot(hoofdKey)} style={S.iconBtnSm} aria-label="Wis"><X size={15} /></button>
                      </div>
                    </>
                  )}
                </div>
              ) : verplaatsVan ? (
                <button onClick={() => verplaatsNaar(dag)} style={S.weekSlotDoel}><ArrowDown size={15} /> Hierheen verplaatsen</button>
              ) : (
                <button onClick={() => setKiesDag(hoofdKey)} style={S.weekSlotLeeg}><Plus size={15} /> Kies gerecht</button>
              )}
            </div>

            {/* Extra maaltijden (ontbijt / lunch / toetje) van deze dag */}
            {extras.map(({ maaltijd, key, slot: es }) => {
              const er = recepten.find((x) => x.id === es!.recipeId);
              if (!er) return null;
              return (
                <div key={key} style={S.weekExtraRow}>
                  <span style={S.weekMaaltijdTag}>{maaltijd}</span>
                  <button onClick={() => setKook({ recept: er, personen: es!.personen })} style={S.weekSlotOpen}>
                    {er.afbeelding
                      ? <img src={er.afbeelding} alt="" style={S.weekThumbKlein} />
                      : <span style={{ ...S.weekThumbLeeg, ...S.weekThumbKleinMaat }}><ChefHat size={14} /></span>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.weekExtraTitel}>{er.titel}</div>
                    </div>
                  </button>
                  <div style={S.weekActies}>
                    <div style={S.persWrap}>
                      <button onClick={() => setPers(key, -1)} style={S.persBtn} aria-label="Minder"><Minus size={13} /></button>
                      <span style={S.persNum}>{es!.personen}p</span>
                      <button onClick={() => setPers(key, 1)} style={S.persBtn} aria-label="Meer"><Plus size={13} /></button>
                    </div>
                    <button onClick={() => wisSlot(key)} style={S.iconBtnSm} aria-label="Wis"><X size={15} /></button>
                  </div>
                </div>
              );
            })}

            {/* Maaltijd toevoegen aan deze dag */}
            {!verplaatsVan && nogToeTeVoegen.length > 0 && (
              plusDag === dag ? (
                <div style={S.weekPlusChips}>
                  {nogToeTeVoegen.map((m) => (
                    <button key={m} onClick={() => { setPlusDag(null); setKiesDag(slotKey(dag, m)); }} style={S.weekPlusChip}>
                      <Plus size={12} /> {m}
                    </button>
                  ))}
                  <button onClick={() => setPlusDag(null)} style={S.weekPlusSluit} aria-label="Sluiten"><X size={13} /></button>
                </div>
              ) : (
                <button onClick={() => setPlusDag(dag)} style={S.weekPlusOpen}>
                  <Plus size={12} /> ontbijt, lunch of toetje
                </button>
              )
            )}
          </div>
        );
      })}

      {kiesDag && (
        <KiesGerechtModal
          dag={kiesDag.replace("|", " · ")} recepten={recepten}
          onKies={(id) => setSlot(kiesDag, id)}
          onClose={() => setKiesDag(null)}
        />
      )}

      {evaluatie && (
        <EvaluatieWizard
          gerechten={evaluatie}
          onUpdateRecept={onUpdateRecept}
          onKlaar={leegmaken}
          onAnnuleer={() => setEvaluatie(null)}
        />
      )}

      {kook && (
        <KookWeergave recept={kook.recept} personen={kook.personen} onClose={() => setKook(null)} />
      )}

      {wizard && (
        <IngredientenWizard
          recept={wizard.recept}
          onUpdateRecept={onUpdateRecept}
          onKlaar={(bijgewerkt) => { plaatsOpSlot(wizard.slot, bijgewerkt); setWizard(null); }}
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
// EVALUATIEWIZARD — bij het leegmaken van het weekmenu: per gerecht een score
// vragen (oude score zichtbaar) en het aantal keer gegeten ophogen.
// ============================================================================
function EvaluatieWizard({
  gerechten, onUpdateRecept, onKlaar, onAnnuleer,
}: {
  gerechten: { recept: Recept; keren: number }[];
  onUpdateRecept: (id: string, patch: Partial<Recept>) => Promise<void>;
  onKlaar: () => void;
  onAnnuleer: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [opslaan, setOpslaan] = useState(false);

  const huidig = gerechten[idx];
  const gekozenScore = huidig ? (scores[huidig.recept.id] ?? huidig.recept.score ?? 0) : 0;

  const volgende = async () => {
    if (idx + 1 < gerechten.length) {
      setIdx(idx + 1);
      return;
    }
    // Laatste gerecht beoordeeld: alle updates opslaan (score + gegeten), dan legen.
    setOpslaan(true);
    try {
      for (const g of gerechten) {
        const nieuweScore = scores[g.recept.id] ?? g.recept.score ?? 0;
        await onUpdateRecept(g.recept.id, {
          score: nieuweScore,
          gegeten: (g.recept.gegeten ?? 0) + g.keren,
        });
      }
      onKlaar();
    } finally {
      setOpslaan(false);
    }
  };

  if (!huidig) { onKlaar(); return null; }
  const r = huidig.recept;

  return (
    <div style={S.modalBg}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <div>
            <span style={S.label}>Gerecht {idx + 1} van {gerechten.length} · beoordelen</span>
            <h2 style={S.modalTitle}>{r.titel}</h2>
          </div>
          <button onClick={onAnnuleer} style={S.iconBtn} aria-label="Annuleren"><X size={20} /></button>
        </div>

        {r.afbeelding && (
          <div style={S.detailAfbWrap}><img src={r.afbeelding} alt={r.titel} style={S.detailAfb} /></div>
        )}

        <div style={S.evalScoreBlok}>
          <div style={S.evalHuidig}>
            Huidige score: {r.score > 0 ? `${r.score} van 5` : "nog geen"}
          </div>
          <span style={S.label}>Jouw score na deze week</span>
          <div style={{ marginTop: 6 }}>
            <Sterren n={gekozenScore} onSet={(s) => setScores((p) => ({ ...p, [r.id]: s }))} />
          </div>
        </div>

        <div style={S.evalGegeten}>
          <Utensils size={15} style={{ color: "var(--green)", flexShrink: 0 }} />
          <span>Keer gegeten gaat van <strong>{r.gegeten ?? 0}</strong> naar <strong>{(r.gegeten ?? 0) + huidig.keren}</strong>{huidig.keren > 1 ? ` (${huidig.keren} dagen gepland)` : ""}</span>
        </div>

        <button onClick={volgende} style={S.primaryBtn} disabled={opslaan}>
          {opslaan
            ? <><Loader2 size={16} className="spin" /> Opslaan...</>
            : idx + 1 < gerechten.length
              ? <>Volgende gerecht <ChevronRight size={16} /></>
              : <><Check size={16} /> Afronden en weekmenu legen</>}
        </button>
        <button onClick={onAnnuleer} style={S.opschoonStop} disabled={opslaan}>Annuleren (weekmenu blijft staan)</button>
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
  const gefilterd = recepten.filter((r) => {
    if (!zoek) return true;
    const z = zoek.toLowerCase();
    return r.titel.toLowerCase().includes(z) || r.ingredienten.some((i) => (i.naam || "").toLowerCase().includes(z));
  });
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
              <input style={S.searchInput} placeholder="Zoek op naam of ingrediënt..." value={zoek} onChange={(e) => setZoek(e.target.value)} autoFocus />
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
  const [opschonenBezig, setOpschonenBezig] = useState(false);
  const [opschoonData, setOpschoonData] = useState<null | {
    samenvoegingen: { ids: string[]; zeker: boolean; naamKeuzes: string[]; voorstelNaam: string; eenheid: string }[];
    verpakkingen: { id: string; zeker: boolean; huidig: string; voorstel: string }[];
  }>(null);
  const [opschoonMelding, setOpschoonMelding] = useState("");

  const genereerUitWeek = (): BoodschapItem[] => {
    const acc: Record<string, { naam: string; eenheid: string; hoev: number; winkel: string; gebied: string }> = {};
    // Alle geplande maaltijden meenemen: avondeten én eventuele ontbijt/lunch/toetjes.
    Object.values(week.slots).forEach((slot) => {
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
      id: uid(), naam: v.naam, hoev: rondLijstAantal(v.hoev, v.eenheid), eenheid: v.eenheid,
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

  // Voert één samenvoeging uit: de betrokken items worden vervangen door één item.
  // Aantallen worden opgeteld als de eenheden gelijk zijn; anders wordt de
  // hoeveelheid gelaten op de som van gelijk-benoemde eenheden (beste inschatting).
  const pasSamenvoegingToe = (ids: string[], gekozenNaam: string, eenheid: string) => {
    setBoodschappen((p) => {
      const betrokken = p.items.filter((it) => ids.includes(it.id));
      if (betrokken.length < 2) return p;
      // hoeveelheid: tel op binnen gelijke eenheid; kies de eenheid die het meest voorkomt
      const somGelijk = betrokken
        .filter((it) => (it.eenheid || "").toLowerCase() === (eenheid || "").toLowerCase())
        .reduce((s, it) => s + (Number(it.hoev) || 0), 0);
      const totaal = somGelijk > 0 ? somGelijk : betrokken.reduce((s, it) => s + (Number(it.hoev) || 0), 0);
      // winkel/gebied/gedaan: neem van het eerste betrokken item dat ze gezet heeft
      const eerste = betrokken.find((it) => it.winkel) || betrokken[0];
      const eersteGebied = betrokken.find((it) => it.gebied) || betrokken[0];
      const nieuw: BoodschapItem = {
        id: uid(), naam: gekozenNaam, hoev: rondLijstAantal(totaal, eenheid), eenheid,
        winkel: eerste.winkel || GEEN_WINKEL, gebied: eersteGebied.gebied || GEEN_GEBIED,
        gedaan: betrokken.every((it) => it.gedaan), bron: "week",
      };
      // vervang: verwijder betrokken, zet het nieuwe item op de plek van het eerste
      const eersteIdx = p.items.findIndex((it) => ids.includes(it.id));
      const rest = p.items.filter((it) => !ids.includes(it.id));
      rest.splice(eersteIdx, 0, nieuw);
      return { items: rest };
    });
  };

  // Past een verpakkingsvoorstel toe: het item krijgt de voorgestelde naam,
  // hoeveelheid 1 en geen aparte eenheid (de eenheid zit in de tekst).
  const pasVerpakkingToe = (id: string, voorstel: string) => {
    setBoodschappen((p) => ({
      items: p.items.map((it) => (it.id === id ? { ...it, naam: voorstel, hoev: 1, eenheid: "" } : it)),
    }));
  };

  // Start het opschonen: vraag de AI om suggesties, pas de zekere direct toe en
  // toon de twijfelgevallen in een controle-popup.
  const startOpschonen = async () => {
    setOpschonenBezig(true);
    setOpschoonMelding("");
    try {
      const invoer = boodschappen.items.map((it) => ({ id: it.id, naam: it.naam, hoev: it.hoev, eenheid: it.eenheid }));
      const res = await api.lijstOpschonen(invoer);
      if ((res as any).geenKey) {
        setOpschoonMelding("Opschonen met AI vereist een ANTHROPIC_API_KEY. Voeg die toe om deze functie te gebruiken.");
        setOpschonenBezig(false);
        return;
      }
      // zekere samenvoegingen direct toepassen
      const zekereSam = res.samenvoegingen.filter((s) => s.zeker);
      const onzekereSam = res.samenvoegingen.filter((s) => !s.zeker);
      zekereSam.forEach((s) => pasSamenvoegingToe(s.ids, s.voorstelNaam || s.naamKeuzes[0] || "", s.eenheid));
      // zekere verpakkingen direct toepassen
      const zekereVerp = res.verpakkingen.filter((v) => v.zeker);
      const onzekereVerp = res.verpakkingen.filter((v) => !v.zeker);
      zekereVerp.forEach((v) => pasVerpakkingToe(v.id, v.voorstel));

      const aantalAuto = zekereSam.length + zekereVerp.length;
      if (onzekereSam.length || onzekereVerp.length) {
        setOpschoonData({ samenvoegingen: onzekereSam, verpakkingen: onzekereVerp });
      } else if (aantalAuto > 0) {
        setOpschoonMelding(`${aantalAuto} ${aantalAuto === 1 ? "aanpassing" : "aanpassingen"} automatisch toegepast.`);
      } else {
        setOpschoonMelding("Niets om op te schonen — de lijst ziet er netjes uit.");
      }
    } catch (e: any) {
      setOpschoonMelding("Opschonen mislukt: " + (e?.message || "onbekende fout") + ". Probeer het opnieuw.");
    } finally {
      setOpschonenBezig(false);
    }
  };

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
        <div style={S.boodOnderBalk}>
          <button onClick={startOpschonen} disabled={opschonenBezig} style={S.opschoonBtn}>
            {opschonenBezig ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
            {opschonenBezig ? "Bezig met opschonen…" : "Lijst opschonen"}
          </button>
          <button onClick={() => setBevestigWisAlles(true)} style={S.wisAllesBtn}>
            <Trash2 size={14} /> Hele lijst leegmaken
          </button>
        </div>
      )}
      {opschoonMelding && <div style={S.opschoonMelding}>{opschoonMelding}</div>}

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

      {opschoonData && (
        <OpschoonWizard
          data={opschoonData}
          items={boodschappen.items}
          onSamenvoeg={pasSamenvoegingToe}
          onVerpakking={pasVerpakkingToe}
          onKlaar={(n) => { setOpschoonData(null); if (n > 0) setOpschoonMelding(`${n} ${n === 1 ? "aanpassing" : "aanpassingen"} toegepast.`); }}
        />
      )}
    </div>
  );
}

// ============================================================================
// OPSCHOON-WIZARD — loopt de twijfelgevallen langs: per samenvoeging kiezen of
// (en onder welke naam) samengevoegd wordt; per verpakking het voorstel accepteren.
// ============================================================================
function OpschoonWizard({
  data, items, onSamenvoeg, onVerpakking, onKlaar,
}: {
  data: {
    samenvoegingen: { ids: string[]; zeker: boolean; naamKeuzes: string[]; voorstelNaam: string; eenheid: string }[];
    verpakkingen: { id: string; zeker: boolean; huidig: string; voorstel: string }[];
  };
  items: BoodschapItem[];
  onSamenvoeg: (ids: string[], naam: string, eenheid: string) => void;
  onVerpakking: (id: string, voorstel: string) => void;
  onKlaar: (aantalToegepast: number) => void;
}) {
  // Alle stappen na elkaar: eerst samenvoegingen, dan verpakkingen.
  const stappen = useMemo(() => [
    ...data.samenvoegingen.map((s) => ({ type: "samen" as const, s })),
    ...data.verpakkingen.map((v) => ({ type: "verp" as const, v })),
  ], [data]);

  const [idx, setIdx] = useState(0);
  const [toegepast, setToegepast] = useState(0);
  // gekozen naam per samenvoeg-stap (default: voorstel of eerste keuze)
  const huidig = stappen[idx];
  const [naamKeuze, setNaamKeuze] = useState("");

  // reset naamkeuze bij nieuwe stap
  useEffect(() => {
    if (huidig?.type === "samen") {
      setNaamKeuze(huidig.s.voorstelNaam || huidig.s.naamKeuzes[0] || "");
    }
  }, [idx, huidig]);

  const naar = (verhoogToegepast: boolean) => {
    if (verhoogToegepast) setToegepast((n) => n + 1);
    if (idx + 1 < stappen.length) setIdx(idx + 1);
    else onKlaar(toegepast + (verhoogToegepast ? 1 : 0));
  };

  if (!huidig) { onKlaar(toegepast); return null; }

  return (
    <div style={S.modalBg}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <div>
            <span style={S.label}>Controle {idx + 1} van {stappen.length}</span>
            <h2 style={S.modalTitle}>{huidig.type === "samen" ? "Samenvoegen?" : "Volle verpakking?"}</h2>
          </div>
        </div>

        {huidig.type === "samen" ? (
          <>
            <p style={S.opschoonUitleg}>Deze artikelen lijken hetzelfde product. Wil je ze samenvoegen tot één regel?</p>
            <ul style={S.opschoonLijst}>
              {huidig.s.ids.map((id) => {
                const it = items.find((x) => x.id === id);
                if (!it) return null;
                return <li key={id} style={S.opschoonLi}><span>{it.naam}</span><span style={S.ingAmt}>{it.hoev} {it.eenheid}</span></li>;
              })}
            </ul>
            <span style={S.label}>Naam op de lijst</span>
            <div style={S.opschoonKeuzes}>
              {[...new Set([huidig.s.voorstelNaam, ...huidig.s.naamKeuzes].filter(Boolean))].map((naam) => (
                <button key={naam} onClick={() => setNaamKeuze(naam)}
                  style={{ ...S.opschoonNaamBtn, ...(naamKeuze === naam ? S.opschoonNaamBtnOn : {}) }}>
                  {naam}
                </button>
              ))}
            </div>
            <div style={S.opschoonAkties}>
              <button onClick={() => naar(false)} style={S.secondaryBtn}>Niet samenvoegen</button>
              <button onClick={() => { onSamenvoeg(huidig.s.ids, naamKeuze, huidig.s.eenheid); naar(true); }} style={S.primaryBtn}>
                <Check size={16} /> Samenvoegen
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={S.opschoonUitleg}>Dit artikel staat in een receptmaat. In de winkel koop je meestal een volle verpakking.</p>
            <div style={S.opschoonVerpRij}>
              <span style={S.opschoonVerpHuidig}>{huidig.v.huidig}</span>
              <ArrowRightLeft size={16} style={{ color: "var(--sub)", flexShrink: 0 }} />
              <span style={S.opschoonVerpVoorstel}>{huidig.v.voorstel}</span>
            </div>
            <div style={S.opschoonAkties}>
              <button onClick={() => naar(false)} style={S.secondaryBtn}>Laat staan</button>
              <button onClick={() => { onVerpakking(huidig.v.id, huidig.v.voorstel); naar(true); }} style={S.primaryBtn}>
                <Check size={16} /> Gebruik verpakking
              </button>
            </div>
          </>
        )}

        <button onClick={() => onKlaar(toegepast)} style={S.opschoonStop}>Stoppen</button>
      </div>
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

// ============================================================================
// INFO — uitgebreide beschrijving van de app, bereikbaar via de header
// ============================================================================
function InfoModal({ onClose }: { onClose: () => void }) {
  const Sectie = ({ titel, children }: { titel: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 18 }}>
      <h3 style={S.infoSectieKop}>{titel}</h3>
      <div style={S.infoTekst}>{children}</div>
    </div>
  );

  return (
    <div style={S.modalBg} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <div>
            <span style={S.label}>Over deze app</span>
            <h2 style={S.modalTitle}>Kookboek</h2>
          </div>
          <button onClick={onClose} style={S.iconBtn} aria-label="Sluiten"><X size={20} /></button>
        </div>

        <p style={S.infoIntro}>
          Kookboek is jullie eigen receptendatabase, weekplanner en slimme boodschappenlijst in één.
          Alles staat centraal opgeslagen in de cloud: iedereen die de app gebruikt kijkt naar dezelfde
          recepten, hetzelfde weekmenu en dezelfde lijst — op telefoon, tablet en computer.
        </p>

        <Sectie titel="Recepten">
          Alle recepten op één plek, met foto, keuken, hoofdingrediënt, maaltijdtype (ontbijt, lunch,
          avondeten of toetje), moeilijkheid, bereidingstijd, jouw score en hoe vaak het gerecht al
          gegeten is. Filter op elk kenmerk of op minimale score, sorteer op naam, score of vaakst
          gegeten, en zoek op titel. Tik een kaart aan voor het volledige recept; daar pas je de score
          aan, hoog je de gegeten-teller op, bewerk je het recept (potlood) of zet je het direct in het
          weekmenu of op de lijst. Tik op een foto om schermvullend in te zoomen.
        </Sectie>

        <Sectie titel="Toevoegen">
          Drie manieren om een recept toe te voegen. <strong>Link</strong>: zoek een gerecht op naam
          (de app zoekt receptsites op internet en toont keuzeopties) of plak zelf een link — het
          recept wordt automatisch uitgelezen, inclusief een foto van de site. <strong>Foto</strong>:
          fotografeer een recept uit een tijdschrift of kookboek; staat het op meerdere pagina's, voeg
          dan alle pagina's toe voordat je laat uitlezen. <strong>Handmatig</strong>: alles zelf
          invoeren, inclusief winkel en afdeling per ingrediënt. Na elke import volgt een
          controlescherm; bevat het recept standaard kruiden zoals zout en peper, dan vraagt de app of
          je die wilt meenemen of weglaten.
        </Sectie>

        <Sectie titel="Weekmenu">
          Plan per dag het avondeten, en voeg optioneel een ontbijt, lunch of toetje toe via het
          plusje onder de dag. De week begint op de dag die jij kiest (pijltjes bovenaan). Per
          maaltijd stel je het aantal personen in; ingrediënten schalen overal automatisch mee. Tik op
          een gepland gerecht voor de <strong>kookweergave</strong>: geschaalde, afvinkbare
          ingrediënten en de bereiding in een groter lettertype. Bij het plaatsen controleert de app
          of alle ingrediënten een winkel en afdeling hebben; ontbreekt iets, dan vult een korte
          wizard dat samen met je aan (de afdeling wordt door AI voorgesteld). Druk je op
          <strong> Leegmaken</strong>, dan volgt eerst een korte evaluatie: per gerecht geef je een
          score en wordt de gegeten-teller opgehoogd — daarna is de week klaar voor een nieuwe planning.
        </Sectie>

        <Sectie titel="Lijst">
          Genereer de boodschappenlijst uit het weekmenu met <strong>Weekmenu verversen</strong>:
          alle geplande maaltijden worden meegenomen, hoeveelheden opgeteld en stuks-artikelen naar
          boven afgerond (2,5 courgette wordt 3). Handmatig toegevoegde items blijven bij het
          verversen gewoon staan. De lijst is gegroepeerd per winkel en daarbinnen per afdeling, in de
          looproute die je bij Winkels hebt ingesteld. <strong>Lijst opschonen</strong> laat AI
          dubbele artikelen samenvoegen en receptmaten (theelepels, grammen) omzetten naar volle
          verpakkingen — twijfelgevallen worden altijd eerst aan jou voorgelegd. De lijst
          synchroniseert vrijwel live: vinkt de een iets af, dan ziet de ander dat binnen enkele
          seconden.
        </Sectie>

        <Sectie titel="Voorraad">
          Terugkerende artikelen die niet uit een recept komen — wasmiddel, aluminiumfolie, koffie —
          sla je hier op met winkel en afdeling. De lijst is gesorteerd per afdeling. Stel het aantal
          in en vink een artikel aan om het in één keer aan de boodschappenlijst toe te voegen; winkel
          en afdeling gaan automatisch mee.
        </Sectie>

        <Sectie titel="Winkels">
          Stel per winkel de volgorde van de afdelingen in, zodat de boodschappenlijst jouw looproute
          door de winkel volgt. Verplaats afdelingen omhoog of omlaag, of herstel de standaardvolgorde.
        </Sectie>

        <Sectie titel="Als app op je telefoon">
          Installeer Kookboek als app: op Android via Chrome → menu → "App installeren", op iPhone via
          Safari → deelknop → "Zet op beginscherm". Je krijgt een eigen icoon en volledig scherm;
          updates gaan vanzelf mee.
        </Sectie>

        <Sectie titel="Goed om te weten">
          De slimme functies (recepten uitlezen en zoeken, afdelingen bepalen, lijst opschonen)
          draaien op AI en hebben een werkende API-sleutel met tegoed nodig. De app heeft internet
          nodig; alle gegevens staan veilig in de cloud en blijven bewaard, ook als je de app
          verwijdert en opnieuw installeert.
        </Sectie>
      </div>
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
  header: { display: "flex", alignItems: "center", gap: 10, padding: "20px 22px 14px", position: "sticky", top: 0, background: "rgba(247,247,245,0.88)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", zIndex: 5, borderBottom: "1px solid var(--line)" },
  appTitle: { fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.03em" },
  headerRechts: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 7 },
  headerSub: { fontSize: 12, color: "var(--sub)", fontWeight: 600, background: "var(--surface)", border: "1px solid var(--line)", padding: "5px 12px", borderRadius: 999 },
  infoKnop: { width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 999, color: "var(--sub)", cursor: "pointer", padding: 0 },
  infoIntro: { fontSize: 14, lineHeight: 1.65, color: "#3a3f52", margin: "4px 0 18px" },
  infoSectieKop: { fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--accent)", margin: "0 0 6px" },
  infoTekst: { fontSize: 13.5, lineHeight: 1.65, color: "#3a3f52" },
  main: { flex: 1, padding: "16px 18px 104px", overflowY: "auto" },
  center: { display: "flex", justifyContent: "center", paddingTop: 60 },

  nav: { position: "fixed", bottom: 10, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 20px)", maxWidth: 480, display: "flex", background: "rgba(255,255,255,0.94)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid var(--line)", borderRadius: 22, padding: "8px 4px 9px", zIndex: 10, boxShadow: "var(--schaduw-zacht)" },
  navBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", color: "var(--sub)", fontSize: 10, fontWeight: 600, padding: "4px 2px", cursor: "pointer" },
  navBtnActive: { color: "var(--accent)", background: "var(--accent-soft)", borderRadius: 14 },
  navLabel: { fontSize: 10 },

  searchWrap: { display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", marginBottom: 12 },
  searchInput: { border: "none", outline: "none", flex: 1, fontSize: 15, background: "none", color: "var(--ink)" },

  filterRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8, overflowX: "auto" },
  chips: { display: "flex", gap: 6, flexWrap: "nowrap" },
  chip: { whiteSpace: "nowrap", padding: "6px 12px", borderRadius: 20, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--sub)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  chipOn: { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" },
  scoreFilterBtn: { display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 20, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  resetBtn: { display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "2px 0", marginBottom: 4 },

  card: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 18, overflow: "hidden" },
  receptGrid: { marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 10, alignItems: "start" },
  cardBody: { display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "13px 15px 11px", cursor: "pointer" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: 700, color: "var(--ink)" },
  cardMeta: { display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" },
  metaItem: { display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, color: "var(--sub)", fontWeight: 500 },
  tag: { fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "var(--accent-soft)", padding: "4px 10px", borderRadius: 999 },
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
  modal: { background: "var(--bg)", width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", borderRadius: "24px 24px 0 0", padding: "20px 20px 32px", boxShadow: "0 -12px 40px rgba(16,17,24,0.18)" },
  modalHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  modalTitle: { fontSize: 21, fontWeight: 800, margin: 0, lineHeight: 1.2 },
  dialogHint: { fontSize: 13, color: "var(--sub)", margin: "0 0 14px", lineHeight: 1.5 },
  scoreEdit: { display: "flex", alignItems: "center", justifyContent: "space-between", margin: "16px 0", padding: "12px 14px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--line)" },
  sorteerRij: { display: "flex", alignItems: "center", gap: 6, marginTop: 4, marginBottom: 4, overflowX: "auto" },
  tijdRij: { display: "flex", alignItems: "center", gap: 10, marginTop: 6, marginBottom: 2 },
  tijdLabel: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--sub)", flexShrink: 0 },
  tijdDubbel: { position: "relative", flex: 1, minWidth: 0, height: 26 },
  tijdSpoor: { position: "absolute", top: 11, left: 0, right: 0, height: 4, borderRadius: 2, background: "var(--line)" },
  tijdVulling: { position: "absolute", top: 11, height: 4, borderRadius: 2, background: "var(--accent)" },
  tijdWaarde: { fontSize: 12, fontWeight: 700, color: "var(--ink)", flexShrink: 0, minWidth: 62, textAlign: "right" },
  sorteerLabel: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--sub)", flexShrink: 0, marginRight: 2 },
  sorteerBtn: { whiteSpace: "nowrap", padding: "5px 11px", borderRadius: 20, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--sub)", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  sorteerBtnOn: { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" },
  gegetenRij: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "12px 0", padding: "12px 14px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--line)" },
  evalScoreBlok: { padding: "14px", background: "var(--surface)", borderRadius: 14, border: "1px solid var(--line)", margin: "4px 0 10px" },
  evalHuidig: { fontSize: 13, color: "var(--sub)", marginBottom: 10 },
  evalGegeten: { display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#3a3f52", lineHeight: 1.5, padding: "11px 13px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--line)", marginBottom: 8 },
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
  input: { width: "100%", padding: "10px 13px", border: "1px solid var(--line)", borderRadius: 12, fontSize: 15, background: "var(--surface)", color: "var(--ink)", outline: "none" },
  textarea: { width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 10, fontSize: 15, background: "var(--surface)", color: "var(--ink)", outline: "none", resize: "vertical" },
  ingRow: { display: "flex", gap: 6, marginBottom: 7, alignItems: "center" },
  ingBlok: { marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--line)" },
  ingRow2: { display: "flex", gap: 6, alignItems: "center" },
  ingSelect: { flex: 1, fontSize: 13, padding: "8px 8px", color: "var(--sub)", minWidth: 0 },
  addRowBtn: { display: "inline-flex", alignItems: "center", gap: 5, background: "var(--accent-soft)", color: "var(--accent)", border: "none", padding: "8px 12px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 2 },
  primaryBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", background: "var(--accent)", color: "#fff", border: "none", padding: "13px 18px", borderRadius: 999, fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 8, boxShadow: "0 6px 18px rgba(79,70,229,0.25)" },
  modalKnopRij: { display: "flex", gap: 8, marginTop: 16 },
  secondaryBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)", padding: "13px 18px", borderRadius: 999, fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 8 },
  naarLijstPers: { display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "12px", background: "var(--bg)", borderRadius: 12, marginBottom: 18 },
  naarLijstPersNum: { fontSize: 16, fontWeight: 700, minWidth: 70, textAlign: "center" },

  importBox: { display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center", padding: "30px 20px", background: "var(--surface)", borderRadius: 16, border: "1.5px dashed var(--line)" },
  importText: { fontSize: 14, color: "var(--sub)", margin: 0, lineHeight: 1.5, maxWidth: 280 },
  zoekLinkRij: { display: "flex", gap: 7, width: "100%", alignItems: "center" },
  zoekLinkBtn: { flexShrink: 0, width: 46, height: 42, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 999, cursor: "pointer", boxShadow: "0 6px 18px rgba(79,70,229,0.25)" },
  zoekBezigTekst: { fontSize: 13, color: "var(--sub)", margin: 0 },
  zoekOpties: { display: "flex", flexDirection: "column", gap: 8, width: "100%" },
  zoekOptie: { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 14px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 14, cursor: "pointer" },
  zoekOptieTitel: { fontSize: 14, fontWeight: 700, color: "var(--ink)", overflowWrap: "break-word", wordBreak: "break-word" },
  zoekOptieOms: { fontSize: 12.5, color: "var(--sub)", marginTop: 2, lineHeight: 1.45 },
  zoekOptieBron: { fontSize: 11, fontWeight: 700, color: "var(--accent)", marginTop: 5, textTransform: "lowercase" },
  zoekOf: { display: "flex", alignItems: "center", gap: 10, width: "100%", fontSize: 12, fontWeight: 700, color: "var(--sub)", textTransform: "uppercase", letterSpacing: "0.05em" },
  zoekOfLijn: { flex: 1, height: 1, background: "var(--line)" },
  fotoStrip: { display: "flex", gap: 8, overflowX: "auto", width: "100%", paddingBottom: 4 },
  fotoStripItem: { position: "relative", flexShrink: 0, width: 84, height: 110, borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)", background: "var(--bg)" },
  fotoStripImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  fotoStripNr: { position: "absolute", left: 5, top: 5, minWidth: 20, height: 20, borderRadius: 10, background: "rgba(16,17,24,0.65)", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" },
  fotoStripDel: { position: "absolute", right: 4, top: 4, width: 22, height: 22, borderRadius: 11, border: "none", background: "rgba(16,17,24,0.65)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 },
  kruidenVraag: { background: "var(--accent-soft)", border: "1px solid var(--accent)", borderRadius: 14, padding: "13px 14px", marginBottom: 16 },
  kruidenVraagTekst: { fontSize: 13.5, lineHeight: 1.55, margin: "0 0 10px", color: "var(--ink)" },
  kruidenVraagKnoppen: { display: "flex", gap: 8 },
  kruidenWegBtn: { flex: 1, padding: "9px", borderRadius: 999, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  kruidenMeeBtn: { flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "9px", borderRadius: 999, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  errText: { color: "var(--red)", fontSize: 13, margin: 0 },
  infoBar: { display: "flex", alignItems: "center", gap: 7, background: "var(--accent-soft)", color: "var(--accent)", padding: "10px 13px", borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 14, flexWrap: "wrap" },
  linkBtn: { marginLeft: "auto", background: "none", border: "none", color: "var(--accent)", fontWeight: 700, fontSize: 13, cursor: "pointer", textDecoration: "underline" },

  weekHead: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14, gap: 10 },
  dayStepper: { display: "flex", alignItems: "center", gap: 10, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: "4px 6px" },
  dayStepperLabel: { fontSize: 14, fontWeight: 700, minWidth: 78, textAlign: "center" },
  leegBtn: { display: "inline-flex", alignItems: "center", gap: 5, background: "var(--surface)", border: "1px solid var(--line)", color: "var(--red)", padding: "8px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  weekRow: { display: "flex", alignItems: "stretch", gap: 10, marginBottom: 0 },
  weekDag: { width: 64, fontSize: 13, fontWeight: 700, color: "var(--sub)", flexShrink: 0, paddingTop: 12 },
  weekBlok: { marginBottom: 12 },
  weekExtraRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 6, marginLeft: 74, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: "7px 9px" },
  weekMaaltijdTag: { fontSize: 10, fontWeight: 800, color: "var(--accent)", background: "var(--accent-soft)", padding: "3px 8px", borderRadius: 999, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.03em" },
  weekThumbKlein: { width: 32, height: 32, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid var(--line)" },
  weekThumbKleinMaat: { width: 32, height: 32, borderRadius: 8 },
  weekExtraTitel: { fontSize: 13, fontWeight: 700, lineHeight: 1.3, overflowWrap: "break-word", wordBreak: "break-word" },
  weekPlusOpen: { display: "inline-flex", alignItems: "center", gap: 4, marginTop: 5, marginLeft: 74, background: "none", border: "none", color: "var(--sub)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "2px 4px" },
  weekPlusChips: { display: "flex", alignItems: "center", gap: 6, marginTop: 6, marginLeft: 74, flexWrap: "wrap" },
  weekPlusChip: { display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 999, border: "1px solid var(--accent)", background: "var(--accent-soft)", color: "var(--accent)", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  weekPlusSluit: { width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "var(--sub)", cursor: "pointer", padding: 0 },
  weekSlotLeeg: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px", border: "1.5px dashed var(--line)", borderRadius: 11, background: "none", color: "var(--sub)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  weekSlotDoel: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px", border: "1.5px dashed var(--accent)", borderRadius: 11, background: "var(--accent-soft)", color: "var(--accent)", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  weekSlotVol: { flex: 1, display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 11, padding: "10px 11px" },
  weekSlotBron: { border: "1.5px solid var(--accent)", background: "var(--accent-soft)" },
  weekSlotKies: { flex: 1, display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 },
  weekSlotOpen: { flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 },
  weekThumb: { width: 46, height: 46, borderRadius: 10, objectFit: "cover", flexShrink: 0, border: "1px solid var(--line)" },
  weekThumbLeeg: { width: 46, height: 46, borderRadius: 10, flexShrink: 0, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--sub)", display: "flex", alignItems: "center", justifyContent: "center" },
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
  boodOnderBalk: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12, marginTop: -2, flexWrap: "wrap" },
  opschoonBtn: { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--accent-soft)", border: "1px solid var(--accent)", color: "var(--accent)", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "7px 12px", borderRadius: 9 },
  opschoonMelding: { fontSize: 13, color: "var(--sub)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 9, padding: "9px 12px", marginBottom: 12 },
  opschoonUitleg: { fontSize: 14, color: "#3a3f52", lineHeight: 1.55, margin: "2px 0 12px" },
  opschoonLijst: { listStyle: "none", padding: 0, margin: "0 0 14px" },
  opschoonLi: { display: "flex", justifyContent: "space-between", padding: "9px 12px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 9, marginBottom: 6, fontSize: 14, fontWeight: 600 },
  opschoonKeuzes: { display: "flex", flexWrap: "wrap", gap: 7, margin: "6px 0 16px" },
  opschoonNaamBtn: { padding: "8px 13px", borderRadius: 20, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  opschoonNaamBtnOn: { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" },
  opschoonAkties: { display: "flex", gap: 8, marginTop: 4 },
  opschoonVerpRij: { display: "flex", alignItems: "center", gap: 12, padding: "14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, margin: "4px 0 16px" },
  opschoonVerpHuidig: { flex: 1, fontSize: 14, color: "var(--sub)", textDecoration: "line-through" },
  opschoonVerpVoorstel: { flex: 1, fontSize: 15, fontWeight: 700, color: "var(--ink)", textAlign: "right" },
  opschoonStop: { display: "block", margin: "16px auto 0", background: "none", border: "none", color: "var(--sub)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
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
