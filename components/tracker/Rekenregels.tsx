"use client";

import React, { useState } from "react";
import { Check, Loader2, PencilLine, Sparkles, X } from "lucide-react";
import { T } from "./stijl";
import { STANDAARD_MATEN } from "@/lib/tracker/recept";
import { naamVarianten } from "@/lib/tracker/naamvarianten";
import Aanvullen from "./Aanvullen";
import type { Nutrients } from "@/lib/tracker/types";
import type { ReceptPunten } from "@/lib/tracker/recept";

// ---------------------------------------------------------------------------
// "Zo is het gerekend", met de mogelijkheid om het bij te stellen.
//
// Een receptpagina schrijft "volkorenmeel (havermeel)" en de productlijst kent
// dat niet, dus valt het buiten de punten — terwijl het een hoofdbestanddeel
// is. Het gat aanwijzen was al goed; er iets aan kunnen doen hoort erbij.
//
// Twee wegen, en die verschillen wezenlijk:
//
//   bijstellen  je verandert de naam of de maat van dít ingredient in deze
//               import. Kost niets, werkt meteen, en verandert verder niets.
//   onthouden   de gevonden voedingswaarden worden onder de oorspronkelijke
//               naam bewaard. Vanaf dan telt "volkorenmeel (havermeel)" overal
//               mee, ook de volgende keer dat je deze pagina ophaalt.
// ---------------------------------------------------------------------------

export interface Regel {
  naam: string;
  hoev: number;
  eenheid: string;
}

