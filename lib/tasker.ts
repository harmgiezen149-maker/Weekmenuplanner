// ---------------------------------------------------------------------------
// Een kant-en-klaar Tasker-project als XML.
//
// Wat er telkens misgaat bij het instellen is niet de logica maar het overtypen:
// een URL van tachtig tekens en een sleutel van tweeëndertig, op een telefoon,
// in een veld zonder plakknop. Dit bestand haalt precies dát weg.
//
// Drie dingen die de opzet bepalen, alle drie geleerd van een import die faalde:
//
//   1. Het moet een PROJECT zijn, niet een losse taak. Tasker weigert een
//      bestand met alleen een <Task> erin: "no Project found".
//   2. De URL staat voluit in de HTTP-actie, niet in een tussenvariabele.
//      Tasker vult variabelen één laag diep in: zou %kb_url zélf weer
//      %kb_soort bevatten, dan wordt de letterlijke tekst "%kb_soort"
//      verstuurd.
//   3. De in te vullen waarden staan in losse "Variable Set"-acties bovenaan,
//      met een label dat zegt wat erin hoort. Dat label is wat je in Tasker
//      ziet staan; de instructie hoort in het scherm zelf, niet in een
//      handleiding ernaast.
//
// En de taak begint in de proefstand: een eerste run die je logboek volzet met
// testritjes is vervelender dan een eerste run die niets doet.
// ---------------------------------------------------------------------------

/** Actiecodes van Tasker. */
const VARIABELE_ZETTEN = 547;
const FLASH = 548;
const HTTP_REQUEST = 339;

/** Methode-keuze van HTTP Request: 0=GET, 1=POST, ... */
const POST = 1;

const TAAK_TEKST = 10;
const TAAK_JSON = 11;
const TAAK_VELDEN = 12;

export interface TaskerOpties {
  /** Volledig adres van het endpoint, zonder queryparameters. */
  adres: string;
  sleutel: string;
  /** Naam van het project zoals het in Tasker komt te staan. */
  project?: string;
  /** Naam van de taak. */
  naam?: string;
}

/**
 * Een tekstargument. Leeg schrijft Tasker zelf als een lege tag, en hoe dichter
 * dit bestand bij zijn eigen exports blijft, hoe kleiner de kans dat de import
 * ergens over struikelt.
 */
function str(nummer: number, waarde: string): string {
  return waarde
    ? `		<Str sr="arg${nummer}" ve="3">${esc(waarde)}</Str>`
    : `		<Str sr="arg${nummer}" ve="3"/>`;
}

