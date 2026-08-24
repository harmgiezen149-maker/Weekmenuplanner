import type React from "react";

// Stijlen van de tracker. Zelfde aanpak als het kookboek: inline style-objecten
// bovenop de CSS-variabelen uit app/globals.css, zodat beide modules er
// hetzelfde uitzien zonder extra build-stap.
export const T: Record<string, React.CSSProperties> = {
  app: { width: "100%", margin: "0 auto", minHeight: "100vh", background: "var(--bg)", color: "var(--ink)", display: "flex", flexDirection: "column", position: "relative" },
  header: { display: "flex", alignItems: "center", gap: 10, padding: "20px 22px 14px", position: "sticky", top: 0, background: "rgba(247,247,245,0.88)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", zIndex: 5, borderBottom: "1px solid var(--line)" },
  titel: { fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.03em" },
  headerRechts: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 7 },
  headerSub: { fontSize: 12, color: "var(--sub)", fontWeight: 600, background: "var(--surface)", border: "1px solid var(--line)", padding: "5px 12px", borderRadius: 999 },
  main: { flex: 1, padding: "16px 18px 104px", overflowY: "auto" },
  inhoud: { width: "100%", maxWidth: 560, margin: "0 auto" },
  center: { display: "flex", justifyContent: "center", paddingTop: 60 },

  nav: { position: "fixed", bottom: 10, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 20px)", maxWidth: 480, display: "flex", background: "rgba(255,255,255,0.94)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid var(--line)", borderRadius: 22, padding: "8px 4px 9px", zIndex: 10, boxShadow: "var(--schaduw-zacht)" },
  navBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", color: "var(--sub)", fontSize: 10, fontWeight: 600, padding: "4px 2px", cursor: "pointer", textDecoration: "none" },
  navBtnActief: { color: "var(--accent)", background: "var(--accent-soft)", borderRadius: 14 },
  navLabel: { fontSize: 10 },

  // Datumbalk
  datumBalk: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 },
  datumKnop: { width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, color: "var(--ink)", cursor: "pointer", padding: 0, flexShrink: 0 },
  datumLabel: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: 700, textTransform: "capitalize" },
  vandaagKnop: { background: "var(--accent-soft)", color: "var(--accent)", border: "none", borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 },

  weegPrompt: { display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "var(--accent-soft)", border: "1px solid var(--accent)", color: "var(--accent)", borderRadius: 16, padding: "14px 16px", marginBottom: 12, cursor: "pointer" },
  weegPromptKop: { display: "block", fontSize: 14.5, fontWeight: 800, marginBottom: 2 },
  weegPromptSub: { display: "block", fontSize: 12.5, fontWeight: 500, lineHeight: 1.5 },

  kaart: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 18, padding: "16px 16px", marginBottom: 12 },
  kaartStrak: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 18, overflow: "hidden", marginBottom: 12 },

  // Ring + samenvatting
  ringWrap: { display: "flex", alignItems: "center", gap: 18 },
  ringCijfers: { flex: 1, minWidth: 0 },
  ringGroot: { fontSize: 34, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.03em" },
  ringSub: { fontSize: 13, color: "var(--sub)", fontWeight: 600, marginTop: 4 },
  ringRegel: { fontSize: 13, fontWeight: 700, marginTop: 8 },

  balkWrap: { marginTop: 14 },
  balkKop: { display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "var(--sub)", marginBottom: 5 },
  balkBaan: { height: 8, background: "var(--bg)", borderRadius: 999, overflow: "hidden", border: "1px solid var(--line)" },
  balkVul: { height: "100%", borderRadius: 999, transition: "width 0.25s ease" },

  macroRij: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 },
  macro: { display: "inline-flex", alignItems: "baseline", gap: 4, background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 999, padding: "5px 11px", fontSize: 12, color: "var(--sub)", fontWeight: 600 },
  macroWaarde: { color: "var(--ink)", fontWeight: 700 },

  // Maaltijdblokken
  maaltijdKop: { display: "flex", alignItems: "center", gap: 8, padding: "11px 15px", borderBottom: "1px solid var(--line)", background: "var(--bg)" },
  maaltijdNaam: { fontSize: 14, fontWeight: 800, letterSpacing: "-0.01em" },
  maaltijdPunten: { marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "var(--sub)" },
  regel: { display: "flex", alignItems: "center", gap: 10, padding: "11px 15px", borderBottom: "1px solid var(--line)" },
  regelTekst: { flex: 1, minWidth: 0 },
  regelNaam: { fontSize: 14.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  regelSub: { fontSize: 12, color: "var(--sub)", marginTop: 2 },
  puntBadge: { fontSize: 13, fontWeight: 800, color: "var(--accent)", background: "var(--accent-soft)", borderRadius: 999, padding: "4px 11px", flexShrink: 0, minWidth: 34, textAlign: "center" },
  wisKnop: { width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "var(--sub)", cursor: "pointer", padding: 0, flexShrink: 0 },
  onderdeelRegel: { display: "flex", alignItems: "center", gap: 10, padding: "8px 15px 8px 28px", borderBottom: "1px solid var(--line)", background: "var(--bg)" },
  onderdeelNaam: { display: "block", fontSize: 13, fontWeight: 500, color: "var(--sub)" },
  onderdeelPunt: { fontSize: 12, fontWeight: 700, color: "var(--sub)", flexShrink: 0, minWidth: 24, textAlign: "right" },

  maaltijdLeeg: { padding: "13px 15px", fontSize: 13, color: "var(--sub)", borderBottom: "1px solid var(--line)" },
  maaltijdPlus: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: "10px", background: "none", color: "var(--accent)", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" },

  // Formulier
  label: { display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--sub)", marginBottom: 5 },
  veld: { width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 10, fontSize: 15, background: "var(--surface)", color: "var(--ink)", outline: "none" },
  veldRij: { display: "flex", gap: 10, marginBottom: 12 },
  veldVak: { flex: 1, minWidth: 0, marginBottom: 12 },
  hint: { fontSize: 12, color: "var(--sub)", lineHeight: 1.5, margin: "6px 0 0" },
  sectieKop: { fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--accent)", margin: "18px 0 10px" },

  chips: { display: "flex", gap: 6, flexWrap: "wrap" },
  chip: { padding: "7px 13px", borderRadius: 20, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--sub)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  chipAan: { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" },

  primair: { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", padding: "13px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 4 },
  secundair: { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", padding: "12px", background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 14.5, fontWeight: 700, cursor: "pointer", marginTop: 10 },

  // Live puntenuitslag in het invoerformulier
  live: { display: "flex", alignItems: "center", gap: 14, background: "var(--accent-soft)", border: "1px solid var(--accent)", borderRadius: 14, padding: "13px 16px", marginBottom: 14 },
  liveGetal: { fontSize: 30, fontWeight: 800, color: "var(--accent)", lineHeight: 1 },
  liveTekst: { fontSize: 12.5, color: "var(--accent)", fontWeight: 600, lineHeight: 1.5 },

  melding: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 18px", fontSize: 14, lineHeight: 1.6, color: "var(--sub)" },
  waarschuwing: { background: "#fff6ea", border: "1px solid var(--gold)", borderRadius: 12, padding: "11px 14px", fontSize: 12.5, lineHeight: 1.55, color: "#8a5a12", marginBottom: 12 },
  fout: { background: "#fdeeeb", border: "1px solid var(--red)", borderRadius: 12, padding: "11px 14px", fontSize: 13, color: "#a8351f", marginBottom: 12 },

  // Toevoegen: keuze tussen snel, zoeken, scannen en handmatig
  modusRij: { display: "flex", gap: 6, marginBottom: 16, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 4 },
  modusKnop: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", borderRadius: 11, padding: "9px 4px", color: "var(--sub)", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  modusKnopAan: { background: "var(--accent-soft)", color: "var(--accent)" },

  terugKnop: { display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "var(--accent)", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "2px 0", marginBottom: 12 },

  productNaam: { fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.25 },
  productSub: { fontSize: 12.5, color: "var(--sub)", marginTop: 4, fontWeight: 500 },

  favorietKnop: { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", padding: "11px", background: "var(--surface)", color: "var(--sub)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 13.5, fontWeight: 700, cursor: "pointer", marginTop: 4 },
  onthoudAan: { background: "var(--accent-soft)", color: "var(--accent)", borderColor: "var(--accent)" },
  favorietKnopAan: { background: "#fff8ec", color: "#a3701a", borderColor: "var(--gold)" },

  // Zoeken en lijsten met producten
  zoekWrap: { display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: "11px 13px", marginBottom: 12 },
  zoekInput: { border: "none", outline: "none", flex: 1, fontSize: 15, background: "none", color: "var(--ink)", minWidth: 0 },
  lijstKop: { display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--sub)", margin: "18px 0 8px" },
  resultaat: { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 15px", borderBottom: "1px solid var(--line)", background: "none", border: "none", borderTop: "none", borderLeft: "none", borderRight: "none", textAlign: "left", cursor: "pointer" },
  resultaatTekst: { display: "block", flex: 1, minWidth: 0 },
  resultaatNaam: { display: "block", fontSize: 14.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  resultaatSub: { display: "block", fontSize: 12, color: "var(--sub)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  bronMerk: { display: "inline-block", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--accent)", background: "var(--accent-soft)", borderRadius: 4, padding: "1px 5px", marginRight: 6, verticalAlign: "1px" },
  potloodKnop: { width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "var(--sub)", cursor: "pointer", padding: 0, flexShrink: 0 },

  // Foto-schatting
  fotoLeeg: { display: "flex", alignItems: "center", justifyContent: "center", gap: 9, width: "100%", padding: "26px 20px", border: "1.5px dashed var(--line)", borderRadius: 14, background: "var(--surface)", color: "var(--accent)", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  fotoWrap: { position: "relative", borderRadius: 14, overflow: "hidden", border: "1px solid var(--line)", marginBottom: 12, background: "var(--bg)" },
  fotoVoorbeeld: { width: "100%", maxHeight: 260, objectFit: "cover", display: "block" },
  fotoOpnieuw: { position: "absolute", right: 10, bottom: 10, display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(22,25,39,0.78)", color: "#fff", border: "none", borderRadius: 999, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" },

  // Scanner
  scanKader: { position: "relative", width: "100%", aspectRatio: "4 / 3", background: "#101118", borderRadius: 16, overflow: "hidden", marginBottom: 12 },
  scanVideo: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  scanLijn: { position: "absolute", left: "8%", right: "8%", top: "50%", height: 2, background: "var(--red)", opacity: 0.85, boxShadow: "0 0 12px rgba(221,79,56,0.9)" },
  scanVenster: { position: "absolute", left: "8%", right: "8%", top: "28%", bottom: "28%", border: "2px solid rgba(255,255,255,0.85)", borderRadius: 10 },
  scanStatus: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "9px 12px", background: "rgba(16,17,24,0.72)", color: "#fff", fontSize: 12.5, fontWeight: 600, textAlign: "center" },

  uitslagRij: { display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 13.5 },
  uitslagLabel: { color: "var(--sub)", fontWeight: 600 },
  uitslagWaarde: { fontWeight: 700, textAlign: "right" },
};
