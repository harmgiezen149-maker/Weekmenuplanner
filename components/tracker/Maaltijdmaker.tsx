"use client";

import React, { useState } from "react";
import { BookOpen, Check, Loader2, UtensilsCrossed } from "lucide-react";
import { T } from "./stijl";
import { trackerApi } from "./api";
import { toonPunten } from "@/lib/tracker/points";
import { MAALTIJD_LABEL } from "@/lib/tracker/types";
import type { Entry, Maaltijd } from "@/lib/tracker/types";
import {
  KOOKBOEK_MAALTIJD, ingredientenUitOnderdelen, onderdelenUitRegels, standaardNaam,
} from "@/lib/tracker/samenstellen";
import { HOOFDINGREDIENTEN } from "@/lib/types";

/**
 * Van een gelogd eetmoment een vaste maaltijd of een kookboekrecept maken.
 *
 * Twee bestemmingen, want het zijn twee verschillende dingen. Een vaste
 * maaltijd staat bij **Snel** en is bedoeld om morgen met één tik opnieuw te
 * loggen; een recept staat in het kookboek, met punten per portie, en gaat mee
 * in het weekmenu en de boodschappenlijst. Je kunt ze allebei aanvinken, en
 * beide staan daarna gewoon te wijzigen op hun eigen plek.
 */
export default function Maaltijdmaker({
  maaltijd, regels, schaal, onKlaar,
}: {
  maaltijd: Maaltijd;
  regels: Entry[];
  schaal: number;
  onKlaar: () => void;
}) {
  const label = MAALTIJD_LABEL[maaltijd];
  const [naam, setNaam] = useState(() => standaardNaam(regels, label));
  const [alsMaaltijd, setAlsMaaltijd] = useState(true);
  const [alsRecept, setAlsRecept] = useState(false);
  const [hoofd, setHoofd] = useState<string>(HOOFDINGREDIENTEN[3]);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [klaar, setKlaar] = useState<string[]>([]);

  const onderdelen = onderdelenUitRegels(regels);
  const punten = toonPunten(onderdelen.reduce((s, c) => s + c.points_raw, 0), schaal);
  const kanOpslaan = naam.trim() !== "" && (alsMaaltijd || alsRecept) && !bezig;

  /**
   * Bewaren. Het recept gaat eerst: dat is de stap die kan mislukken op iets
   * dat je nog kunt herstellen (een naam die de opslag weigert), en dan sta je
   * hier nog met alles ingevuld.
   */
  const bewaar = async () => {
    if (!kanOpslaan) return;
    setBezig(true); setFout(""); setKlaar([]);
    const gelukt: string[] = [];
    try {
      if (alsRecept) {
        await bewaarRecept(naam.trim(), hoofd, maaltijd, onderdelen);
        gelukt.push("als recept in je kookboek");
      }
      if (alsMaaltijd) {
        await trackerApi.bewaarMaaltijd({
          name: naam.trim(), meal: maaltijd, components: onderdelen,
        });
        gelukt.push("als vaste maaltijd bij Snel");
      }
      setKlaar(gelukt);
    } catch (e) {
      // Wat wél lukte staat er ook bij: anders sla je het straks nog een keer op.
      setKlaar(gelukt);
      setFout(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally { setBezig(false); }
  };

  if (klaar.length > 0 && !fout) {
    return (
      <div style={T.makerVak}>
        <div style={T.makerGelukt}>
          <Check size={15} style={{ flexShrink: 0, marginTop: 2 }} />
          <span><strong>{naam.trim()}</strong> is bewaard {klaar.join(" en ")}.</span>
        </div>
        <button style={T.secundair} onClick={onKlaar}>Klaar</button>
      </div>
    );
  }

  return (
    <div style={T.makerVak}>
      {fout && <div style={T.fout}>{fout}</div>}

      <div style={T.veldVak}>
        <label style={T.label} htmlFor={`mk-naam-${maaltijd}`}>Naam</label>
        <input id={`mk-naam-${maaltijd}`} style={T.veld} value={naam}
          onChange={(e) => setNaam(e.target.value)}
          placeholder={`Bijvoorbeeld: mijn standaard ${label.toLowerCase()}`} />
      </div>

      <div style={T.veldVak}>
        <span style={T.label}>Bewaren als</span>
        <div style={T.chips}>
          <button type="button" onClick={() => setAlsMaaltijd((v) => !v)}
            style={{ ...T.chip, ...(alsMaaltijd ? T.chipAan : {}) }}>
            <UtensilsCrossed size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
            Vaste maaltijd
          </button>
          <button type="button" onClick={() => setAlsRecept((v) => !v)}
            style={{ ...T.chip, ...(alsRecept ? T.chipAan : {}) }}>
            <BookOpen size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
            Recept in kookboek
          </button>
        </div>
        <p style={T.hint}>
          Een vaste maaltijd staat bij <strong>Snel</strong> en logt zichzelf morgen met
          één tik. Een recept staat in je kookboek, met punten per portie, en kan mee
          in het weekmenu en op de boodschappenlijst.
        </p>
      </div>

      {alsRecept && (
        <div style={T.veldVak}>
          <label style={T.label} htmlFor={`mk-hoofd-${maaltijd}`}>Hoofdingrediënt</label>
          <select id={`mk-hoofd-${maaltijd}`} style={T.veld} value={hoofd}
            onChange={(e) => setHoofd(e.target.value)}>
            {HOOFDINGREDIENTEN.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <p style={T.hint}>
            Het recept komt binnen voor één persoon — dit is één keer wat jij at, geen
            gezinsmaaltijd. Hoeveelheden, bereiding en foto vul je in het kookboek aan.
          </p>
        </div>
      )}

      <div style={T.makerRegels}>
        {onderdelen.length} {onderdelen.length === 1 ? "onderdeel" : "onderdelen"} · {punten} pt
        <div style={T.makerNamen}>{onderdelen.map((c) => c.name).join(", ")}</div>
      </div>

      <button style={{ ...T.primair, opacity: kanOpslaan ? 1 : 0.5 }}
        onClick={bewaar} disabled={!kanOpslaan}>
        {bezig
          ? <><Loader2 size={16} className="spin" /> Bewaren...</>
          : <><Check size={16} /> Bewaren</>}
      </button>
      <button style={T.secundair} onClick={onKlaar}>Annuleren</button>
    </div>
  );
}

/**
 * Het eetmoment als recept in het kookboek.
 *
 * Voor één persoon: dit is één keer wat jij at, en doen alsof het voor vier
 * was zou de hoeveelheden verzinnen.
 */
async function bewaarRecept(
  titel: string, hoofd: string, maaltijd: Maaltijd,
  onderdelen: ReturnType<typeof onderdelenUitRegels>
) {
  const ingredienten = ingredientenUitOnderdelen(onderdelen);
  const res = await fetch("/api/recipes", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      titel, hoofd, maaltijd: KOOKBOEK_MAALTIJD[maaltijd],
      personen: 1, tijd: 30, score: 0, gegeten: 1, afbeelding: "",
      ingredienten, bereiding: "",
    }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d?.error || "Het recept kon niet worden opgeslagen");
  }

  // Zonder deze stap staat het verse recept met nul punten in het kookboek:
  // "geroosterde krieltjes" is nog geen bekend product. Op de achtergrond en
  // stil als het misgaat — het recept is opgeslagen, dat was de vraag.
  void fetch("/api/tracker/ingredienten/schat-alles", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ namen: ingredienten.map((i) => i.naam) }),
  }).catch(() => {});
}