export default function Rekenregels({
  punten, personen, onHerrekend,
}: {
  punten: ReceptPunten;
  personen: number;
  /** De hele nieuwe uitslag; het scherm zet hem in de plaats van de oude. */
  onHerrekend: (nieuw: ReceptPunten) => void;
}) {
  const [bewerkt, setBewerkt] = useState<number | null>(null);
  // De namen zoals ze binnenkwamen. Die blijven staan als je een regel
  // bijstelt: "onthoud dit" moet de naam van de página onthouden, niet de naam
  // die jij er zojuist voor in de plaats zette.
  const [origineel] = useState(() => punten.matches.map((m) => m.ingredient));
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [onthouden, setOnthouden] = useState<string[]>([]);
  // Welk ingredient je op dit moment zelf invult. Dat is de tweede weg: staat
  // het écht niet in de productlijst, dan help je de lijst uitbreiden in plaats
  // van naar een naam te blijven zoeken die er niet is.
  const [aanvullen, setAanvullen] = useState<{ index: number; naam: string } | null>(null);

  const regels: Regel[] = punten.matches.map((m) => ({
    naam: m.ingredient, hoev: m.hoev, eenheid: m.eenheid,
  }));

  const herreken = async (index: number, nieuw: Regel) => {
    setBezig(true); setFout("");
    try {
      const res = await fetch("/api/tracker/recepten/doorrekenen", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personen,
          ingredienten: regels.map((r, i) => (i === index ? nieuw : r)),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Doorrekenen mislukt");
      onHerrekend(data.punten as ReceptPunten);
      setBewerkt(null);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Doorrekenen mislukt");
    } finally { setBezig(false); }
  };

  /**
   * De gevonden waarden onder de oorspronkelijke naam bewaren.
   *
   * Alleen zinvol als het ingredient inmiddels wél herkend wordt: dan is er
   * iets om te onthouden. De naam die je binnenkreeg wordt de sleutel, zodat
   * dezelfde pagina de volgende keer meteen goed valt.
   */
  const onthoud = async (origineel: string, index: number) => {
    const m = punten.matches[index];
    if (!m?.product) return;
    setBezig(true); setFout("");
    try {
      const res = await fetch("/api/tracker/ingredienten", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          naam: origineel,
          weergavenaam: m.product.name,
          eenheid: m.product.eenheid === "ml" ? "ml" : "g",
          per100: m.product.per100,
          ...(m.product.portie?.grams ? { portie: m.product.portie.grams } : {}),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Onthouden mislukt");
      setOnthouden((p) => [...p, origineel]);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Onthouden mislukt");
    } finally { setBezig(false); }
  };

  /**
   * Een zelf ingevuld ingredient bewaren en het recept opnieuw doorrekenen.
   *
   * Dit gaat naar de productlijst en geldt dus vanaf nu voor élk recept met dit
   * ingredient — precies zoals aanvullen vanuit het kookboek werkt.
   */
  const bewaarIngredient = async (index: number, gegevens: {
    naam: string; weergavenaam: string; eenheid: "g" | "ml"; per100: Nutrients; portie?: number;
  }) => {
    setBezig(true); setFout("");
    try {
      const res = await fetch("/api/tracker/ingredienten", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gegevens),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Opslaan mislukt");
      setAanvullen(null);
      await herreken(index, regels[index]);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally { setBezig(false); }
  };

  return (
    <>
      {fout && <div style={T.fout}>{fout}</div>}

      <div style={T.kaartStrak}>
        {punten.matches.map((m, i) => {
          const gat = m.overgeslagen || m.omrekening.onbekend;
          return (
            <React.Fragment key={`${m.ingredient}-${i}`}>
              <div style={T.regel}>
                <div style={T.regelTekst}>
                  <div style={{
                    ...T.regelNaam,
                    color: m.overgeslagen ? "var(--sub)" : "var(--ink)",
                    textDecoration: m.overgeslagen ? "line-through" : "none",
                  }}>
                    {m.ingredient}
                  </div>
                  <div style={T.regelSub}>
                    {m.overgeslagen
                      ? "niet herkend, telt niet mee"
                      : `${m.product!.name} · ${m.omrekening.aanname}`}
                  </div>
                </div>
                <button style={{ ...T.potloodKnop, ...(gat ? { color: "var(--accent)" } : {}) }}
                  onClick={() => { setBewerkt(bewerkt === i ? null : i); setFout(""); }}
                  aria-expanded={bewerkt === i}
                  aria-label={`${m.ingredient} bijstellen`}>
                  <PencilLine size={15} />
                </button>
              </div>

              {aanvullen?.index === i && (
                <div style={S.vak}>
                  <Aanvullen
                    ingredient={aanvullen.naam}
                    bezig={bezig}
                    onOpslaan={(g) => void bewaarIngredient(i, g)}
                    onTerug={() => setAanvullen(null)}
                  />
                </div>
              )}

              {bewerkt === i && aanvullen?.index !== i && (
                <Bijstellen
                  regel={regels[i]} bezig={bezig}
                  herkend={!m.overgeslagen && !m.omrekening.onbekend}
                  origineel={origineel[i] ?? m.ingredient}
                  onthouden={onthouden.includes(origineel[i] ?? m.ingredient)}
                  onProbeer={(nieuw) => void herreken(i, nieuw)}
                  onOnthoud={() => void onthoud(origineel[i] ?? m.ingredient, i)}
                  onAanvullen={(naam) => { setAanvullen({ index: i, naam }); setBewerkt(null); }}
                  onSluit={() => setBewerkt(null)}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </>
  );
}

function Bijstellen({
  regel, origineel, bezig, herkend, onthouden, onProbeer, onOnthoud, onAanvullen, onSluit,
}: {
  regel: Regel;
  /** De naam zoals de pagina hem schreef. */
  origineel: string;
  bezig: boolean;
  /** Of dit ingredient nu wél meetelt. */
  herkend: boolean;
  onthouden: boolean;
  onProbeer: (nieuw: Regel) => void;
  onOnthoud: () => void;
  /** Staat het er echt niet in: zelf invullen of laten schatten. */
  onAanvullen: (naam: string) => void;
  onSluit: () => void;
}) {
  const [naam, setNaam] = useState(regel.naam);
  const [hoev, setHoev] = useState(String(regel.hoev || ""));
  const [eenheid, setEenheid] = useState(regel.eenheid);
  const varianten = naamVarianten(origineel);

  const probeer = (metNaam = naam) => {
    const n = Number(String(hoev).replace(",", "."));
    onProbeer({
      naam: metNaam.trim() || regel.naam,
      hoev: Number.isFinite(n) && n > 0 ? n : regel.hoev,
      eenheid: eenheid.trim(),
    });
  };

  return (
    <div style={S.vak}>
      <p style={S.uitleg}>
        Staat het onder een andere naam in de productlijst, schrijf hem dan hier
        anders op — of zet er een maat bij die de app kent. Er wordt meteen opnieuw
        gerekend; er verandert niets aan de pagina zelf.
      </p>

      {varianten.length > 0 && (
        <div style={{ ...T.chips, marginBottom: 10 }}>
          {varianten.map((v) => (
            <button key={v} type="button" style={T.chip}
              onClick={() => { setNaam(v); probeer(v); }} disabled={bezig}>
              {v}
            </button>
          ))}
        </div>
      )}

      <label style={T.label} htmlFor={`rk-naam-${regel.naam}`}>Naam</label>
      <input id={`rk-naam-${regel.naam}`} style={T.veld} value={naam}
        onChange={(e) => setNaam(e.target.value)} />

      <div style={{ ...T.veldRij, marginTop: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={T.label} htmlFor={`rk-hoev-${regel.naam}`}>Hoeveelheid</label>
          <input id={`rk-hoev-${regel.naam}`} style={T.veld} value={hoev} inputMode="decimal"
            onChange={(e) => setHoev(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={T.label} htmlFor={`rk-eenh-${regel.naam}`}>Eenheid</label>
          <input id={`rk-eenh-${regel.naam}`} style={T.veld} value={eenheid}
            list="rekenregel-maten" onChange={(e) => setEenheid(e.target.value)} />
          <datalist id="rekenregel-maten">
            {STANDAARD_MATEN.map((m) => <option key={m} value={m} />)}
          </datalist>
        </div>
      </div>

      <button style={{ ...T.primair, marginTop: 12 }} onClick={() => probeer()} disabled={bezig}>
        {bezig
          ? <><Loader2 size={16} className="spin" /> Rekenen...</>
          : <><Check size={16} /> Opnieuw doorrekenen</>}
      </button>

      {herkend && !onthouden && (
        <button style={T.secundair} onClick={onOnthoud} disabled={bezig}>
          <Sparkles size={15} /> Onthoud dit voor &ldquo;{origineel}&rdquo;
        </button>
      )}
      {onthouden && (
        <div style={{ ...T.melding, marginTop: 8 }}>
          Onthouden. Voortaan telt <strong>{origineel}</strong> overal mee.
        </div>
      )}

      {!herkend && (
        <button style={T.secundair} onClick={() => onAanvullen(naam.trim() || origineel)}
          disabled={bezig}>
          <Sparkles size={15} /> Staat er niet in: zelf invullen
        </button>
      )}

      <button style={T.secundair} onClick={onSluit} disabled={bezig}>
        <X size={15} /> Sluiten
      </button>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  vak: { padding: "12px 15px 14px", background: "var(--bg)", borderBottom: "1px solid var(--line)" },
  uitleg: { fontSize: 12.5, lineHeight: 1.6, color: "var(--sub)", margin: "0 0 12px" },
};
