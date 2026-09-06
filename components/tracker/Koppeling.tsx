"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Copy, Download, Loader2, RefreshCw, Trash2, Watch, X } from "lucide-react";
import { T } from "./stijl";
import { fileNaarDataUrl, comprimeerAfbeelding } from "@/lib/afbeelding";

// Beweging uit je horloge.
//
// Drie wegen naar hetzelfde plakveld: zelf typen of plakken, een screenshot
// van je overzicht laten uitlezen, en een sleutel waarmee Tasker activiteiten
// instuurt. De eerste twee werken altijd en meteen; de derde vraagt eenmalig
// wat gepriegel op je telefoon en loopt daarna vanzelf.
//
// De foto vult hetzelfde tekstveld als plakken, in plaats van meteen te
// boeken: zo kijk je na wat het model eruit haalde en kun je het aanvullen of
// verbeteren voor je op Inlezen drukt — precies zoals elke andere import in
// deze app een concept oplevert en geen voldongen feit.

/** Groot genoeg om kleine cijfers in een lange lijst leesbaar te houden. */
const MAX_ZIJDE = 1600;

interface Geboekt {
  datum: string;
  soort: string;
  minuten: number;
  punten: number;
}

export default function Koppeling() {
  const [sleutel, setSleutel] = useState<string | null>(null);
  const [laden, setLaden] = useState(true);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [gekopieerd, setGekopieerd] = useState("");
  const [tekst, setTekst] = useState("");
  const [uitslag, setUitslag] = useState<
    { geboekt: Geboekt[]; overgeslagen: number; afgewezen: string[] } | null
  >(null);

  // Screenshot inlezen: eerst foto's verzamelen (er kan meer dan één
  // screenshot nodig zijn bij een lange lijst), dan pas naar het model.
  const fileRef = useRef<HTMLInputElement>(null);
  const [fotos, setFotos] = useState<string[]>([]); // data-URLs, al gecomprimeerd
  const [fotoBezig, setFotoBezig] = useState(false);
  const [leesBezig, setLeesBezig] = useState(false);

  const laad = useCallback(async () => {
    try {
      const res = await fetch("/api/koppeling", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Kon de koppeling niet ophalen");
      setSleutel(data.sleutel);
    } catch (e) {
      setFout(tekstUit(e));
    } finally { setLaden(false); }
  }, []);

  useEffect(() => { laad(); }, [laad]);

  const nieuweSleutel = async () => {
    setBezig(true); setFout("");
    try {
      const res = await fetch("/api/koppeling", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Er ging iets mis");
      setSleutel(data.sleutel);
    } catch (e) { setFout(tekstUit(e)); } finally { setBezig(false); }
  };

  const trekIn = async () => {
    if (!confirm("Sleutel intrekken? Je horloge kan daarna niets meer insturen.")) return;
    setBezig(true); setFout("");
    try {
      await fetch("/api/koppeling", { method: "DELETE" });
      setSleutel(null);
    } catch (e) { setFout(tekstUit(e)); } finally { setBezig(false); }
  };

  const kopieer = async (wat: string, watHet: string) => {
    try {
      await navigator.clipboard.writeText(wat);
      setGekopieerd(watHet);
      setTimeout(() => setGekopieerd(""), 2000);
    } catch {
      setFout("Kopiëren lukte niet. Selecteer de tekst en kopieer hem met de hand.");
    }
  };

  /** Eén of meer foto's toevoegen aan de strip; comprimeren gebeurt meteen. */
  const voegFotos = async (files: FileList) => {
    setFout(""); setFotoBezig(true);
    try {
      const nieuwe: string[] = [];
      for (const file of Array.from(files)) {
        const raw = await fileNaarDataUrl(file);
        nieuwe.push(await comprimeerAfbeelding(raw, 0.85, MAX_ZIJDE));
      }
      setFotos((p) => [...p, ...nieuwe]);
    } catch {
      setFout("Kon een foto niet verwerken.");
    } finally {
      setFotoBezig(false);
      if (fileRef.current) fileRef.current.value = ""; // zelfde bestand opnieuw kunnen kiezen
    }
  };

  const verwijderFoto = (idx: number) => setFotos((p) => p.filter((_, i) => i !== idx));

  /**
   * De foto's laten uitlezen. Het resultaat komt niet meteen het logboek in —
   * het vult het plakveld, zodat je het kunt nakijken voor je op Inlezen drukt.
   */
  const leesFotos = async () => {
    if (!fotos.length || leesBezig) return;
    setLeesBezig(true); setFout("");
    try {
      const res = await fetch("/api/tracker/beweging/foto", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fotos }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Er ging iets mis");
      setTekst((p) => (p.trim() ? `${p.trim()}\n${data.tekst}` : data.tekst));
      setFotos([]);
    } catch (e) { setFout(tekstUit(e)); } finally { setLeesBezig(false); }
  };

  const plakken = async () => {
    if (!tekst.trim() || bezig) return;
    setBezig(true); setFout(""); setUitslag(null);
    try {
      const res = await fetch("/api/tracker/beweging/plakken", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tekst }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Er ging iets mis");
      setUitslag(data);
      if (data.geboekt.length > 0) setTekst("");
    } catch (e) { setFout(tekstUit(e)); } finally { setBezig(false); }
  };

  const adres = typeof window !== "undefined"
    ? `${window.location.origin}/api/tracker/beweging/extern`
    : "/api/tracker/beweging/extern";

  return (
    <>
      <h2 style={T.sectieKop}>Beweging uit je horloge</h2>

      {fout && <div style={T.fout}>{fout}</div>}

      <h3 style={T.subKop}>Een screenshot laten inlezen</h3>
      <p style={T.hint}>
        Geen zin om te kopiëren? Maak een screenshot van je overzicht in Garmin Connect (of een
        andere app) en laat hem uitlezen. Past de lijst niet op één scherm, voeg dan gerust
        meerdere screenshots toe voor je op Uitlezen drukt. Het resultaat komt in het tekstveld
        hieronder terecht — kijk het na voor je op Inlezen drukt, precies als bij elke andere foto
        in deze app.
      </p>
      <input
        ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }}
        onChange={(e) => e.target.files?.length && voegFotos(e.target.files)}
      />
      {fotos.length > 0 && (
        <div style={T.fotoStrip}>
          {fotos.map((f, idx) => (
            <div key={idx} style={T.fotoStripItem}>
              <img src={f} alt={`Screenshot ${idx + 1}`} style={T.fotoStripImg} />
              <span style={T.fotoStripNr}>{idx + 1}</span>
              <button onClick={() => verwijderFoto(idx)} style={T.fotoStripDel} aria-label="Verwijder screenshot">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        style={{ ...T.secundair, marginTop: fotos.length ? 8 : 0, opacity: fotoBezig || leesBezig ? 0.6 : 1 }}
        onClick={() => fileRef.current?.click()} disabled={fotoBezig || leesBezig}
      >
        {fotoBezig
          ? <><Loader2 size={15} className="spin" /> Foto verwerken...</>
          : <><Camera size={15} /> {fotos.length ? "Nog een screenshot toevoegen" : "Screenshot kiezen"}</>}
      </button>
      {fotos.length > 0 && (
        <button style={{ ...T.primair, opacity: leesBezig ? 0.6 : 1 }} onClick={leesFotos} disabled={leesBezig || fotoBezig}>
          {leesBezig
            ? <><Loader2 size={15} className="spin" /> Uitlezen...</>
            : <><Check size={15} /> Uitlezen ({fotos.length} {fotos.length === 1 ? "screenshot" : "screenshots"})</>}
        </button>
      )}

      <h3 style={T.subKop}>Lijst plakken</h3>
      <p style={T.hint}>
        Ook zonder screenshot werkt dit meteen. Kopieer je activiteiten uit Garmin Connect (of typ ze
        over) en plak ze hieronder — één per regel, met de soort, de datum en de duur erin.
        Bijvoorbeeld: <em>Hardlopen 2026-08-24 45:12</em>. Wat de app niet herkent laat hij staan
        in plaats van te gokken.
      </p>
      <textarea
        style={{ ...T.veld, minHeight: 96, fontFamily: "inherit", resize: "vertical" }}
        value={tekst} onChange={(e) => setTekst(e.target.value)}
        placeholder={"Hardlopen\t2026-08-24\t45:12\nWandelen\t2026-08-23\t1:05:00"}
      />
      <button style={{ ...T.primair, opacity: tekst.trim() && !bezig ? 1 : 0.5 }}
        onClick={plakken} disabled={!tekst.trim() || bezig}>
        {bezig ? <><Loader2 size={15} className="spin" /> Bezig...</> : <><Check size={15} /> Inlezen</>}
      </button>

      {uitslag && (
        <div style={{ ...T.kaart, marginTop: 10 }}>
          {uitslag.geboekt.length > 0 ? (
            <>
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>
                {uitslag.geboekt.length} toegevoegd
              </div>
              {uitslag.geboekt.map((g, i) => (
                <div key={i} style={T.uitslagRij}>
                  <span style={T.uitslagLabel}>{g.datum} · {g.soort}</span>
                  <span style={T.uitslagWaarde}>{g.minuten} min · {g.punten} pt</span>
                </div>
              ))}
            </>
          ) : (
            <div style={{ fontSize: 13.5 }}>Niets toegevoegd.</div>
          )}
          {uitslag.overgeslagen > 0 && (
            <p style={{ ...T.hint, marginTop: 10 }}>
              {uitslag.overgeslagen} regel{uitslag.overgeslagen === 1 ? "" : "s"} stond er al en is
              overgeslagen.
            </p>
          )}
          {uitslag.afgewezen.length > 0 && (
            <div style={{ ...T.waarschuwing, marginTop: 10, marginBottom: 0 }}>
              Niet herkend, dus niet geboekt:
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {uitslag.afgewezen.slice(0, 8).map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <h3 style={T.subKop}>Automatisch, via je telefoon</h3>
      {laden ? (
        <div style={T.kaart}><Loader2 size={18} className="spin" style={{ color: "var(--accent)" }} /></div>
      ) : !sleutel ? (
        <>
          <p style={T.hint}>
            Garmin heeft geen koppeling voor particulieren, dus het gaat via je telefoon. De
            eenvoudigste weg heeft géén plug-in nodig: laat Tasker afgaan op een melding van Garmin
            Connect en stuur de tekst van die melding hierheen — de app zoekt er zelf een sport en
            een duur uit. Lukt dat niet, dan is er de omweg via Health Connect met een plug-in.
          </p>
          <button style={{ ...T.primair, opacity: bezig ? 0.6 : 1 }} onClick={nieuweSleutel} disabled={bezig}>
            <Watch size={15} /> Sleutel aanmaken
          </button>
        </>
      ) : (
        <>
          <a href="/api/koppeling/tasker" download style={{ ...T.primair, textDecoration: "none", marginTop: 0 }}>
            <Download size={15} /> Tasker-taak downloaden
          </a>
          <p style={T.hint}>
            Een kant-en-klaar bestand met je adres en je sleutel er al in. In Tasker: tabblad
            <strong> Taken</strong> → menu rechtsboven → <strong>Importeer taak</strong> → kies
            <span style={S.bestand}>kookboek-beweging.tsk.xml</span> uit je downloadmap.
          </p>
          <p style={T.hint}>
            Er zitten drie taken in, van "heeft het minste nodig" naar "heeft het meeste nodig".
            Begin met <strong>1 Beweging via tekst</strong>: die heeft géén plug-in nodig. Maak in
            Tasker een profiel <span style={S.bestand}>Event → UI → Notificatie</span> met Garmin
            Connect als app, koppel deze taak eraan, en de tekst van de melding gaat naar de app.
            Die zoekt er zelf een sport en een duur uit.
          </p>
          <p style={T.hint}>
            Taak 2 is voor een plug-in die JSON teruggeeft, taak 3 voor een plug-in met losse
            variabelen per activiteit. Werkt taak 1, dan heb je die twee niet nodig.
          </p>
          <p style={T.hint}>
            Alle drie staan in de <strong>proefstand</strong>: de eerste keer controleren ze alles
            en zetten ze nog niets in je logboek. Werkt het, zet dan de eerste actie
            {" "}<span style={S.bestand}>%kb_proef</span> op 0.
          </p>
          <p style={{ ...T.hint, marginBottom: 14 }}>
            Het bestand bevat je sleutel. Deel het met niemand, en gooi het uit je downloadmap als
            je klaar bent.
          </p>

          <div style={T.kaart}>
            <div style={T.label}>De eenvoudigste vorm — stuur gewoon tekst</div>
            <code style={S.code}>{adres}</code>
            <p style={T.hint}>
              Method POST, Body = een stuk tekst met een sport en een duur erin. Bijvoorbeeld
              {" "}<span style={S.bestand}>Hardlopen 2026-08-24 45:12</span> of gewoon
              {" "}<span style={S.bestand}>Wandeling voltooid 1:05:00</span>. Meerdere regels mag
              ook. Wat de app niet kan lezen zegt hij, in plaats van te gokken.
            </p>

            <div style={{ ...T.label, marginTop: 16 }}>Of met losse velden — adres (POST)</div>
            <code style={S.code}>{`${adres}?soort=&minuten=&datum=&id=`}</code>
            <button style={{ ...T.secundair, marginTop: 8 }}
              onClick={() => kopieer(`${adres}?soort=&minuten=&datum=&id=`, "adres")}>
              {gekopieerd === "adres" ? <><Check size={14} /> Gekopieerd</> : <><Copy size={14} /> Adres kopiëren</>}
            </button>
            <p style={T.hint}>
              Achter elk isgelijkteken zet je jouw eigen Tasker-variabele. Er staat hier met opzet
              geen voorbeeldnaam: die wordt overgenomen, bestaat dan niet, en levert een fout op
              die naar de verkeerde kant wijst. Laat de Body leeg.
            </p>

            <div style={{ ...T.label, marginTop: 16 }}>Header</div>
            <code style={S.code}>Authorization: Bearer {sleutel}</code>
            <button style={{ ...T.secundair, marginTop: 8 }}
              onClick={() => kopieer(`Authorization:Bearer ${sleutel}`, "header")}>
              {gekopieerd === "header" ? <><Check size={14} /> Gekopieerd</> : <><Copy size={14} /> Header kopiëren</>}
            </button>

            <div style={{ ...T.label, marginTop: 16 }}>Eerst proberen zonder te boeken</div>
            <code style={S.code}>{`${adres}?proef=1&soort=RUNNING&minuten=42`}</code>
            <button style={{ ...T.secundair, marginTop: 8 }}
              onClick={() => kopieer(`${adres}?proef=1&soort=RUNNING&minuten=42`, "proef")}>
              {gekopieerd === "proef" ? <><Check size={14} /> Gekopieerd</> : <><Copy size={14} /> Proefadres kopiëren</>}
            </button>
          </div>

          <p style={T.hint}>
            <strong>Zo stel je het in.</strong> Maak in Tasker een taak met één actie: Net → HTTP
            Request, Method POST, bovenstaande URL, de header erbij, Body leeg. Zet er daarvoor
            tijdelijk een Flash-actie met <code>%hc_type %hc_duration</code> erin, zodat je ziet
            of die variabelen werkelijk gevuld zijn — dat is negen van de tien keer waar het
            misgaat.
          </p>
          <p style={T.hint}>
            <strong>De naam van de variabele</strong> hangt af van je plug-in. Kijk in het
            actiescherm van de plug-in zelf welke variabele hij vult — die staat daar, en gokken
            kost je een avond. Vertalen hoef je niet: Engelse namen worden herkend (RUNNING,
            WALKING, BIKING, MOUNTAIN_BIKING, STRENGTH_TRAINING, SWIMMING_POOL, HIKING), net als de
            Nederlandse.
          </p>
          <p style={T.hint}>
            <strong>Staat de sport als nummer in de JSON</strong> in plaats van als naam, dan zegt
            de app welk nummer het was en boekt hij die sessie niet. Dat is met opzet: die
            cijfercodes zijn nergens betrouwbaar na te slaan, en een verkeerd gegokt nummer boekt
            stilletjes de verkeerde sport. Geef het nummer door, dan zet ik het erbij.
          </p>
          <p style={T.hint}>
            Gaat er iets mis, dan staat in het antwoord welke velden er binnenkwamen en met welke
            waarde. Komt daar de naam van een variabele uit in plaats van een sport, dan zegt de
            app dat ook met zoveel woorden — dan is die variabele niet ingevuld. Dezelfde training twee keer insturen levert één regel op, dus een mislukte
            poging mag je gerust overdoen.
          </p>
          <p style={T.hint}>
            De app rekent de punten zelf uit je gewicht en je basaal metabolisme. Een verbranding
            die je horloge meestuurt wordt niet overgenomen — die getallen zijn structureel te
            hoog, en de dempers van de app zouden er dan omheen lopen.
          </p>

          <button style={T.secundair} onClick={nieuweSleutel} disabled={bezig}>
            <RefreshCw size={15} /> Nieuwe sleutel (trekt de oude in)
          </button>
          <button style={T.secundair} onClick={trekIn} disabled={bezig}>
            <Trash2 size={15} /> Koppeling intrekken
          </button>
        </>
      )}
    </>
  );
}

const S: Record<string, React.CSSProperties> = {
  code: {
    display: "block", background: "var(--bg)", border: "1px solid var(--line)",
    borderRadius: 8, padding: "8px 10px", fontSize: 11.5, lineHeight: 1.5,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    wordBreak: "break-all", color: "var(--ink)",
  },
  bestand: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.92em", background: "var(--bg)", padding: "1px 5px", borderRadius: 5,
  },
};

function tekstUit(e: unknown): string {
  return e instanceof Error ? e.message : "Er ging iets mis";
}
