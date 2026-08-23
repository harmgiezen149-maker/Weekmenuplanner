"use client";

import React, { useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { T } from "./stijl";
import { berekenBudget, eiwitDoelGram } from "@/lib/tracker/budget";
import {
  ACTIVITEITSFACTOREN, EIWIT_PER_KG_STREEFGEWICHT, STANDAARD_WEEKBUFFER, WEEGDAGEN,
} from "@/lib/tracker/types";
import type { Geslacht, Profile } from "@/lib/tracker/types";
import { nl } from "@/lib/tracker/datum";

export default function Instellingen({
  profiel, bezig, fout, opgeslagen, onOpslaan,
}: {
  profiel: Profile | null;
  bezig: boolean;
  fout: string;
  opgeslagen: boolean;
  onOpslaan: (p: Partial<Profile>) => void;
}) {
  const [naam, setNaam] = useState(profiel?.name ?? "");
  const [sex, setSex] = useState<Geslacht>(profiel?.sex ?? "man");
  const [geboorte, setGeboorte] = useState(profiel?.birthdate ?? "");
  const [lengte, setLengte] = useState(str(profiel?.height_cm));
  const [factor, setFactor] = useState(profiel?.activity_factor ?? 1.375);
  const [gewicht, setGewicht] = useState(str(profiel?.current_weight_kg));
  const [streef, setStreef] = useState(str(profiel?.goal_weight_kg));
  const [weegdag, setWeegdag] = useState(profiel?.weigh_day ?? 6);
  const [schaal, setSchaal] = useState(str(profiel?.points_scale ?? 1));
  const [eiwitAan, setEiwitAan] = useState((profiel?.protein_target_g ?? 1) > 0);

  const compleet =
    geboorte !== "" && getal(lengte) > 0 && getal(gewicht) > 0 && getal(streef) > 0;

  // Zelfde functie als de server gebruikt, dus wat hier staat is wat er wordt
  // opgeslagen.
  const voorbeeld = useMemo(() => {
    if (!compleet) return null;
    return berekenBudget({
      sex, birthdate: geboorte, height_cm: getal(lengte), activity_factor: factor,
      current_weight_kg: getal(gewicht), goal_weight_kg: getal(streef),
      points_scale: getal(schaal) || 1,
    });
  }, [compleet, sex, geboorte, lengte, factor, gewicht, streef, schaal]);

  const eiwitDoel = eiwitDoelGram(getal(streef) || getal(gewicht), EIWIT_PER_KG_STREEFGEWICHT);

  const opslaan = () => {
    if (!compleet || bezig) return;
    onOpslaan({
      name: naam.trim(),
      sex,
      birthdate: geboorte,
      height_cm: getal(lengte),
      activity_factor: factor,
      start_weight_kg: profiel?.start_weight_kg ?? getal(gewicht),
      current_weight_kg: getal(gewicht),
      goal_weight_kg: getal(streef),
      weigh_day: weegdag,
      points_scale: getal(schaal) || 1,
      weekly_buffer: profiel?.weekly_buffer ?? STANDAARD_WEEKBUFFER,
      protein_target_g: eiwitAan ? eiwitDoel : 0,
      created_at: profiel?.created_at,
    } as Partial<Profile>);
  };

  return (
    <>
      {fout && <div style={T.fout}>{fout}</div>}

      <h2 style={{ ...T.sectieKop, marginTop: 0 }}>Over jou</h2>

      <div style={T.veldVak}>
        <label style={T.label} htmlFor="in-naam">Naam (optioneel)</label>
        <input id="in-naam" style={T.veld} value={naam} onChange={(e) => setNaam(e.target.value)} />
      </div>

      <div style={T.veldVak}>
        <span style={T.label}>Geslacht</span>
        <div style={T.chips}>
          {(["man", "vrouw"] as Geslacht[]).map((g) => (
            <button key={g} type="button" onClick={() => setSex(g)}
              style={{ ...T.chip, ...(sex === g ? T.chipAan : {}) }}>
              {g === "man" ? "Man" : "Vrouw"}
            </button>
          ))}
        </div>
        <p style={T.hint}>De formule voor je basaal metabolisme rekent hier anders mee.</p>
      </div>

      <div style={T.veldRij}>
        <div style={{ flex: 1 }}>
          <label style={T.label} htmlFor="in-geb">Geboortedatum</label>
          <input id="in-geb" type="date" style={T.veld} value={geboorte}
            onChange={(e) => setGeboorte(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={T.label} htmlFor="in-lengte">Lengte (cm)</label>
          <input id="in-lengte" style={T.veld} value={lengte} inputMode="decimal"
            onChange={(e) => setLengte(e.target.value)} />
        </div>
      </div>

      <div style={T.veldRij}>
        <div style={{ flex: 1 }}>
          <label style={T.label} htmlFor="in-gewicht">Huidig gewicht (kg)</label>
          <input id="in-gewicht" style={T.veld} value={gewicht} inputMode="decimal"
            onChange={(e) => setGewicht(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={T.label} htmlFor="in-streef">Streefgewicht (kg)</label>
          <input id="in-streef" style={T.veld} value={streef} inputMode="decimal"
            onChange={(e) => setStreef(e.target.value)} />
        </div>
      </div>

      <div style={T.veldVak}>
        <span style={T.label}>Hoe actief ben je?</span>
        <div style={T.chips}>
          {ACTIVITEITSFACTOREN.map((a) => (
            <button key={a.waarde} type="button" onClick={() => setFactor(a.waarde)}
              style={{ ...T.chip, ...(factor === a.waarde ? T.chipAan : {}) }}>
              {a.label}
            </button>
          ))}
        </div>
        <p style={T.hint}>
          {ACTIVITEITSFACTOREN.find((a) => a.waarde === factor)?.uitleg}
        </p>
      </div>

      <h2 style={T.sectieKop}>Je dagbudget</h2>

      {!compleet && (
        <div style={T.melding}>
          Vul je geboortedatum, lengte, gewicht en streefgewicht in, dan verschijnt hier je budget.
        </div>
      )}

      {voorbeeld && (
        <div style={T.kaart}>
          <Uitslag label="Basaal metabolisme" waarde={`${Math.round(voorbeeld.bmr)} kcal`} />
          <Uitslag label="Onderhoudsbehoefte" waarde={`${Math.round(voorbeeld.tdee)} kcal`} />
          <Uitslag
            label="Beoogde afname"
            waarde={voorbeeld.opOnderhoud ? "geen (op streefgewicht)" : `${nl(voorbeeld.afnamePerWeekKg, 2)} kg per week`}
          />
          <Uitslag label="Dagelijks tekort" waarde={`${Math.round(voorbeeld.tekortPerDagKcal)} kcal`} />
          <Uitslag label="Doel per dag" waarde={`${Math.round(voorbeeld.doelKcal)} kcal`} />
          <div style={{ ...T.uitslagRij, borderBottom: "none", paddingTop: 12 }}>
            <span style={{ ...T.uitslagLabel, color: "var(--ink)", fontWeight: 800 }}>Dagbudget</span>
            <span style={{ ...T.uitslagWaarde, color: "var(--accent)", fontSize: 20, fontWeight: 800 }}>
              {voorbeeld.dagbudgetPunten} punten
            </span>
          </div>

          {voorbeeld.begrensdDoorBmr && (
            <div style={{ ...T.waarschuwing, marginBottom: 0, marginTop: 10 }}>
              Het tekort zou je onder je basaal metabolisme brengen. Het budget is daarom
              afgetopt op {Math.round(voorbeeld.bmr)} kcal — verder omlaag gaat de app niet.
            </div>
          )}
          {voorbeeld.opOnderhoud && (
            <div style={{ ...T.waarschuwing, marginBottom: 0, marginTop: 10 }}>
              Je zit op of onder je streefgewicht. Het budget staat op onderhoud, zonder tekort.
            </div>
          )}
        </div>
      )}

      <p style={T.hint}>
        Het tempo is maximaal een half procent van je lichaamsgewicht per week, met een plafond
        van 0,75 kg. Word je lichter, dan schaalt het tempo automatisch mee omlaag.
      </p>

      <h2 style={T.sectieKop}>Fijnafstelling</h2>

      <div style={T.veldVak}>
        <label style={T.label} htmlFor="in-schaal">Puntenschaal</label>
        <input id="in-schaal" style={T.veld} value={schaal} inputMode="decimal"
          onChange={(e) => setSchaal(e.target.value)} />
        <p style={T.hint}>
          De enige knop om het puntenniveau te verschuiven. Op 1,0 komt een dag rond de
          40 tot 50 punten uit; zet hem op 0,75 als je liever rond de 30 zit. Hij werkt met
          terugwerkende kracht op je hele logboek.
        </p>
      </div>

      <div style={T.veldVak}>
        <label style={T.label} htmlFor="in-weegdag">Weegdag</label>
        <select id="in-weegdag" style={T.veld} value={weegdag}
          onChange={(e) => setWeegdag(Number(e.target.value))}>
          {WEEGDAGEN.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </select>
        <p style={T.hint}>Op deze dag reset de weekbuffer van {profiel?.weekly_buffer ?? STANDAARD_WEEKBUFFER} punten.</p>
      </div>

      <div style={T.veldVak}>
        <span style={T.label}>Eiwitdoel tonen</span>
        <div style={T.chips}>
          <button type="button" onClick={() => setEiwitAan(true)}
            style={{ ...T.chip, ...(eiwitAan ? T.chipAan : {}) }}>Aan</button>
          <button type="button" onClick={() => setEiwitAan(false)}
            style={{ ...T.chip, ...(!eiwitAan ? T.chipAan : {}) }}>Uit</button>
        </div>
        <p style={T.hint}>
          {eiwitAan
            ? `Streefwaarde ${eiwitDoel} g per dag: ${nl(EIWIT_PER_KG_STREEFGEWICHT)} g per kg streefgewicht. Genoeg eiwit helpt spiermassa behouden tijdens het afvallen.`
            : "Op het dagoverzicht verschijnt geen eiwitbalk."}
        </p>
      </div>

      <button style={{ ...T.primair, opacity: compleet && !bezig ? 1 : 0.5 }}
        onClick={opslaan} disabled={!compleet || bezig}>
        {bezig
          ? <><Loader2 size={16} className="spin" /> Opslaan...</>
          : <><Check size={16} /> {opgeslagen ? "Opgeslagen" : "Opslaan"}</>}
      </button>
    </>
  );
}

function Uitslag({ label, waarde }: { label: string; waarde: string }) {
  return (
    <div style={T.uitslagRij}>
      <span style={T.uitslagLabel}>{label}</span>
      <span style={T.uitslagWaarde}>{waarde}</span>
    </div>
  );
}

function str(n: number | undefined): string {
  return n == null || n === 0 ? "" : String(n);
}

function getal(s: string): number {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
