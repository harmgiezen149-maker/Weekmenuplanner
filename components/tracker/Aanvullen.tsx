"use client";

import React, { useState } from "react";
import { ArrowLeft, Check, Loader2, Sparkles } from "lucide-react";
import { T } from "./stijl";
import { rawPoints, toonPunten } from "@/lib/tracker/points";
import { CATEGORIEEN, CATEGORIE_LABEL } from "@/lib/tracker/types";
import type { Category, Nutrients } from "@/lib/tracker/types";

const LEEG = {
  kcal: "", protein_g: "", fat_g: "", satfat_g: "",
  carbs_g: "", sugar_g: "", fiber_g: "",
};
type Velden = typeof LEEG;

/**
 * Een ontbrekend ingrediënt aanvullen, of een herkend ingrediënt aanpassen.
 *
 * Wat je hier invult geldt vanaf dat moment voor élk recept waarin dit
 * ingrediënt voorkomt — de sleutel is de naam, niet het recept waar je hem
 * tegenkwam. Vul je "harissa" één keer in, dan tellen alle recepten met
 * harissa er voortaan mee.
 *
 * Krijgt het formulier `begin` mee, dan is het ingrediënt al herkend en zijn de
 * huidige waarden voorgevuld. Opslaan zet je eigen regel dan vóór de treffer
 * uit de basislijst.
 *
 * De schatknop vult het formulier voor; hij bewaart niets. Je kijkt het na en
 * slaat het daarna zelf op.
 */
