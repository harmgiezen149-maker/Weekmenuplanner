"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, BookOpen, CalendarRange, ListPlus, Loader2, Scale, Settings } from "lucide-react";
import { T } from "./stijl";
import Dagoverzicht, { toonDatum } from "./Dagoverzicht";
import Toevoegen from "./Toevoegen";
import Instellingen from "./Instellingen";
import Gewicht from "./Gewicht";
import type { GewichtGegevens } from "./Gewicht";
import Weekoverzicht from "./Weekoverzicht";
import Import from "./Import";
import type { WeekSamenvatting } from "@/lib/tracker/week";
import { trackerApi } from "./api";
import { datumSleutel } from "@/lib/tracker/datum";
import { toonPunten } from "@/lib/tracker/points";
import { dagBewegingspunten } from "@/lib/tracker/activiteit";
import type { Day, Maaltijd, Profile } from "@/lib/tracker/types";
import { MAALTIJDEN_TRACKER } from "@/lib/tracker/types";

export type Pagina = "dag" | "toevoegen" | "week" | "gewicht" | "instellingen" | "import";

const PAGINAS: { id: Pagina; pad: string; label: string; icon: typeof Activity }[] = [
  { id: "dag", pad: "/tracker", label: "Vandaag", icon: Activity },
  { id: "toevoegen", pad: "/tracker/toevoegen", label: "Toevoegen", icon: ListPlus },
  { id: "week", pad: "/tracker/week", label: "Week", icon: CalendarRange },
  { id: "gewicht", pad: "/tracker/gewicht", label: "Gewicht", icon: Scale },
  { id: "instellingen", pad: "/tracker/instellingen", label: "Instellingen", icon: Settings },
];

