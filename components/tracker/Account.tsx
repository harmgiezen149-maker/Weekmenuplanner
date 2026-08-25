"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle, Check, Download, KeyRound, Loader2, LogOut, Trash2, Upload, UserPlus,
} from "lucide-react";
import { T } from "./stijl";
import Meldingen from "./Meldingen";

// Account, mensen en back-up. Staat onderaan het instellingenscherm en haalt
// zijn eigen gegevens op: het heeft niets te maken met het profiel erboven en
// hoeft dat scherm dus ook niet zwaarder te maken.

interface Gebruiker {
  id: string;
  gebruikersnaam: string;
  naam: string;
  gemaakt: string;
}

interface BackupBestand {
  gemaakt?: string;
  persoon?: { naam?: string };
  gedeeld?: { recepten?: unknown[]; dagen?: unknown[] };
  persoonlijk?: { wegingen?: unknown[]; adviezen?: unknown[] };
}

export default function Account() {
  const [gebruikers, setGebruikers] = useState<Gebruiker[]>([]);
  const [ik, setIk] = useState("");
  const [fout, setFout] = useState("");
  const [melding, setMelding] = useState("");

  const laad = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/gebruikers", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Kon de accounts niet ophalen");
      setGebruikers(data.gebruikers ?? []);
      setIk(data.ik ?? "");
    } catch (e) {
      setFout(tekst(e));
    }
  }, []);

  useEffect(() => { laad(); }, [laad]);

  const mij = gebruikers.find((g) => g.id === ik);

  const uitloggen = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    // De service worker bewaart een kopie van onder meer de boodschappenlijst.
    // Die hoort niet achter te blijven op een apparaat waar je net af bent.
    if ("caches" in window) {
      await caches.keys()
        .then((namen) => Promise.all(namen.map((n) => caches.delete(n))))
        .catch(() => {});
    }
    window.location.href = "/login";
  };

  return (
    <>
      <h2 style={T.sectieKop}>Account</h2>

      {fout && <div style={T.fout}>{fout}</div>}
      {melding && <div style={{ ...T.melding, marginBottom: 12 }}>{melding}</div>}

      <div style={T.kaart}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{mij?.naam || "Ingelogd"}</div>
        <div style={{ fontSize: 12.5, color: "var(--sub)", marginTop: 3 }}>
          {mij ? `@${mij.gebruikersnaam}` : " "}
        </div>
        <button style={{ ...T.secundair, marginTop: 14 }} onClick={uitloggen}>
          <LogOut size={15} /> Uitloggen
        </button>
      </div>

      <Wachtwoord onKlaar={(m) => { setMelding(m); setFout(""); }} onFout={setFout} />

      <Personen
        gebruikers={gebruikers} ik={ik} onVernieuw={laad}
        onFout={setFout} onMelding={(m) => { setMelding(m); setFout(""); }}
      />

      <Meldingen />

      <Backup onFout={setFout} onMelding={(m) => { setMelding(m); setFout(""); }} />
    </>
  );
}

// -- wachtwoord --------------------------------------------------------------

