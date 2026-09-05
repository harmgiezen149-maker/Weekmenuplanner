"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, BookOpen, Check, ClipboardPaste, Link2, Loader2,
} from "lucide-react";
import { leesGeplakteLijst } from "@/lib/tracker/koppeling";
import { datumSleutel } from "@/lib/tracker/datum";
import { T } from "./stijl";
import { rawPoints, toonPunten } from "@/lib/tracker/points";
import { nl } from "@/lib/tracker/datum";
import { MAALTIJDEN_TRACKER, MAALTIJD_LABEL } from "@/lib/tracker/types";
import type { Maaltijd, Product } from "@/lib/tracker/types";
import type { ReceptPunten } from "@/lib/tracker/recept";
import Rekenregels from "./Rekenregels";
import { KOOKBOEK_MAALTIJD } from "@/lib/tracker/samenstellen";
import { HOOFDINGREDIENTEN } from "@/lib/types";
import { fotoVanPagina } from "@/lib/receptfoto";

type Bron = "json-ld" | "html" | "model";

interface ReceptUitslag {
  soort: "recept";
  recept: { titel: string; personen: number; bereiding?: string };
  punten: ReceptPunten;
  bron: Bron;
  url: string;
}

interface ProductUitslag {
  soort: "product";
  product: Product;
  bron: Bron;
  url: string;
}

type Uitslag = ReceptUitslag | ProductUitslag;

const BRON_UITLEG: Record<Bron, string> = {
  "json-ld": "Uit de receptgegevens van de pagina zelf — die zijn exact.",
  html: "Uit de ingrediëntenlijst op de pagina. Kijk de hoeveelheden even na.",
  model: "Uit de tekst van de pagina afgeleid. Kijk het geheel even na.",
};

const PRODUCT_BRON_UITLEG: Record<Bron, string> = {
  "json-ld": "Uit de productgegevens van de pagina zelf — die zijn exact.",
  html: "Uit de voedingswaardetabel op de pagina.",
  model: "Uit de tekst van de pagina afgeleid. Kijk de waarden even na.",
};

/**
 * Landingspunt voor een gedeelde link.
 *
 * Werkt voor allebei: een receptpagina wordt per portie doorgerekend, een
 * productpagina van een webshop levert een product op. Welke van de twee het
 * is zoekt de app zelf uit — dat hoef je niet te weten voor je plakt.
 *
 * Op Android komt de link binnen via het deelmenu (share_target in het
 * manifest). iOS kent dat niet; daar plak je hem hier, of stuurt een Shortcut
 * hem naar dezelfde route.
 */
