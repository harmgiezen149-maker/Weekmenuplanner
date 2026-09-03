"use client";

import React, { useMemo, useState } from "react";
import {
  ChevronLeft, ChevronRight, ChevronDown, Minus, PencilLine, Plus, Trash2, Settings, Scale,
  Footprints, UtensilsCrossed,
} from "lucide-react";
import { T } from "./stijl";
import Ring from "./Ring";
import { toonPunten } from "@/lib/tracker/points";
import { MAALTIJDEN_TRACKER, MAALTIJD_LABEL } from "@/lib/tracker/types";
import { nl, verschuifDatum } from "@/lib/tracker/datum";
import { dagBewegingspunten } from "@/lib/tracker/activiteit";
import { aantalvak, factorVoor, schaalEntry } from "@/lib/tracker/regel";
import Beweging from "./Beweging";
import Maaltijdmaker from "./Maaltijdmaker";
import type { Day, Entry, Maaltijd, Profile } from "@/lib/tracker/types";

const NL_DATUM = new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long" });

export function toonDatum(datum: string, vandaag: string): string {
  if (datum === vandaag) return "Vandaag";
  const d = new Date(datum + "T12:00:00");
  const gisteren = new Date(vandaag + "T12:00:00");
  gisteren.setDate(gisteren.getDate() - 1);
  if (d.toDateString() === gisteren.toDateString()) return "Gisteren";
  return NL_DATUM.format(d);
}

