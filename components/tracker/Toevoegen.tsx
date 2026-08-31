"use client";

import React, { useEffect, useState } from "react";
import { Camera, ChefHat, Keyboard, ScanLine, Search, Zap } from "lucide-react";
import { T } from "./stijl";
import Snel from "./Snel";
import Zoeken from "./Zoeken";
import Scanner from "./Scanner";
import Handmatig from "./Handmatig";
import Maaltijdbouwer from "./Maaltijdbouwer";
import Recepten from "./Recepten";
import Foto from "./Foto";
import Portiekiezer, { naarPer100, VORIGE_PORTIE } from "./Portiekiezer";
import { naamUitStukEenheid } from "@/lib/tracker/portie";
import { trackerApi } from "./api";
import type { FoodTemplate, Maaltijd, Maaltijdsjabloon, Product } from "@/lib/tracker/types";

type Modus = "snel" | "zoeken" | "scannen" | "recept" | "foto" | "handmatig";

const MODI: { id: Modus; label: string; icon: typeof Zap }[] = [
  { id: "snel", label: "Snel", icon: Zap },
  { id: "zoeken", label: "Zoeken", icon: Search },
  { id: "scannen", label: "Scannen", icon: ScanLine },
  { id: "recept", label: "Recept", icon: ChefHat },
  { id: "foto", label: "Foto", icon: Camera },
  { id: "handmatig", label: "Handmatig", icon: Keyboard },
];

/**
 * Keuzescherm voor het toevoegen van een regel. De vier routes komen allemaal
 * uit op dezelfde opslagfunctie; alleen de weg ernaartoe verschilt.
 */
