"use client";

import React, { useState } from "react";
import { ArrowLeft, Check, Loader2, PencilLine, Plus, Trash2 } from "lucide-react";
import { T } from "./stijl";
import Onderdeelkiezer from "./Onderdeelkiezer";
import Portiekiezer, { naarPer100 } from "./Portiekiezer";
import { rawPoints, toonPunten } from "@/lib/tracker/points";
import { telComponentenOp } from "@/lib/tracker/maaltijd";
import { nl } from "@/lib/tracker/datum";
import { naamUitStukEenheid } from "@/lib/tracker/portie";
import { MAALTIJDEN_TRACKER, MAALTIJD_LABEL } from "@/lib/tracker/types";
import type { FoodTemplate, Maaltijd, MaaltijdComponent, Maaltijdsjabloon, Nutrients, Product } from "@/lib/tracker/types";

/**
 * Een maaltijd samenstellen uit losse onderdelen: een vast ontbijt, een lunch
 * met brood en beleg.
 *
 * De punten die hier bovenaan staan zijn de som van de onderdelen. Elk
 * onderdeel houdt zijn eigen categorie, dus de melksuiker in een glas melk
 * telt niet mee terwijl de suiker in havermout dat wel doet.
 */
export default function Maaltijdbouwer({
  bestaand, favorieten, recent, schaal, bezig, fout, onOpslaan, onTerug,
}: {
  bestaand?: Maaltijdsjabloon;
  favorieten: FoodTemplate[];
  recent: FoodTemplate[];
  schaal: number;
  bezig: boolean;
  fout: string;
  onOpslaan: (m: Omit<Maaltijdsjabloon, "created_at" | "last_used">) => void;
  onTerug: () => void;
}) {
  const [naam, setNaam] = useState(bestaand?.name ?? "");
  const [maal, setMaal] = useState<Maaltijd>(bestaand?.meal ?? "ontbijt");
  const [componenten, setComponenten] = useState<MaaltijdComponent[]>(bestaand?.components ?? []);
  const [zoekt, setZoekt] = useState(false);
  const [gekozen, setGekozen] = useState<Product | null>(null);
  // Index van het onderdeel dat wordt aangepast; null = er wordt iets nieuws
  // toegevoegd. Portiekiezer kent zelf geen onderscheid tussen die twee.
  const [bewerktIndex, setBewerktIndex] = useState<number | null>(null);

  const totaal = telComponentenOp(componenten);
  const punten = toonPunten(totaal.points_raw, schaal);
  const kanOpslaan = naam.trim().length > 0 && componenten.length > 0 && !bezig;

  const voegToe = (payload: Record<string, unknown>) => {
    const nutrients = payload.nutrients as Nutrients;
    const grams = Number(payload.grams) || 0;
    const component: MaaltijdComponent = {
      id: bewerktIndex != null ? componenten[bewerktIndex].id : `${Date.now()}-${componenten.length}`,
      name: String(payload.name ?? "Onderdeel"),
      ...(payload.brand ? { brand: String(payload.brand) } : {}),
      amount: Number(payload.amount) || grams,
      unit: String(payload.unit ?? "g"),
      grams,
      nutrients,
      // Dezelfde formule als de server, zodat het totaal boven in beeld
      // meteen klopt. De server rekent het bij het opslaan opnieuw uit en
      // blijft de bron van waarheid.
      points_raw: rawPoints(nutrients, grams),
    };
    setComponenten((lijst) => bewerktIndex != null
      ? lijst.map((c, i) => (i === bewerktIndex ? component : c))
      : [...lijst, component]);
    sluitPortie();
  };

  /** Een favoriet in één tik toevoegen, in de hoeveelheid die bewaard staat. */
  const voegComponentToe = (c: MaaltijdComponent) => {
    setComponenten((lijst) => [...lijst, { ...c, id: `${c.id}-${lijst.length}` }]);
    setZoekt(false);
  };

  const sluitPortie = () => {
    setGekozen(null);
    setBewerktIndex(null);
    setZoekt(false);
  };

  // De hoeveelheid van een bestaand onderdeel aanpassen: terug naar waarden
  // per 100, zodat de portiekiezer het weer als product kan tonen.
  const bewerkComponent = (i: number) => {
    const c = componenten[i];
    const stuk = naamUitStukEenheid(c.unit);
    const perStuk = stuk && c.amount > 0
      ? { grams: c.grams / c.amount, label: stuk }
      : { grams: c.grams, label: "zoals bewaard" };
    setBewerktIndex(i);
    setGekozen({
      id: c.id,
      name: c.name,
      ...(c.brand ? { brand: c.brand } : {}),
      bron: "bewaard",
      eenheid: c.unit === "ml" ? "ml" : "g",
      per100: naarPer100(c.nutrients, c.grams),
      portie: perStuk,
    });
  };

  // Onderdeel toevoegen of aanpassen: eerst kiezen (bij aanpassen al bekend),
  // dan de hoeveelheid.
  if (gekozen) {
    return (
      <Portiekiezer
        product={gekozen} maaltijd={maal} datumLabel="" schaal={schaal}
        bezig={false} fout="" modus="component"
        onOpslaan={voegToe}
        onTerug={sluitPortie}
      />
    );
  }

  if (zoekt) {
    return (
      <Onderdeelkiezer
        favorieten={favorieten} recent={recent} schaal={schaal}
        onDirect={voegComponentToe}
        onKiesProduct={setGekozen}
        onTerug={() => setZoekt(false)}
      />
    );
  }

  return (
    <>
      <button style={T.terugKnop} onClick={onTerug}>
        <ArrowLeft size={15} /> Terug
      </button>

      {fout && <div style={T.fout}>{fout}</div>}

      <div style={T.live} role="status" aria-live="polite">
        <span style={T.liveGetal}>{punten}</span>
        <span style={T.liveTekst}>
          {punten === 1 ? "punt" : "punten"} voor deze maaltijd<br />
          {componenten.length} {componenten.length === 1 ? "onderdeel" : "onderdelen"}
          {componenten.length > 0 && ` · ${Math.round(totaal.nutrients.kcal)} kcal`}
        </span>
      </div>

      <div style={T.veldVak}>
        <label style={T.label} htmlFor="mb-naam">Naam van de maaltijd</label>
        <input id="mb-naam" style={T.veld} value={naam} onChange={(e) => setNaam(e.target.value)}
          placeholder="Bijvoorbeeld: mijn standaard ontbijt" autoFocus />
      </div>

      <div style={T.veldVak}>
        <span style={T.label}>Hoort standaard bij</span>
        <div style={T.chips}>
          {MAALTIJDEN_TRACKER.map((m) => (
            <button key={m} type="button" onClick={() => setMaal(m)}
              style={{ ...T.chip, ...(maal === m ? T.chipAan : {}) }}>
              {MAALTIJD_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      <h2 style={T.lijstKop}>Onderdelen</h2>

      {componenten.length === 0 && (
        <div style={T.melding}>
          Nog geen onderdelen. Voeg toe wat er standaard in gaat — bijvoorbeeld
          havermout, melk en een banaan.
        </div>
      )}

      {componenten.length > 0 && (
        <div style={T.kaartStrak}>
          {componenten.map((c, i) => (
            <div key={c.id} style={T.regel}>
              <div style={T.regelTekst}>
                <div style={T.regelNaam}>{c.name}</div>
                <div style={T.regelSub}>
                  {nl(c.amount)} {c.unit} · {Math.round(c.nutrients.kcal)} kcal
                </div>
              </div>
              <span style={T.puntBadge}>{toonPunten(c.points_raw, schaal)}</span>
              <button style={T.potloodKnop} onClick={() => bewerkComponent(i)}
                aria-label={`${c.name}: hoeveelheid aanpassen`}>
                <PencilLine size={15} />
              </button>
              <button style={T.wisKnop}
                onClick={() => setComponenten((l) => l.filter((_, j) => j !== i))}
                aria-label={`${c.name} uit de maaltijd verwijderen`}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button style={T.secundair} onClick={() => setZoekt(true)}>
        <Plus size={16} /> Onderdeel toevoegen
      </button>

      <button style={{ ...T.primair, opacity: kanOpslaan ? 1 : 0.5 }} disabled={!kanOpslaan}
        onClick={() => onOpslaan({
          id: bestaand?.id ?? "",
          name: naam.trim(),
          meal: maal,
          components: componenten,
        })}>
        {bezig
          ? <><Loader2 size={16} className="spin" /> Opslaan...</>
          : <><Check size={16} /> {bestaand ? "Maaltijd bijwerken" : "Maaltijd bewaren"}</>}
      </button>

      <p style={T.hint}>
        De punten zijn de som van de onderdelen, elk met zijn eigen soort product.
        Daardoor telt de melksuiker in zuivel en de suiker in vers fruit niet mee,
        ook niet als ze samen in één maaltijd zitten.
      </p>
    </>
  );
}
