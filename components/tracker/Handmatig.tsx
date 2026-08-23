"use client";

import React, { useMemo, useState } from "react";
import { Check, Loader2, Star } from "lucide-react";
import { T } from "./stijl";
import { naarGram, rawPoints, toonPunten, effectiveSugar } from "@/lib/tracker/points";
import { nl } from "@/lib/tracker/datum";
import {
  CATEGORIEEN, CATEGORIE_LABEL, MAALTIJDEN_TRACKER, MAALTIJD_LABEL,
} from "@/lib/tracker/types";
import type { Category, Maaltijd, Nutrients } from "@/lib/tracker/types";

const EENHEDEN = ["g", "ml", "stuk", "portie"];

// Etiketten staan per 100 g, maar een enkel koekje of een kant-en-klare portie
// staat er als geheel op. Beide invoerwijzen leiden tot dezelfde absolute
// voedingswaarden voor de gelogde hoeveelheid.
type Basis = "per100" | "totaal";

const LEEG = {
  kcal: "", protein_g: "", fat_g: "", satfat_g: "",
  carbs_g: "", sugar_g: "", added_sugar_g: "", fiber_g: "",
};
type Velden = typeof LEEG;

export default function Handmatig({
  maaltijd, datumLabel, bezig, fout, onOpslaan, schaal, voorvulling,
}: {
  maaltijd: Maaltijd;
  datumLabel: string;
  bezig: boolean;
  fout: string;
  schaal: number;
  /** Ingevuld als het scannen wel een code maar geen product opleverde. */
  voorvulling?: { naam?: string; barcode?: string };
  onOpslaan: (payload: Record<string, unknown>, alsFavoriet: boolean) => void;
}) {
  const [naam, setNaam] = useState(voorvulling?.naam ?? "");
  const [merk, setMerk] = useState("");
  const [maal, setMaal] = useState<Maaltijd>(maaltijd);
  const [hoev, setHoev] = useState("100");
  const [eenheid, setEenheid] = useState("g");
  const [basis, setBasis] = useState<Basis>("per100");
  const [categorie, setCategorie] = useState<Category>("default");
  const [v, setV] = useState<Velden>(LEEG);
  const [favoriet, setFavoriet] = useState(false);

  const stukEenheid = eenheid === "stuk" || eenheid === "portie";
  // Bij stuks is "per 100 g" betekenisloos; dan telt altijd het totaal.
  const echteBasis: Basis = stukEenheid ? "totaal" : basis;
  // Bij precies 100 g of ml komen beide keuzes op hetzelfde neer; de knoppen
  // dan tonen levert alleen verwarring op.
  const keuzeDoetErToe = !stukEenheid && Math.abs(getal(hoev) - 100) > 0.001;

  const grams = naarGram(getal(hoev), eenheid);

  const nutrients: Nutrients = useMemo(() => {
    const factor = echteBasis === "per100" ? grams / 100 : 1;
    const toegevoegd = v.added_sugar_g.trim();
    return {
      kcal: getal(v.kcal) * factor,
      protein_g: getal(v.protein_g) * factor,
      fat_g: getal(v.fat_g) * factor,
      satfat_g: getal(v.satfat_g) * factor,
      carbs_g: getal(v.carbs_g) * factor,
      sugar_g: getal(v.sugar_g) * factor,
      fiber_g: getal(v.fiber_g) * factor,
      ...(toegevoegd === "" ? {} : { added_sugar_g: getal(toegevoegd) * factor }),
      category: categorie,
    };
  }, [v, echteBasis, grams, categorie]);

  const raw = rawPoints(nutrients, grams);
  const punten = toonPunten(raw, schaal);
  const suiker = effectiveSugar(nutrients, grams);
  const suikerGecorrigeerd = nutrients.sugar_g > 0 && suiker < nutrients.sugar_g - 0.05;

  const zet = (k: keyof Velden) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  const kanOpslaan = naam.trim().length > 0 && grams > 0 && !bezig;

  const opslaan = () => {
    if (!kanOpslaan) return;
    onOpslaan({
      name: naam.trim(),
      brand: merk.trim() || undefined,
      meal: maal,
      source: voorvulling?.barcode ? "barcode" : "manual",
      amount: getal(hoev),
      unit: eenheid,
      grams,
      nutrients,
      ...(voorvulling?.barcode ? { ref: voorvulling.barcode } : {}),
    }, favoriet);
  };

  return (
    <>
      {fout && <div style={T.fout}>{fout}</div>}

      {voorvulling?.barcode && (
        <div style={T.waarschuwing}>
          Streepjescode {voorvulling.barcode} staat niet in de productdatabase.
          Vul de waarden van de verpakking in; bewaar je het als favoriet, dan
          hoeft dat maar één keer.
        </div>
      )}

      <div style={T.live} role="status" aria-live="polite">
        <span style={T.liveGetal}>{punten}</span>
        <span style={T.liveTekst}>
          {punten === 1 ? "punt" : "punten"} voor deze portie<br />
          {datumLabel.toLowerCase()} · {MAALTIJD_LABEL[maal].toLowerCase()}
        </span>
      </div>

      <div style={T.veldVak}>
        <label style={T.label} htmlFor="tr-naam">Wat heb je gegeten?</label>
        <input id="tr-naam" style={T.veld} value={naam} onChange={(e) => setNaam(e.target.value)}
          placeholder="Bijvoorbeeld: volkoren boterham met kaas" autoFocus />
      </div>

      <div style={T.veldVak}>
        <label style={T.label} htmlFor="tr-merk">Merk (optioneel)</label>
        <input id="tr-merk" style={T.veld} value={merk} onChange={(e) => setMerk(e.target.value)} />
      </div>

      <div style={T.veldVak}>
        <span style={T.label}>Maaltijd</span>
        <div style={T.chips}>
          {MAALTIJDEN_TRACKER.map((m) => (
            <button key={m} type="button" onClick={() => setMaal(m)}
              style={{ ...T.chip, ...(maal === m ? T.chipAan : {}) }}>
              {MAALTIJD_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      <div style={T.veldRij}>
        <div style={{ flex: 1 }}>
          <label style={T.label} htmlFor="tr-hoev">Hoeveelheid</label>
          <input id="tr-hoev" style={T.veld} value={hoev} onChange={(e) => setHoev(e.target.value)}
            inputMode="decimal" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={T.label} htmlFor="tr-eenheid">Eenheid</label>
          <select id="tr-eenheid" style={T.veld} value={eenheid} onChange={(e) => setEenheid(e.target.value)}>
            {EENHEDEN.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <h2 style={T.sectieKop}>Voedingswaarde</h2>

      {keuzeDoetErToe && (
        <div style={{ ...T.veldVak, marginBottom: 14 }}>
          <div style={T.chips}>
            <button type="button" onClick={() => setBasis("per100")}
              style={{ ...T.chip, ...(basis === "per100" ? T.chipAan : {}) }}>
              Per 100 {eenheid}
            </button>
            <button type="button" onClick={() => setBasis("totaal")}
              style={{ ...T.chip, ...(basis === "totaal" ? T.chipAan : {}) }}>
              Totaal voor {hoev || 0} {eenheid}
            </button>
          </div>
          <p style={T.hint}>
            Op de verpakking staan de waarden meestal per 100 {eenheid}. Neem ze dan zo over;
            de app rekent naar jouw portie om.
          </p>
        </div>
      )}

      <div style={T.veldRij}>
        <Getal id="kcal" label="Calorieën (kcal)" waarde={v.kcal} onChange={zet("kcal")} />
        <Getal id="protein" label="Eiwit (g)" waarde={v.protein_g} onChange={zet("protein_g")} />
      </div>
      <div style={T.veldRij}>
        <Getal id="fat" label="Vet (g)" waarde={v.fat_g} onChange={zet("fat_g")} />
        <Getal id="satfat" label="Waarvan verzadigd (g)" waarde={v.satfat_g} onChange={zet("satfat_g")} />
      </div>
      <div style={T.veldRij}>
        <Getal id="carbs" label="Koolhydraten (g)" waarde={v.carbs_g} onChange={zet("carbs_g")} />
        <Getal id="sugar" label="Waarvan suikers (g)" waarde={v.sugar_g} onChange={zet("sugar_g")} />
      </div>
      <div style={T.veldRij}>
        <Getal id="fiber" label="Vezels (g)" waarde={v.fiber_g} onChange={zet("fiber_g")} />
        <Getal id="added" label="Toegevoegde suiker (g)" waarde={v.added_sugar_g} onChange={zet("added_sugar_g")} />
      </div>

      <div style={T.veldVak}>
        <label style={T.label} htmlFor="tr-cat">Soort product</label>
        <select id="tr-cat" style={T.veld} value={categorie}
          onChange={(e) => setCategorie(e.target.value as Category)}>
          {CATEGORIEEN.map((c) => <option key={c} value={c}>{CATEGORIE_LABEL[c]}</option>)}
        </select>
        <p style={T.hint}>
          Etiketten tellen lactose en fruitsuiker mee bij de suikers. Kies je hier de juiste
          soort, dan telt alleen toegevoegde suiker mee in de punten.
          {suikerGecorrigeerd && (
            <>
              {" "}Nu wordt er gerekend met {nl(suiker)} g in plaats van {nl(nutrients.sugar_g)} g.
            </>
          )}
        </p>
      </div>

      <button type="button" onClick={() => setFavoriet((x) => !x)}
        style={{ ...T.favorietKnop, ...(favoriet ? T.favorietKnopAan : {}) }}>
        <Star size={15} fill={favoriet ? "currentColor" : "none"} />
        {favoriet ? "Wordt bewaard als favoriet" : "Bewaar als favoriet"}
      </button>

      <button style={{ ...T.primair, opacity: kanOpslaan ? 1 : 0.5 }} onClick={opslaan} disabled={!kanOpslaan}>
        {bezig ? <><Loader2 size={16} className="spin" /> Opslaan...</> : <><Check size={16} /> Toevoegen aan {datumLabel.toLowerCase()}</>}
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
      <label style={T.label} htmlFor={`tr-${id}`}>{label}</label>
      <input id={`tr-${id}`} style={T.veld} value={waarde} onChange={onChange}
        inputMode="decimal" placeholder="0" />
    </div>
  );
}

function getal(s: string): number {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