export default function Toevoegen({
  maaltijd, datumLabel, schaal, bezig, fout, onOpslaan,
}: {
  maaltijd: Maaltijd;
  datumLabel: string;
  schaal: number;
  bezig: boolean;
  fout: string;
  onOpslaan: (
    payload: Record<string, unknown>,
    alsFavoriet: boolean,
    onthoudBij?: { barcode: string; per100: unknown; eenheid: "g" | "ml" }
  ) => void;
}) {
  const [modus, setModus] = useState<Modus>("snel");
  const [maal, setMaal] = useState<Maaltijd>(maaltijd);
  const [gekozen, setGekozen] = useState<Product | null>(null);
  const [voorvulling, setVoorvulling] = useState<{ naam?: string; barcode?: string }>();

  const [favorieten, setFavorieten] = useState<FoodTemplate[]>([]);
  const [recent, setRecent] = useState<FoodTemplate[]>([]);
  const [maaltijden, setMaaltijden] = useState<Maaltijdsjabloon[]>([]);
  const [bouwt, setBouwt] = useState<{ bestaand?: Maaltijdsjabloon } | null>(null);
  const [scanFout, setScanFout] = useState("");

  useEffect(() => { setMaal(maaltijd); }, [maaltijd]);

  useEffect(() => {
    trackerApi.getSnel()
      .then((d) => { setFavorieten(d.favorieten); setRecent(d.recent); })
      .catch(() => { /* lege lijsten zijn hier een prima uitkomst */ });
    trackerApi.getMaaltijden()
      .then(setMaaltijden)
      .catch(() => { /* idem */ });
  }, []);

  const kies = (p: Product) => { setGekozen(p); setScanFout(""); };

  const naarHandmatig = (barcode?: string) => {
    setVoorvulling(barcode ? { barcode } : undefined);
    setModus("handmatig");
  };

  // Een sjabloon uit favorieten of recent: meteen loggen met de bewaarde
  // hoeveelheid. Dat is het hele punt van deze lijst.
  const logSjabloon = (t: FoodTemplate) => {
    onOpslaan({
      name: t.name, brand: t.brand, meal: maal, source: t.source || "favorite",
      amount: t.amount, unit: t.unit, grams: t.grams,
      nutrients: t.nutrients, ref: t.ref,
    }, false);
  };

  // Wel hetzelfde product, maar een andere hoeveelheid.
  //
  // Is het de vorige keer per stuk gelogd ("3 × snee"), dan is de portie één
  // stuk en niet de hele vorige regel — anders zou "nog een keer, maar dan
  // twee" uitkomen op zes boterhammen.
  const pasSjabloonAan = (t: FoodTemplate) => {
    const stuk = naamUitStukEenheid(t.unit);
    const perStuk = stuk && t.amount > 0
      ? { grams: t.grams / t.amount, label: stuk }
      : { grams: t.grams, label: VORIGE_PORTIE };
    setGekozen({
      id: t.id,
      name: t.name,
      ...(t.brand ? { brand: t.brand } : {}),
      bron: "bewaard",
      eenheid: t.unit === "ml" ? "ml" : "g",
      per100: naarPer100(t.nutrients, t.grams),
      portie: perStuk,
      ...(t.ref ? { barcode: t.ref } : {}),
    });
  };

  const zoekBarcode = async (code: string) => {
    setScanFout("");
    try {
      const d = await trackerApi.barcode(code);
      if (d.gevonden && d.product) { setGekozen(d.product); return; }
      // Onbekende code: handmatig invullen met de code alvast ingevuld.
      setVoorvulling({ barcode: code });
      setModus("handmatig");
    } catch {
      setScanFout("Opzoeken mislukt. Probeer opnieuw of vul het product handmatig in.");
    }
  };

  const wisFavoriet = async (id: string) => {
    try { setFavorieten(await trackerApi.wisFavoriet(id)); } catch { /* stil */ }
  };

  // Een vaste maaltijd loggen: de onderdelen gaan mee, zodat de server de
  // punten per onderdeel optelt in plaats van over de som te rekenen.
  const logMaaltijd = (m: Maaltijdsjabloon) => {
    onOpslaan({
      name: m.name,
      meal: maal,
      source: "meal",
      ref: m.id,
      amount: 1,
      unit: "portie",
      components: m.components,
    }, false);
  };

  const bewaarMaaltijd = async (m: Omit<Maaltijdsjabloon, "created_at" | "last_used">) => {
    setScanFout("");
    try {
      setMaaltijden(await trackerApi.bewaarMaaltijd(m));
      setBouwt(null);
      setModus("snel");
    } catch (e) {
      setScanFout(e instanceof Error ? e.message : "Opslaan mislukt");
    }
  };

  if (bouwt) {
    return (
      <Maaltijdbouwer
        bestaand={bouwt.bestaand} favorieten={favorieten} recent={recent}
        schaal={schaal} bezig={bezig} fout={scanFout}
        onOpslaan={bewaarMaaltijd} onTerug={() => setBouwt(null)}
      />
    );
  }

  if (gekozen) {
    return (
      <Portiekiezer
        product={gekozen} maaltijd={maal} datumLabel={datumLabel} schaal={schaal}
        bezig={bezig} fout={fout}
        onOpslaan={onOpslaan}
        onTerug={() => setGekozen(null)}
      />
    );
  }

  return (
    <>
      <div style={T.modusRij} role="tablist" aria-label="Manier van toevoegen">
        {MODI.map((m) => (
          <button key={m.id} role="tab" aria-selected={modus === m.id}
            onClick={() => { setModus(m.id); setVoorvulling(undefined); }}
            style={{ ...T.modusKnop, ...(modus === m.id ? T.modusKnopAan : {}) }}>
            <m.icon size={18} />
            {m.label}
          </button>
        ))}
      </div>

      {scanFout && <div style={T.fout}>{scanFout}</div>}

      {modus === "snel" && (
        <Snel
          maaltijden={maaltijden} favorieten={favorieten} recent={recent}
          maaltijd={maal} onMaaltijd={setMaal}
          schaal={schaal} onLog={logSjabloon} onAanpassen={pasSjabloonAan}
          onWisFavoriet={wisFavoriet}
          onLogMaaltijd={logMaaltijd}
          onBewerkMaaltijd={(m) => setBouwt({ bestaand: m })}
          onNieuweMaaltijd={() => setBouwt({})}
        />
      )}

      {modus === "zoeken" && <Zoeken schaal={schaal} onKies={kies} />}

      {modus === "scannen" && <Scanner onCode={zoekBarcode} onHandmatig={naarHandmatig} />}

      {modus === "recept" && (
        <Recepten
          maaltijd={maal} datumLabel={datumLabel} schaal={schaal}
          bezig={bezig} fout={fout}
          onLog={(payload) => onOpslaan(payload, false)}
        />
      )}

      {modus === "foto" && (
        <Foto
          maaltijd={maal} datumLabel={datumLabel} schaal={schaal}
          bezig={bezig} fout={fout} onOpslaan={onOpslaan}
        />
      )}

      {modus === "handmatig" && (
        <Handmatig
          maaltijd={maal} datumLabel={datumLabel} bezig={bezig} fout={fout}
          schaal={schaal} voorvulling={voorvulling} onOpslaan={onOpslaan}
        />
      )}
    </>
  );
}
