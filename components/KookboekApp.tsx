"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { comprimeerAfbeelding, fileNaarDataUrl } from "@/lib/afbeelding";
import Bonscanner from "./Bonscanner";
import type { BonKeuze } from "./Bonscanner";
import { euroTekst, raamLijst } from "@/lib/prijzen";
import { verschuifWeek, weekLabel, weekVan } from "@/lib/weeksleutel";
import Weekvoorstel from "./Weekvoorstel";
import Weekfoto, { legeWeekfotoStaat } from "./Weekfoto";
import type { WeekfotoStaat } from "./Weekfoto";
import type { Prijsboek } from "@/lib/prijzen";
import {
  Search, Plus, Star, Calendar, ShoppingCart, BookOpen, Camera, Link2,
  PencilLine, X, Trash2, ChevronLeft, ChevronRight, Clock, ChefHat, Check, Loader2,
  Minus, CalendarPlus, ArrowRightLeft, RefreshCw, Eye, EyeOff, ArrowDown, Store, GripVertical,
  Utensils, Repeat, ArrowDownNarrowWide, Image as ImageIcon, ZoomIn, Package, Sparkles, Info,
  Activity, ClipboardCheck, WifiOff, Receipt, Euro, Share2, Printer, SlidersHorizontal,
} from "lucide-react";
import {
  KEUKENS, HOOFDINGREDIENTEN, MOEILIJKHEDEN, MAALTIJDEN, DAGEN, WINKELS, GEEN_WINKEL,
  WINKELGEBIEDEN, GEEN_GEBIED,
  type Recept, type WeekState, type Boodschappen, type BoodschapItem, type GebiedVolgorde,
  type Voorraad, type VoorraadArtikel,
} from "@/lib/types";
import Aanvullen from "./tracker/Aanvullen";
import Werkinstructie from "./Werkinstructie";
import { STANDAARD_MATEN } from "@/lib/tracker/recept";
import type { Nutrients } from "@/lib/tracker/types";
import { beschrijfMislukt } from "@/lib/tracker/schatting";
import type { MislukteSchatting } from "@/lib/tracker/schatting";

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
  async getWeek(sleutel?: string): Promise<WeekState & { week: string }> {
    const q = sleutel ? `?week=${encodeURIComponent(sleutel)}` : "";
    const r = await fetch(`/api/week${q}`, { cache: "no-store" }); return r.json();
  },
  async saveWeek(sleutel: string, w: WeekState): Promise<WeekState> {
    const res = await fetch(`/api/week?week=${encodeURIComponent(sleutel)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(w) }); return res.json();
  },
  async getBoodschappen(): Promise<Boodschappen> {
    const r = await fetch("/api/boodschappen", { cache: "no-store" }); return r.json();
  },
  async saveBoodschappen(b: Boodschappen): Promise<Boodschappen> {
    const res = await fetch("/api/boodschappen", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
    // Wel een antwoord, maar geen goed antwoord (401 na uitloggen, 500 bij een
    // storing) telt hier als mislukt: anders neemt de lijst een foutobject over
    // als nieuwe serverstand.
    if (!res.ok) throw new Error("opslaan mislukt");
    return res.json();
  },
  async getGebiedVolgorde(): Promise<GebiedVolgorde> {
    const r = await fetch("/api/gebiedvolgorde", { cache: "no-store" }); return r.json();
  },
  async saveGebiedVolgorde(g: GebiedVolgorde): Promise<GebiedVolgorde> {
    const res = await fetch("/api/gebiedvolgorde", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(g) }); return res.json();
  },
  async getPrijsboek(): Promise<{ boek: Prijsboek }> {
    const r = await fetch("/api/prijzen", { cache: "no-store" }); return r.json();
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
  async getReceptPunten(): Promise<{
    punten: ReceptPuntenKaart;
    profiel: boolean;
    /** De weegdag uit het trackerprofiel; null zonder profiel. */
    weegdag: number | null;
  }> {
    const r = await fetch("/api/tracker/recepten/punten", { cache: "no-store" });
    if (!r.ok) return { punten: {}, profiel: false, weegdag: null };
    return r.json();
  },
  async dagmenuNaarLogboek(datum: string, gerechten: { id: string; maaltijd: string }[]): Promise<{
    toegevoegd: string[]; mislukt: string[]; nietHerkend: string[];
  }> {
    const res = await fetch("/api/tracker/dagmenu", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datum, gerechten }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Toevoegen mislukt"); }
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

/** Een hoeveelheid zoals je hem opschrijft: 2, 2,5 — geen 2.5 en geen 2,50. */
function getalTekst(n: number): string {
  const getal = Number(n);
  if (!Number.isFinite(getal) || getal === 0) return "";
  return String(Math.round(getal * 100) / 100).replace(".", ",");
}

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


// ============================================================================
// APP
// ============================================================================
/** Punten per portie per recept, uit de tracker. */
export type ReceptPuntenKaart = Record<string, ReceptPuntenInfo>;

export interface ReceptPuntenInfo {
  punten: number;
  /** Ingredienten zonder bekend product. */
  nietHerkend: number;
  /** Ingredienten met een maat die niet te lezen was. */
  maatOnbekend?: number;
  totaal: number;
  /** Welke ingredienten buiten het totaal vallen, bij naam. */
  gaten?: string[];
}

/**
 * Of de punten al binnen zijn.
 *
 * Bij een koude cache rekent de tracker alle recepten door en dat duurt even.
 * Zolang dat loopt houdt het kaartje zijn plek met een draaiende cirkel erin,
 * anders springt de hele metaregel op als de getallen alsnog binnenkomen.
 * Zonder trackerprofiel komen er nooit punten en hoort er ook geen plek voor
 * gereserveerd te worden.
 */
export type PuntenStatus = "laden" | "klaar" | "geen-profiel";

export default function App() {
  const [recepten, setRecepten] = useState<Recept[]>([]);
  const [week, setWeek] = useState<WeekState>({ startDag: 0, slots: {} });
  // Welke week je aan het plannen bent. Het weekmenu en de boodschappenlijst
  // volgen dezelfde keuze: je plant een week en maakt daarna de lijst ervoor.
  const [weekSleutel, setWeekSleutel] = useState(() => weekVan(new Date().toISOString().slice(0, 10)));
  const [boodschappen, setBoodschappen] = useState<Boodschappen>({ items: [] });
  const [gebiedVolgorde, setGebiedVolgorde] = useState<GebiedVolgorde>({});
  const [voorraad, setVoorraad] = useState<Voorraad>({ items: [] });
  const [prijsboek, setPrijsboek] = useState<Prijsboek>({});
  // De weegdag uit de tracker: daar begint de trackerweek. Null zonder profiel.
  const [weegdag, setWeegdag] = useState<number | null>(null);
  const [tab, setTab] = useState("recepten");
  // Het gefotografeerde briefje. Staat hier en niet in het weekmenu omdat je er
  // halverwege vandaan loopt om een ontbrekend gerecht aan te maken: dan mag de
  // lijst niet weg zijn als je terugkomt.
  const [weekfoto, setWeekfoto] = useState<WeekfotoStaat | null>(null);
  // Naam die het invoerscherm alvast invult, van een briefje dat je overneemt.
  const [nieuwTitel, setNieuwTitel] = useState("");
  // Welk zojuist toegevoegd recept op dit moment wordt doorgerekend.
  const [schatRecept, setSchatRecept] = useState("");
  // Punten per portie, doorgerekend door de tracker. Los opgehaald zodat het
  // kookboek zonder ingevuld trackerprofiel gewoon blijft werken.
  const [receptPunten, setReceptPunten] = useState<ReceptPuntenKaart>({});
  const [puntenStatus, setPuntenStatus] = useState<PuntenStatus>("laden");
  const router = useRouter();
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    (async () => {
      const [r, w, b, g, v, pb] = await Promise.all([api.getRecepten(), api.getWeek(weekSleutel), api.getBoodschappen(), api.getGebiedVolgorde(), api.getVoorraad(),
        // Het prijsboek is een extra: gaat het ophalen mis, dan verdwijnt
        // alleen de raming en werkt de lijst gewoon door.
        api.getPrijsboek().catch(() => ({ boek: {} as Prijsboek }))]);
      // Migratie: oude slot-sleutels (alleen de dagnaam) worden avondeten.
      const slots: Record<string, { recipeId: string; personen: number }> = {};
      Object.entries(w.slots || {}).forEach(([k, v2]) => { slots[k.includes("|") ? k : slotKey(k, HOOFD_MAALTIJD)] = v2 as any; });
      setRecepten(r); setWeek({ ...w, slots }); setBoodschappen(b); setGebiedVolgorde(g); setVoorraad(v); setPrijsboek(pb?.boek ?? {}); setLaden(false);
      api.getReceptPunten()
        .then((d) => {
          setReceptPunten(d.punten);
          setWeegdag(d.weegdag);
          setPuntenStatus(d.profiel ? "klaar" : "geen-profiel");
        })
        .catch(() => {
          // Zonder punten werkt het kookboek gewoon door; dan verdwijnen de
          // plekhouders in plaats van eeuwig te blijven draaien.
          setPuntenStatus("geen-profiel");
        });
    })();
  }, []);

  // Na het aanvullen van een ingrediënt kloppen de badges van álle recepten
  // niet meer: die aanvulling telt overal mee. Dus opnieuw ophalen, niet
  // alleen voor het recept dat openstond.
  const ververPunten = useCallback(() => {
    // Bewust zonder terug naar "laden": de badges staan er al en hoeven niet
    // opnieuw te gaan draaien voor een verversing op de achtergrond.
    api.getReceptPunten()
      .then((d) => setReceptPunten(d.punten))
      .catch(() => { /* de badges blijven dan even staan zoals ze stonden */ });
  }, []);

  const eersteWeek = useRef(true);
  useEffect(() => {
    if (laden) return;
    if (eersteWeek.current) { eersteWeek.current = false; return; }
    api.saveWeek(weekSleutel, week);
  }, [week, weekSleutel, laden]);

  /**
   * Naar een andere week bladeren.
   *
   * Het opslaan hierboven mag niet meteen afgaan met de nieuwe inhoud onder de
   * oude sleutel — dan zou de ene week de andere overschrijven. Daarom eerst de
   * inhoud ophalen en pas daarna beide tegelijk zetten, met de opslag een keer
   * overgeslagen.
   */
  const [weekLaadt, setWeekLaadt] = useState(false);
  const wisselWeek = useCallback(async (nieuw: string) => {
    if (nieuw === weekSleutel || weekLaadt) return;
    setWeekLaadt(true);
    try {
      const w = await api.getWeek(nieuw);
      eersteWeek.current = true;
      setWeekSleutel(nieuw);
      setWeek({ startDag: Number(w.startDag) || 0, slots: w.slots || {} });
    } catch {
      /* dan blijf je gewoon in de week waar je zat */
    } finally { setWeekLaadt(false); }
  }, [weekSleutel, weekLaadt]);

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

  // In een winkel valt het bereik weg. Een mislukte opslag mag dan geen
  // afgevinkte boodschap kosten: hij blijft openstaan en wordt opnieuw
  // geprobeerd zodra er weer verbinding is. Wat op het scherm staat is
  // ondertussen leidend, dus je kunt gewoon doorwerken.
  const [boodOpenstaand, setBoodOpenstaand] = useState(false);

  const bewaarBoodschappen = useCallback(async () => {
    try {
      boodBasis.current = await api.saveBoodschappen(boodLokaal.current);
      setBoodOpenstaand(false);
      return true;
    } catch {
      setBoodOpenstaand(true);
      return false;
    }
  }, []);

  useEffect(() => {
    if (laden) return;
    if (eersteBood.current) { eersteBood.current = false; return; }
    const t = setTimeout(bewaarBoodschappen, 350);
    return () => clearTimeout(t);
  }, [boodschappen, laden, bewaarBoodschappen]);

  useEffect(() => {
    if (!boodOpenstaand) return;
    // Twee prikkels: het moment dat de browser zegt dat hij weer online is, en
    // een klok voor het geval dat signaal uitblijft (dat gebeurt bij een
    // wankele verbinding vaker dan je zou denken).
    const opnieuw = () => { bewaarBoodschappen(); };
    window.addEventListener("online", opnieuw);
    const klok = setInterval(opnieuw, 15000);
    return () => { window.removeEventListener("online", opnieuw); clearInterval(klok); };
  }, [boodOpenstaand, bewaarBoodschappen]);

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
    // Meteen doorrekenen, op de achtergrond: het opslaan hoeft er niet op te
    // wachten. Zonder dit staat elk nieuw recept eerst met te weinig punten in
    // de lijst tot je het toevallig opent en op Aanvullen drukt.
    void reken(saved);
    // Kwam je hier vanaf een gefotografeerd briefje, dan hoor je terug te komen
    // waar je gebleven was — met het nieuwe recept er nu wel in.
    if (nieuwTitel) { setNieuwTitel(""); setTab("week"); return; }
    setTab("recepten");
  };

  /**
   * De onbekende ingrediënten van een nieuw recept laten schatten.
   *
   * Stil als er niets te doen is, en stil als het misgaat: dit is een extraatje
   * bovenop het opslaan, en een foutmelding over iets waar je niet om gevraagd
   * hebt hoort niet over je scherm te komen. Wat er níet lukt zie je terug in
   * het paneel "recepten tellen nog niet alles mee".
   *
   * Zonder trackerprofiel worden er nergens punten getoond; dan is dit alleen
   * een modelaanroep zonder doel.
   */
  const reken = async (recept: Recept) => {
    if (puntenStatus === "geen-profiel") return;
    const namen = (recept.ingredienten ?? [])
      .map((i) => (i.naam || "").trim())
      .filter((n) => n.length > 0);
    if (namen.length === 0) return;

    setSchatRecept(recept.titel);
    try {
      const res = await fetch("/api/tracker/ingredienten/schat-alles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ namen }),
      });
      if (res.ok) ververPunten();
    } catch {
      /* stil: het recept staat er, de punten volgen later of via Aanvullen */
    } finally { setSchatRecept(""); }
  };

  /** Een gerecht van het briefje aanmaken: naar het invoerscherm, naam ingevuld. */
  const maakGerechtVanBriefje = (titel: string) => { setNieuwTitel(titel); setTab("toevoegen"); };
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
    // De tracker is een aparte route met een eigen scherm, geen tab-state.
    { id: "tracker", label: "Tracker", icon: Activity, pad: "/tracker" },
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
      {/* Voorstellen, geen dwang: een import levert vrije tekst en die moet
          gewoon door kunnen. De omrekening normaliseert wat er binnenkomt. */}
      <datalist id="standaard-maten">
        {STANDAARD_MATEN.map((m) => <option key={m} value={m} />)}
      </datalist>

      <header style={S.header}>
        <ChefHat size={22} style={{ color: "var(--accent)" }} />
        <h1 style={S.appTitle}>Kookboek</h1>
        <div style={S.headerRechts}>
          <button onClick={() => setInfoOpen(true)} style={S.infoKnop} aria-label="Werkinstructie"><Info size={15} /></button>
          <span style={S.headerSub}>{recepten.length} recepten</span>
        </div>
      </header>

      {infoOpen && <Werkinstructie onClose={() => setInfoOpen(false)} />}

      {schatRecept && (
        <div style={S.rekenBalk} role="status" aria-live="polite">
          <Loader2 size={13} className="spin" />
          De ingrediënten van &ldquo;{schatRecept}&rdquo; worden doorgerekend...
        </div>
      )}

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
                receptPunten={receptPunten} puntenStatus={puntenStatus}
                onPuntenVeranderd={ververPunten}
              />
            )}
            {tab === "toevoegen" && <Toevoegen onAdd={addRecept} startTitel={nieuwTitel} />}
            {tab === "week" && (
              <Weekmenu
                recepten={recepten} week={week} setWeek={setWeek} dagen={dagenInVolgorde}
                onUpdateRecept={updateRecept}
                weekSleutel={weekSleutel} onWisselWeek={wisselWeek} weekLaadt={weekLaadt}
                weegdag={weegdag}
                weekfoto={weekfoto} setWeekfoto={setWeekfoto}
                onMaakRecept={maakGerechtVanBriefje}
              />
            )}
            {tab === "boodschappen" && (
              <BoodschappenPagina
                recepten={recepten} week={week} dagen={dagenInVolgorde}
                boodschappen={boodschappen} setBoodschappen={setBoodschappen}
                gebiedVolgorde={gebiedVolgorde} openstaand={boodOpenstaand}
                prijsboek={prijsboek} weekSleutel={weekSleutel}
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
          <button
            key={t.id}
            onClick={() => ("pad" in t && t.pad ? router.push(t.pad) : setTab(t.id))}
            style={{ ...S.navBtn, ...(tab === t.id ? S.navBtnActive : {}) }}
          >
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
  recepten, week, setWeek, dagen, onDelete, onScore, onUpdate, onNaarLijst, receptPunten,
  puntenStatus, onPuntenVeranderd,
}: {
  recepten: Recept[]; week: WeekState; setWeek: React.Dispatch<React.SetStateAction<WeekState>>;
  dagen: readonly string[]; onDelete: (id: string) => void; onScore: (id: string, s: number) => void;
  onUpdate: (id: string, patch: Partial<Recept>) => Promise<void>;
  onNaarLijst: (recept: Recept, personen: number) => void;
  receptPunten: ReceptPuntenKaart;
  puntenStatus: PuntenStatus;
  onPuntenVeranderd: () => void;
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
  // Punten per portie. Vaste grenzen, net als bij de tijd: aan de rechterkant
  // betekent "helemaal open" géén maximum, dus een recept van 45 punten valt
  // er niet buiten omdat de schaal bij 40 ophoudt.
  const MIN_PUNT = 0;
  const MAX_PUNT = 40;
  const [fPuntMin, setFPuntMin] = useState(MIN_PUNT);
  const [fPuntMax, setFPuntMax] = useState(MAX_PUNT);
  const [sortering, setSortering] = useState<"naam" | "gegeten" | "score">("naam");
  // Het filterblok is standaard dicht. Vier rijen chips en twee schuiven zijn
  // een gereedschapskist, geen kop van een pagina: normaal wil je je recepten
  // zien. Wat er wél aanstaat blijft zichtbaar in de knop zelf.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [open, setOpen] = useState<Recept | null>(null);
  const [plaats, setPlaats] = useState<Recept | null>(null);
  const [bewerk, setBewerk] = useState<Recept | null>(null);
  const [naarLijst, setNaarLijst] = useState<Recept | null>(null);

  // Alleen filteren als er punten zijn om op te filteren. Zonder trackerprofiel
  // heeft geen enkel recept een getal; dan zou een schuif die per ongeluk
  // aanstaat de hele lijst leegmaken zonder dat je ziet waarom.
  const puntenBruikbaar = puntenStatus === "klaar";
  const puntFilterAan = puntenBruikbaar && (fPuntMin > MIN_PUNT || fPuntMax < MAX_PUNT);
  // Recepten die buiten het puntenfilter vallen omdat ze geen getal hebben.
  const zonderPunten = puntFilterAan
    ? recepten.filter((r) => receptPunten[r.id]?.punten == null).length
    : 0;

  const gefilterd = recepten.filter((r) => {
    if (zoek) {
      const z = zoek.toLowerCase();
      const inTitel = r.titel.toLowerCase().includes(z);
      const inIngredient = r.ingredienten.some((i) => (i.naam || "").toLowerCase().includes(z));
      // Ook in de bereiding: "oven", "marineren" en "wok" staan zelden in de
      // titel of de ingredientenlijst, maar dat is wel waar je op zoekt als je
      // weet wat voor avond het is.
      const inBereiding = (r.bereiding || "").toLowerCase().includes(z);
      if (!inTitel && !inIngredient && !inBereiding) return false;
    }
    if (fKeuken && r.keuken !== fKeuken) return false;
    if (fHoofd && r.hoofd !== fHoofd) return false;
    if (fMaaltijd && r.maaltijd !== fMaaltijd) return false;
    if (fMoeil && r.moeilijkheid !== fMoeil) return false;
    if (fScore && r.score < fScore) return false;
    if (fTijdMin > MIN_TIJD && (Number(r.tijd) || 0) < fTijdMin) return false;
    if (fTijd < MAX_TIJD && (Number(r.tijd) || 0) > fTijd) return false;
    if (puntFilterAan) {
      const p = receptPunten[r.id]?.punten;
      // Zonder bekend puntenaantal valt er niet op te filteren. Dat is geen
      // reden om het recept stilzwijgend te laten verdwijnen, dus staat er
      // onder de schuif hoeveel er zo buiten vallen.
      if (p == null) return false;
      if (p < fPuntMin) return false;
      if (fPuntMax < MAX_PUNT && p > fPuntMax) return false;
    }
    return true;
  }).sort((a, b) => {
    if (sortering === "gegeten") return (b.gegeten ?? 0) - (a.gegeten ?? 0) || a.titel.localeCompare(b.titel);
    if (sortering === "score") return (b.score ?? 0) - (a.score ?? 0) || a.titel.localeCompare(b.titel);
    return a.titel.localeCompare(b.titel);
  });

  const reset = () => {
    setFKeuken(""); setFHoofd(""); setFMaaltijd(""); setFMoeil(""); setFScore(0);
    setFTijdMin(MIN_TIJD); setFTijd(MAX_TIJD);
    setFPuntMin(MIN_PUNT); setFPuntMax(MAX_PUNT);
    setZoek("");
  };
  // Het zoekveld telt niet mee: dat staat altijd in beeld en spreekt voor
  // zichzelf. De rest zit straks achter een dichtgeklapt blok en moet dus
  // ergens te zien zijn.
  const actieveFilters = [
    fKeuken, fHoofd, fMaaltijd, fMoeil, fScore ? "score" : "",
    fTijdMin > MIN_TIJD || fTijd < MAX_TIJD ? "tijd" : "",
    puntFilterAan ? "punten" : "",
  ].filter(Boolean).length;
  const anyFilter = actieveFilters > 0 || zoek;
  const huidig = open ? recepten.find((r) => r.id === open.id) || open : null;

  return (
    <div>
      <div style={S.searchWrap}>
        <Search size={18} style={{ color: "var(--sub)" }} />
        <input style={S.searchInput} placeholder="Zoek op naam, ingrediënt of bereiding..." value={zoek} onChange={(e) => setZoek(e.target.value)} />
      </div>

      <div style={S.filterBalk}>
        <button
          style={{ ...S.filterKnop, ...(filtersOpen ? S.filterKnopOpen : {}) }}
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
        >
          <SlidersHorizontal size={14} />
          Filters en sorteren
          {actieveFilters > 0 && <span style={S.filterTeller}>{actieveFilters}</span>}
          <ChevronRight size={14} style={{ transform: `rotate(${filtersOpen ? -90 : 90}deg)`, transition: "transform .15s" }} />
        </button>
        {anyFilter ? <button onClick={reset} style={S.resetBtn}><X size={13} /> Wissen</button> : null}
      </div>

      {filtersOpen && (
      <>
      <div style={S.filterRow}><Chips opts={MAALTIJDEN} val={fMaaltijd} set={setFMaaltijd} /></div>
      <div style={S.filterRow}><Chips opts={KEUKENS} val={fKeuken} set={setFKeuken} /></div>
      <div style={S.filterRow}><Chips opts={HOOFDINGREDIENTEN} val={fHoofd} set={setFHoofd} /></div>
      <div style={S.filterRow}>
        <Chips opts={MOEILIJKHEDEN} val={fMoeil} set={setFMoeil} />
        <div style={{ flex: 1 }} />
        <ScoreFilter val={fScore} set={setFScore} />
      </div>

      <div style={S.schuifRij}>
        <span style={S.schuifLabel}><Clock size={13} /> Bereidingstijd</span>
        <div className="dubbelSlider" style={S.schuifDubbel}>
          <div style={S.schuifSpoor} />
          <div style={{
            ...S.schuifVulling,
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
        <span style={S.schuifWaarde}>
          {fTijdMin <= MIN_TIJD && fTijd >= MAX_TIJD ? "alle"
            : fTijdMin <= MIN_TIJD ? `≤ ${fTijd} min`
            : fTijd >= MAX_TIJD ? `≥ ${fTijdMin} min`
            : `${fTijdMin}–${fTijd} min`}
        </span>
      </div>

      {puntenBruikbaar && (
        <>
          <div style={S.schuifRij}>
            <span style={S.schuifLabel}><Activity size={13} /> Punten</span>
            <div className="dubbelSlider" style={S.schuifDubbel}>
              <div style={S.schuifSpoor} />
              <div style={{
                ...S.schuifVulling,
                left: `${(fPuntMin / MAX_PUNT) * 100}%`,
                width: `${((fPuntMax - fPuntMin) / MAX_PUNT) * 100}%`,
              }} />
              <input
                type="range" min={MIN_PUNT} max={MAX_PUNT} step={1} value={fPuntMin}
                onChange={(e) => setFPuntMin(Math.min(Number(e.target.value), fPuntMax - 1))}
                aria-label="Minimaal aantal punten"
              />
              <input
                type="range" min={MIN_PUNT} max={MAX_PUNT} step={1} value={fPuntMax}
                onChange={(e) => setFPuntMax(Math.max(Number(e.target.value), fPuntMin + 1))}
                aria-label="Maximaal aantal punten"
              />
            </div>
            <span style={S.schuifWaarde}>
              {fPuntMin <= MIN_PUNT && fPuntMax >= MAX_PUNT ? "alle"
                : fPuntMin <= MIN_PUNT ? `≤ ${fPuntMax} pt`
                : fPuntMax >= MAX_PUNT ? `≥ ${fPuntMin} pt`
                : `${fPuntMin}–${fPuntMax} pt`}
            </span>
          </div>

          {puntFilterAan && (
            <p style={S.schuifHint}>
              {zonderPunten > 0 && (
                <>{zonderPunten} recept{zonderPunten === 1 ? "" : "en"} zonder puntenaantal
                  {zonderPunten === 1 ? " valt" : " vallen"} hierbuiten. </>
              )}
              Staat er een <strong>~</strong> voor het getal, dan is het een ondergrens: er valt nog
              een ingrediënt buiten de telling.
            </p>
          )}
        </>
      )}

      <div style={S.sorteerRij}>
        <span style={S.sorteerLabel}><ArrowDownNarrowWide size={13} /> Sorteer</span>
        <button onClick={() => setSortering("naam")} style={{ ...S.sorteerBtn, ...(sortering === "naam" ? S.sorteerBtnOn : {}) }}>Naam</button>
        <button onClick={() => setSortering("score")} style={{ ...S.sorteerBtn, ...(sortering === "score" ? S.sorteerBtnOn : {}) }}>Score</button>
        <button onClick={() => setSortering("gegeten")} style={{ ...S.sorteerBtn, ...(sortering === "gegeten" ? S.sorteerBtnOn : {}) }}>Vaakst gegeten</button>
      </div>
      </>
      )}

      <Onvolledig
        recepten={recepten} receptPunten={receptPunten} onOpen={setOpen}
        onKlaar={onPuntenVeranderd}
      />

      <div style={S.receptGrid}>
        {recepten.length === 0 && <p style={S.empty}>Nog geen recepten. Voeg er een toe via het tabblad Toevoegen.</p>}
        {recepten.length > 0 && gefilterd.length === 0 && <p style={S.empty}>Geen recepten gevonden. Pas je filters aan.</p>}
        {gefilterd.map((r) => (
          <ReceptKaart key={r.id} r={r} punten={receptPunten[r.id]} puntenStatus={puntenStatus}
            onOpen={() => setOpen(r)} onPlaats={() => setPlaats(r)} />
        ))}
      </div>

      {huidig && (
        <ReceptModal
          r={huidig} punten={receptPunten[huidig.id]} puntenStatus={puntenStatus}
          onClose={() => setOpen(null)}
          onPuntenVeranderd={onPuntenVeranderd}
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

/**
 * Welke recepten nog niet compleet zijn.
 *
 * Een puntentotaal dat te laag uitvalt omdat er ingrediënten buiten vallen ziet
 * er precies zo uit als een recept dat gewoon licht is. Dit paneel maakt het
 * verschil zichtbaar en zegt erbij welk ingrediënt het is, zodat je weet wat je
 * moet aanvullen in plaats van alleen dát er iets mist.
 *
 * Ingeklapt tenzij je hem opent: het is een controlemiddel, geen aansporing.
 */
function Onvolledig({
  recepten, receptPunten, onOpen, onKlaar,
}: {
  recepten: Recept[];
  receptPunten: ReceptPuntenKaart;
  onOpen: (r: Recept) => void;
  /** De punten opnieuw ophalen nadat er ingrediënten zijn bijgekomen. */
  onKlaar: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [voortgang, setVoortgang] = useState<{ gedaan: number; over: number } | null>(null);
  const [uitslag, setUitslag] = useState<{ gedaan: number; mislukt: string[]; maten: number } | null>(null);
  const [fout, setFout] = useState("");

  /**
   * Alle gaten in het hele kookboek in één keer laten schatten.
   *
   * De server doet een ronde per aanroep en zegt hoeveel er nog over is; dit
   * loopt door tot er niets meer bijkomt. Namen waar het model op stukliep gaan
   * mee als "sla deze over", anders zou een ronde vol onbekende namen alles
   * wat erachter staat blokkeren.
   *
   * De waarden gaan meteen de lijst in, gemerkt als schatting. Ze zijn per
   * recept aan te passen — dat is de afspraak die overal in deze app geldt:
   * een geschat getal blijft als schatting herkenbaar.
   */
  const schatAlles = async () => {
    setBezig(true); setFout(""); setUitslag(null); setVoortgang(null);
    const mislukt = new Set<string>();
    let gedaan = 0;
    let maten = 0;
    try {
      // Ruime bovengrens: elke ronde doet er twintig, dus dit is genoeg voor
      // een kookboek van vierhonderd onbekende ingrediënten. Het is een
      // noodrem, geen verwachting.
      for (let ronde = 0; ronde < 20; ronde++) {
        const res = await fetch("/api/tracker/ingredienten/schat-kookboek", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overslaan: [...mislukt] }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "Schatten mislukt");

        gedaan += d.gelukt?.length ?? 0;
        for (const m of d.mislukt ?? []) mislukt.add(m.naam);
        maten = d.maatOnbekend ?? 0;
        setVoortgang({ gedaan, over: d.resterend ?? 0 });
        if ((d.resterend ?? 0) === 0) break;
        // Een ronde die niets oplevert en niets meldt: doorgaan heeft geen zin.
        if ((d.gelukt?.length ?? 0) === 0 && (d.mislukt?.length ?? 0) === 0) break;
      }
      setUitslag({ gedaan, mislukt: [...mislukt], maten });
      if (gedaan > 0) onKlaar();
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Schatten mislukt");
    } finally { setBezig(false); setVoortgang(null); }
  };

  const lijst = useMemo(() => recepten
    .map((r) => ({ r, info: receptPunten[r.id] }))
    .filter((x) => x.info && (x.info.nietHerkend + (x.info.maatOnbekend ?? 0)) > 0)
    // Het recept met de meeste gaten hoort bovenaan: daar valt het meest te winnen.
    .sort((a, b) =>
      (b.info!.nietHerkend + (b.info!.maatOnbekend ?? 0)) -
      (a.info!.nietHerkend + (a.info!.maatOnbekend ?? 0))),
    [recepten, receptPunten]);

  if (lijst.length === 0) return null;

  return (
    <div style={S.onvolledigVak}>
      <button style={S.onvolledigKop} onClick={() => setOpen((o) => !o)}>
        <ClipboardCheck size={15} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: "left" }}>
          {lijst.length} {lijst.length === 1 ? "recept telt" : "recepten tellen"} nog niet
          alles mee
        </span>
        {open ? <ChevronLeft size={15} style={{ transform: "rotate(90deg)" }} />
          : <ChevronRight size={15} style={{ transform: "rotate(90deg)" }} />}
      </button>

      {open && (
        <div style={{ padding: "0 12px 10px" }}>
          <p style={S.onvolledigUitleg}>
            Bij deze recepten valt een ingrediënt buiten de puntentelling, dus het getal is te
            laag. Vul het ingrediënt aan in het recept — via het potlood, en dan Aanvullen — of
            pas de maat aan naar iets dat de app kent. Of laat ze hieronder in één keer schatten.
          </p>

          <button style={S.schatAllesBtn} onClick={schatAlles} disabled={bezig}>
            {bezig
              ? <><Loader2 size={14} className="spin" /> Bezig{voortgang ? ` — ${voortgang.gedaan} gedaan, nog ${voortgang.over}` : "..."}</>
              : <><Sparkles size={14} /> Alle ontbrekende ingrediënten schatten</>}
          </button>

          {fout && <p style={S.onvolledigMelding}>{fout}</p>}

          {uitslag && (
            <p style={S.onvolledigMelding}>
              {uitslag.gedaan > 0
                ? `${uitslag.gedaan} ingrediënt${uitslag.gedaan === 1 ? "" : "en"} geschat en bewaard. `
                : "Er viel niets te schatten. "}
              {uitslag.mislukt.length > 0 && (
                <>Niet gelukt: {uitslag.mislukt.slice(0, 6).join(", ")}
                  {uitslag.mislukt.length > 6 ? ` en ${uitslag.mislukt.length - 6} andere` : ""}. </>
              )}
              {uitslag.maten > 0 && (
                <>{uitslag.maten} ingrediënt{uitslag.maten === 1 ? " heeft" : "en hebben"} een maat
                  die de app niet kan lezen; die moet je zelf aanpassen. </>
              )}
              Geschatte waarden zijn niet nagekeken — open een recept om ze bij te stellen.
            </p>
          )}
          {lijst.map(({ r, info }) => (
            <button key={r.id} style={S.onvolledigRegel} onClick={() => onOpen(r)}>
              <span style={S.onvolledigNaam}>{r.titel}</span>
              <span style={S.onvolledigGaten}>
                {(info!.gaten ?? []).join(", ") ||
                  `${info!.nietHerkend + (info!.maatOnbekend ?? 0)} van ${info!.totaal}`}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReceptKaart({ r, punten, puntenStatus, onOpen, onPlaats }: {
  r: Recept; punten?: ReceptPuntenInfo;
  puntenStatus: PuntenStatus;
  onOpen: () => void; onPlaats: () => void;
}) {
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
          <PuntenPlek punten={punten} status={puntenStatus} />
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

/**
 * De plek van de puntenbadge.
 *
 * Zolang de tracker rekent staat hier een even groot vakje met een draaiende
 * cirkel erin. Zonder die plekhouder verschijnt de badge er na een paar
 * seconden ineens tussen en schuift de hele metaregel opzij.
 *
 * Zonder trackerprofiel komen er nooit punten; dan staat hier niets.
 */
function PuntenPlek({ punten, status }: {
  punten?: ReceptPuntenInfo;
  status: PuntenStatus;
}) {
  if (status === "laden") {
    return (
      <span style={{ ...S.puntenTag, ...S.puntenTagLaden }}
        role="status" aria-label="Punten worden berekend">
        <Loader2 size={11} className="spin" aria-hidden="true" />
      </span>
    );
  }
  // Zonder profiel is de puntenschaal onbekend en zegt het getal niets; dan
  // hoort er niets te staan. Klaar maar zonder getal komt ook voor: een recept
  // zonder ingrediënten valt niet door te rekenen.
  if (status !== "klaar" || !punten) return null;
  return <PuntenTag {...punten} />;
}

/**
 * Punten per portie, doorgerekend uit de ingrediënten door de tracker.
 *
 * Kon niet elk ingrediënt worden herkend, dan staat er een tilde voor: het
 * getal is dan aan de lage kant en dat hoort zichtbaar te zijn.
 */
function PuntenTag({ punten, nietHerkend, maatOnbekend = 0, totaal }: {
  punten: number; nietHerkend: number; maatOnbekend?: number; totaal: number;
}) {
  const onvolledig = nietHerkend + maatOnbekend > 0;
  const uitleg = onvolledig
    ? `${punten} punten per portie. ${nietHerkend + maatOnbekend} van de ${totaal} ingrediënten tellen niet mee, dus dit is aan de lage kant.`
    : `${punten} punten per portie`;

  return (
    <span
      style={{ ...S.puntenTag, ...(onvolledig ? S.puntenTagOnvolledig : {}) }}
      title={uitleg}
    >
      {onvolledig ? "~" : ""}{punten} pt
    </span>
  );
}

/**
 * Eén ingrediënt zoals de tracker het herkende. Komt uit
 * `/api/tracker/recepten/[id]` en staat in dezelfde volgorde als de
 * ingrediënten van het recept zelf.
 */
interface IngredientStatus {
  ingredient: string;
  product: {
    name: string; eenheid: "g" | "ml"; per100: Nutrients; bron: string;
    portie?: { grams: number; label: string };
  } | null;
  score: number;
  omrekening: { aanname: string; onzeker: boolean; onbekend?: boolean };
  overgeslagen: boolean;
}

/** Uitkomst van "vul alles in één keer aan". */
interface VulUitslag {
  gelukt: number;
  mislukt: MislukteSchatting[];
}

function ReceptModal({
  r, punten, puntenStatus, onClose, onDelete, onScore, onPlaats, onBewerk, onNaarLijst, onGegeten,
  onPuntenVeranderd,
}: {
  r: Recept; punten?: ReceptPuntenInfo;
  puntenStatus: PuntenStatus;
  onClose: () => void; onDelete: () => void; onScore: (s: number) => void; onPlaats: () => void; onBewerk: () => void; onNaarLijst: () => void; onGegeten: (n: number) => void;
  onPuntenVeranderd: () => void;
}) {
  const [zoom, setZoom] = useState(false);
  // Per ingrediënt of de tracker het kent. Null zolang het nog niet geladen is.
  const [status, setStatus] = useState<IngredientStatus[] | null>(null);
  // Wat elk ingredient bijdraagt aan één portie, onafgerond en schaalvrij.
  // Zelfde volgorde als de ingredienten; null waar niets herkend is.
  const [bijdrage, setBijdrage] = useState<(number | null)[] | null>(null);
  const [schaal, setSchaal] = useState(1);
  // Welk ingrediënt (index) op dit moment wordt aangevuld of aangepast.
  const [aanvullen, setAanvullen] = useState<number | null>(null);
  const [bewaart, setBewaart] = useState(false);
  const [statusFout, setStatusFout] = useState("");
  const [vultAlles, setVultAlles] = useState(false);
  const [vulUitslag, setVulUitslag] = useState<VulUitslag | null>(null);
  const [gedeeld, setGedeeld] = useState("");

  const laadStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/tracker/recepten/${r.id}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setStatus(Array.isArray(d?.punten?.matches) ? d.punten.matches : []);
      setBijdrage(Array.isArray(d?.perIngredient) ? d.perIngredient : null);
      setSchaal(typeof d?.schaal === "number" && d.schaal > 0 ? d.schaal : 1);
    } catch {
      // Stil: dan blijft de ingrediëntenlijst gewoon zoals hij altijd was.
      setStatus([]);
      setBijdrage(null);
    }
  }, [r.id]);

  // Alleen als er punten zijn is er ook een trackerprofiel; zonder profiel
  // hoort dit hele blok er niet te staan.
  const heeftPunten = punten != null;
  useEffect(() => { if (heeftPunten) laadStatus(); }, [heeftPunten, laadStatus]);

  /**
   * Bewaart een aangevuld of aangepast ingrediënt. Daarna klopt de cache van
   * elk recept niet meer, dus de badges worden ook opnieuw opgehaald.
   */
  const bewaarIngredient = async (gegevens: {
    naam: string; weergavenaam: string; eenheid: "g" | "ml"; per100: Nutrients; portie?: number;
  }) => {
    setBewaart(true); setStatusFout("");
    try {
      const res = await fetch("/api/tracker/ingredienten", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gegevens),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Opslaan mislukt");
      }
      setAanvullen(null);
      await laadStatus();
      onPuntenVeranderd();
    } catch (e) {
      setStatusFout(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally { setBewaart(false); }
  };

  /**
   * Laat alle onbekende ingrediënten in één keer schatten en bewaren.
   *
   * De waarden gaan hier meteen de lijst in, zonder tussenscherm — dat is de
   * winst van deze knop. Daarom staat er achteraf bij wát er is ingevuld, blijft
   * elke regel aantikbaar en krijgen de geschatte regels het label "geschat".
   */
  const vulAllesAan = async () => {
    const namen = (status ?? []).filter((s) => s.overgeslagen).map((s) => s.ingredient);
    if (namen.length === 0) return;
    setVultAlles(true); setStatusFout(""); setVulUitslag(null);
    try {
      const res = await fetch("/api/tracker/ingredienten/schat-alles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ namen }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Aanvullen mislukt");
      setVulUitslag({ gelukt: d.gelukt?.length ?? 0, mislukt: d.mislukt ?? [] });
      await laadStatus();
      onPuntenVeranderd();
    } catch (e) {
      setStatusFout(e instanceof Error ? e.message : "Aanvullen mislukt");
    } finally { setVultAlles(false); }
  };

  const onbekend = status?.filter((s) => s.overgeslagen).length ?? 0;
  const puntenOnvolledig = punten ? punten.nietHerkend + (punten.maatOnbekend ?? 0) : 0;
  // Optelling van wat er getoond wordt. Hoort na afronden gelijk te zijn aan de
  // badge bovenaan; wijkt het af, dan zit het verschil in een ingredient dat
  // niet meetelt.
  const samenPerPortie = bijdrage
    ? bijdrage.reduce<number>((som, v) => som + (v ?? 0), 0) * schaal
    : null;
  const bezigItem = aanvullen != null ? r.ingredienten[aanvullen] : null;
  const bezigStatus = aanvullen != null ? status?.[aanvullen] : null;

  /**
   * Het recept als platte tekst, om te delen of te plakken.
   *
   * Geen link: een link naar deze app is voor de ontvanger een loginscherm.
   * Wie een recept deelt wil dat de ander het kan lezen, niet dat hij een
   * account moet maken.
   */
  const alsTekst = () => {
    const regels = [
      r.titel,
      "",
      `Voor ${r.personen} ${r.personen === 1 ? "persoon" : "personen"} · ${r.tijd} minuten · ${r.moeilijkheid}`,
      "",
      "Ingrediënten:",
      ...r.ingredienten
        .filter((i) => (i.naam || "").trim())
        .map((i) => `- ${getalTekst(i.hoev)} ${i.eenheid || ""} ${i.naam}`.replace(/\s+/g, " ").trim()),
    ];
    if ((r.bereiding || "").trim()) regels.push("", "Bereiding:", r.bereiding.trim());
    return regels.join("\n");
  };

  const deel = async () => {
    const tekst = alsTekst();
    // Het deelmenu van de telefoon als het er is; anders het klembord, want
    // een knop die niets doet is erger dan een knop die iets anders doet.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: r.titel, text: tekst });
        return;
      } catch {
        // Geannuleerd of geweigerd: dan alsnog het klembord proberen.
      }
    }
    try {
      await navigator.clipboard.writeText(tekst);
      setGedeeld("Recept naar het klembord gekopieerd.");
      setTimeout(() => setGedeeld(""), 2500);
    } catch {
      setGedeeld("Delen lukte niet op dit apparaat.");
      setTimeout(() => setGedeeld(""), 2500);
    }
  };

  return (
    <div style={S.modalBg} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()} data-print="recept">
        <div style={S.modalHead}>
          <h2 style={S.modalTitle}>{r.titel}</h2>
          <div style={{ display: "flex", gap: 2, flexShrink: 0 }} data-print-verbergen>
            <button onClick={deel} style={S.iconBtn} aria-label="Delen of kopiëren"><Share2 size={18} /></button>
            <button onClick={() => window.print()} style={S.iconBtn} aria-label="Afdrukken"><Printer size={18} /></button>
            <button onClick={onBewerk} style={S.iconBtn} aria-label="Bewerken"><PencilLine size={19} /></button>
            <button onClick={onClose} style={S.iconBtn} aria-label="Sluiten"><X size={20} /></button>
          </div>
        </div>

        {gedeeld && <div style={S.deelMelding}>{gedeeld}</div>}

        {r.afbeelding && (
          <button onClick={() => setZoom(true)} style={S.detailAfbWrap}>
            <img src={r.afbeelding} alt={r.titel} style={S.detailAfb} />
            <span style={S.detailAfbZoom}><ZoomIn size={16} /></span>
          </button>
        )}

        <div style={S.cardMeta}>
          <PuntenPlek punten={punten} status={puntenStatus} />
          <Tag tone="maaltijd">{r.maaltijd || "Avondeten"}</Tag>
          <Tag>{r.keuken}</Tag><Tag>{r.hoofd}</Tag>
          <span style={S.metaItem}><Clock size={12} /> {r.tijd}m</span>
          <span style={S.metaItem}><ChefHat size={12} /> {r.moeilijkheid}</span>
        </div>

        {puntenStatus === "laden" && (
          <p style={S.puntenUitleg}>
            <Loader2 size={12} className="spin" style={{ verticalAlign: -2, marginRight: 6 }} />
            De punten van dit recept worden berekend uit de ingrediënten.
          </p>
        )}

        {puntenStatus === "klaar" && punten && (
          <p style={S.puntenUitleg}>
            <strong style={{ color: "var(--ink)" }}>
              {puntenOnvolledig > 0 ? "Ongeveer " : ""}{punten.punten} punten per portie
            </strong>{" "}
            bij {r.personen} {r.personen === 1 ? "persoon" : "personen"}, berekend uit de
            ingrediënten.
            {puntenOnvolledig > 0 && (
              <>
                {" "}{puntenOnvolledig} van de {punten.totaal} ingrediënten{" "}
                {puntenOnvolledig === 1 ? "telt" : "tellen"} niet mee, dus het echte aantal ligt
                hoger.
                {punten.nietHerkend > 0 && (
                  <>
                    {" "}
                    {punten.nietHerkend === 1 ? "Eén staat" : `${punten.nietHerkend} staan`} niet
                    in de productlijst; die vul je hieronder aan.
                  </>
                )}
                {(punten.maatOnbekend ?? 0) > 0 && (
                  <>
                    {" "}
                    {punten.maatOnbekend === 1 ? "Bij één" : `Bij ${punten.maatOnbekend}`} is de
                    maat niet te lezen; pas die aan met het potlood bovenaan.
                  </>
                )}
              </>
            )}
          </p>
        )}

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

        {status && status.length > 0 && (
          <p style={S.ingUitleg}>
            Eronder staat waarmee de tracker rekent. Tik op een ingrediënt om het aan te
            vullen of aan te passen; dat hoeft maar één keer, daarna geldt het voor élk
            recept waar het in zit.
          </p>
        )}
        {onbekend > 0 && (
          <button style={S.vulAllesBtn} onClick={vulAllesAan} disabled={vultAlles}>
            {vultAlles
              ? <><Loader2 size={15} className="spin" /> Bezig met {onbekend} {onbekend === 1 ? "ingrediënt" : "ingrediënten"}...</>
              : <><Sparkles size={15} /> {onbekend === 1 ? "Laat dit ingrediënt schatten" : `Laat alle ${onbekend} in één keer schatten`}</>}
          </button>
        )}

        {vulUitslag && (
          <p style={S.ingUitslag}>
            {vulUitslag.gelukt > 0 && (
              <>
                <strong style={{ color: "var(--ink)" }}>
                  {vulUitslag.gelukt} {vulUitslag.gelukt === 1 ? "ingrediënt" : "ingrediënten"} ingevuld
                </strong>{" "}
                en meteen bewaard. Het zijn schattingen, dus ze staan hieronder met{" "}
                <em>geschat</em> erbij — tik erop om ze na te kijken.{" "}
              </>
            )}
            {vulUitslag.mislukt.length > 0 && (
              <>{beschrijfMislukt(vulUitslag.mislukt)}; die vul je zelf in.</>
            )}
          </p>
        )}

        {statusFout && <p style={S.ingFout}>{statusFout}</p>}

        <ul style={S.ingList}>
          {r.ingredienten.map((i, k) => {
            const st = status?.[k];
            if (!st) {
              // Er komt nog een statusregel aan: alvast plek houden, anders
              // groeit elke regel een halve tel later een regel bij.
              const wacht = heeftPunten && status === null;
              return (
                <li key={k} style={wacht ? S.ingRij : S.ingLi}>
                  {wacht ? (
                    <span style={{ ...S.ingKnop, cursor: "default" }}>
                      <span style={S.ingKop}>
                        <span>{i.naam}</span>
                        <span style={S.ingAmt}>{i.hoev} {i.eenheid}</span>
                      </span>
                      <span style={S.ingBekend}>&nbsp;</span>
                    </span>
                  ) : (
                    <>
                      <span>{i.naam}</span>
                      <span style={S.ingAmt}>{i.hoev} {i.eenheid}</span>
                    </>
                  )}
                </li>
              );
            }
            // De maat zegt niets bruikbaars. Dan valt dit ingredient buiten de
            // telling, en is de knop naar het productformulier de verkeerde
            // uitweg: het recept zelf moet aangepast worden.
            if (!st.overgeslagen && st.omrekening.onbekend) {
              return (
                <li key={k} style={S.ingRij}>
                  <span style={{ ...S.ingKnop, cursor: "default" }}>
                    <span style={S.ingKop}>
                      <span>{i.naam}</span>
                      <span style={S.ingAmt}>{i.hoev} {i.eenheid}</span>
                    </span>
                    <span style={S.ingOnbekend}>
                      <Info size={12} /> {st.omrekening.aanname} — telt niet mee, pas de maat aan
                      met het potlood
                    </span>
                  </span>
                </li>
              );
            }
            // De hoeveelheid is geraden ("1 stuk" zonder bekend gewicht), los van
            // de vraag of de voedingswaarden geschat zijn.
            const hoeveelheidGeschat = !st.overgeslagen && (st.score < 50 || st.omrekening.onzeker);
            return (
              <li key={k} style={S.ingRij}>
                <button style={S.ingKnop} onClick={() => setAanvullen(k)}
                  aria-label={st.overgeslagen ? `${i.naam} aanvullen` : `${i.naam} aanpassen`}>
                  <span style={S.ingKop}>
                    <span>{i.naam}</span>
                    <span style={S.ingAmt}>{i.hoev} {i.eenheid}</span>
                  </span>
                  {st.overgeslagen ? (
                    <span style={S.ingOnbekend}>
                      <Plus size={12} /> niet bekend — tik om aan te vullen
                    </span>
                  ) : (
                    <span style={S.ingBekendRij}>
                      <span style={S.ingBekend}>
                        {hoeveelheidGeschat && <Info size={11} style={{ verticalAlign: -1, marginRight: 3 }} />}
                        {st.product!.name} · {st.omrekening.aanname}
                        {st.product!.bron === "schatting" && <>{" "}<span style={S.ingGeschat}>geschat</span></>}
                      </span>
                      {bijdrage?.[k] != null && (
                        <span style={S.ingPunt}>{puntTekst(bijdrage[k]! * schaal)} pt</span>
                      )}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {samenPerPortie != null && (
          <div style={S.ingTotaal}>
            <span>
              Samen per portie
              <span style={S.ingTotaalSub}>
                {" "}· {r.personen} {r.personen === 1 ? "persoon" : "personen"}
                {onbekend > 0 && `, ${onbekend} niet meegeteld`}
              </span>
            </span>
            <span style={S.ingTotaalPunt}>{puntTekst(samenPerPortie)} pt</span>
          </div>
        )}

        {aanvullen != null && bezigItem && (
          <div style={S.modalBg} onClick={(e) => { e.stopPropagation(); setAanvullen(null); }}>
            <div style={S.modal} onClick={(e) => e.stopPropagation()}>
              <div style={S.modalHead}>
                <div>
                  <span style={S.label}>
                    {bezigStatus?.overgeslagen ? "Ingrediënt aanvullen" : "Ingrediënt aanpassen"}
                  </span>
                  <h2 style={S.modalTitle}>{bezigItem.naam}</h2>
                </div>
                <button onClick={() => setAanvullen(null)} style={S.iconBtn} aria-label="Sluiten"><X size={20} /></button>
              </div>
              <Aanvullen
                ingredient={bezigItem.naam}
                bezig={bewaart}
                begin={bezigStatus?.product ? {
                  weergavenaam: bezigStatus.product.name,
                  eenheid: bezigStatus.product.eenheid,
                  per100: bezigStatus.product.per100,
                  ...(bezigStatus.product.portie ? { portie: bezigStatus.product.portie.grams } : {}),
                } : undefined}
                onOpslaan={bewaarIngredient}
              />
            </div>
          </div>
        )}

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
function Toevoegen({ onAdd, startTitel }: { onAdd: (r: Partial<Recept>) => void; startTitel?: string }) {
  // Met een naam van een briefje in de hand is handmatig het snelste pad: de
  // titel staat er al, jij vult de ingrediënten aan. Link en foto blijven staan
  // voor als het recept ergens vandaan te halen is.
  const [modus, setModus] = useState(startTitel ? "hand" : "link");
  return (
    <div>
      <div style={S.segWrap}>
        <SegBtn active={modus === "link"} onClick={() => setModus("link")} icon={Link2} label="Link" />
        <SegBtn active={modus === "foto"} onClick={() => setModus("foto")} icon={Camera} label="Foto" />
        <SegBtn active={modus === "bord"} onClick={() => setModus("bord")} icon={Utensils} label="Bord" />
        <SegBtn active={modus === "hand"} onClick={() => setModus("hand")} icon={PencilLine} label="Handmatig" />
      </div>
      {startTitel && (
        <p style={S.briefjeHint}>
          Van je briefje: <strong>{startTitel}</strong>. Sla je het op, dan kom je terug bij het
          weekmenu en staat de dag voor je ingevuld.
        </p>
      )}
      {modus === "hand" && (
        <HandmatigForm
          key={startTitel || "leeg"}
          onAdd={onAdd}
          initial={startTitel ? { ...leegRecept(), titel: startTitel } : undefined}
        />
      )}
      {modus === "foto" && <FotoImport onAdd={onAdd} />}
      {modus === "bord" && <BordImport onAdd={onAdd} />}
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
              <input style={{ ...S.input, flex: 1 }} placeholder="eenh." list="standaard-maten" value={i.eenheid} onChange={(e) => setIng(idx, "eenheid", e.target.value)} />
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

/**
 * Een recept maken van een foto van een opgediend bord.
 *
 * Anders dan bij de foto-import staat het recept hier niet op de foto: het
 * wordt gereconstrueerd uit wat er te zien is. Dat levert een bruikbaar
 * beginpunt op — een titel, de ingrediënten die je herkent en een werkwijze —
 * maar hoeveelheden en bereidingstijd zijn een aanname. Daarom staat dat er in
 * gewone taal bij, en gaat het net als elke andere import langs het
 * bevestigingsscherm voordat het je kookboek in mag.
 */
function BordImport({ onAdd }: { onAdd: (r: Partial<Recept>) => void }) {
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<Partial<Recept> | null>(null);
  const [err, setErr] = useState("");
  const [foto, setFoto] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const kies = async (file: File) => {
    setErr(""); setParsed(null); setBusy(true);
    try {
      const ruw = await fileNaarDataUrl(file);
      const groot = await comprimeerAfbeelding(ruw, 0.85, 1400);
      setFoto(groot);
      const res = await api.importRecept({
        type: "bord",
        fotos: [{ mediaType: "image/jpeg", data: groot.split(",")[1] }],
      });
      const recept = normaliseer(res.recept || res);
      // Het bord wordt de receptafbeelding: je hebt hem toch al gemaakt, en
      // een foto van het echte resultaat is beter dan een lege kaart.
      recept.afbeelding = await comprimeerAfbeelding(groot).catch(() => "");
      setParsed(recept);
    } catch (e: any) {
      setErr(e?.message || "Kon van deze foto geen recept maken.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (parsed) return <BevestigImport parsed={parsed} onAdd={onAdd} onCancel={() => setParsed(null)} />;

  return (
    <div style={S.importBox}>
      <Utensils size={36} style={{ color: "var(--accent)" }} />
      <p style={S.importText}>
        Maak een foto van het bord zoals het op tafel staat. De app maakt er een receptvoorstel
        van: de gerechtnaam, de ingrediënten die te zien zijn en een korte werkwijze.
      </p>
      <input
        ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
        onChange={(e) => e.target.files?.[0] && kies(e.target.files[0])}
      />

      {foto && (
        <div style={S.bordVoorbeeldWrap}>
          <img src={foto} alt="Je bord" style={S.bordVoorbeeld} />
        </div>
      )}

      <button onClick={() => fileRef.current?.click()} style={S.primaryBtn} disabled={busy}>
        {busy
          ? <><Loader2 size={16} className="spin" /> Bezig met kijken...</>
          : <><Camera size={16} /> {foto ? "Andere foto" : "Foto van je bord maken"}</>}
      </button>

      <p style={S.importKleinText}>
        Hoeveelheden en bereidingstijd zijn een aanname — aan een bord is niet te zien hoeveel er
        in de pan ging. Loop ze na voordat je opslaat.
      </p>

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
  recepten, week, setWeek, dagen, onUpdateRecept, weekSleutel, onWisselWeek, weekLaadt, weegdag,
  weekfoto, setWeekfoto, onMaakRecept,
}: {
  recepten: Recept[]; week: WeekState; setWeek: React.Dispatch<React.SetStateAction<WeekState>>; dagen: readonly string[];
  onUpdateRecept: (id: string, patch: Partial<Recept>) => Promise<void>;
  weekSleutel: string;
  onWisselWeek: (sleutel: string) => void;
  weekLaadt: boolean;
  /** Op welke dag de trackerweek begint. Null zonder trackerprofiel. */
  weegdag: number | null;
  /** Het gefotografeerde briefje; null als er geen bezig is. */
  weekfoto: WeekfotoStaat | null;
  setWeekfoto: React.Dispatch<React.SetStateAction<WeekfotoStaat | null>>;
  onMaakRecept: (titel: string) => void;
}) {
  const [kiesDag, setKiesDag] = useState<string | null>(null);
  const [voorstelOpen, setVoorstelOpen] = useState(false);
  const [verplaatsVan, setVerplaatsVan] = useState<string | null>(null);
  const [kook, setKook] = useState<{ recept: Recept; personen: number } | null>(null);
  // Wizard die ontbrekende winkel/gebied opvraagt voordat een gerecht geplaatst wordt.
  const [wizard, setWizard] = useState<{ recept: Recept; slot: string } | null>(null);
  // Evaluatie bij leegmaken: per uniek gerecht score vragen en gegeten ophogen.
  const [evaluatie, setEvaluatie] = useState<{ recept: Recept; keren: number }[] | null>(null);
  // Voor welke dag het "maaltijd toevoegen"-menu open staat.
  const [plusDag, setPlusDag] = useState<string | null>(null);
  // Dagmenu naar het logboek van de tracker: welke dag bezig is, en wat de
  // laatste uitkomst was.
  const [logboekDag, setLogboekDag] = useState<string | null>(null);
  const [logboekUitslag, setLogboekUitslag] = useState<{ dag: string; tekst: string; fout: boolean } | null>(null);

  // Zet alle gerechten van een dag als losse regels in het voedingslogboek.
  // De datum is die van vandaag: de weekplanner kent alleen dagnamen, geen
  // kalenderdatums, dus een andere dag zou een gok zijn.
  const naarLogboek = async (dag: string) => {
    const gerechten = [HOOFD_MAALTIJD, ...EXTRA_MAALTIJDEN]
      .map((m) => ({ maaltijd: m, slot: week.slots[slotKey(dag, m)] }))
      .filter((x) => x.slot)
      .map((x) => ({ id: x.slot!.recipeId, maaltijd: x.maaltijd === HOOFD_MAALTIJD ? "Avondeten" : x.maaltijd }));

    if (gerechten.length === 0) return;
    setLogboekDag(dag); setLogboekUitslag(null);
    try {
      const vandaag = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      const datum = `${vandaag.getFullYear()}-${p(vandaag.getMonth() + 1)}-${p(vandaag.getDate())}`;
      const uit = await api.dagmenuNaarLogboek(datum, gerechten);

      const delen: string[] = [];
      if (uit.toegevoegd.length > 0) delen.push(`${uit.toegevoegd.length} gerecht${uit.toegevoegd.length === 1 ? "" : "en"} in het logboek van vandaag`);
      if (uit.mislukt.length > 0) delen.push(`${uit.mislukt.length} niet gelukt`);
      if (uit.nietHerkend.length > 0) delen.push(`niet meegeteld: ${uit.nietHerkend.slice(0, 4).join(", ")}`);
      setLogboekUitslag({ dag, tekst: delen.join(" · ") || "Niets toegevoegd", fout: uit.toegevoegd.length === 0 });
    } catch (e) {
      setLogboekUitslag({ dag, tekst: e instanceof Error ? e.message : "Toevoegen mislukt", fout: true });
    } finally { setLogboekDag(null); }
  };

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

  const vandaag = new Date().toISOString().slice(0, 10);

  /**
   * Een voorgesteld weekmenu overnemen.
   *
   * Alleen de avondslots gaan eraan: een geplande lunch of een toetje heeft met
   * dit voorstel niets te maken en hoort niet stilletjes te verdwijnen. Het
   * aantal personen komt uit het recept zelf.
   */
  const neemVoorstelOver = (keuze: { dag: string; recipeId: string }[]) => {
    setWeek((p) => {
      const slots = { ...p.slots };
      for (const d of dagen) delete slots[slotKey(d, HOOFD_MAALTIJD)];
      for (const k of keuze) {
        const r = recepten.find((x) => x.id === k.recipeId);
        if (!r) continue;
        slots[slotKey(k.dag, HOOFD_MAALTIJD)] = { recipeId: r.id, personen: r.personen || 4 };
      }
      return { ...p, slots };
    });
    setVoorstelOpen(false);
  };

  /**
   * De dagen van een gefotografeerd briefje overnemen.
   *
   * Alleen de dagen die op het briefje stonden of die je zelf hebt ingevuld.
   * Anders dan bij een voorstel wordt de rest van de week niet leeggemaakt: een
   * half briefje hoort geen halve week op te leveren.
   */
  const neemFotoOver = (keuze: { dag: string; recipeId: string }[]) => {
    setWeek((p) => {
      const slots = { ...p.slots };
      for (const k of keuze) {
        const r = recepten.find((x) => x.id === k.recipeId);
        if (!r) continue;
        slots[slotKey(k.dag, HOOFD_MAALTIJD)] = { recipeId: r.id, personen: r.personen || 4 };
      }
      return { ...p, slots };
    });
    setWeekfoto(null);
  };

  return (
    <div>
      {weekfoto && (
        <Weekfoto
          recepten={recepten}
          dagen={dagen}
          staat={weekfoto}
          setStaat={setWeekfoto}
          onOvernemen={neemFotoOver}
          onMaakRecept={onMaakRecept}
          onSluiten={() => setWeekfoto(null)}
        />
      )}

      {voorstelOpen && (
        <Weekvoorstel
          dagen={dagen}
          onOvernemen={neemVoorstelOver}
          onSluiten={() => setVoorstelOpen(false)}
        />
      )}

      <div style={S.weekKiezer}>
        <button onClick={() => onWisselWeek(verschuifWeek(weekSleutel, -1))}
          style={S.iconBtnSm} aria-label="Vorige week" disabled={weekLaadt}>
          <ChevronLeft size={16} />
        </button>
        <span style={S.weekKiezerLabel}>
          {weekLaadt ? <Loader2 size={14} className="spin" /> : weekLabel(weekSleutel, vandaag)}
        </span>
        <button onClick={() => onWisselWeek(verschuifWeek(weekSleutel, 1))}
          style={S.iconBtnSm} aria-label="Volgende week" disabled={weekLaadt}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div style={S.weekHead}>
        <div>
          <span style={S.label}>Startdag</span>
          <div style={S.dayStepper}>
            <button onClick={() => setStartDag(week.startDag + 6)} style={S.iconBtnSm} aria-label="Vorige dag"><ChevronLeft size={16} /></button>
            <span style={S.dayStepperLabel}>{DAGEN[week.startDag]}</span>
            <button onClick={() => setStartDag(week.startDag + 1)} style={S.iconBtnSm} aria-label="Volgende dag"><ChevronRight size={16} /></button>
          </div>
          {weegdag != null && weegdag !== week.startDag && (
            <button style={S.weekGelijk} onClick={() => setStartDag(weegdag)}>
              Je trackerweek begint op {DAGEN[weegdag].toLowerCase()} · gelijkzetten
            </button>
          )}
        </div>
        <div style={S.weekKnoppen}>
          <button onClick={() => setWeekfoto(legeWeekfotoStaat())} style={S.voorstelBtn}>
            <Camera size={14} /> Van een briefje
          </button>
          <button onClick={() => setVoorstelOpen(true)} style={S.voorstelBtn}>
            <Sparkles size={14} /> Stel een week voor
          </button>
          {aantalGepland > 0 && (
            <button onClick={startLeegmaken} style={S.leegBtn}><Trash2 size={14} /> Leegmaken</button>
          )}
        </div>
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
        const heeftIets = Boolean(r) || extras.length > 0;
        const uitslag = logboekUitslag?.dag === dag ? logboekUitslag : null;
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

            {/* Dagmenu naar het voedingslogboek van de tracker */}
            {heeftIets && !verplaatsVan && (
              <div style={S.logboekRij}>
                <button
                  onClick={() => naarLogboek(dag)}
                  disabled={logboekDag === dag}
                  style={{ ...S.logboekKnop, opacity: logboekDag === dag ? 0.6 : 1 }}
                >
                  {logboekDag === dag
                    ? <><Loader2 size={13} className="spin" /> Bezig...</>
                    : <><ClipboardCheck size={13} /> Zet dagmenu in logboek</>}
                </button>
                {uitslag && (
                  <span style={{ ...S.logboekUitslag, color: uitslag.fout ? "var(--red)" : "var(--green)" }}>
                    {uitslag.tekst}
                  </span>
                )}
              </div>
            )}

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
    return r.titel.toLowerCase().includes(z)
      || r.ingredienten.some((i) => (i.naam || "").toLowerCase().includes(z))
      || (r.bereiding || "").toLowerCase().includes(z);
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
              <input style={S.searchInput} placeholder="Zoek op naam, ingrediënt of bereiding..." value={zoek} onChange={(e) => setZoek(e.target.value)} autoFocus />
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

/**
 * Hoeveel je er nog van hebt.
 *
 * Optioneel: artikelen van voor deze uitbreiding hebben geen aantal en tonen
 * alleen "tel mee". Pas als je er een getal in zet gaat de app erover praten —
 * een voorraadlijst waar overal een geraden 0 bij staat is erger dan geen
 * aantallen.
 */
function Voorraadstand({
  art, onWijzig,
}: { art: VoorraadArtikel; onWijzig: (patch: Partial<VoorraadArtikel>) => void }) {
  if (art.aantal == null) {
    return (
      <button style={S.voorraadTelMee} onClick={() => onWijzig({ aantal: 1, eenheid: art.eenheid || "stuk" })}>
        <Plus size={11} /> tel mee
      </button>
    );
  }

  const drempel = art.drempel ?? 1;
  const bijnaOp = art.aantal <= drempel;
  return (
    <div style={S.voorraadStand}>
      <button
        style={S.voorraadStandBtn}
        onClick={() => onWijzig(art.aantal! <= 0 ? { aantal: undefined } : { aantal: art.aantal! - 1 })}
        aria-label={`Minder ${art.naam}`}
      >
        <Minus size={12} />
      </button>
      <span style={{ ...S.voorraadStandTekst, ...(bijnaOp ? { color: "var(--over)", fontWeight: 800 } : {}) }}>
        {art.aantal === 0 ? "op" : `${art.aantal} ${art.eenheid || "stuk"}`}
      </span>
      <button style={S.voorraadStandBtn} onClick={() => onWijzig({ aantal: art.aantal! + 1 })}
        aria-label={`Meer ${art.naam}`}>
        <Plus size={12} />
      </button>
    </div>
  );
}

// ============================================================================
// BOODSCHAPPENLIJST
// ============================================================================
function BoodschappenPagina({
  recepten, week, dagen, boodschappen, setBoodschappen, gebiedVolgorde, openstaand, prijsboek,
  weekSleutel,
}: {
  recepten: Recept[]; week: WeekState; dagen: readonly string[];
  boodschappen: Boodschappen; setBoodschappen: React.Dispatch<React.SetStateAction<Boodschappen>>;
  gebiedVolgorde: GebiedVolgorde;
  /** Er staan wijzigingen open die nog niet bij de server zijn aangekomen. */
  openstaand: boolean;
  /** Laatst betaalde prijzen, voor de raming onder aan de lijst. */
  prijsboek: Prijsboek;
  /** Welke week het weekmenu op dit moment toont. */
  weekSleutel: string;
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

  // Wat de lijst ongeveer gaat kosten. Alleen items met een bekende prijs
  // tellen mee; hoeveel er onbekend zijn staat er altijd bij. Een raming die
  // stiekem een gemiddelde invult ziet er nauwkeuriger uit dan hij is.
  const raming = useMemo(
    () => raamLijst(prijsboek, items.map((it) => ({ naam: it.naam, hoev: it.hoev })),
      new Date().toISOString().slice(0, 10)),
    [prijsboek, items]
  );

  return (
    <div>
      {openstaand && (
        <div style={S.nogNietOpgeslagen}>
          <WifiOff size={15} style={{ flexShrink: 0 }} />
          <span>
            Je afvinkjes staan nog niet op de server. Ze blijven op dit scherm staan en gaan
            vanzelf mee zodra er weer verbinding is — je kunt gewoon doorwerken.
          </span>
        </div>
      )}

      <p style={S.boodWeek}>
        Uit het weekmenu van <strong>{weekLabel(weekSleutel, new Date().toISOString().slice(0, 10)).toLowerCase()}</strong>.
        Blader op het tabblad Weekmenu naar een andere week om die lijst te maken.
      </p>

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
        <>
          <div style={S.infoBar}>
            <ShoppingCart size={15} /> {items.length} items{aantalGedaan > 0 ? ` · ${aantalGedaan} afgevinkt` : ""}
          </div>
          {raming.bekend > 0 && (
            <div style={S.ramingBalk}>
              <Euro size={15} style={{ flexShrink: 0 }} />
              <span>
                <strong>{euroTekst(raming.euro)}</strong> voor {raming.bekend}{" "}
                {raming.bekend === 1 ? "item" : "items"} met een bekende prijs
                {raming.onbekend > 0 && <> · {raming.onbekend} nog onbekend</>}
                {raming.verouderd > 0 && <> · {raming.verouderd} ouder dan vier maanden</>}
              </span>
            </div>
          )}
        </>
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
            <input style={{ ...S.input, flex: 1 }} placeholder="eenh." list="standaard-maten" value={it.eenheid} onChange={(e) => onEenheid(e.target.value)} />
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
  const [scannerOpen, setScannerOpen] = useState(false);
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

  /**
   * Regels van een gescande bon of foto erbij.
   *
   * Een naam die er al staat wordt niet nog een keer toegevoegd maar opgehoogd:
   * twee keer "melk" in je voorraad helpt niemand. De vergelijking gaat op de
   * naam zonder hoofdletters en spaties, want zo typ je hem de tweede keer
   * zelden precies hetzelfde.
   */
  const uitFoto = (regels: BonKeuze[], winkelVanBon: string) => {
    setVoorraad((p) => {
      const items = [...p.items];
      const zoek = (n: string) =>
        items.findIndex((a) => a.naam.trim().toLowerCase() === n.trim().toLowerCase());
      for (const r of regels) {
        const naam = r.naam.trim();
        if (!naam) continue;
        const i = zoek(naam);
        if (i >= 0) {
          items[i] = {
            ...items[i],
            aantal: (items[i].aantal ?? 0) + r.aantal,
            eenheid: items[i].eenheid || r.eenheid,
            winkel: items[i].winkel || winkelVanBon,
            gebied: items[i].gebied || r.gebied,
          };
        } else {
          items.push({
            id: uid(), naam, winkel: winkelVanBon, gebied: r.gebied,
            aantal: r.aantal, eenheid: r.eenheid,
          });
        }
      }
      return { items };
    });
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

      <button style={S.bonKnop} onClick={() => setScannerOpen(true)}>
        <Receipt size={16} /> Voorraad snel vullen
      </button>

      {scannerOpen && (
        <Bonscanner onToevoegen={uitFoto} onSluiten={() => setScannerOpen(false)} />
      )}

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
                  <Voorraadstand art={art} onWijzig={(p2) => wijzig(art.id, p2)} />
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

/**
 * Punten met één decimaal. Altijd een decimaal, zodat een kolom getallen onder
 * elkaar uitlijnt, en zonder "-0" bij een waarde die net onder nul afrondt.
 */
function puntTekst(v: number): string {
  const afgerond = Math.round(v * 10) / 10;
  const n = Object.is(afgerond, -0) ? 0 : afgerond;
  return n.toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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

  filterBalk: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
  filterKnop: { display: "inline-flex", alignItems: "center", gap: 7, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 999, padding: "7px 13px", fontSize: 13, fontWeight: 700, color: "var(--ink)", cursor: "pointer" },
  filterKnopOpen: { background: "var(--accent-soft)", borderColor: "var(--accent)", color: "var(--accent)" },
  filterTeller: { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 800 },
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
  puntenUitleg: { fontSize: 12.5, lineHeight: 1.6, color: "var(--sub)", margin: "10px 0 0" },
  // Alle badges even breed: dan is de plekhouder precies zo groot als het getal
  // dat erin komt en verschuift er niets als de punten binnenvallen. 58 px is
  // ruim genoeg voor het breedste geval ("~99 pt").
  puntenTag: { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 58, minHeight: 21, boxSizing: "border-box", fontSize: 11, fontWeight: 800, color: "#fff", background: "var(--accent)", padding: "4px 9px", borderRadius: 999, letterSpacing: "0.01em" },
  puntenTagLaden: { background: "var(--line)", color: "var(--sub)" },
  puntenTagOnvolledig: { background: "var(--over)" },

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

  logboekRij: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "8px 0 2px" },
  logboekKnop: { display: "inline-flex", alignItems: "center", gap: 5, background: "var(--accent-soft)", color: "var(--accent)", border: "none", borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  logboekUitslag: { fontSize: 11.5, fontWeight: 600, lineHeight: 1.4, flex: 1, minWidth: 0 },

  empty: { gridColumn: "1 / -1", textAlign: "center", color: "var(--sub)", fontSize: 14, padding: "40px 20px", lineHeight: 1.6 },

  modalBg: { position: "fixed", inset: 0, background: "rgba(22,25,39,0.45)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" },
  modal: { background: "var(--bg)", width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", borderRadius: "24px 24px 0 0", padding: "20px 20px 32px", boxShadow: "0 -12px 40px rgba(16,17,24,0.18)" },
  modalHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  modalTitle: { fontSize: 21, fontWeight: 800, margin: 0, lineHeight: 1.2 },
  dialogHint: { fontSize: 13, color: "var(--sub)", margin: "0 0 14px", lineHeight: 1.5 },
  scoreEdit: { display: "flex", alignItems: "center", justifyContent: "space-between", margin: "16px 0", padding: "12px 14px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--line)" },
  sorteerRij: { display: "flex", alignItems: "center", gap: 6, marginTop: 4, marginBottom: 4, overflowX: "auto" },
  schuifHint: { fontSize: 11.5, lineHeight: 1.6, color: "var(--sub)", margin: "2px 0 6px" },
  schuifRij: { display: "flex", alignItems: "center", gap: 10, marginTop: 6, marginBottom: 2 },
  schuifLabel: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--sub)", flexShrink: 0 },
  schuifDubbel: { position: "relative", flex: 1, minWidth: 0, height: 26 },
  schuifSpoor: { position: "absolute", top: 11, left: 0, right: 0, height: 4, borderRadius: 2, background: "var(--line)" },
  schuifVulling: { position: "absolute", top: 11, height: 4, borderRadius: 2, background: "var(--accent)" },
  schuifWaarde: { fontSize: 12, fontWeight: 700, color: "var(--ink)", flexShrink: 0, minWidth: 62, textAlign: "right" },
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
  ingAmt: { color: "var(--sub)", fontWeight: 600, flexShrink: 0 },
  ingUitleg: { fontSize: 12.5, lineHeight: 1.6, color: "var(--sub)", margin: "0 0 6px" },
  ingFout: { fontSize: 12.5, lineHeight: 1.5, color: "var(--over)", fontWeight: 600, margin: "0 0 8px" },
  ingRij: { borderBottom: "1px solid var(--line)" },
  ingKnop: { display: "flex", flexDirection: "column", gap: 3, width: "100%", padding: "8px 0", background: "none", border: "none", textAlign: "left", font: "inherit", color: "inherit", cursor: "pointer" },
  ingKop: { display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14 },
  ingBekend: { fontSize: 12, color: "var(--sub)" },
  ingBekendRij: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
  // Geen kleurcodering naar hoog of laag: dat zou een oordeel over eten worden.
  // Alleen het getal, met het teken erbij.
  ingPunt: { fontSize: 12, fontWeight: 800, color: "var(--accent)", flexShrink: 0, fontVariantNumeric: "tabular-nums" },
  ingTotaal: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, padding: "10px 0 2px", fontSize: 13, fontWeight: 700 },
  ingTotaalSub: { fontWeight: 500, color: "var(--sub)", fontSize: 12 },
  ingTotaalPunt: { fontSize: 13, fontWeight: 800, color: "var(--accent)", fontVariantNumeric: "tabular-nums" },
  ingOnbekend: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--over)" },
  ingGeschat: { marginLeft: 6, fontSize: 11, fontWeight: 800, color: "var(--over)", background: "#fff2e2", padding: "1px 6px", borderRadius: 999 },
  ingUitslag: { fontSize: 12.5, lineHeight: 1.6, color: "var(--sub)", margin: "0 0 8px" },
  vulAllesBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", background: "var(--surface)", color: "var(--accent)", border: "1px solid var(--accent)", padding: "11px 16px", borderRadius: 999, fontSize: 14, fontWeight: 700, cursor: "pointer", margin: "0 0 10px" },
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

  weekHead: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", marginBottom: 14, gap: 10 },
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
  voorraadStand: { display: "flex", alignItems: "center", gap: 4, marginTop: 5 },
  voorraadStandBtn: { width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)", borderRadius: 6, background: "var(--bg)", color: "var(--sub)", cursor: "pointer", padding: 0 },
  voorraadStandTekst: { fontSize: 11.5, color: "var(--sub)", minWidth: 52, textAlign: "center" },
  voorraadTelMee: { display: "inline-flex", alignItems: "center", gap: 3, marginTop: 5, padding: "2px 7px", border: "1px dashed var(--line)", borderRadius: 999, background: "transparent", color: "var(--sub)", fontSize: 11, cursor: "pointer" },
  boodWeek: { fontSize: 12, color: "var(--sub)", lineHeight: 1.5, margin: "0 0 10px" },
  weekKnoppen: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginLeft: "auto" },
  rekenBalk: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "7px 14px", background: "var(--accent-soft)", color: "var(--accent)", fontSize: 12.5, fontWeight: 700 },
  bordVoorbeeldWrap: { width: "100%", borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)", marginBottom: 4 },
  bordVoorbeeld: { display: "block", width: "100%", maxHeight: 260, objectFit: "cover" },
  importKleinText: { fontSize: 11.5, lineHeight: 1.6, color: "var(--sub)", textAlign: "center", margin: "6px 0 0" },
  briefjeHint: { background: "var(--accent-soft)", borderRadius: 12, padding: "10px 13px", fontSize: 12.5, lineHeight: 1.6, color: "var(--ink)", margin: "0 0 12px" },
  voorstelBtn: { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--accent-soft)", color: "var(--accent)", border: "none", borderRadius: 999, padding: "7px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" },
  weekGelijk: { display: "block", marginTop: 6, background: "none", border: "none", padding: 0, fontSize: 11.5, lineHeight: 1.4, color: "var(--accent)", textAlign: "left", cursor: "pointer", textDecoration: "underline" },
  weekKiezer: { display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: "6px 8px", marginBottom: 12 },
  weekKiezerLabel: { flex: 1, textAlign: "center", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 22 },
  deelMelding: { background: "var(--accent-soft)", color: "var(--accent)", borderRadius: 10, padding: "8px 12px", fontSize: 12.5, margin: "0 0 10px" },
  schatAllesBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", padding: "9px 12px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "var(--ink)", cursor: "pointer", marginBottom: 8 },
  onvolledigMelding: { fontSize: 11.5, lineHeight: 1.6, color: "var(--sub)", margin: "0 0 10px" },
  onvolledigVak: { background: "var(--surface)", border: "1px solid var(--gold)", borderRadius: 14, marginBottom: 14, overflow: "hidden" },
  onvolledigKop: { display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "11px 12px", background: "none", border: "none", color: "#7a4d09", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  onvolledigUitleg: { fontSize: 12.5, lineHeight: 1.6, color: "var(--sub)", margin: "0 0 10px" },
  onvolledigRegel: { display: "block", width: "100%", textAlign: "left", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, padding: "8px 10px", marginBottom: 6, cursor: "pointer" },
  onvolledigNaam: { display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--ink)" },
  onvolledigGaten: { display: "block", fontSize: 12, color: "var(--sub)", marginTop: 2 },
  ramingBalk: { display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: "9px 12px", fontSize: 12.5, lineHeight: 1.5, color: "var(--sub)", marginBottom: 12 },
  bonKnop: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "11px", background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 12, fontSize: 14, fontWeight: 700, color: "var(--accent)", cursor: "pointer", marginBottom: 14 },
  nogNietOpgeslagen: { display: "flex", alignItems: "center", gap: 8, background: "#fdf4e3", border: "1px solid var(--gold)", borderRadius: 12, padding: "9px 12px", fontSize: 12.5, lineHeight: 1.5, color: "#7a4d09", marginBottom: 12 },
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
