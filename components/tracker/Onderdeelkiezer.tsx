"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock, Loader2, PencilLine, Search, Star } from "lucide-react";
import { T } from "./stijl";
import { rawPoints, toonPunten } from "@/lib/tracker/points";
import { voorHoeveelheid } from "./Portiekiezer";
import { nl } from "@/lib/tracker/datum";
import type { FoodTemplate, MaaltijdComponent, Product } from "@/lib/tracker/types";

/**
 * Een onderdeel kiezen voor een maaltijd.
 *
 * Favorieten en recent gelogde items staan bovenaan: die zijn met één tik
 * toegevoegd, in de hoeveelheid die je eerder gebruikte. Dat is de snelle weg
 * om een vaste maaltijd in elkaar te zetten. Wil je een andere hoeveelheid of
 * iets wat er nog niet bij staat, dan is er het zoekveld.
 */
export default function Onderdeelkiezer({
  favorieten, recent, schaal, onDirect, onKiesProduct, onTerug,
}: {
  favorieten: FoodTemplate[];
  recent: FoodTemplate[];
  schaal: number;
  /** Meteen toevoegen in de bewaarde hoeveelheid. */
  onDirect: (component: MaaltijdComponent) => void;
  /** Eerst de hoeveelheid kiezen. */
  onKiesProduct: (p: Product) => void;
  onTerug: () => void;
}) {
  const [term, setTerm] = useState("");
  const [resultaten, setResultaten] = useState<Product[]>([]);
  const [bezig, setBezig] = useState(false);
  const [gezocht, setGezocht] = useState(false);
  const [externMislukt, setExternMislukt] = useState(false);

  const laatste = useRef(0);
  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) {
      setResultaten([]); setGezocht(false); setExternMislukt(false);
      return;
    }
    const mijnBeurt = ++laatste.current;
    const timer = setTimeout(async () => {
      setBezig(true);
      try {
        const res = await fetch(`/api/tracker/zoeken?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const data = await res.json();
        if (mijnBeurt !== laatste.current) return;
        setResultaten(Array.isArray(data.resultaten) ? data.resultaten : []);
        setExternMislukt(data.extern === "mislukt");
        setGezocht(true);
      } catch {
        if (mijnBeurt === laatste.current) { setResultaten([]); setGezocht(true); }
      } finally {
        if (mijnBeurt === laatste.current) setBezig(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [term]);

  const zoekt = term.trim().length >= 2;

  return (
    <>
      <button style={T.terugKnop} onClick={onTerug}>
        <ArrowLeft size={15} /> Terug naar de maaltijd
      </button>

      <div style={T.zoekWrap}>
        {bezig
          ? <Loader2 size={17} className="spin" style={{ color: "var(--accent)", flexShrink: 0 }} />
          : <Search size={17} style={{ color: "var(--sub)", flexShrink: 0 }} />}
        <input
          style={T.zoekInput} value={term} onChange={(e) => setTerm(e.target.value)}
          placeholder="Zoek een product om toe te voegen"
          aria-label="Zoek een product"
        />
      </div>

      {!zoekt && favorieten.length === 0 && recent.length === 0 && (
        <div style={T.melding}>
          Je hebt nog geen favorieten of recent gelogde items. Zoek hierboven een
          product op; bewaar het daarna als favoriet, dan staat het de volgende
          keer meteen klaar.
        </div>
      )}

      {!zoekt && favorieten.length > 0 && (
        <>
          <h2 style={T.lijstKop}><Star size={13} /> Favorieten</h2>
          <div style={T.kaartStrak}>
            {favorieten.map((f) => (
              <Sjabloon key={f.id} t={f} schaal={schaal}
                onDirect={onDirect} onKiesProduct={onKiesProduct} />
            ))}
          </div>
        </>
      )}

      {!zoekt && recent.length > 0 && (
        <>
          <h2 style={T.lijstKop}><Clock size={13} /> Onlangs gelogd</h2>
          <div style={T.kaartStrak}>
            {recent.map((r) => (
              <Sjabloon key={r.id} t={r} schaal={schaal}
                onDirect={onDirect} onKiesProduct={onKiesProduct} />
            ))}
          </div>
        </>
      )}

      {externMislukt && (
        <div style={T.waarschuwing}>
          De productdatabase is nu niet bereikbaar. Je ziet alleen resultaten uit
          de eigen basislijst en je eigen favorieten.
        </div>
      )}

      {zoekt && gezocht && resultaten.length === 0 && !bezig && (
        <div style={T.melding}>
          Niets gevonden voor <strong style={{ color: "var(--ink)" }}>{term.trim()}</strong>.
        </div>
      )}

      {zoekt && resultaten.length > 0 && (
        <div style={T.kaartStrak}>
          {resultaten.map((p) => (
            <Resultaat key={p.id} product={p} schaal={schaal} onKies={onKiesProduct} />
          ))}
        </div>
      )}
    </>
  );
}

/** Een favoriet of recent item: één tik voegt hem toe zoals hij bewaard staat. */
function Sjabloon({ t, schaal, onDirect, onKiesProduct }: {
  t: FoodTemplate;
  schaal: number;
  onDirect: (c: MaaltijdComponent) => void;
  onKiesProduct: (p: Product) => void;
}) {
  const alsComponent = (): MaaltijdComponent => ({
    id: `${t.id}-${Date.now()}`,
    name: t.name,
    ...(t.brand ? { brand: t.brand } : {}),
    amount: t.amount,
    unit: t.unit,
    grams: t.grams,
    nutrients: t.nutrients,
    points_raw: rawPoints(t.nutrients, t.grams),
  });

  // Voor het aanpassen van de hoeveelheid moet het weer een product worden,
  // dus terug naar waarden per 100.
  const alsProduct = (): Product => ({
    id: t.id,
    name: t.name,
    ...(t.brand ? { brand: t.brand } : {}),
    bron: "bewaard",
    eenheid: t.unit === "ml" ? "ml" : "g",
    per100: t.grams > 0 ? voorHoeveelheid(t.nutrients, (100 / t.grams) * 100) : t.nutrients,
    portie: { grams: t.grams, label: "zoals bewaard" },
    ...(t.ref ? { barcode: t.ref } : {}),
  });

  return (
    <div style={T.regel}>
      <button style={{ ...T.resultaat, padding: 0, borderBottom: "none" }}
        onClick={() => onDirect(alsComponent())}>
        <span style={T.resultaatTekst}>
          <span style={T.resultaatNaam}>{t.name}</span>
          <span style={T.resultaatSub}>
            {nl(t.amount)} {t.unit}
            {t.brand ? ` · ${t.brand}` : ""}
            {` · ${Math.round(t.nutrients.kcal)} kcal`}
          </span>
        </span>
        <span style={T.puntBadge}>{toonPunten(rawPoints(t.nutrients, t.grams), schaal)}</span>
      </button>
      <button style={T.potloodKnop} onClick={() => onKiesProduct(alsProduct())}
        aria-label={`${t.name} met een andere hoeveelheid toevoegen`}>
        <PencilLine size={15} />
      </button>
    </div>
  );
}

function Resultaat({ product, schaal, onKies }: {
  product: Product; schaal: number; onKies: (p: Product) => void;
}) {
  const per100 = toonPunten(rawPoints(product.per100, 100), schaal);
  const portie = product.portie
    ? toonPunten(
        rawPoints(voorHoeveelheid(product.per100, product.portie.grams), product.portie.grams),
        schaal
      )
    : null;

  return (
    <button style={T.resultaat} onClick={() => onKies(product)}>
      <span style={T.resultaatTekst}>
        <span style={T.resultaatNaam}>
          {product.bron === "basis" && <span style={T.bronMerk}>basis</span>}
          {product.name}
        </span>
        <span style={T.resultaatSub}>
          {product.brand ? `${product.brand} · ` : ""}
          {per100} pt per 100 {product.eenheid}
          {portie != null && product.portie ? ` · ${portie} pt per ${product.portie.label}` : ""}
        </span>
      </span>
      <span style={T.puntBadge}>{portie ?? per100}</span>
    </button>
  );
}
