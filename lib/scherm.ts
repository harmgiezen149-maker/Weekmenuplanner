// ---------------------------------------------------------------------------
// Welk scherm je open hebt, voor de chatbot.
//
// Beide helften van de app zijn eenpagina-schermen: het pad in de adresbalk
// zegt wel dat je in het kookboek zit, maar niet dat je naar de pastasalade
// kijkt. Een scherm dat iets toont wat de moeite waard is om te weten zet het
// hier neer; de chatknop leest het uit als je een vraag stelt.
//
// Bewust een simpele variabele en geen context: dit is één regel tekst, het
// hoeft niets opnieuw te tekenen, en een provider om de hele app heen zou meer
// kosten dan het oplevert.
// ---------------------------------------------------------------------------

let huidig = "";

/** Wat je nu bekijkt, in gewone taal: "het recept Pastasalade met feta". */
export function zetScherm(omschrijving: string): void {
  huidig = omschrijving.slice(0, 120);
}

/** Wist de omschrijving, maar alleen als hij nog van dit scherm is. */
export function wisScherm(omschrijving: string): void {
  if (huidig === omschrijving.slice(0, 120)) huidig = "";
}

export function leesScherm(): string {
  return huidig;
}
