"use client";

import React from "react";
import { Clock, PencilLine, Star, Trash2 } from "lucide-react";
import { T } from "./stijl";
import { toonPunten } from "@/lib/tracker/points";
import { nl } from "@/lib/tracker/datum";
import { MAALTIJDEN_TRACKER, MAALTIJD_LABEL } from "@/lib/tracker/types";
import type { FoodTemplate, Maaltijd } from "@/lib/tracker/types";

/**
 * Favorieten en recent gelogde items. In de praktijk de snelste route: wat je
 * vaak eet staat bovenaan en is met één tik gelogd bij de gekozen maaltijd.
 */
export default function Snel({
  favorieten, recent, maaltijd, onMaaltijd, schaal, onLog, onAanpassen, onWisFavoriet,
}: {
  favorieten: FoodTemplate[];
  recent: FoodTemplate[];
  maaltijd: Maaltijd;
  onMaaltijd: (m: Maaltijd) => void;
  schaal: number;
  onLog: (t: FoodTemplate) => void;
  onAanpassen: (t: FoodTemplate) => void;
  onWisFavoriet: (id: string) => void;
}) {
  const leeg = favorieten.length === 0 && recent.length === 0;

  return (
    <>
      <div style={T.veldVak}>
        <span style={T.label}>Voeg toe aan</span>
        <div style={T.chips}>
          {MAALTIJDEN_TRACKER.map((m) => (
            <button key={m} type="button" onClick={() => onMaaltijd(m)}
              style={{ ...T.chip, ...(maaltijd === m ? T.chipAan : {}) }}>
              {MAALTIJD_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      {leeg && (
        <div style={T.melding}>
          Hier komen je favorieten en wat je onlangs hebt gelogd te staan.
          Zoek of scan eerst een product, of voer er handmatig een in — daarna
          is het met één tik terug te vinden.
        </div>
      )}

      {favorieten.length > 0 && (
        <>
          <h2 style={T.lijstKop}><Star size={13} /> Favorieten</h2>
          <div style={T.kaartStrak}>
            {favorieten.map((f) => (
              <Regel key={f.id} t={f} schaal={schaal} onLog={onLog} onAanpassen={onAanpassen}
                onWis={() => onWisFavoriet(f.id)} />
            ))}
          </div>
        </>
      )}

      {recent.length > 0 && (
        <>
          <h2 style={T.lijstKop}><Clock size={13} /> Onlangs gelogd</h2>
          <div style={T.kaartStrak}>
            {recent.map((r) => (
              <Regel key={r.id} t={r} schaal={schaal} onLog={onLog} onAanpassen={onAanpassen} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Regel({ t, schaal, onLog, onAanpassen, onWis }: {
  t: FoodTemplate; schaal: number;
  onLog: (t: FoodTemplate) => void;
  onAanpassen: (t: FoodTemplate) => void;
  onWis?: () => void;
}) {
  return (
    <div style={T.regel}>
      <button style={{ ...T.resultaat, padding: 0, borderBottom: "none" }} onClick={() => onLog(t)}>
        <span style={T.resultaatTekst}>
          <span style={T.resultaatNaam}>{t.name}</span>
          <span style={T.resultaatSub}>
            {nl(t.amount)} {t.unit}
            {t.brand ? ` · ${t.brand}` : ""}
            {` · ${Math.round(t.nutrients.kcal)} kcal`}
          </span>
        </span>
        <span style={T.puntBadge}>{toonPunten(t.points_raw, schaal)}</span>
      </button>
      <button style={T.potloodKnop} onClick={() => onAanpassen(t)}
        aria-label={`${t.name} met andere hoeveelheid toevoegen`}>
        <PencilLine size={15} />
      </button>
      {onWis && (
        <button style={T.wisKnop} onClick={onWis} aria-label={`${t.name} uit favorieten verwijderen`}>
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}
