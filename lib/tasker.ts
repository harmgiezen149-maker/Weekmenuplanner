// ---------------------------------------------------------------------------
// Een kant-en-klare Tasker-taak als XML.
//
// Wat er telkens misgaat bij het instellen is niet de logica maar het overtypen:
// een URL van tachtig tekens en een sleutel van tweeëndertig, op een telefoon,
// in een veld zonder plakknop. Dit bestand haalt precies dát weg.
//
// Twee dingen die de opzet bepalen:
//
//   1. Alles wat de app aanlevert staat in losse "Variable Set"-acties, niet
//      verstopt in de HTTP-actie. Het formaat van die actie is eenvoudig en
//      goed gedocumenteerd; dat van HTTP Request is dat minder. Zou Tasker de
//      HTTP-actie anders inlezen dan bedoeld, dan staan de URL en de sleutel er
//      nog steeds goed in en is het een kwestie van twee velden aanwijzen.
//   2. De taak begint in de proefstand. Een eerste run die je logboek volzet
//      met testritjes is vervelender dan een eerste run die niets doet.
//
// Elke actie krijgt een label, want dat label is wat je in Tasker ziet staan.
// De instructie hoort in het scherm zelf, niet in een handleiding ernaast.
// ---------------------------------------------------------------------------

/** Actiecodes van Tasker. */
const VARIABELE_ZETTEN = 547;
const FLASH = 548;
const HTTP_REQUEST = 339;

/** Methode-keuze van HTTP Request: 0=GET, 1=POST, ... */
const POST = 1;

export interface TaskerOpties {
  /** Volledig adres van het endpoint, zonder queryparameters. */
  adres: string;
  sleutel: string;
  /** Naam van de taak zoals hij in Tasker komt te staan. */
  naam?: string;
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
		<Str sr="arg0" ve="3">${esc(naam)}</Str>
		<Str sr="arg1" ve="3">${esc(waarde)}</Str>
		<Int sr="arg2" val="0"/>
		<Int sr="arg3" val="0"/>
		<Int sr="arg4" val="0"/>
		<Int sr="arg5" val="3"/>
		<Int sr="arg6" val="0"/>
	</Action>`;
}

function flash(nummer: number, tekst: string, label: string): string {
  return `	<Action sr="act${nummer}" ve="7">
		<code>${FLASH}</code>
		<label>${esc(label)}</label>
		<Str sr="arg0" ve="3">${esc(tekst)}</Str>
		<Int sr="arg1" val="0"/>
		<Int sr="arg2" val="0"/>
		<Int sr="arg3" val="0"/>
	</Action>`;
}

/**
 * Bouwt de taak.
 *
 * De vier velden bovenaan zijn de enige die jij nog invult: welke variabelen je
 * plug-in oplevert weet alleen jij, en raden zou hier een taak opleveren die
 * stilletjes het verkeerde verstuurt.
 */
export function taskerTaak(opties: TaskerOpties): string {
  const naam = opties.naam ?? "Kookboek beweging";
  const nu = Date.now();

  // De gegevens gaan achter de URL en niet in een body: een variabele die nog
  // leeg is levert dan een leeg veld op in plaats van kapotte JSON.
  const url = `${opties.adres}?proef=%kb_proef&soort=%kb_soort&minuten=%kb_minuten`
    + "&datum=%kb_datum&id=%kb_id";

  const acties = [
    zetVariabele(0, "%kb_proef", "1",
      "PROEFSTAND — 1 = alleen controleren, 0 = echt in je logboek zetten"),

    zetVariabele(1, "%kb_soort", "",
      "VUL IN — de variabele van Health Sync met de sport, bijvoorbeeld %hs_type. "
      + "Engelse namen zoals RUNNING of WALKING worden herkend."),
    zetVariabele(2, "%kb_minuten", "",
      "VUL IN — de duur in minuten. Heb je alleen seconden, gebruik dan &seconden= in de URL."),
    zetVariabele(3, "%kb_datum", "",
      "VUL IN — de datum als 2026-08-26. Laat leeg voor vandaag."),
    zetVariabele(4, "%kb_id", "",
      "VUL IN — een uniek kenmerk van de activiteit. Leeg mag; dan maakt de app er zelf een."),

    flash(5, "soort=%kb_soort duur=%kb_minuten datum=%kb_datum",
      "KIJK — wat zit er werkelijk in je variabelen? Zet deze actie uit zodra het klopt."),

    zetVariabele(6, "%kb_url", url,
      "Niet aanpassen — adres van de app, met je gegevens erachter"),
    zetVariabele(7, "%kb_header", `Authorization: Bearer ${opties.sleutel}`,
      "Niet aanpassen — je persoonlijke sleutel. Deel dit bestand met niemand."),

    `	<Action sr="act8" ve="7">
		<code>${HTTP_REQUEST}</code>
		<label>Versturen — controleer dat Method op POST staat en de Body leeg is</label>
		<Int sr="arg0" val="${POST}"/>
		<Str sr="arg1" ve="3">%kb_url</Str>
		<Str sr="arg2" ve="3">%kb_header</Str>
		<Str sr="arg3" ve="3"/>
		<Str sr="arg4" ve="3"/>
		<Str sr="arg5" ve="3"/>
		<Str sr="arg6" ve="3"/>
		<Int sr="arg7" val="30"/>
		<Int sr="arg8" val="0"/>
		<Int sr="arg9" val="1"/>
		<Int sr="arg10" val="0"/>
	</Action>`,

    flash(9, "%http_data",
      "ANTWOORD — hier staat of het gelukt is, en anders welk veld leeg binnenkwam."),
  ];

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<TaskerData sr="" dvi="1" tv="6.3.13">
	<Task sr="task1">
		<cdate>${nu}</cdate>
		<edate>${nu}</edate>
		<id>1</id>
		<nme>${esc(naam)}</nme>
		<pri>100</pri>
${acties.join("\n")}
	</Task>
</TaskerData>
`;
}