export default function TrackerApp({ pagina }: { pagina: Pagina }) {
  const router = useRouter();
  const zoek = useSearchParams();
  const vandaag = datumSleutel();

  const [datum, setDatum] = useState(vandaag);
  const [profiel, setProfiel] = useState<Profile | null>(null);
  const [dag, setDag] = useState<Day | null>(null);
  const [laden, setLaden] = useState(true);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [opgeslagen, setOpgeslagen] = useState(false);
  const [gewicht, setGewicht] = useState<GewichtGegevens | null>(null);
  const [week, setWeek] = useState<{ week: WeekSamenvatting | null; dagenTeGaan: number } | null>(null);
  const [weekDatum, setWeekDatum] = useState(datumSleutel());
  const [herberekend, setHerberekend] = useState(false);

  // De datum en de gekozen maaltijd reizen via de URL mee naar het
  // invoerscherm, zodat "toevoegen bij lunch" op de juiste plek belandt.
  // Het deelmenu van Android geeft url, text en title mee; de link kan in
  // allebei de eerste twee velden zitten.
  const gedeeldeUrl = (zoek.get("url") || zoek.get("text") || "").trim();
  const urlDatum = zoek.get("datum");
  const urlMaaltijd = zoek.get("maaltijd");
  const maaltijd: Maaltijd = MAALTIJDEN_TRACKER.includes(urlMaaltijd as Maaltijd)
    ? (urlMaaltijd as Maaltijd)
    : standaardMaaltijd();

  useEffect(() => {
    if (urlDatum && /^\d{4}-\d{2}-\d{2}$/.test(urlDatum)) setDatum(urlDatum);
  }, [urlDatum]);

  useEffect(() => {
    let afgebroken = false;
    (async () => {
      try {
        const [p, d, g] = await Promise.all([
          trackerApi.getProfiel(), trackerApi.getDag(datum), trackerApi.getGewicht(),
        ]);
        if (afgebroken) return;
        setProfiel(p.profiel);
        setDag(d);
        setGewicht(g);
      } catch (e) {
        if (!afgebroken) setFout(bericht(e));
      } finally {
        if (!afgebroken) setLaden(false);
      }
    })();
    return () => { afgebroken = true; };
  }, [datum]);

  const ga = useCallback((pad: string) => { router.push(pad); }, [router]);

  // De weekgegevens zijn zowel voor het weekoverzicht als voor de bufferbalk
  // op het dagoverzicht nodig; ze volgen de gekozen week.
  useEffect(() => {
    let afgebroken = false;
    trackerApi.getWeek(pagina === "week" ? weekDatum : datum)
      .then((w) => { if (!afgebroken) setWeek({ week: w.week, dagenTeGaan: w.dagenTeGaan }); })
      .catch(() => { /* de bufferbalk verdwijnt dan, de rest werkt door */ });
    return () => { afgebroken = true; };
  }, [pagina, weekDatum, datum, dag]);

  const weeg = async (kg: number, note?: string) => {
    setBezig(true); setFout(""); setHerberekend(false);
    try {
      const g = await trackerApi.weeg(kg, note);
      setGewicht(g);
      setHerberekend(g.herberekend);
      if (g.profiel) setProfiel(g.profiel);
    } catch (e) { setFout(bericht(e)); } finally { setBezig(false); }
  };

  const voegBewegingToe = async (soort: string, minuten: number) => {
    setBezig(true); setFout("");
    try {
      setDag(await trackerApi.voegBewegingToe(datum, soort, minuten));
    } catch (e) { setFout(bericht(e)); } finally { setBezig(false); }
  };

  const wisBeweging = async (id: string) => {
    setFout("");
    try { setDag(await trackerApi.wisBeweging(datum, id)); } catch (e) { setFout(bericht(e)); }
  };

  const wisWeging = async (d: string) => {
    setFout(""); setHerberekend(false);
    try {
      const g = await trackerApi.wisWeging(d);
      setGewicht(g);
      if (g.profiel) setProfiel(g.profiel);
    } catch (e) { setFout(bericht(e)); }
  };

  const wisRegel = async (id: string) => {
    setFout("");
    try {
      setDag(await trackerApi.wisRegel(datum, id));
    } catch (e) { setFout(bericht(e)); }
  };

  const voegToe = async (
    payload: Record<string, unknown>,
    alsFavoriet = false,
    onthoudBij?: { barcode: string; per100: unknown; eenheid: "g" | "ml" }
  ) => {
    setBezig(true); setFout("");
    try {
      setDag(await trackerApi.addRegel(datum, payload));
      // Bewaren als favoriet en onthouden bij de streepjescode zijn extra's:
      // de regel staat al in het logboek, ook als die stappen misgaan.
      if (alsFavoriet) {
        await trackerApi.bewaarFavoriet(payload).catch(() => {});
      }
      if (onthoudBij) {
        await trackerApi.onthoudBijBarcode(onthoudBij.barcode, {
          name: payload.name,
          brand: payload.brand,
          per100: onthoudBij.per100,
          eenheid: onthoudBij.eenheid,
        }).catch(() => {});
      }
      ga(`/tracker?datum=${datum}`);
    } catch (e) {
      setFout(bericht(e));
    } finally { setBezig(false); }
  };

  const bewaarProfiel = async (p: Partial<Profile>) => {
    setBezig(true); setFout(""); setOpgeslagen(false);
    try {
      const antwoord = await trackerApi.saveProfiel(p);
      setProfiel(antwoord.profiel);
      setOpgeslagen(true);
    } catch (e) {
      setFout(bericht(e));
    } finally { setBezig(false); }
  };

  const schaal = profiel?.points_scale ?? 1;
  const gebruikt = dag ? toonPunten(dag.totals.points_raw, schaal) : 0;
  // Bewegingspunten verruimen het budget van die dag; de kop toont hetzelfde
  // getal als de ring op het dagoverzicht.
  const budgetVandaag = (profiel?.daily_budget ?? 0)
    + (dag ? dagBewegingspunten(dag.activity).meetellend : 0);

  return (
    <div style={T.app}>
      <header style={T.header}>
        <Activity size={22} style={{ color: "var(--accent)" }} />
        <h1 style={T.titel}>Tracker</h1>
        <div style={T.headerRechts}>
          {profiel && (
            <span style={T.headerSub}>{gebruikt} / {budgetVandaag} pt</span>
          )}
        </div>
      </header>

      <main style={T.main}>
        {laden || !dag ? (
          <div style={T.center}>
            <Loader2 size={26} className="spin" style={{ color: "var(--accent)" }} />
          </div>
        ) : (
          <div style={T.inhoud}>
            {pagina === "dag" && (
              <Dagoverzicht
                dag={dag} profiel={profiel} datum={datum} vandaag={vandaag}
                buffer={week?.week
                  ? { rest: week.week.bufferRest, totaal: week.week.bufferTotaal, dagenTeGaan: week.dagenTeGaan }
                  : null}
                moetWegen={gewicht?.moetWegen ?? false}
                onDatum={(d) => { setDatum(d); ga(`/tracker?datum=${d}`); }}
                onWis={wisRegel}
                onToevoegen={(m) => ga(`/tracker/toevoegen?datum=${datum}&maaltijd=${m}`)}
                onInstellingen={() => ga("/tracker/instellingen")}
                onWegen={() => ga("/tracker/gewicht")}
                bewegingBezig={bezig} bewegingFout={fout}
                onBeweging={voegBewegingToe} onWisBeweging={wisBeweging}
              />
            )}

            {pagina === "toevoegen" && (
              <Toevoegen
                maaltijd={maaltijd} datumLabel={toonDatum(datum, vandaag)}
                bezig={bezig} fout={fout} schaal={schaal} onOpslaan={voegToe}
              />
            )}

            {pagina === "week" && (
              <Weekoverzicht
                week={week?.week ?? null} dagenTeGaan={week?.dagenTeGaan ?? 0}
                peildatum={weekDatum} vandaag={vandaag} onPeildatum={setWeekDatum}
              />
            )}

            {pagina === "gewicht" && gewicht && (
              <Gewicht
                gegevens={gewicht} vandaag={vandaag} bezig={bezig} fout={fout}
                herberekend={herberekend} onWeeg={weeg} onWis={wisWeging}
              />
            )}

            {pagina === "import" && (
              <Import
                gedeeldeUrl={gedeeldeUrl} datumLabel={toonDatum(datum, vandaag)}
                schaal={schaal} bezig={bezig} fout={fout}
                onLog={(payload) => voegToe(payload, false)}
              />
            )}

            {pagina === "instellingen" && (
              <Instellingen
                profiel={profiel} bezig={bezig} fout={fout} opgeslagen={opgeslagen}
                onOpslaan={bewaarProfiel}
              />
            )}
          </div>
        )}
      </main>

      <nav style={T.nav}>
        {PAGINAS.map((p) => (
          <button key={p.id} onClick={() => ga(p.id === "dag" ? `/tracker?datum=${datum}` : p.pad)}
            style={{ ...T.navBtn, ...(pagina === p.id ? T.navBtnActief : {}) }}>
            <p.icon size={20} />
            <span style={T.navLabel}>{p.label}</span>
          </button>
        ))}
        <button onClick={() => ga("/")} style={T.navBtn}>
          <BookOpen size={20} />
          <span style={T.navLabel}>Kookboek</span>
        </button>
      </nav>
    </div>
  );
}

// Een gok op basis van het tijdstip, zodat het invoerscherm meestal meteen
// goed staat.
function standaardMaaltijd(): Maaltijd {
  const u = new Date().getHours();
  if (u < 10) return "ontbijt";
  if (u < 15) return "lunch";
  if (u < 21) return "diner";
  return "snack";
}

function bericht(e: unknown): string {
  return e instanceof Error ? e.message : "Er ging iets mis";
}
