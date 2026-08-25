"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Loader2, LogIn } from "lucide-react";

// Het loginscherm staat los van de rest van de app: het is het enige dat
// zichtbaar is voordat er een sessie is. Eigen stijlen dus, wel op dezelfde
// CSS-variabelen als het kookboek en de tracker.
const S: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 20px", background: "var(--bg)", color: "var(--ink)" },
  kaart: { width: "100%", maxWidth: 380, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 20, padding: "26px 22px 22px", boxShadow: "var(--schaduw-zacht)" },
  merk: { display: "flex", alignItems: "center", gap: 9, marginBottom: 18 },
  titel: { fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", margin: 0 },
  intro: { fontSize: 13.5, color: "var(--sub)", lineHeight: 1.6, margin: "0 0 18px" },
  label: { display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--sub)", marginBottom: 5 },
  veld: { width: "100%", padding: "11px 12px", border: "1px solid var(--line)", borderRadius: 10, fontSize: 16, background: "var(--bg)", color: "var(--ink)", outline: "none" },
  vak: { marginBottom: 13 },
  knop: { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", padding: "13px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 6 },
  fout: { background: "#fdeeeb", border: "1px solid var(--red)", borderRadius: 12, padding: "10px 13px", fontSize: 13, color: "#a8351f", marginBottom: 13, lineHeight: 1.5 },
  hint: { fontSize: 12, color: "var(--sub)", lineHeight: 1.55, margin: "12px 0 0" },
};

interface Status {
  ingericht: boolean;
  ingelogd: boolean;
}

export default function Login() {
  const router = useRouter();
  const zoek = useSearchParams();
  const door = zoek.get("door") || "/";

  const [status, setStatus] = useState<Status | null>(null);
  const [gebruikersnaam, setGebruikersnaam] = useState("");
  const [naam, setNaam] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [herhaal, setHerhaal] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");

  useEffect(() => {
    fetch("/api/auth/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((s: Status) => {
        setStatus(s);
        // Al ingelogd en tóch op het loginscherm? Dan hoort hier niets te
        // gebeuren en gaan we meteen door.
        if (s.ingelogd) router.replace(veiligDoor(door));
      })
      .catch(() => setStatus({ ingericht: true, ingelogd: false }));
  }, [door, router]);

  const eersteKeer = status != null && !status.ingericht;

  const verstuur = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bezig) return;
    if (eersteKeer && wachtwoord !== herhaal) {
      setFout("De twee wachtwoorden zijn niet gelijk.");
      return;
    }
    setBezig(true); setFout("");
    try {
      const res = await fetch(eersteKeer ? "/api/auth/inrichten" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          eersteKeer ? { gebruikersnaam, naam, wachtwoord } : { gebruikersnaam, wachtwoord }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Er ging iets mis");
      // Harde navigatie: de sessiecookie moet mee naar middleware, en die
      // draait alleen bij een nieuwe aanvraag.
      window.location.href = veiligDoor(door);
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Er ging iets mis");
      setBezig(false);
    }
  };

  if (!status) {
    return (
      <div style={S.wrap}>
        <Loader2 size={26} className="spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      <form style={S.kaart} onSubmit={verstuur}>
        <div style={S.merk}>
          <BookOpen size={22} style={{ color: "var(--accent)" }} />
          <h1 style={S.titel}>Kookboek</h1>
        </div>

        <p style={S.intro}>
          {eersteKeer
            ? "Nog geen account. Kies een gebruikersnaam en een wachtwoord; alles wat er nu in de app staat wordt van dit account."
            : "Log in om verder te gaan."}
        </p>

        {fout && <div style={S.fout}>{fout}</div>}

        <div style={S.vak}>
          <label style={S.label} htmlFor="lg-naam">Gebruikersnaam</label>
          <input id="lg-naam" style={S.veld} value={gebruikersnaam} autoComplete="username"
            autoCapitalize="none" autoCorrect="off" spellCheck={false}
            onChange={(e) => setGebruikersnaam(e.target.value)} />
        </div>

        {eersteKeer && (
          <div style={S.vak}>
            <label style={S.label} htmlFor="lg-weergave">Je naam (optioneel)</label>
            <input id="lg-weergave" style={S.veld} value={naam}
              onChange={(e) => setNaam(e.target.value)} />
          </div>
        )}

        <div style={S.vak}>
          <label style={S.label} htmlFor="lg-ww">Wachtwoord</label>
          <input id="lg-ww" type="password" style={S.veld} value={wachtwoord}
            autoComplete={eersteKeer ? "new-password" : "current-password"}
            onChange={(e) => setWachtwoord(e.target.value)} />
        </div>

        {eersteKeer && (
          <div style={S.vak}>
            <label style={S.label} htmlFor="lg-herhaal">Wachtwoord nog een keer</label>
            <input id="lg-herhaal" type="password" style={S.veld} value={herhaal}
              autoComplete="new-password" onChange={(e) => setHerhaal(e.target.value)} />
          </div>
        )}

        <button type="submit" style={{ ...S.knop, opacity: bezig ? 0.6 : 1 }} disabled={bezig}>
          {bezig
            ? <><Loader2 size={16} className="spin" /> Even geduld...</>
            : <><LogIn size={16} /> {eersteKeer ? "Account aanmaken" : "Inloggen"}</>}
        </button>

        {eersteKeer && (
          <p style={S.hint}>
            Minstens 8 tekens. Sla het op in de wachtwoordkluis van je telefoon — er is
            geen "wachtwoord vergeten"-mail.
          </p>
        )}
      </form>
    </div>
  );
}

/**
 * Alleen terug naar een pad binnen deze app. Zonder deze controle zou
 * ?door=https://ergensanders.nl van het loginscherm een doorstuurluik maken.
 */
function veiligDoor(pad: string): string {
  return pad.startsWith("/") && !pad.startsWith("//") ? pad : "/";
}
