"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { T } from "./stijl";
import { rawPoints, toonPunten } from "@/lib/tracker/points";
import { voorHoeveelheid } from "./Portiekiezer";
import type { Product } from "@/lib/tracker/types";

export default function Zoeken({
  schaal, onKies,
}: {
  schaal: number;
  onKies: (p: Product) => void;
}) {
  const [term, setTerm] = useState("");
  const [resultaten, setResultaten] = useState<Product[]>([]);
  const [bezig, setBezig] = useState(false);
  const [gezocht, setGezocht] = useState(false);
  const [externMislukt, setExternMislukt] = useState(false);

  // Elke toetsaanslag een zoekopdracht sturen is zonde van de externe
  // database; een halve seconde stilte is genoeg signaal dat je uitgetypt bent.
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
        // Een trager antwoord op een oudere term mag een nieuwer niet overschrijven.
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

  return (
    <>
      <div style={T.zoekWrap}>
        {bezig
          ? <Loader2 size={17} className="spin" style={{ color: "var(--accent)", flexShrink: 0 }} />
          : <Search size={17} style={{ color: "var(--sub)", flexShrink: 0 }} />}
        <input
          style={T.zoekInput} value={term} onChange={(e) => setTerm(e.target.value)}
          placeholder="Zoek een product, bijvoorbeeld kwark" autoFocus
          aria-label="Zoek een product"
        />
      </div>

      {externMislukt && (
        <div style={T.waarschuwing}>
          De productdatabase is nu niet bereikbaar. Je ziet alleen resultaten uit
          de eigen basislijst; scannen en handmatig invoeren werken gewoon.
        </div>
      )}

      {gezocht && resultaten.length === 0 && !bezig && (
        <div style={T.melding}>
          Niets gevonden voor <strong style={{ color: "var(--ink)" }}>{term.trim()}</strong>.
          Probeer een kortere term, scan de streepjescode, of voer het handmatig in.
        </div>
      )}

      {resultaten.length > 0 && (
        <div style={T.kaartStrak}>
          {resultaten.map((p) => (
            <Resultaat key={p.id} product={p} schaal={schaal} onKies={onKies} />
          ))}
        </div>
      )}
    </>
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