export default function Dagoverzicht({
  dag, profiel, datum, vandaag, buffer, moetWegen,
  onDatum, onWis, onWijzig, onToevoegen, onInstellingen, onWegen,
  bewegingBezig, bewegingFout, onBeweging, onWisBeweging,
}: {
  dag: Day;
  profiel: Profile | null;
  datum: string;
  vandaag: string;
  /** Restant van de weekbuffer en het aantal dagen dat de week nog telt. */
  buffer: { rest: number; totaal: number; dagenTeGaan: number } | null;
  moetWegen: boolean;
  onDatum: (d: string) => void;
  onWis: (id: string) => void;
  /** Een regel op een ander aantal zetten; de body gaat als PATCH mee. */
  onWijzig: (regel: Record<string, unknown>) => void;
  onToevoegen: (m: Maaltijd) => void;
  onInstellingen: () => void;
  onWegen: () => void;
  bewegingBezig: boolean;
  bewegingFout: string;
  onBeweging: (soort: string, minuten: number) => void;
  onWisBeweging: (id: string) => void;
}) {
  const [bewegingOpen, setBewegingOpen] = useState(false);
  // Welk eetmoment op dit moment als maaltijd of recept wordt bewaard.
  const [maakt, setMaakt] = useState<Maaltijd | null>(null);
  const beweging = dagBewegingspunten(dag.activity);
  const schaal = profiel?.points_scale ?? 1;
  const budget = profiel?.daily_budget ?? 0;

  // Eén afronding over het dagtotaal, niet per regel: zo stapelen
  // afrondingsfouten zich niet op over een dag met tien items.
  const gebruikt = toonPunten(dag.totals.points_raw, schaal);
  // Bewegingspunten verruimen het budget van vandaag, tot het dagplafond.
  const budgetVandaag = budget + beweging.meetellend;
  const rest = budgetVandaag - gebruikt;

  const perMaaltijd = useMemo(() => {
    const groepen: Record<Maaltijd, Entry[]> = { ontbijt: [], lunch: [], diner: [], snack: [] };
    for (const e of dag.entries) (groepen[e.meal] ?? groepen.snack).push(e);
    return groepen;
  }, [dag.entries]);

  const verschuif = (dagen: number) => onDatum(verschuifDatum(datum, dagen));

  const eiwitDoel = profiel?.protein_target_g ?? 0;
  const eiwit = Math.round(dag.totals.protein_g);

  return (
    <>
      <div style={T.datumBalk}>
        <button style={T.datumKnop} onClick={() => verschuif(-1)} aria-label="Vorige dag">
          <ChevronLeft size={18} />
        </button>
        <span style={T.datumLabel}>{toonDatum(datum, vandaag)}</span>
        {datum !== vandaag && (
          <button style={T.vandaagKnop} onClick={() => onDatum(vandaag)}>Vandaag</button>
        )}
        <button
          style={{ ...T.datumKnop, opacity: datum >= vandaag ? 0.35 : 1 }}
          onClick={() => verschuif(1)}
          disabled={datum >= vandaag}
          aria-label="Volgende dag"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {moetWegen && profiel && (
        <button style={T.weegPrompt} onClick={onWegen}>
          <Scale size={20} style={{ flexShrink: 0 }} />
          <span style={{ textAlign: "left" }}>
            <span style={T.weegPromptKop}>Het is je weegdag</span>
            <span style={T.weegPromptSub}>
              Eén getal is genoeg. Daarna reset de weekbuffer en kijkt de app of je
              budget nog klopt.
            </span>
          </span>
        </button>
      )}

      {!profiel && (
        <div style={T.melding}>
          <strong style={{ color: "var(--ink)" }}>Nog geen profiel ingevuld.</strong><br />
          Vul je lengte, gewicht en activiteitsniveau in, dan berekent de app je dagbudget.
          <button style={T.primair} onClick={onInstellingen}>
            <Settings size={16} /> Naar instellingen
          </button>
        </div>
      )}

      {profiel && (
        <div style={T.kaart}>
          <div style={T.ringWrap}>
            <Ring gebruikt={gebruikt} budget={budgetVandaag} />
            <div style={T.ringCijfers}>
              <div style={T.ringGroot}>{gebruikt}</div>
              <div style={T.ringSub}>
                van {budgetVandaag} punten
                {beweging.meetellend > 0 && (
                  <span style={{ color: "var(--green)", fontWeight: 700 }}>
                    {" "}(+{beweging.meetellend} beweging)
                  </span>
                )}
              </div>
              <div style={{ ...T.ringRegel, color: rest < 0 ? "var(--red)" : "var(--green)" }}>
                {rest >= 0 ? `${rest} punten te gaan` : `${Math.abs(rest)} punten over budget`}
              </div>
            </div>
          </div>

          {buffer && (
            <div style={T.balkWrap}>
              <div style={T.balkKop}>
                <span>Weekbuffer</span>
                <span style={{ color: buffer.rest < 0 ? "var(--red)" : "var(--sub)" }}>
                  {buffer.rest < 0
                    ? `${Math.abs(buffer.rest)} eroverheen`
                    : `${buffer.rest} van ${buffer.totaal} over`}
                  {` · nog ${buffer.dagenTeGaan} ${buffer.dagenTeGaan === 1 ? "dag" : "dagen"}`}
                </span>
              </div>
              <div style={T.balkBaan}>
                <div style={{
                  ...T.balkVul,
                  width: `${Math.min(100, buffer.totaal > 0 ? ((buffer.totaal - buffer.rest) / buffer.totaal) * 100 : 0)}%`,
                  background: buffer.rest < 0 ? "var(--red)" : "var(--over)",
                }} />
              </div>
            </div>
          )}

          {eiwitDoel > 0 && (
            <div style={T.balkWrap}>
              <div style={T.balkKop}>
                <span>Eiwit</span>
                <span style={{ color: eiwit >= eiwitDoel ? "var(--green)" : "var(--sub)" }}>
                  {eiwit} / {eiwitDoel} g
                </span>
              </div>
              <div style={T.balkBaan}>
                <div style={{
                  ...T.balkVul,
                  width: `${Math.min(100, eiwitDoel > 0 ? (eiwit / eiwitDoel) * 100 : 0)}%`,
                  background: eiwit >= eiwitDoel ? "var(--green)" : "var(--accent)",
                }} />
              </div>
            </div>
          )}

          <div style={T.macroRij}>
            <span style={T.macro}><span style={T.macroWaarde}>{Math.round(dag.totals.kcal)}</span> kcal</span>
            <span style={T.macro}><span style={T.macroWaarde}>{nl(dag.totals.protein_g)}</span> g eiwit</span>
            <span style={T.macro}><span style={T.macroWaarde}>{nl(dag.totals.fat_g)}</span> g vet</span>
            <span style={T.macro}><span style={T.macroWaarde}>{nl(dag.totals.carbs_g)}</span> g koolh.</span>
            <span style={T.macro}><span style={T.macroWaarde}>{nl(dag.totals.fiber_g)}</span> g vezels</span>
          </div>
        </div>
      )}

      <section style={T.kaartStrak}>
        <header style={T.maaltijdKop}>
          <Footprints size={15} style={{ color: "var(--sub)" }} />
          <span style={T.maaltijdNaam}>Beweging</span>
          <span style={T.maaltijdPunten}>
            {beweging.meetellend > 0 ? `+${beweging.meetellend} pt` : "0 pt"}
          </span>
        </header>

        {dag.activity.length === 0 && !bewegingOpen && (
          <div style={T.maaltijdLeeg}>Nog niets gelogd.</div>
        )}

        {!bewegingOpen && dag.activity.map((a) => (
          <div key={a.id} style={T.regel}>
            <div style={T.regelTekst}>
              <div style={T.regelNaam}>{a.name}</div>
              <div style={T.regelSub}>{a.minutes} minuten</div>
            </div>
            <span style={T.puntBadge}>{a.points}</span>
          </div>
        ))}

        {!bewegingOpen && beweging.afgetopt && (
          <div style={T.maaltijdLeeg}>
            Je verdiende {beweging.ruw} punten; er tellen er {beweging.meetellend} mee.
            Schattingen van verbranding vallen structureel te hoog uit.
          </div>
        )}

        {bewegingOpen && (
          <div style={{ padding: "14px 15px" }}>
            <Beweging
              activiteiten={dag.activity} datumLabel={toonDatum(datum, vandaag)}
              bezig={bewegingBezig} fout={bewegingFout}
              onVoegToe={onBeweging} onWis={onWisBeweging}
            />
          </div>
        )}

        <button style={T.maaltijdPlus} onClick={() => setBewegingOpen((v) => !v)}>
          {bewegingOpen ? "Klaar" : <><Plus size={15} /> Beweging toevoegen</>}
        </button>
      </section>

      {MAALTIJDEN_TRACKER.map((m) => {
        const regels = perMaaltijd[m];
        const punten = toonPunten(regels.reduce((s, e) => s + e.points_raw, 0), schaal);
        return (
          <section key={m} style={T.kaartStrak}>
            <header style={T.maaltijdKop}>
              <span style={T.maaltijdNaam}>{MAALTIJD_LABEL[m]}</span>
              <span style={T.maaltijdPunten}>{punten} pt</span>
            </header>

            {regels.length === 0 && <div style={T.maaltijdLeeg}>Nog niets gelogd.</div>}

            {regels.map((e) => (
              <Regel key={e.id} entry={e} schaal={schaal} onWis={onWis} onWijzig={onWijzig} />
            ))}

            {maakt === m && (
              <Maaltijdmaker maaltijd={m} regels={regels} schaal={schaal}
                onKlaar={() => setMaakt(null)} />
            )}

            <div style={T.maaltijdVoet}>
              <button style={T.maaltijdPlus} onClick={() => onToevoegen(m)}>
                <Plus size={15} /> Toevoegen
              </button>
              {regels.length > 0 && maakt !== m && (
                <button style={T.maaltijdPlus} onClick={() => setMaakt(m)}>
                  <UtensilsCrossed size={15} /> Maaltijd of recept
                </button>
              )}
            </div>
          </section>
        );
      })}
    </>
  );
}

