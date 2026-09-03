"use client";

import React, { useRef, useState } from "react";
import { AlertTriangle, BookOpen, Camera, Check, Loader2, Trash2 } from "lucide-react";
import { T } from "./stijl";
import { rawPoints, toonPunten } from "@/lib/tracker/points";
import { nl } from "@/lib/tracker/datum";
import { CATEGORIE_LABEL, CATEGORIEEN, MAALTIJDEN_TRACKER, MAALTIJD_LABEL } from "@/lib/tracker/types";
import type { Category, Maaltijd, Nutrients } from "@/lib/tracker/types";
import type { FotoItem } from "@/lib/tracker/foto";
import { KOOKBOEK_MAALTIJD } from "@/lib/tracker/samenstellen";
import { comprimeerAfbeelding } from "@/lib/afbeelding";
import { HOOFDINGREDIENTEN } from "@/lib/types";

const MAX_ZIJDE = 1400; // groot genoeg om porties te kunnen zien

/**
 * Een foto van je bord laten schatten.
 *
 * Het resultaat is altijd een BEWERKBAAR CONCEPT: een schatting uit een foto
 * is een startpunt, geen meting. Er wordt niets opgeslagen voordat je het hebt
 * nagekeken, en bij een lage zekerheid wordt de portiegrootte gemarkeerd.
 *
 * Wat je fotografeert heb je vaak zelf gekookt. Daarom staat de vraag erbij of
 * het ook in het kookboek moet: dezelfde foto, dezelfde onderdelen, en dan
 * hoef je het gerecht niet een tweede keer in te typen. Standaard staat die
 * vraag uit — één handeling loggen is niet hetzelfde als een recept bewaren.
 */
