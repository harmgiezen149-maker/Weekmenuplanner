// ---------------------------------------------------------------------------
// Andere manieren om hetzelfde ingredient te schrijven.
//
// Receptpagina's schrijven ingredienten zoals ze in de tekst passen:
// "volkorenmeel (havermeel)", "spinazie, vers", "kipfilet of kalkoenfilet".
// De productlijst kent zulke samenstellingen niet, dus valt het ingredient
// buiten de puntentelling — terwijl er twee prima namen in staan.
//
// Dit levert die losse namen op, zodat het scherm ze als knopje kan aanbieden.
// Er wordt niets geraden en niets vertaald: alles wat hier uitkomt staat
// letterlijk in de naam die je binnenkreeg.
// ---------------------------------------------------------------------------

/** Zoveel knopjes passen er op een telefoon naast elkaar. */
const MAX = 4;

export function naamVarianten(naam: string): string[] {
  const bron = (naam ?? "").trim();
  if (bron === "") return [];

  const uit: string[] = [];
  const voegToe = (kandidaat: string) => {
    const s = kandidaat.replace(/\s+/g, " ").trim().replace(/^[-–,;]+|[-–,;]+$/g, "").trim();
    if (s === "" || s.length < 2) return;
    if (s.toLowerCase() === bron.toLowerCase()) return;
    if (uit.some((b) => b.toLowerCase() === s.toLowerCase())) return;
    uit.push(s);
  };

  // "volkorenmeel (havermeel)" → beide helften apart.
  const zonderHaakjes = bron.replace(/\([^)]*\)/g, " ");
  voegToe(zonderHaakjes);
  for (const inhoud of bron.matchAll(/\(([^)]*)\)/g)) voegToe(inhoud[1]);

  // "spinazie, vers" en "kipfilet of kalkoenfilet" → elk deel apart.
  for (const deel of zonderHaakjes.split(/,|\bof\b|\/|\ben\b/i)) voegToe(deel);

  return uit.slice(0, MAX);
}