function Wachtwoord({
  onKlaar, onFout,
}: { onKlaar: (m: string) => void; onFout: (f: string) => void }) {
  const [open, setOpen] = useState(false);
  const [huidig, setHuidig] = useState("");
  const [nieuw, setNieuw] = useState("");
  const [herhaal, setHerhaal] = useState("");
  const [bezig, setBezig] = useState(false);

  const opslaan = async () => {
    if (bezig) return;
    if (nieuw !== herhaal) { onFout("De twee nieuwe wachtwoorden zijn niet gelijk."); return; }
    setBezig(true); onFout("");
    try {
      const res = await fetch("/api/auth/wachtwoord", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ huidig, nieuw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Er ging iets mis");
      setHuidig(""); setNieuw(""); setHerhaal(""); setOpen(false);
      onKlaar("Je wachtwoord is gewijzigd. Je blijft op dit apparaat ingelogd.");
    } catch (e) {
      onFout(tekst(e));
    } finally { setBezig(false); }
  };

  if (!open) {
    return (
      <button style={{ ...T.secundair, marginTop: 0, marginBottom: 12 }} onClick={() => setOpen(true)}>
        <KeyRound size={15} /> Wachtwoord wijzigen
      </button>
    );
  }

  return (
    <div style={T.kaart}>
      <div style={T.veldVak}>
        <label style={T.label} htmlFor="ac-huidig">Huidig wachtwoord</label>
        <input id="ac-huidig" type="password" style={T.veld} value={huidig}
          autoComplete="current-password" onChange={(e) => setHuidig(e.target.value)} />
      </div>
      <div style={T.veldVak}>
        <label style={T.label} htmlFor="ac-nieuw">Nieuw wachtwoord</label>
        <input id="ac-nieuw" type="password" style={T.veld} value={nieuw}
          autoComplete="new-password" onChange={(e) => setNieuw(e.target.value)} />
      </div>
      <div style={T.veldVak}>
        <label style={T.label} htmlFor="ac-herhaal">Nog een keer</label>
        <input id="ac-herhaal" type="password" style={T.veld} value={herhaal}
          autoComplete="new-password" onChange={(e) => setHerhaal(e.target.value)} />
      </div>
      <button style={{ ...T.primair, opacity: bezig ? 0.6 : 1 }} onClick={opslaan} disabled={bezig}>
        {bezig ? <><Loader2 size={15} className="spin" /> Opslaan...</> : <><Check size={15} /> Opslaan</>}
      </button>
      <button style={T.secundair} onClick={() => setOpen(false)}>Annuleren</button>
    </div>
  );
}

// -- personen ----------------------------------------------------------------

function Personen({
  gebruikers, ik, onVernieuw, onFout, onMelding,
}: {
  gebruikers: Gebruiker[]; ik: string; onVernieuw: () => void;
  onFout: (f: string) => void; onMelding: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [gebruikersnaam, setGebruikersnaam] = useState("");
  const [naam, setNaam] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [bezig, setBezig] = useState(false);

  const toevoegen = async () => {
    if (bezig) return;
    setBezig(true); onFout("");
    try {
      const res = await fetch("/api/auth/gebruikers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gebruikersnaam, naam, wachtwoord }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Er ging iets mis");
      setGebruikersnaam(""); setNaam(""); setWachtwoord(""); setOpen(false);
      onMelding(`${data.gebruiker.naam} kan nu inloggen. Geef het wachtwoord persoonlijk door en laat het meteen wijzigen.`);
      onVernieuw();
    } catch (e) {
      onFout(tekst(e));
    } finally { setBezig(false); }
  };

  const verwijder = async (g: Gebruiker) => {
    if (!confirm(`Inlog van ${g.naam} weghalen? De gegevens blijven staan.`)) return;
    onFout("");
    try {
      const res = await fetch(`/api/auth/gebruikers?id=${encodeURIComponent(g.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Er ging iets mis");
      onVernieuw();
    } catch (e) { onFout(tekst(e)); }
  };

  return (
    <>
      <h2 style={T.sectieKop}>Wie kunnen er inloggen</h2>

      <div style={T.kaartStrak}>
        {gebruikers.map((g) => (
          <div key={g.id} style={T.regel}>
            <div style={T.regelTekst}>
              <div style={T.regelNaam}>{g.naam}{g.id === ik ? " (jij)" : ""}</div>
              <div style={T.regelSub}>@{g.gebruikersnaam}</div>
            </div>
            {g.id !== ik && (
              <button style={T.wisKnop} onClick={() => verwijder(g)} aria-label={`Verwijder ${g.naam}`}>
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
        {gebruikers.length === 0 && <div style={T.maaltijdLeeg}>Nog niemand.</div>}
      </div>

      {open ? (
        <div style={T.kaart}>
          <div style={T.veldVak}>
            <label style={T.label} htmlFor="ac-nieuwnaam">Gebruikersnaam</label>
            <input id="ac-nieuwnaam" style={T.veld} value={gebruikersnaam}
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              onChange={(e) => setGebruikersnaam(e.target.value)} />
          </div>
          <div style={T.veldVak}>
            <label style={T.label} htmlFor="ac-weergave">Naam</label>
            <input id="ac-weergave" style={T.veld} value={naam}
              onChange={(e) => setNaam(e.target.value)} />
          </div>
          <div style={T.veldVak}>
            <label style={T.label} htmlFor="ac-startww">Startwachtwoord</label>
            <input id="ac-startww" type="text" style={T.veld} value={wachtwoord}
              autoComplete="off" onChange={(e) => setWachtwoord(e.target.value)} />
            <p style={T.hint}>
              Minstens 8 tekens. Deze persoon krijgt een eigen profiel en een eigen weeglijst;
              recepten, weekmenu, boodschappen en het eetdagboek blijven gedeeld.
            </p>
          </div>
          <button style={{ ...T.primair, opacity: bezig ? 0.6 : 1 }} onClick={toevoegen} disabled={bezig}>
            {bezig
              ? <><Loader2 size={15} className="spin" /> Aanmaken...</>
              : <><UserPlus size={15} /> Persoon aanmaken</>}
          </button>
          <button style={T.secundair} onClick={() => setOpen(false)}>Annuleren</button>
        </div>
      ) : (
        <button style={{ ...T.secundair, marginTop: 0 }} onClick={() => setOpen(true)}>
          <UserPlus size={15} /> Persoon toevoegen
        </button>
      )}
    </>
  );
}

// -- back-up -----------------------------------------------------------------

function Backup({
  onFout, onMelding,
}: { onFout: (f: string) => void; onMelding: (m: string) => void }) {
  const bestandKiezer = useRef<HTMLInputElement>(null);
  const [gekozen, setGekozen] = useState<{ naam: string; inhoud: BackupBestand } | null>(null);
  const [bezig, setBezig] = useState(false);

  const kies = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    onFout("");
    try {
      const inhoud = JSON.parse(await f.text()) as BackupBestand;
      setGekozen({ naam: f.name, inhoud });
    } catch {
      onFout("Dat bestand is geen leesbare JSON. Kies het bestand dat je met de knop hierboven hebt gedownload.");
    }
  };

  const terugzetten = async () => {
    if (!gekozen || bezig) return;
    setBezig(true); onFout("");
    try {
      const res = await fetch("/api/backup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bevestigd: true, bestand: gekozen.inhoud }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Er ging iets mis");
      const t = data.teruggezet;
      setGekozen(null);
      onMelding(
        `Teruggezet: ${t.recepten} recepten, ${t.dagen} dagen, ${t.wegingen} wegingen. ` +
        "Ververs de pagina om alles bijgewerkt te zien."
      );
    } catch (e) {
      onFout(tekst(e));
    } finally { setBezig(false); }
  };

  const g = gekozen?.inhoud;

  return (
    <>
      <h2 style={T.sectieKop}>Back-up</h2>

      <a href="/api/backup" download style={{ ...T.primair, textDecoration: "none", marginTop: 0 }}>
        <Download size={15} /> Back-up downloaden
      </a>
      <p style={T.hint}>
        Eén JSON-bestand met je recepten, weekmenu, boodschappen, voorraad, eetdagboek,
        je profiel en je weeglijst. Caches en wachtwoorden gaan er niet in. Bewaar het
        ergens buiten de app — een back-up op dezelfde plek als het origineel is geen back-up.
      </p>

      <input ref={bestandKiezer} type="file" accept="application/json,.json"
        style={{ display: "none" }} onChange={kies} />

      {!gekozen ? (
        <button style={T.secundair} onClick={() => bestandKiezer.current?.click()}>
          <Upload size={15} /> Back-up terugzetten
        </button>
      ) : (
        <div style={{ ...T.kaart, marginTop: 10 }}>
          <div style={{ ...T.waarschuwing, display: "flex", gap: 9, alignItems: "flex-start" }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Dit vervangt wat er nu in de app staat. Recepten en dagen die niet in het
              bestand zitten, verdwijnen.
            </span>
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{gekozen.naam}</div>
            <div style={{ color: "var(--sub)" }}>
              Gemaakt: {datum(g?.gemaakt)}<br />
              {g?.gedeeld?.recepten?.length ?? 0} recepten,{" "}
              {g?.gedeeld?.dagen?.length ?? 0} dagen,{" "}
              {g?.persoonlijk?.wegingen?.length ?? 0} wegingen
              {g?.persoon?.naam ? <> · persoonlijk deel van {g.persoon.naam}</> : null}
            </div>
          </div>
          <button
            style={{ ...T.primair, background: "var(--red)", opacity: bezig ? 0.6 : 1 }}
            onClick={terugzetten} disabled={bezig}>
            {bezig
              ? <><Loader2 size={15} className="spin" /> Terugzetten...</>
              : <><Upload size={15} /> Ja, vervang alles</>}
          </button>
          <button style={T.secundair} onClick={() => setGekozen(null)}>Annuleren</button>
        </div>
      )}
    </>
  );
}

function datum(iso: string | undefined): string {
  if (!iso) return "onbekend";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "onbekend"
    : d.toLocaleString("nl-NL", { dateStyle: "long", timeStyle: "short" });
}

function tekst(e: unknown): string {
  return e instanceof Error ? e.message : "Er ging iets mis";
}