/**
 * Een regel in het logboek. Komt hij uit een samengestelde maaltijd of een
 * recept, dan zijn de onderdelen uit te klappen — anders is niet te zien waar
 * de punten vandaan komen.
 */
function Regel({ entry, schaal, onWis, onWijzig }: {
  entry: Entry; schaal: number;
  onWis: (id: string) => void;
  onWijzig: (regel: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  // Null zolang het aantal niet in bewerking is; anders wat er in het veld staat.
  const [aantal, setAantal] = useState<string | null>(null);
  const onderdelen = entry.components ?? [];
  const samengesteld = onderdelen.length > 0;

  const vak = aantalvak(entry);
  const nieuwAantal = getal(aantal ?? "");
  const factor = factorVoor(vak, nieuwAantal);

  return (
    <>
      <div style={T.regel}>
        {samengesteld ? (
          <button style={{ ...T.resultaat, padding: 0, borderBottom: "none" }}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}>
            <span style={T.resultaatTekst}>
              <span style={T.resultaatNaam}>{entry.name}</span>
              <span style={T.resultaatSub}>
                {toonHoeveelheid(entry)} · {onderdelen.length}{" "}
                {onderdelen.length === 1 ? "onderdeel" : "onderdelen"} ·{" "}
                {Math.round(entry.nutrients.kcal)} kcal
              </span>
            </span>
            <ChevronDown size={15} style={{
              color: "var(--sub)", flexShrink: 0,
              transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s",
            }} />
          </button>
        ) : (
          <div style={T.regelTekst}>
            <div style={T.regelNaam}>{entry.name}</div>
            <div style={T.regelSub}>
              {toonHoeveelheid(entry)}
              {entry.brand ? ` · ${entry.brand}` : ""}
              {` · ${Math.round(entry.nutrients.kcal)} kcal`}
            </div>
          </div>
        )}
        <span style={T.puntBadge}>{toonPunten(entry.points_raw, schaal)}</span>
        <button style={T.potloodKnop}
          onClick={() => setAantal((a) => (a === null ? String(vak.waarde) : null))}
          aria-expanded={aantal !== null}
          aria-label={`Aantal van ${entry.name} aanpassen`}>
          <PencilLine size={15} />
        </button>
        <button style={T.wisKnop} onClick={() => onWis(entry.id)}
          aria-label={`${entry.name} verwijderen`}>
          <Trash2 size={15} />
        </button>
      </div>

      {aantal !== null && (
        <div style={T.aantalRij}>
          <div style={{ ...T.stapper, width: 132, flexShrink: 0 }}>
            <button type="button" style={T.stapKnop} aria-label="Eén minder"
              onClick={() => setAantal(stap(aantal, -vak.stap))}>
              <Minus size={15} />
            </button>
            <input style={T.stapVeld} value={aantal} inputMode="decimal"
              aria-label={vak.label} onChange={(e) => setAantal(e.target.value)} />
            <button type="button" style={T.stapKnop} aria-label="Eén meer"
              onClick={() => setAantal(stap(aantal, vak.stap))}>
              <Plus size={15} />
            </button>
          </div>
          <span style={T.aantalUitleg}>
            {nl(nieuwAantal)} × {vak.eenheid} ·{" "}
            {toonPunten(entry.points_raw * factor, schaal)} pt
          </span>
          <button type="button" style={T.aantalKnop}
            onClick={() => { onWijzig(schaalEntry(entry, factor)); setAantal(null); }}>
            Opslaan
          </button>
        </div>
      )}

      {open && onderdelen.map((c) => (
        <div key={c.id} style={T.onderdeelRegel}>
          <span style={T.regelTekst}>
            <span style={T.onderdeelNaam}>{c.name}</span>
            <span style={T.regelSub}>{nl(c.amount)} {c.unit}</span>
          </span>
          <span style={T.onderdeelPunt}>{toonPunten(c.points_raw, schaal)}</span>
        </div>
      ))}
    </>
  );
}

/** Eén stap erbij of eraf, nooit onder de stapgrootte zelf. */
function stap(waarde: string | null, richting: number): string {
  const n = getal(waarde ?? "") + richting;
  const kleinste = Math.abs(richting);
  return String(Math.round(Math.max(n, kleinste) * 100) / 100);
}

function getal(s: string): number {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function toonHoeveelheid(e: Entry): string {
  const hoev = nl(e.amount);
  return e.unit ? `${hoev} ${e.unit}` : hoev;
}
