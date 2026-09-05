// ---------------------------------------------------------------------------
// Wat er binnenkomt als je iets naar de app deelt.
//
// Het deelmenu van Android is slordig: Chrome zet de link soms in `url`, soms
// in `text`, en vaak staat er "Paginatitel https://..." in één veld. Wat
// WhatsApp of een receptapp meestuurt is weer anders. Hier wordt daar één
// bruikbaar paar van gemaakt: een link, en de tekst eromheen.
// ---------------------------------------------------------------------------

export interface Deling {
  /** De gedeelde link, als er een bruikbare in zat. */
  url: string | null;
  /** Wat er verder aan tekst bij zat, zonder de link erin. */
  tekst: string;
}

/** Alleen deze twee protocollen; een `javascript:`-link is geen receptpagina. */
const LINK = /https?:\/\/[^\s<>"')]+/i;

export function leesDeling(velden: {
  url?: string | null;
  text?: string | null;
  title?: string | null;
}): Deling {
  const url = (velden.url ?? "").trim();
  const text = (velden.text ?? "").trim();
  const title = (velden.title ?? "").trim();

  // `url` eerst: staat die er, dan is het bijna altijd precies de link.
  const gevonden = eersteLink(url) ?? eersteLink(text) ?? eersteLink(title);

  // De tekst is wat er overblijft als de link eruit is. De titel telt mee als
  // de tekst niets toevoegt — bij een gedeelde receptpagina is dat vaak de
  // naam van het gerecht.
  const zonderLink = gevonden ? text.replace(gevonden, " ") : text;
  const tekst = schoon(zonderLink) || schoon(title);

  return { url: gevonden, tekst };
}

function eersteLink(s: string): string | null {
  const treffer = s.match(LINK);
  if (!treffer) return null;
  // Een punt of komma direct achter een link hoort bij de zin, niet bij de url.
  return treffer[0].replace(/[.,;]+$/, "");
}

function schoon(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 200);
}