export default function Aanvullen({
  ingredient, bezig, begin, onOpslaan, onTerug,
}: {
  ingredient: string;
  bezig: boolean;
  /** Huidige waarden als dit ingrediënt al herkend werd. */
  begin?: { weergavenaam: string; eenheid: "g" | "ml"; per100: Nutrients; portie?: number };
  onOpslaan: (gegevens: {
    naam: string; weergavenaam: string; eenheid: "g" | "ml"; per100: Nutrients;
    /** Gewicht van één stuk, als dat een zinnige maat is. */
    portie?: number;
  }) => void;
  /** Weglaten als het scherm al een eigen sluitknop heeft. */
  onTerug?: () => void;
}) {
  const [weergavenaam, setWeergavenaam] = useState(begin?.weergavenaam ?? hoofdletter(ingredient));
  const [eenheid, setEenheid] = useState<"g" | "ml">(begin?.eenheid ?? "g");
  const [categorie, setCategorie] = useState<Category>(begin?.per100.category ?? "default");
  const [v, setV] = useState<Velden>(begin ? naarVelden(begin.per100) : LEEG);
  const [portie, setPortie] = useState(begin?.portie ? String(begin.portie) : "");
  const [schat, setSchat] = useState(false);
  const [fout, setFout] = useState("");
  const [toelichting, setToelichting] = useState("");

  const per100: Nutrients = {
    kcal: getal(v.kcal),
    protein_g: getal(v.protein_g),
    fat_g: getal(v.fat_g),
    satfat_g: getal(v.satfat_g),
    carbs_g: getal(v.carbs_g),
    sugar_g: getal(v.sugar_g),
    fiber_g: getal(v.fiber_g),
    category: categorie,
  };

  const punten = toonPunten(rawPoints(per100, 100), 1);
  const kanOpslaan = per100.kcal > 0 && weergavenaam.trim().length > 0 && !bezig;

  const laatSchatten = async () => {
    setSchat(true); setFout(""); setToelichting("");
    try {
      const res = await fetch("/api/tracker/ingredienten/schat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ naam: ingredient }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Schatten mislukt");
      const s = data.schatting;
      setWeergavenaam(s.naam);
      setEenheid(s.eenheid);
      setCategorie(s.per100.category ?? "default");
      setV({
        kcal: String(rond(s.per100.kcal)),
        protein_g: String(rond(s.per100.protein_g)),
        fat_g: String(rond(s.per100.fat_g)),
        satfat_g: String(rond(s.per100.satfat_g)),
        carbs_g: String(rond(s.per100.carbs_g)),
        sugar_g: String(rond(s.per100.sugar_g)),
        fiber_g: String(rond(s.per100.fiber_g)),
      });
      if (s.toelichting) setToelichting(s.toelichting);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Schatten mislukt");
    } finally { setSchat(false); }
  };

  const zet = (k: keyof Velden) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  return (
    <>
      {onTerug && (
        <button style={T.terugKnop} onClick={onTerug}>
          <ArrowLeft size={15} /> Terug naar het recept
        </button>
      )}

      {fout && <div style={T.fout}>{fout}</div>}

      <div style={T.kaart}>
        <div style={T.productNaam}>{hoofdletter(ingredient)}</div>
        <div style={T.productSub}>
          {begin ? (
            <>
              Nu geteld als {begin.weergavenaam}. Pas de waarden per 100 {eenheid} aan — wat
              je hier bewaart gaat vóór de basislijst, in élk recept waar dit in zit.
            </>
          ) : (
            <>
              Dit ingrediënt staat niet in de productlijst. Vul de waarden per
              100 {eenheid} in — daarna telt het mee in élk recept waar het in zit.
            </>
          )}
        </div>
      </div>

      <button style={{ ...T.secundair, marginTop: 0 }} onClick={laatSchatten} disabled={schat}>
        {schat
          ? <><Loader2 size={16} className="spin" /> Bezig met schatten...</>
          : <><Sparkles size={16} /> Laat de waarden schatten</>}
      </button>

      {toelichting && <p style={T.hint}>{toelichting} Kijk de getallen na voor je opslaat.</p>}

      <div style={{ ...T.live, marginTop: 14 }} role="status" aria-live="polite">
        <span style={T.liveGetal}>{punten}</span>
        <span style={T.liveTekst}>
          {punten === 1 ? "punt" : "punten"} per 100 {eenheid}<br />
          zo telt dit ingrediënt straks mee
        </span>
      </div>

      <div style={T.veldVak}>
        <label style={T.label} htmlFor="av-naam">Naam zoals je hem wilt zien</label>
        <input id="av-naam" style={T.veld} value={weergavenaam}
          onChange={(e) => setWeergavenaam(e.target.value)} />
      </div>

      <div style={T.veldVak}>
        <span style={T.label}>Gemeten per</span>
        <div style={T.chips}>
          {(["g", "ml"] as const).map((e) => (
            <button key={e} type="button" onClick={() => setEenheid(e)}
              style={{ ...T.chip, ...(eenheid === e ? T.chipAan : {}) }}>
              100 {e}
            </button>
          ))}
        </div>
      </div>

      <div style={T.veldRij}>
        <Getal id="kcal" label="Calorieën (kcal)" waarde={v.kcal} onChange={zet("kcal")} />
        <Getal id="prot" label="Eiwit (g)" waarde={v.protein_g} onChange={zet("protein_g")} />
      </div>
      <div style={T.veldRij}>
        <Getal id="vet" label="Vet (g)" waarde={v.fat_g} onChange={zet("fat_g")} />
        <Getal id="sat" label="Waarvan verzadigd (g)" waarde={v.satfat_g} onChange={zet("satfat_g")} />
      </div>
      <div style={T.veldRij}>
        <Getal id="kh" label="Koolhydraten (g)" waarde={v.carbs_g} onChange={zet("carbs_g")} />
        <Getal id="sug" label="Waarvan suikers (g)" waarde={v.sugar_g} onChange={zet("sugar_g")} />
      </div>
      <div style={T.veldRij}>
        <Getal id="vez" label="Vezels (g)" waarde={v.fiber_g} onChange={zet("fiber_g")} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <label style={T.label} htmlFor="av-portie">Gewicht per stuk (g)</label>
          <input id="av-portie" style={T.veld} inputMode="decimal" value={portie}
            placeholder="optioneel"
            onChange={(e) => setPortie(e.target.value.replace(",", "."))} />
        </div>
      </div>
      <p style={{ ...T.hint, marginBottom: 12 }}>
        Staat dit ingrediënt in een recept als "1 stuk" of "2 stuks", dan wordt dit gewicht
        gebruikt. Vul je niets in, dan rekent de app met 100 g per stuk en zie je dat als aanname
        bij het recept staan.
      </p>

      <div style={T.veldVak}>
        <label style={T.label} htmlFor="av-cat">Soort product</label>
        <select id="av-cat" style={T.veld} value={categorie}
          onChange={(e) => setCategorie(e.target.value as Category)}>
          {CATEGORIEEN.map((c) => <option key={c} value={c}>{CATEGORIE_LABEL[c]}</option>)}
        </select>
      </div>

      <button style={{ ...T.primair, opacity: kanOpslaan ? 1 : 0.5 }} disabled={!kanOpslaan}
        onClick={() => onOpslaan({
          naam: ingredient,
          weergavenaam: weergavenaam.trim(),
          eenheid,
          per100,
          ...(getal(portie) > 0 ? { portie: getal(portie) } : {}),
        })}>
        {bezig
          ? <><Loader2 size={16} className="spin" /> Opslaan...</>
          : <><Check size={16} /> Bewaren voor alle recepten</>}
      </button>
    </>
  );
}

function Getal({ id, label, waarde, onChange }: {
  id: string; label: string; waarde: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label style={T.label} htmlFor={`av-${id}`}>{label}</label>
      <input id={`av-${id}`} style={T.veld} value={waarde} onChange={onChange}
        inputMode="decimal" placeholder="0" />
    </div>
  );
}

function hoofdletter(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Voedingswaarden naar bewerkbare velden. Een nul blijft leeg staan. */
function naarVelden(n: Nutrients): Velden {
  const t = (x: number) => (x > 0 ? String(rond(x)) : "");
  return {
    kcal: t(n.kcal), protein_g: t(n.protein_g), fat_g: t(n.fat_g),
    satfat_g: t(n.satfat_g), carbs_g: t(n.carbs_g), sugar_g: t(n.sugar_g),
    fiber_g: t(n.fiber_g),
  };
}

function getal(s: string): number {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function rond(n: number): number {
  return Math.round(n * 10) / 10;
}
