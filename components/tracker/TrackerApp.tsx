"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, BookOpen, ListPlus, Loader2, Settings } from "lucide-react";
import { T } from "./stijl";
import Dagoverzicht, { toonDatum } from "./Dagoverzicht";
import Toevoegen from "./Toevoegen";
import Instellingen from "./Instellingen";
import { trackerApi } from "./api";
import { datumSleutel } from "@/lib/tracker/datum";
import { toonPunten } from "@/lib/tracker/points";
import type { Day, Maaltijd, Profile } from "@/lib/tracker/types";
import { MAALTIJDEN_TRACKER } from "@/lib/tracker/types";

export type Pagina = "dag" | "toevoegen" | "instellingen";

const PAGINAS: { id: Pagina; pad: string; label: string; icon: typeof Activity }[] = [
  { id: "dag", pad: "/tracker", label: "Vandaag", icon: Activity },
  { id: "toevoegen", pad: "/tracker/toevoegen", label: "Toevoegen", icon: ListPlus },
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

  // De datum en de gekozen maaltijd reizen via de URL mee naar het
  // invoerscherm, zodat "toevoegen bij lunch" op de juiste plek belandt.
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
        const [p, d] = await Promise.all([trackerApi.getProfiel(), trackerApi.getDag(datum)]);
        if (afgebroken) return;
        setProfiel(p.profiel);
        setDag(d);
      } catch (e) {
        if (!afgebroken) setFout(bericht(e));
      } finally {
        if (!afgebroken) setLaden(false);
      }
    })();
    return () => { afgebroken = true; };
  }, [datum]);

  const ga = useCallback((pad: string) => { router.push(pad); }, [router]);

  const wisRegel = async (id: string) => {
    setFout("");
    try {
      setDag(await trackerApi.wisRegel(datum, id));
    } catch (e) { setFout(bericht(e)); }
  };

  const voegToe = async (payload: Record<string, unknown>, alsFavoriet = false) => {
    setBezig(true); setFout("");
    try {
      setDag(await trackerApi.addRegel(datum, payload));
      // Het bewaren als favoriet mag de regel zelf niet in de weg zitten:
      // die staat al in het logboek, ook als dit misgaat.
      if (alsFavoriet) {
        await trackerApi.bewaarFavoriet(payload).catch(() => {});
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

  return (
    <div style={T.app}>
      <header style={T.header}>
        <Activity size={22} style={{ color: "var(--accent)" }} />
        <h1 style={T.titel}>Tracker</h1>
        <div style={T.headerRechts}>
          {profiel && (
            <span style={T.headerSub}>{gebruikt} / {profiel.daily_budget} pt</span>
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
                onDatum={(d) => { setDatum(d); ga(`/tracker?datum=${d}`); }}
                onWis={wisRegel}
                onToevoegen={(m) => ga(`/tracker/toevoegen?datum=${datum}&maaltijd=${m}`)}
                onInstellingen={() => ga("/tracker/instellingen")}
              />
            )}

            {pagina === "toevoegen" && (
              <Toevoegen
                maaltijd={maaltijd} datumLabel={toonDatum(datum, vandaag)}
                bezig={bezig} fout={fout} schaal={schaal} onOpslaan={voegToe}
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