export default function Foto({
  maaltijd, datumLabel, schaal, bezig, fout, onOpslaan,
}: {
  maaltijd: Maaltijd;
  datumLabel: string;
  schaal: number;
  bezig: boolean;
  fout: string;
  onOpslaan: (payload: Record<string, unknown>, alsFavoriet: boolean) => void;
}) {
  const invoer = useRef<HTMLInputElement | null>(null);
  const [voorbeeld, setVoorbeeld] = useState("");
  const [analyseert, setAnalyseert] = useState(false);
  const [items, setItems] = useState<FotoItem[] | null>(null);
  const [eigenFout, setEigenFout] = useState("");
  const [maal, setMaal] = useState<Maaltijd>(maaltijd);
  const [naarKookboek, setNaarKookboek] = useState(false);
  const [receptTitel, setReceptTitel] = useState("");
  const [receptHoofd, setReceptHoofd] = useState<string>(HOOFDINGREDIENTEN[1]);
  const [bewaartRecept, setBewaartRecept] = useState(false);

  const kiesFoto = async (bestand: File) => {
    setEigenFout(""); setItems(null);
    try {
      const dataUrl = await comprimeer(bestand);
      setVoorbeeld(dataUrl);
      setAnalyseert(true);
      const res = await fetch("/api/tracker/foto", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ afbeelding: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "De foto kon niet worden verwerkt");
      setItems(data.items);
      // Eén herkend gerecht is meteen een bruikbare naam; bij meer onderdelen
      // weet alleen jij hoe het heet.
      setReceptTitel(data.items?.length === 1 ? String(data.items[0].name ?? "") : "");
    } catch (e) {
      setEigenFout(e instanceof Error ? e.message : "Er ging iets mis");
    } finally { setAnalyseert(false); }
  };

  const nutrientsVan = (i: FotoItem): Nutrients => ({
    kcal: i.kcal, protein_g: i.protein_g, fat_g: i.fat_g, satfat_g: i.satfat_g,
    carbs_g: i.carbs_g, sugar_g: i.sugar_g, fiber_g: i.fiber_g,
    ...(i.added_sugar_g > 0 ? { added_sugar_g: i.added_sugar_g } : {}),
    category: i.category,
  });

  // Elk item wordt een eigen onderdeel met zijn eigen categorie, zodat de
  // suikercorrectie per gerecht op het bord blijft gelden.
  const componenten = (items ?? []).map((i, n) => ({
    id: `foto-${n}`,
    name: i.name,
    amount: i.amount,
    unit: i.unit,
    grams: i.amount,
    nutrients: nutrientsVan(i),
    points_raw: rawPoints(nutrientsVan(i), i.amount),
  }));

  const totaalRaw = componenten.reduce((s, c) => s + c.points_raw, 0);
  const punten = toonPunten(totaalRaw, schaal);

  /**
   * Het gerecht als recept in het kookboek zetten.
   *
   * De onderdelen van de foto worden de ingrediënten, voor één persoon: dit is
   * één bord, en doen alsof het een gezinsmaaltijd was zou de hoeveelheden
   * verzinnen. In het kookboek staan ze daarna gewoon te wijzigen.
   */
  const bewaarAlsRecept = async () => {
    const titel = receptTitel.trim() || (items?.length === 1 ? items[0].name : "Bord van de foto");
    const res = await fetch("/api/recipes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titel,
        hoofd: receptHoofd,
        maaltijd: KOOKBOEK_MAALTIJD[maal],
        personen: 1,
        tijd: 30,
        score: 0,
        gegeten: 1,
        // Kleiner dan de foto die het model kreeg: in het kookboek staat hij
        // op een kaartje, en de opslag heeft een grens per waarde.
        afbeelding: await comprimeerAfbeelding(voorbeeld).catch(() => ""),
        ingredienten: (items ?? []).map((i) => ({
          naam: i.name, hoev: i.amount, eenheid: i.unit,
        })),
        bereiding: "",
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d?.error || "Het recept kon niet worden opgeslagen");
    }

    // De onderdelen van een bord zijn zelden bekende ingrediënten ("geroosterde
    // krieltjes"). Zonder deze stap staat het verse recept meteen met nul
    // punten in het kookboek. Op de achtergrond, en stil als het misgaat: het
    // recept is opgeslagen, dat is wat je gevraagd had.
    void fetch("/api/tracker/ingredienten/schat-alles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ namen: (items ?? []).map((i) => i.name) }),
    }).catch(() => {});
  };

  /**
   * Opslaan: eerst het kookboek, dan de dag.
   *
   * In die volgorde omdat het loggen het scherm verlaat. Lukt het recept niet,
   * dan blijf je hier staan met de melding erbij en is er niets kwijt — een
   * gerecht dat je hebt aangevinkt hoort niet stilletjes te verdwijnen omdat
   * het loggen wel lukte.
   */
  const bewaar = async () => {
    setEigenFout("");
    if (naarKookboek) {
      setBewaartRecept(true);
      try {
        await bewaarAlsRecept();
      } catch (e) {
        setEigenFout(e instanceof Error ? e.message : "Het recept kon niet worden opgeslagen");
        return;
      } finally { setBewaartRecept(false); }
    }
    onOpslaan({
      name: items && items.length === 1 ? items[0].name : "Bord van de foto",
      meal: maal,
      source: "photo",
      amount: 1,
      unit: "portie",
      components: componenten,
    }, false);
  };

  const wijzig = (index: number, veld: keyof FotoItem, waarde: string) => {
    setItems((lijst) => (lijst ?? []).map((i, n) => {
      if (n !== index) return i;
      if (veld === "name" || veld === "unit") return { ...i, [veld]: waarde };
      if (veld === "category") return { ...i, category: waarde as Category };
      const g = Number(String(waarde).replace(",", "."));
      return { ...i, [veld]: Number.isFinite(g) && g >= 0 ? g : 0 };
    }));
  };

  return (
    <>
      {(fout || eigenFout) && <div style={T.fout}>{fout || eigenFout}</div>}

      <input ref={invoer} type="file" accept="image/*" capture="environment"
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) kiesFoto(f); e.target.value = ""; }} />

      {!voorbeeld && (
        <button style={T.fotoLeeg} onClick={() => invoer.current?.click()}>
          <Camera size={20} /> Foto van je bord maken
        </button>
      )}

      {voorbeeld && (
        <div style={T.fotoWrap}>
          <img src={voorbeeld} alt="Je bord" style={T.fotoVoorbeeld} />
          <button style={T.fotoOpnieuw} onClick={() => invoer.current?.click()}>
            <Camera size={14} /> Andere foto
          </button>
        </div>
      )}

      {analyseert && (
        <div style={{ ...T.melding, display: "flex", alignItems: "center", gap: 10 }}>
          <Loader2 size={17} className="spin" style={{ color: "var(--accent)" }} />
          Bezig met kijken wat er op je bord ligt...
        </div>
      )}

      {items && items.length > 0 && (
        <>
          <div style={T.live} role="status" aria-live="polite">
            <span style={T.liveGetal}>{punten}</span>
            <span style={T.liveTekst}>
              {punten === 1 ? "punt" : "punten"} geschat<br />
              {datumLabel.toLowerCase()} · {MAALTIJD_LABEL[maal].toLowerCase()}
            </span>
          </div>

          <div style={T.waarschuwing}>
            <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
            Dit is een schatting, geen meting. Loop de hoeveelheden na en pas ze
            aan voordat je opslaat — vooral waar de zekerheid laag is.
          </div>

          <h2 style={T.lijstKop}>Wat er is herkend</h2>

          {items.map((i, n) => (
            <div key={n} style={T.kaart}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <input style={{ ...T.veld, fontWeight: 700 }} value={i.name}
                  onChange={(e) => wijzig(n, "name", e.target.value)}
                  aria-label={`Naam van onderdeel ${n + 1}`} />
                <span style={T.puntBadge}>{toonPunten(componenten[n].points_raw, schaal)}</span>
                <button style={T.wisKnop}
                  onClick={() => setItems((l) => (l ?? []).filter((_, j) => j !== n))}
                  aria-label={`${i.name} verwijderen`}>
                  <Trash2 size={15} />
                </button>
              </div>

              <div style={T.veldRij}>
                <div style={{ flex: 1 }}>
                  <label style={{
                    ...T.label,
                    color: i.confidence === "laag" ? "var(--over)" : "var(--sub)",
                  }}>
                    Hoeveelheid{i.confidence === "laag" ? " — onzeker" : ""}
                  </label>
                  <input
                    style={{
                      ...T.veld,
                      ...(i.confidence === "laag"
                        ? { borderColor: "var(--over)", background: "#fff8f0" }
                        : {}),
                    }}
                    value={String(i.amount)} inputMode="decimal"
                    onChange={(e) => wijzig(n, "amount", e.target.value)} />
                </div>
                <div style={{ width: 90 }}>
                  <label style={T.label}>Eenheid</label>
                  <input style={T.veld} value={i.unit}
                    onChange={(e) => wijzig(n, "unit", e.target.value)} />
                </div>
              </div>

              <div style={T.veldRij}>
                <Getal label="kcal" waarde={i.kcal} onChange={(v) => wijzig(n, "kcal", v)} />
                <Getal label="Eiwit (g)" waarde={i.protein_g} onChange={(v) => wijzig(n, "protein_g", v)} />
              </div>
              <div style={T.veldRij}>
                <Getal label="Verz. vet (g)" waarde={i.satfat_g} onChange={(v) => wijzig(n, "satfat_g", v)} />
                <Getal label="Vezels (g)" waarde={i.fiber_g} onChange={(v) => wijzig(n, "fiber_g", v)} />
              </div>
              <div style={T.veldRij}>
                <Getal label="Suiker (g)" waarde={i.sugar_g} onChange={(v) => wijzig(n, "sugar_g", v)} />
                <Getal label="Toegevoegde suiker (g)" waarde={i.added_sugar_g}
                  onChange={(v) => wijzig(n, "added_sugar_g", v)} />
              </div>

              <div>
                <label style={T.label}>Soort product</label>
                <select style={T.veld} value={i.category}
                  onChange={(e) => wijzig(n, "category", e.target.value)}>
                  {CATEGORIEEN.map((c) => <option key={c} value={c}>{CATEGORIE_LABEL[c]}</option>)}
                </select>
              </div>
            </div>
          ))}

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

          <div style={T.veldVak}>
            <label style={T.aanvinkRij}>
              <input type="checkbox" checked={naarKookboek}
                onChange={(e) => setNaarKookboek(e.target.checked)} />
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <BookOpen size={14} /> Ook als recept in het kookboek
              </span>
            </label>
            {naarKookboek && (
              <>
                <label style={T.label}>Naam van het gerecht</label>
                <input style={T.veld} value={receptTitel}
                  placeholder="bijv. Ovenschotel met spinazie"
                  onChange={(e) => setReceptTitel(e.target.value)} />
                <div style={{ marginTop: 10 }}>
                  {/* Waar het gerecht om draait bepaalt in het kookboek mede wat
                      er wordt voorgesteld — twee vleesavonden achter elkaar
                      krijgen aftrek. Een gok van de app zou dat stil sturen. */}
                  <label style={T.label}>Waar draait het om?</label>
                  <select style={T.veld} value={receptHoofd}
                    onChange={(e) => setReceptHoofd(e.target.value)}>
                    {HOOFDINGREDIENTEN.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <p style={T.aanvinkUitleg}>
                  De onderdelen hierboven worden de ingrediënten en de foto wordt de
                  receptafbeelding. Hoeveelheden gelden voor dit ene bord — pas ze in het
                  kookboek aan als je voor meer mensen kookt.
                </p>
              </>
            )}
          </div>

          <button style={{ ...T.primair, opacity: bezig || bewaartRecept ? 0.5 : 1 }}
            disabled={bezig || bewaartRecept}
            onClick={bewaar}>
            {bezig || bewaartRecept
              ? <><Loader2 size={16} className="spin" /> Opslaan...</>
              : <><Check size={16} /> Toevoegen aan {datumLabel.toLowerCase()} ({nl(punten, 0)} pt)</>}
          </button>
        </>
      )}
    </>
  );
}

function Getal({ label, waarde, onChange }: {
  label: string; waarde: number; onChange: (v: string) => void;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label style={T.label}>{label}</label>
      <input style={T.veld} value={String(waarde)} inputMode="decimal"
        onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** Schaalt en comprimeert naar JPEG, zodat de foto binnen de aanvraag past. */
function comprimeer(bestand: File): Promise<string> {
  return new Promise((klaar, mislukt) => {
    const lezer = new FileReader();
    lezer.onerror = () => mislukt(new Error("De foto kon niet worden gelezen"));
    lezer.onload = () => {
      const img = new Image();
      img.onerror = () => mislukt(new Error("De foto kon niet worden gelezen"));
      img.onload = () => {
        const factor = Math.min(1, MAX_ZIJDE / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * factor);
        canvas.height = Math.round(img.height * factor);
        const ctx = canvas.getContext("2d");
        if (!ctx) return mislukt(new Error("De foto kon niet worden verwerkt"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        klaar(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = String(lezer.result);
    };
    lezer.readAsDataURL(bestand);
  });
}