export default function Import({
  gedeeldeUrl, datumLabel, schaal, bezig, fout, onLog, onKiesProduct,
}: {
  gedeeldeUrl: string;
  datumLabel: string;
  schaal: number;
  bezig: boolean;
  fout: string;
  onLog: (payload: Record<string, unknown>) => void;
  /** Een gevonden product gaat naar de portiekiezer. */
  onKiesProduct: (p: Product) => void;
}) {
  const [url, setUrl] = useState(gedeeldeUrl);
  const [laadt, setLaadt] = useState(false);
  const [eigenFout, setEigenFout] = useState("");
  const [uitslag, setUitslag] = useState<Uitslag | null>(null);
  const [porties, setPorties] = useState("1");
  const [maal, setMaal] = useState<Maaltijd>("diner");
  const [beweging, setBeweging] = useState<{ geboekt: number; melding: string } | null>(null);
  const [bewegingBezig, setBewegingBezig] = useState(false);
  // Waar het recept heen gaat. Loggen is waar je meestal voor komt; het
  // kookboek staat ernaast, want een recept dat je lekker vond wil je vaker.
  const [naarLogboek, setNaarLogboek] = useState(true);
  const [naarKookboek, setNaarKookboek] = useState(false);
  const [hoofd, setHoofd] = useState<string>(HOOFDINGREDIENTEN[3]);
  const [bewaartRecept, setBewaartRecept] = useState(false);
  const [fotoBezig, setFotoBezig] = useState(false);
  const [kookboekKlaar, setKookboekKlaar] = useState("");

  /**
   * Ziet de gedeelde tekst eruit als een training?
   *
   * Wordt hier gedaan en niet op de server: dan verschijnt de knop meteen, en
   * er gaat pas iets naar de app als je erop drukt. De herkenning is dezelfde
   * functie die het plakveld in Instellingen gebruikt.
   */
  const alsBeweging = useMemo(() => {
    const tekst = (gedeeldeUrl || url).trim();
    if (!tekst || tekst.length > 2000) return null;
    const { herkend } = leesGeplakteLijst(tekst, datumSleutel());
    return herkend.length > 0 ? herkend : null;
  }, [gedeeldeUrl, url]);

  const boekBeweging = async () => {
    if (!alsBeweging || bewegingBezig) return;
    setBewegingBezig(true); setEigenFout("");
    try {
      const res = await fetch("/api/tracker/beweging/plakken", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tekst: (gedeeldeUrl || url).trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Er ging iets mis");
      const n = (data.geboekt ?? []).length;
      setBeweging({
        geboekt: n,
        melding: n > 0
          ? `${n === 1 ? "Eén activiteit" : `${n} activiteiten`} toegevoegd aan je logboek.`
          : data.overgeslagen > 0
            ? "Deze stond er al in."
            : "Er viel niets te boeken.",
      });
    } catch (e) {
      setEigenFout(e instanceof Error ? e.message : "Er ging iets mis");
    } finally { setBewegingBezig(false); }
  };

  const haalOp = useCallback(async (adres: string) => {
    if (!adres.trim()) return;
    setLaadt(true); setEigenFout(""); setUitslag(null);
    try {
      const res = await fetch("/api/tracker/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: adres.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Importeren mislukt");
      if (data.soort === "product") {
        setUitslag(data);
        return;
      }
      setUitslag(data);
    } catch (e) {
      setEigenFout(e instanceof Error ? e.message : "Er ging iets mis");
    } finally { setLaadt(false); }
  }, []);

  // Kwam er iets via het deelmenu binnen, dan meteen ophalen — tenzij het een
  // training blijkt te zijn. Die hoort niet als receptpagina opgehaald te
  // worden, en zeker geen modelaanroep te kosten.
  useEffect(() => {
    if (!gedeeldeUrl) return;
    setUrl(gedeeldeUrl);
    const { herkend } = leesGeplakteLijst(gedeeldeUrl, datumSleutel());
    if (herkend.length === 0) haalOp(gedeeldeUrl);
  }, [gedeeldeUrl, haalOp]);

  const plak = async () => {
    try {
      const tekst = await navigator.clipboard.readText();
      setUrl(tekst);
      haalOp(tekst);
    } catch {
      setEigenFout("Je browser gaf geen toegang tot het klembord. Plak de link zelf in het veld.");
    }
  };

  const aantal = getal(porties);
  const perPortie = uitslag?.soort === "recept" ? uitslag.punten.perPortiePunten : 0;
  const punten = toonPunten(perPortie * aantal, schaal);

  const kanOpslaan = aantal > 0 && (naarLogboek || naarKookboek) && !bezig && !bewaartRecept;
  const opslaanLabel = naarLogboek && naarKookboek
    ? "Loggen en in het kookboek"
    : naarKookboek
      ? "In het kookboek zetten"
      : `Toevoegen aan ${datumLabel.toLowerCase()}`;

  /**
   * Het recept in het kookboek zetten.
   *
   * De ingrediënten komen uit de doorrekening en niet uit de oorspronkelijke
   * pagina: heb je hierboven een naam of een maat bijgesteld, dan hoort die
   * verbetering mee te gaan.
   */
  const bewaarInKookboek = async (u: ReceptUitslag): Promise<{ metFoto: boolean }> => {
    const ingredienten = u.punten.matches.map((m) => ({
      naam: m.ingredient, hoev: m.hoev, eenheid: m.eenheid,
    }));

    // De foto van de bronpagina meenemen. Een recept zonder plaatje valt in het
    // kookboek uit de toon tussen de rest, en de pagina heeft er meestal een.
    // Lukt het niet, dan gaat het recept gewoon zonder mee — dat mag geen
    // reden zijn om het opslaan te laten stranden.
    setFotoBezig(true);
    const afbeelding = await fotoVanPagina(u.url).catch(() => "");
    setFotoBezig(false);

    const res = await fetch("/api/recipes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titel: u.recept.titel,
        hoofd,
        maaltijd: KOOKBOEK_MAALTIJD[maal],
        personen: u.recept.personen,
        tijd: 30, score: 0, gegeten: 0, afbeelding,
        ingredienten,
        bereiding: [u.recept.bereiding, `Bron: ${u.url}`].filter(Boolean).join("\n\n"),
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d?.error || "Het recept kon niet worden opgeslagen");
    }

    // Wat nog niet herkend is alsnog laten schatten, zodat het verse recept
    // niet met een gat in de punten in het kookboek staat. Op de achtergrond
    // en stil als het misgaat: het recept is opgeslagen, dat was de vraag.
    if (u.punten.nietHerkend.length > 0) {
      void fetch("/api/tracker/ingredienten/schat-alles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ namen: u.punten.nietHerkend }),
      }).catch(() => {});
    }

    return { metFoto: afbeelding !== "" };
  };

  /**
   * Opslaan. Het kookboek gaat eerst, want loggen verlaat dit scherm: gaat het
   * recept mis, dan sta je hier nog met de melding erbij in plaats van in je
   * dagoverzicht met een half uitgevoerde opdracht.
   */
  const bewaar = async (u: ReceptUitslag) => {
    setEigenFout(""); setKookboekKlaar("");

    if (naarKookboek) {
      setBewaartRecept(true);
      try {
        const { metFoto } = await bewaarInKookboek(u);
        setKookboekKlaar(
          `${u.recept.titel} staat in je kookboek` +
          (metFoto
            ? ", met de foto van de pagina erbij."
            : ". Er kwam geen foto van de pagina mee; die voeg je in het kookboek zelf toe.")
        );
      } catch (e) {
        setEigenFout(e instanceof Error ? e.message : "Het recept kon niet worden opgeslagen");
        return;
      } finally { setBewaartRecept(false); setFotoBezig(false); }
    }

    if (!naarLogboek) return;

    const factor = aantal / u.punten.personen;
    onLog({
      name: u.recept.titel,
      meal: maal,
      source: "link",
      ref: u.url,
      amount: aantal,
      unit: aantal === 1 ? "portie" : "porties",
      components: u.punten.componenten.map((c) => ({
        ...c,
        amount: c.amount * factor,
        grams: c.grams * factor,
        nutrients: Object.fromEntries(
          Object.entries(c.nutrients).map(([k, v]) => [k, typeof v === "number" ? v * factor : v])
        ),
      })),
    });
  };

  return (
    <>
      {(fout || eigenFout) && <div style={T.fout}>{fout || eigenFout}</div>}

      {alsBeweging && !beweging && (
        <div style={{ ...T.kaart, borderColor: "var(--accent)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Activity size={16} style={{ color: "var(--accent)" }} />
            <strong style={{ fontSize: 14.5 }}>Dit lijkt een training</strong>
          </div>
          {alsBeweging.map((r, i) => (
            <div key={i} style={T.uitslagRij}>
              <span style={T.uitslagLabel}>{r.datum} · {r.soort.naam}</span>
              <span style={T.uitslagWaarde}>{r.minuten} min</span>
            </div>
          ))}
          <button
            style={{ ...T.primair, opacity: bewegingBezig ? 0.6 : 1 }}
            onClick={boekBeweging} disabled={bewegingBezig}
          >
            {bewegingBezig
              ? <><Loader2 size={15} className="spin" /> Toevoegen...</>
              : <><Check size={15} /> Bij mijn beweging zetten</>}
          </button>
          <p style={T.hint}>
            Klopt dit niet, negeer deze kaart dan — hieronder kun je gewoon een recept of product
            ophalen.
          </p>
        </div>
      )}

      {beweging && (
        <div style={{ ...T.melding, marginBottom: 12 }}>{beweging.melding}</div>
      )}

      <div style={T.veldVak}>
        <label style={T.label} htmlFor="im-url">Link naar een recept of product</label>
        <input id="im-url" style={T.veld} value={url} inputMode="url"
          placeholder="https://..." onChange={(e) => setUrl(e.target.value)} />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button style={{ ...T.primair, marginTop: 0, opacity: url.trim() && !laadt ? 1 : 0.5 }}
            disabled={!url.trim() || laadt} onClick={() => haalOp(url)}>
            {laadt
              ? <><Loader2 size={16} className="spin" /> Ophalen...</>
              : <><Link2 size={16} /> Ophalen</>}
          </button>
          <button style={{ ...T.secundair, marginTop: 0, width: "auto", padding: "12px 14px" }}
            onClick={plak} aria-label="Link uit klembord plakken">
            <ClipboardPaste size={16} />
          </button>
        </div>
        <p style={T.hint}>
          Werkt voor een receptpagina én voor een productpagina van een webshop; de
          app zoekt zelf uit welke van de twee het is. Op Android kun je een pagina
          rechtstreeks vanuit je browser naar deze app delen. Op iOS bestaat dat
          niet: kopieer de link en gebruik de plakknop.
        </p>
      </div>

      {uitslag?.soort === "product" && (
        <>
          <div style={T.kaart}>
            <div style={T.productNaam}>{uitslag.product.name}</div>
            <div style={T.productSub}>
              {uitslag.product.brand ? `${uitslag.product.brand} · ` : ""}
              {PRODUCT_BRON_UITLEG[uitslag.bron]}
            </div>
            <div style={T.macroRij}>
              <span style={T.macro}>
                <span style={T.macroWaarde}>{Math.round(uitslag.product.per100.kcal)}</span>{" "}
                kcal/100 {uitslag.product.eenheid}
              </span>
              <span style={T.macro}>
                <span style={T.macroWaarde}>{nl(uitslag.product.per100.protein_g)}</span> g eiwit
              </span>
              <span style={T.macro}>
                <span style={T.macroWaarde}>{nl(uitslag.product.per100.sugar_g)}</span> g suiker
              </span>
              <span style={T.macro}>
                <span style={T.macroWaarde}>
                  {toonPunten(rawPoints(uitslag.product.per100, 100), schaal)}
                </span> pt per 100 {uitslag.product.eenheid}
              </span>
            </div>
          </div>

          {uitslag.product.barcode && (
            <div style={{ ...T.melding, borderColor: "var(--green)" }}>
              Streepjescode <strong style={{ color: "var(--ink)" }}>{uitslag.product.barcode}</strong>{" "}
              stond op de pagina en is bewaard. Scan je dit product later, dan wordt
              het meteen gevonden.
            </div>
          )}

          <button style={T.primair} onClick={() => onKiesProduct(uitslag.product)}>
            <Check size={16} /> Hoeveelheid kiezen en toevoegen
          </button>

          <p style={T.hint}>
            De punten komen uit de eigen formule, berekend uit de voedingswaarden op
            de pagina. Prijzen en bonusteksten worden genegeerd.
          </p>
        </>
      )}

      {uitslag?.soort === "recept" && (
        <>
          <div style={T.kaart}>
            <div style={T.productNaam}>{uitslag.recept.titel}</div>
            <div style={T.productSub}>
              Recept voor {uitslag.recept.personen}{" "}
              {uitslag.recept.personen === 1 ? "persoon" : "personen"} · {BRON_UITLEG[uitslag.bron]}
            </div>
          </div>

          <div style={T.live} role="status" aria-live="polite">
            <span style={T.liveGetal}>{punten}</span>
            <span style={T.liveTekst}>
              {punten === 1 ? "punt" : "punten"} voor {nl(aantal)}{" "}
              {aantal === 1 ? "portie" : "porties"}<br />
              {datumLabel.toLowerCase()} · {MAALTIJD_LABEL[maal].toLowerCase()}
            </span>
          </div>

          {uitslag.punten.nietHerkend.length > 0 && (
            <div style={T.waarschuwing}>
              <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
              Niet meegeteld: {uitslag.punten.nietHerkend.join(", ")}. De punten
              hierboven zijn dus aan de lage kant.
            </div>
          )}

          <div style={T.veldRij}>
            <div style={{ flex: 1 }}>
              <label style={T.label} htmlFor="im-porties">Aantal porties</label>
              <input id="im-porties" style={T.veld} value={porties} inputMode="decimal"
                onChange={(e) => setPorties(e.target.value)} />
            </div>
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

          <h2 style={T.lijstKop}>Zo is het gerekend</h2>
          {/* Op url gesleuteld: haal je een andere pagina op, dan begint dit
              lijstje schoon en niet met de bijstellingen van het vorige recept. */}
          <Rekenregels
            key={uitslag.url}
            punten={uitslag.punten}
            personen={uitslag.recept.personen}
            onHerrekend={(nieuw) => setUitslag({ ...uitslag, punten: nieuw })}
          />

          <p style={T.hint}>
            De punten komen uit de eigen formule, berekend uit de ingrediënten.
            Een puntwaarde die op de bronpagina staat wordt nooit overgenomen. Telt
            een ingrediënt niet mee, tik dan op het potlood ernaast: met een andere
            naam of een maat die de app kent telt het alsnog.
          </p>

          <div style={T.veldVak}>
            <span style={T.label}>Waar zet je het neer?</span>
            <div style={T.chips}>
              <button type="button" onClick={() => setNaarLogboek((v) => !v)}
                style={{ ...T.chip, ...(naarLogboek ? T.chipAan : {}) }}>
                <Activity size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
                In je logboek
              </button>
              <button type="button" onClick={() => setNaarKookboek((v) => !v)}
                style={{ ...T.chip, ...(naarKookboek ? T.chipAan : {}) }}>
                <BookOpen size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
                In je kookboek
              </button>
            </div>
            <p style={T.hint}>
              Loggen zet {aantal === 1 ? "deze portie" : "deze porties"} bij{" "}
              {datumLabel.toLowerCase()}. In je kookboek blijft het recept staan om vaker
              te maken, met punten per portie, klaar voor het weekmenu. Allebei mag.
            </p>
          </div>

          {naarKookboek && (
            <div style={T.veldVak}>
              <label style={T.label} htmlFor="im-hoofd">Hoofdingrediënt</label>
              <select id="im-hoofd" style={T.veld} value={hoofd}
                onChange={(e) => setHoofd(e.target.value)}>
                {HOOFDINGREDIENTEN.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              <p style={T.hint}>
                De ingrediënten gaan mee zoals ze hierboven staan, jouw bijstellingen
                incluis.{uitslag.recept.bereiding ? " De bereiding stond op de pagina en gaat mee." : " Een bereiding stond er niet bij; die vul je in het kookboek aan."}
                {" "}Staat er een foto op de pagina, dan komt die er ook bij.
              </p>
            </div>
          )}

          {kookboekKlaar && <div style={{ ...T.melding, marginBottom: 12 }}>{kookboekKlaar}</div>}

          <button style={{ ...T.primair, opacity: kanOpslaan ? 1 : 0.5 }}
            disabled={!kanOpslaan}
            onClick={() => void bewaar(uitslag)}>
            {bezig || bewaartRecept
              ? <><Loader2 size={16} className="spin" /> {fotoBezig ? "Foto ophalen..." : "Opslaan..."}</>
              : <><Check size={16} /> {opslaanLabel}</>}
          </button>
        </>
      )}
    </>
  );
}

function getal(s: string): number {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
