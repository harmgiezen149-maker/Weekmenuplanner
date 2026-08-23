"use client";

import React from "react";
import { Clock, PencilLine, Plus, Star, Trash2, UtensilsCrossed } from "lucide-react";
import { T } from "./stijl";
import { toonPunten } from "@/lib/tracker/points";
import { telComponentenOp } from "@/lib/tracker/maaltijd";
import { nl } from "@/lib/tracker/datum";
import { MAALTIJDEN_TRACKER, MAALTIJD_LABEL } from "@/lib/tracker/types";
import type { FoodTemplate, Maaltijd, Maaltijdsjabloon } from "@/lib/tracker/types";

/**
 * Favorieten en recent gelogde items. In de praktijk de snelste route: wat je
 * vaak eet staat bovenaan en is met één tik gelogd bij de gekozen maaltijd.
 */
export default function Snel({
  maaltijden, favorieten, recent, maaltijd, onMaaltijd, schaal,
  onLog, onAanpassen, onWisFavoriet, onLogMaaltijd, onBewerkMaaltijd, onNieuweMaaltijd,
}: {
  maaltijden: Maaltijdsjabloon[];
  favorieten: FoodTemplate[];
  recent: FoodTemplate[];
  maaltijd: Maaltijd;
  onMaaltijd: (m: Maaltijd) => void;
  schaal: number;
  onLog: (t: FoodTemplate) => void;
  onAanpassen: (t: FoodTemplate) => void;
  onWisFavoriet: (id: string) => void;
  onLogMaaltijd: (m: Maaltijdsjabloon) => void;
  onBewerkMaaltijd: (m: Maaltijdsjabloon) => void;
  onNieuweMaaltijd: () => void;
}) {
  const leeg = maaltijden.length === 0 && favorieten.length === 0 && recent.length === 0;

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
          Hier komen je vaste maaltijden, je favorieten en wat je onlangs hebt
          gelogd te staan. Stel een maaltijd samen — een vast ontbijt, of een
          lunch met brood en beleg — en die is voortaan met één tik gelogd.
        </div>
      )}

      <h2 style={T.lijstKop}><UtensilsCrossed size={13} /> Vaste maaltijden</h2>

      {maaltijden.length > 0 && (
        <div style={T.kaartStrak}>
          {maaltijden.map((m) => {
            const totaal = telComponentenOp(m.components);
            return (
              <div key={m.id} style={T.regel}>
                <button style={{ ...T.resultaat, padding: 0, borderBottom: "none" }}
                  onClick={() => onLogMaaltijd(m)}>
                  <span style={T.resultaatTekst}>
                    <span style={T.resultaatNaam}>{m.name}</span>
                    <span style={T.resultaatSub}>
                      {m.components.length}{" "}
                      {m.components.length === 1 ? "onderdeel" : "onderdelen"}
                      {" · "}{Math.round(totaal.nutrients.kcal)} kcal
                      {" · "}{m.components.map((c) => c.name).join(", ")}
                    </span>
                  </span>
                  <span style={T.puntBadge}>{toonPunten(totaal.points_raw, schaal)}</span>
                </button>
                <button style={T.potloodKnop} onClick={() => onBewerkMaaltijd(m)}
                  aria-label={`${m.name} aanpassen`}>
                  <PencilLine size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button style={{ ...T.secundair, marginTop: maaltijden.length > 0 ? 10 : 0 }}
        onClick={onNieuweMaaltijd}>
        <Plus size={16} /> Maaltijd samenstellen
      </button>

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
