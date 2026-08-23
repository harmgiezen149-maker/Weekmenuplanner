"use client";

import React, { useMemo, useState } from "react";
import { ArrowLeft, Check, Loader2, Star } from "lucide-react";
import { T } from "./stijl";
import { rawPoints, toonPunten } from "@/lib/tracker/points";
import { nl } from "@/lib/tracker/datum";
import { CATEGORIE_LABEL, MAALTIJDEN_TRACKER, MAALTIJD_LABEL } from "@/lib/tracker/types";
import type { Maaltijd, Nutrients, Product } from "@/lib/tracker/types";

const BRON_LABEL: Record<Product["bron"], string> = {
  off: "Productdatabase",
  basis: "Eigen basislijst",
  bewaard: "Eerder gelogd",
};

/** Voedingswaarden per 100 omrekenen naar een hoeveelheid. */
export function voorHoeveelheid(per100: Nutrients, grams: number): Nutrients {
  const f = grams / 100;
  return {
    ...per100,
    kcal: per100.kcal * f,
    protein_g: per100.protein_g * f,
    fat_g: per100.fat_g * f,
    satfat_g: per100.satfat_g * f,
    carbs_g: per100.carbs_g * f,
    sugar_g: per100.sugar_g * f,
    fiber_g: per100.fiber_g * f,
    ...(per100.added_sugar_g != null ? { added_sugar_g: per100.added_sugar_g * f } : {}),
  };
}

/**
 * De omgekeerde weg: van absolute waarden voor een hoeveelheid terug naar
 * waarden per 100. Nodig om een bewaarde regel weer als product te tonen.
 */
export function naarPer100(nutrients: Nutrients, grams: number): Nutrients {
  if (grams <= 0) return nutrients;
  return voorHoeveelheid(nutrients, (100 / grams) * 100);
}

/**
 * Laatste stap voor een gevonden product: hoeveel, bij welke maaltijd.
 * Gedeeld door zoeken, scannen en de favorietenlijst, zodat er maar één
 * scherm is waar een product een regel wordt.
 */
export default function Portiekiezer({
  product, maaltijd, datumLabel, schaal, bezig, fout, modus = "log", onOpslaan, onTerug,
}: {
  product: Product;
  maaltijd: Maaltijd;
  datumLabel: string;
  schaal: number;
  bezig: boolean;
  fout: string;
  /** "component" = onderdeel van een maaltijd; dan geen maaltijdkeuze of favoriet. */
  modus?: "log" | "component";
  onOpslaan: (payload: Record<string, unknown>, alsFavoriet: boolean) => void;
  onTerug: () => void;
}) {
  const alsComponent = modus === "component";
  const heeftPortie = product.portie != null;
  const [hoev, setHoev] = useState(String(product.portie?.grams ?? 100));
  const [maal, setMaal] = useState<Maaltijd>(maaltijd);
  const [favoriet, setFavoriet] = useState(false);

  const grams = getal(hoev);
  const nutrients = useMemo(() => voorHoeveelheid(product.per100, grams), [product.per100, grams]);
  const punten = toonPunten(rawPoints(nutrients, grams), schaal);

  const opslaan = () => {
    if (grams <= 0 || bezig) return;
    onOpslaan({
      name: product.name,
      brand: product.brand,
      meal: maal,
      source: herkomst(product),
      amount: grams,
      unit: product.eenheid,
      grams,
      nutrients,
      ref: product.barcode,
    }, favoriet);
  };

  return (
    <>
      <button style={T.terugKnop} onClick={onTerug}>
        <ArrowLeft size={15} /> Terug
      </button>

      {fout && <div style={T.fout}>{fout}</div>}

      <div style={T.kaart}>
        <div style={T.productNaam}>{product.name}</div>
        <div style={T.productSub}>
          {product.brand ? `${product.brand} · ` : ""}
          {BRON_LABEL[product.bron]}
          {product.per100.category !== "default" ? ` · ${CATEGORIE_LABEL[product.per100.category ?? "default"]}` : ""}
        </div>
        <div style={T.macroRij}>
          <span style={T.macro}><span style={T.macroWaarde}>{Math.round(product.per100.kcal)}</span> kcal/100 {product.eenheid}</span>
          <span style={T.macro}><span style={T.macroWaarde}>{nl(product.per100.protein_g)}</span> g eiwit</span>
          <span style={T.macro}><span style={T.macroWaarde}>{nl(product.per100.satfat_g)}</span> g verz. vet</span>
          <span style={T.macro}><span style={T.macroWaarde}>{nl(product.per100.fiber_g)}</span> g vezels</span>
        </div>
      </div>

      <div style={T.live} role="status" aria-live="polite">
        <span style={T.liveGetal}>{punten}</span>
        <span style={T.liveTekst}>
          {punten === 1 ? "punt" : "punten"} voor {nl(grams)} {product.eenheid}<br />
          {alsComponent
            ? "als onderdeel van deze maaltijd"
            : `${datumLabel.toLowerCase()} · ${MAALTIJD_LABEL[maal].toLowerCase()}`}
        </span>
      </div>

      <div style={T.veldVak}>
        <label style={T.label} htmlFor="pk-hoev">Hoeveelheid ({product.eenheid})</label>
        <input id="pk-hoev" style={T.veld} value={hoev} inputMode="decimal"
          onChange={(e) => setHoev(e.target.value)} />
        <div style={{ ...T.chips, marginTop: 8 }}>
          {heeftPortie && (
            <button type="button" style={T.chip}
              onClick={() => setHoev(String(product.portie!.grams))}>
              {product.portie!.label} ({product.portie!.grams} {product.eenheid})
            </button>
          )}
          <button type="button" style={T.chip} onClick={() => setHoev("100")}>
            100 {product.eenheid}
          </button>
          {heeftPortie && (
            <button type="button" style={T.chip}
              onClick={() => setHoev(String(Math.round(product.portie!.grams / 2)))}>
              Halve portie
            </button>
          )}
        </div>
      </div>

      {!alsComponent && (
        <>
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

          <button type="button" onClick={() => setFavoriet((v) => !v)}
            style={{ ...T.favorietKnop, ...(favoriet ? T.favorietKnopAan : {}) }}>
            <Star size={15} fill={favoriet ? "currentColor" : "none"} />
            {favoriet ? "Wordt bewaard als favoriet" : "Bewaar als favoriet"}
          </button>
        </>
      )}

      <button style={{ ...T.primair, opacity: grams > 0 && !bezig ? 1 : 0.5 }}
        onClick={opslaan} disabled={grams <= 0 || bezig}>
        {bezig
          ? <><Loader2 size={16} className="spin" /> Opslaan...</>
          : <><Check size={16} /> {alsComponent ? "Aan maaltijd toevoegen" : `Toevoegen aan ${datumLabel.toLowerCase()}`}</>}
      </button>
    </>
  );
}

/** Waar de regel vandaan kwam, voor het logboek. */
function herkomst(p: Product): string {
  if (p.bron === "bewaard") return "favorite";
  return p.barcode ? "barcode" : "search";
}

function getal(s: string): number {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