function esc(tekst: string): string {
  return String(tekst)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function zetVariabele(nummer: number, naam: string, waarde: string, label: string): string {
  return `	<Action sr="act${nummer}" ve="7">
		<code>${VARIABELE_ZETTEN}</code>
		<label>${esc(label)}</label>
${str(0, naam)}
${str(1, waarde)}
		<Int sr="arg2" val="0"/>
		<Int sr="arg3" val="0"/>
		<Int sr="arg4" val="0"/>
		<Int sr="arg5" val="3"/>
		<Int sr="arg6" val="0"/>
	</Action>`;
}

function httpRequest(
  nummer: number, url: string, headers: string, body: string, label: string
): string {
  return `	<Action sr="act${nummer}" ve="7">
		<code>${HTTP_REQUEST}</code>
		<label>${esc(label)}</label>
		<Int sr="arg0" val="${POST}"/>
${str(1, url)}
${str(2, headers)}
${str(3, "")}
${str(4, body)}
${str(5, "")}
${str(6, "")}
		<Int sr="arg7" val="30"/>
		<Int sr="arg8" val="0"/>
		<Int sr="arg9" val="1"/>
		<Int sr="arg10" val="0"/>
	</Action>`;
}

function taak(id: number, naam: string, acties: string[], nu: number): string {
  return `	<Task sr="task${id}">
		<cdate>${nu}</cdate>
		<edate>${nu}</edate>
		<id>${id}</id>
		<nme>${esc(naam)}</nme>
		<pri>100</pri>
${acties.join("\n")}
	</Task>`;
}

function flash(nummer: number, tekst: string, label: string): string {
  return `	<Action sr="act${nummer}" ve="7">
		<code>${FLASH}</code>
		<label>${esc(label)}</label>
${str(0, tekst)}
		<Int sr="arg1" val="0"/>
		<Int sr="arg2" val="0"/>
		<Int sr="arg3" val="0"/>
	</Action>`;
}

/**
 * Bouwt het project.
 *
 * Drie taken, van "heeft het minste nodig" naar "heeft het meeste nodig":
 *
 *   TEKST    — stuurt gewoon een stuk tekst door; de app leest er zelf een
 *              sport en een duur uit. Werkt zonder enige plug-in, bijvoorbeeld
 *              met een notificatieprofiel op Garmin Connect.
 *   JSON     — een plug-in voor Health Connect geeft één blok JSON terug met
 *              alle sessies erin. Dat stuur je in zijn geheel door.
 *   VELDEN   — heb je wél losse variabelen per activiteit, dan is dit de weg.
 *
 * De waarden blijven leeg. Welke variabelen jouw plug-in oplevert weet alleen
 * jij, en er staat met opzet ook geen voorbeeldnaam als `%hc_type`: die ziet
 * eruit als een echte variabele, wordt letterlijk overgenomen, en levert dan
 * een fout op die naar de verkeerde kant wijst.
 */
export function taskerProject(opties: TaskerOpties): string {
  const projectNaam = opties.project ?? "Kookboek";
  const nu = Date.now();
  const header = `Authorization: Bearer ${opties.sleutel}`;

  // -- taak 1: gewone tekst, zonder enige plug-in ---------------------------
  // Dit is de weg die het minste nodig heeft: wat er ook aan tekst binnenkomt,
  // de app probeert er een sport en een duur uit te lezen. Koppel hem aan een
  // profiel Event → UI → Notificatie met Garmin Connect als app, en stuur
  // %evtprm2 (de tekst van de melding) door.
  const tekstActies = [
    zetVariabele(0, "%kb_proef", "1",
      "PROEFSTAND — 1 = alleen controleren, 0 = echt in je logboek zetten"),
    zetVariabele(1, "%kb_tekst", "%evtprm2",
      "VUL IN — de tekst met de training erin. Bij een notificatieprofiel is dat "
      + "%evtprm2; anders de variabele die jouw trigger vult."),
    flash(2, "[%kb_tekst]",
      "KIJK — staat er tussen de haken een sport en een duur? Dan kan de app hem lezen."),
    httpRequest(3, `${opties.adres}?proef=%kb_proef`,
      `${header}\nContent-Type: text/plain`, "%kb_tekst",
      "Versturen — Method POST, de tekst gaat mee als Body."),
    flash(4, "%http_data",
      "ANTWOORD — wat er geboekt is, of waarom er niets uit de tekst te halen viel."),
  ];

  // -- taak 2: het hele blok JSON doorsturen --------------------------------
  const jsonActies = [
    zetVariabele(0, "%kb_proef", "1",
      "PROEFSTAND — 1 = alleen controleren, 0 = echt in je logboek zetten"),
    zetVariabele(1, "%kb_json", "",
      "VUL IN — hier hoort de variabele met de JSON van je Health Connect-plug-in. "
      + "Het hele blok; uit elkaar halen hoeft niet."),
    flash(2, "[%kb_json]",
      "KIJK — staat er tussen de haken JSON? Zo niet, dan klopt de variabelenaam hierboven niet."),
    httpRequest(3, `${opties.adres}?proef=%kb_proef`,
      `${header}\nContent-Type: application/json`, "%kb_json",
      "Versturen — Method POST, de JSON gaat mee als Body."),
    flash(4, "%http_data",
      "ANTWOORD — wat er geboekt is, en per sessie waarom er iets niet lukte."),
  ];

  // -- taak 2: losse velden -------------------------------------------------
  const url = `${opties.adres}?proef=%kb_proef&soort=%kb_soort&minuten=%kb_minuten`
    + "&datum=%kb_datum&id=%kb_id";
  const veldActies = [
    zetVariabele(0, "%kb_proef", "1",
      "PROEFSTAND — 1 = alleen controleren, 0 = echt in je logboek zetten"),
    zetVariabele(1, "%kb_soort", "",
      "VUL IN — de variabele met de sport. Engelse namen als RUNNING of WALKING "
      + "worden herkend."),
    zetVariabele(2, "%kb_minuten", "",
      "VUL IN — de duur in minuten. Alleen seconden? Vervang minuten= door seconden= "
      + "in de HTTP-actie."),
    zetVariabele(3, "%kb_datum", "",
      "VUL IN — de datum als 2026-08-26. Laat leeg voor vandaag."),
    zetVariabele(4, "%kb_id", "",
      "VUL IN — een uniek kenmerk van de activiteit. Leeg mag; dan maakt de app er zelf een."),
    flash(5, "soort=[%kb_soort] duur=[%kb_minuten] datum=[%kb_datum]",
      "KIJK — staat er tussen de haken iets? Zo niet, dan klopt de variabelenaam hierboven niet."),
    httpRequest(6, url, header, "",
      "Versturen — Method POST, Body leeg. Adres en sleutel staan er al in."),
    flash(7, "%http_data",
      "ANTWOORD — hier staat of het gelukt is, en anders welk veld leeg binnenkwam."),
  ];

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<TaskerData sr="" dvi="1" tv="6.3.13">
	<Project sr="proj1" ve="2">
		<cdate>${nu}</cdate>
		<name>${esc(projectNaam)}</name>
		<tids>${TAAK_TEKST},${TAAK_JSON},${TAAK_VELDEN}</tids>
	</Project>
${taak(TAAK_TEKST, "1 Beweging via tekst (geen plug-in nodig)", tekstActies, nu)}
${taak(TAAK_JSON, "2 Beweging via JSON van een plug-in", jsonActies, nu)}
${taak(TAAK_VELDEN, "3 Beweging via losse velden", veldActies, nu)}
</TaskerData>
`;
}
