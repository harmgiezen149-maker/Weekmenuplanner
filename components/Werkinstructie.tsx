"use client";

import React, { useState } from "react";
import { ChevronDown, X } from "lucide-react";

// ---------------------------------------------------------------------------
// De werkinstructie: één beschrijving van de hele app, bereikbaar via het
// info-knopje in de header van zowel het kookboek als de tracker.
//
// Beide helften delen deze component, zodat er maar één plek is waar de tekst
// staat. Twee losse teksten lopen na een paar wijzigingen gegarandeerd uiteen,
// en dan klopt er ergens iets niet meer.
//
// De hoofdstukken zijn inklapbaar. Op een telefoonscherm is een lap tekst van
// vijftien hoofdstukken onleesbaar; "Je eerste week" staat open omdat dat het
// hoofdstuk is dat iemand nodig heeft die de app net krijgt.
// ---------------------------------------------------------------------------

const S: Record<string, React.CSSProperties> = {
  bg: {
    position: "fixed", inset: 0, background: "rgba(22,25,39,0.45)", zIndex: 50,
    display: "flex", alignItems: "flex-end", justifyContent: "center",
  },
  modal: {
    background: "var(--bg)", width: "100%", maxWidth: 480, maxHeight: "88vh",
    overflowY: "auto", borderRadius: "24px 24px 0 0", padding: "20px 20px 32px",
    boxShadow: "0 -12px 40px rgba(16,17,24,0.18)",
  },
  kop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  label: {
    display: "block", fontSize: 12, fontWeight: 700, color: "var(--sub)",
    marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.03em",
  },
  titel: { fontSize: 21, fontWeight: 800, margin: 0, lineHeight: 1.2 },
  sluit: { background: "none", border: "none", color: "var(--sub)", cursor: "pointer", padding: 4 },

  intro: { fontSize: 14, lineHeight: 1.65, color: "#3a3f52", margin: "4px 0 20px" },

  deel: {
    fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em",
    color: "var(--sub)", margin: "22px 0 8px",
  },

  hoofdstuk: { borderTop: "1px solid var(--line)" },
  knop: {
    display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
    background: "none", border: "none", padding: "13px 0", cursor: "pointer",
    color: "var(--ink)", fontSize: 14.5, fontWeight: 700, letterSpacing: "-0.01em",
  },
  pijl: { marginLeft: "auto", color: "var(--sub)", flexShrink: 0, transition: "transform 0.18s ease" },
  pijlOpen: { transform: "rotate(180deg)" },
  inhoud: { fontSize: 13.5, lineHeight: 1.65, color: "#3a3f52", padding: "0 0 16px" },

  lijst: { margin: "8px 0", paddingLeft: 18 },
  stap: { margin: "0 0 8px" },
  sub: {
    fontSize: 12.5, fontWeight: 800, color: "var(--accent)", textTransform: "uppercase",
    letterSpacing: "0.04em", margin: "14px 0 4px",
  },
  formule: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12,
    lineHeight: 1.8, background: "var(--surface)", border: "1px solid var(--line)",
    borderRadius: 10, padding: "12px 14px", margin: "10px 0", overflowX: "auto",
  },
  kader: {
    background: "var(--accent-soft)", borderRadius: 12, padding: "12px 14px",
    margin: "12px 0", fontSize: 13, lineHeight: 1.6, color: "#3a3f52",
  },
  route: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12,
    background: "var(--surface)", border: "1px solid var(--line)",
    borderRadius: 5, padding: "1px 5px",
  },
};

function Hoofdstuk({
  titel, open, onToggle, children,
}: {
  titel: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section style={S.hoofdstuk}>
      <button style={S.knop} onClick={onToggle} aria-expanded={open}>
        {titel}
        <ChevronDown size={17} style={{ ...S.pijl, ...(open ? S.pijlOpen : {}) }} />
      </button>
      {open && <div style={S.inhoud}>{children}</div>}
    </section>
  );
}

export default function Werkinstructie({ onClose }: { onClose: () => void }) {
  // Alleen "Je eerste week" staat open: dat is wat iemand nodig heeft die de
  // app net krijgt, en de rest is naslag.
  const [open, setOpen] = useState<string | null>("eerste-week");
  const wissel = (id: string) => setOpen((h) => (h === id ? null : id));

  const H = ({ id, titel, children }: { id: string; titel: string; children: React.ReactNode }) => (
    <Hoofdstuk titel={titel} open={open === id} onToggle={() => wissel(id)}>{children}</Hoofdstuk>
  );

  return (
    <div style={S.bg} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.kop}>
          <div>
            <span style={S.label}>Werkinstructie</span>
            <h2 style={S.titel}>Kookboek</h2>
          </div>
          <button onClick={onClose} style={S.sluit} aria-label="Sluiten"><X size={20} /></button>
        </div>

        <p style={S.intro}>
          Kookboek is drie dingen in één: een receptendatabase, een weekplanner met boodschappenlijst,
          en een voedings- en gewichtstracker die je recepten kan doorrekenen. Alles staat centraal in
          de cloud — iedereen die de app gebruikt kijkt naar dezelfde recepten, hetzelfde weekmenu en
          dezelfde lijst.
        </p>

        <H id="eerste-week" titel="Je eerste week">
          <p style={{ margin: "0 0 10px" }}>
            De eerste week voelt traag, omdat je alles voor het eerst invoert. Vanaf week twee is het
            meeste één tik. Deze volgorde werkt het prettigst:
          </p>

          <div style={S.sub}>Dag 1 — zet de basis neer</div>
          <ol style={S.lijst}>
            <li style={S.stap}>
              Vul je <strong>trackerprofiel</strong> in bij Instellingen: geslacht, geboortedatum,
              lengte, gewicht, streefgewicht, activiteitsniveau en je weegdag. Zonder profiel is er
              geen dagbudget en staan er geen puntenbadges bij je recepten.
            </li>
            <li style={S.stap}>
              Stel bij <strong>Winkels</strong> de looproute in van de winkel waar je het vaakst komt.
              Eén keer instellen, en elke boodschappenlijst loopt daarna in de goede volgorde.
            </li>
            <li style={S.stap}>
              Zet <strong>vijf tot tien recepten</strong> in je kookboek. Begin met de gerechten die
              je toch al maakt; via een link of een foto gaat dat het snelst.
            </li>
          </ol>

          <div style={S.sub}>Dag 1 tot 3 — begin met loggen</div>
          <ol style={S.lijst} start={4}>
            <li style={S.stap}>
              Log een paar dagen <strong>alles</strong> wat je eet, ook als het niet mooi is. Een
              onvolledig logboek maakt elke latere analyse onbetrouwbaar; dat is de enige echte
              valkuil.
            </li>
            <li style={S.stap}>
              Bewaar wat je vaak eet als <strong>favoriet</strong>, en maak van je vaste ontbijt één
              <strong> vaste maaltijd</strong>. Dat scheelt je de rest van het jaar tijd.
            </li>
          </ol>

          <div style={S.sub}>Dag 3 — plan je eerste week</div>
          <ol style={S.lijst} start={6}>
            <li style={S.stap}>
              Vul het <strong>weekmenu</strong> en stel per dag het aantal personen in. Ontbreekt er
              een winkel of afdeling, dan vult een korte wizard dat met je aan.
            </li>
            <li style={S.stap}>
              Druk op <strong>Weekmenu verversen</strong> voor de boodschappenlijst, vul aan uit
              Voorraad, en loop de winkel.
            </li>
          </ol>

          <div style={S.sub}>Op je weegdag — sluit de cirkel</div>
          <ol style={S.lijst} start={8}>
            <li style={S.stap}>
              <strong>Weeg één keer.</strong> De trendlijn heeft een paar wegingen nodig voor hij iets
              zegt; schrik dus niet van de eerste getallen.
            </li>
            <li style={S.stap}>
              Maak het weekmenu leeg en geef elk gerecht een <strong>score</strong>. Dat is precies
              wat je receptenlijst over een half jaar bruikbaar houdt.
            </li>
          </ol>

          <div style={S.kader}>
            <strong>Na twee weken gaat Inzicht open.</strong> Vanaf veertien dagen historie en acht
            gelogde dagen in de laatste twee weken krijg je je eerste advies. Tot die tijd zie je de
            cijfers wél, met de melding hoeveel er nog nodig is.
          </div>
        </H>

        <div style={S.deel}>Kookboek</div>

        <H id="recepten" titel="Recepten">
          <p style={{ margin: "0 0 8px" }}>
            Alle recepten als kaarten met foto, elk met keuken, hoofdingrediënt, maaltijdtype,
            moeilijkheid, bereidingstijd, jouw score van 1 tot 5 sterren, en hoe vaak je het al
            gegeten hebt.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            Het zoekveld staat altijd klaar; zoeken kan op titel <em>of op ingrediënt</em> —
            "courgette" levert elk recept op waar courgette in zit. Alle filters zitten achter de
            knop <strong>Filters en sorteren</strong>, die dicht staat tot je hem opent: filter op
            elk kenmerk of op een minimale score, schuif met de <strong>bereidingstijd</strong> en
            met de <strong>punten per portie</strong> (van–tot), en sorteer op naam, score of vaakst
            gegeten. Staat de knop dicht terwijl er iets aanstaat, dan zie je het aantal in een
            bolletje op de knop.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            De puntenschuif is er alleen als je een trackerprofiel hebt — anders heeft geen enkel
            recept een puntenaantal. Helemaal rechts betekent géén maximum. Recepten waarvan de
            punten nog niet bekend zijn vallen buiten dit filter; er staat bij hoeveel dat er zijn.
          </p>
          <p style={{ margin: 0 }}>
            Tik een kaart aan voor het hele recept. Daar pas je de score aan, hoog je de
            gegeten-teller op, bewerk je met het potlood, of zet je het meteen in het weekmenu of op
            de lijst. Tik op de foto om schermvullend in te zoomen.
          </p>
        </H>

        <H id="toevoegen" titel="Toevoegen">
          <p style={{ margin: "0 0 8px" }}>
            <strong>Link</strong> — zoek een gerecht op naam (de app zoekt receptsites af en toont
            keuzeopties) of plak zelf een link. Het recept wordt uitgelezen, foto en al.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong>Foto</strong> — fotografeer een recept uit een tijdschrift of kookboek. Staat het
            over meerdere pagina's, voeg dan eerst álle pagina's toe en laat het daarna pas uitlezen.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong>Bord</strong> — fotografeer een opgediend bord; de app maakt er een
            receptvoorstel van. Zie het kopje hieronder.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong>Handmatig</strong> — alles zelf invoeren, inclusief winkel en afdeling per
            ingrediënt.
          </p>
          <div style={S.kader}>
            Na elke import volgt een controlescherm; een import is een startpunt, geen eindresultaat.
            Bevat het recept standaard kruiden zoals zout en peper, dan vraagt de app of je die wilt
            meenemen. Meestal weglaten — die staan al in je kast.
          </div>
          <p style={{ margin: "8px 0 0" }}>
            Zodra een recept is opgeslagen worden de ingrediënten die de app nog niet kent meteen
            geschat, op de achtergrond. Bovenin staat zolang een balkje; daarna klopt het
            puntengetal op het kaartje.
          </p>
        </H>

        <H id="weekmenu" titel="Weekmenu">
          <p style={{ margin: "0 0 8px" }}>
            Plan per dag het avondeten, en voeg met het plusje onder een dag optioneel een ontbijt,
            lunch of toetje toe. De week begint op de dag die jij kiest — verzet dat met de pijltjes
            bovenaan.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            Stel per maaltijd het aantal personen in; alle ingrediënten schalen automatisch mee, ook
            op de boodschappenlijst. Bij het plaatsen controleert de app of elk ingrediënt een winkel
            en afdeling heeft; ontbreekt er iets, dan vult een korte wizard dat aan.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong>Kookweergave</strong> — tik op een gepland gerecht en je krijgt de ingrediënten
            geschaald naar die dag, afvinkbaar, met de bereiding in een groter lettertype. Bedoeld om
            naast je op het aanrecht te leggen.
          </p>
          <p style={{ margin: 0 }}>
            Bij <strong>Leegmaken</strong> volgt eerst een korte evaluatie: per gerecht een score, en
            de gegeten-teller gaat omhoog. Daarna is de week klaar voor een nieuwe planning.
          </p>
        </H>

        <H id="bordfoto" titel="Een recept maken van een foto van je bord">
          <p style={{ margin: "0 0 8px" }}>
            Op <strong>Toevoegen</strong> staat naast Foto ook <strong>Bord</strong>. Foto is voor
            een recept uit een tijdschrift of kookboek; Bord is voor wat er op tafel staat. De app
            maakt er een receptvoorstel van: de naam van het gerecht, de ingrediënten die te zien
            zijn en een korte werkwijze.
          </p>
          <p style={{ margin: 0 }}>
            Hoeveelheden en bereidingstijd zijn een aanname — aan een bord is niet te zien hoeveel
            er in de pan ging. Ze staan voor twee personen klaar en je past ze aan in het
            bevestigingsscherm, net als bij elke andere import. De foto wordt de receptafbeelding.
          </p>
        </H>

        <H id="fotoscan-kookboek" titel="Een gefotografeerd bord ook bewaren als recept">
          <p style={{ margin: "0 0 8px" }}>
            Scan je in de tracker een foto van je bord, dan staat onder de schatting de vraag of
            het gerecht ook <strong>in het kookboek</strong> moet. Vink je die aan, dan vraagt de
            app om een naam en om waar het gerecht om draait, en worden de herkende onderdelen de
            ingrediënten van een nieuw recept — met dezelfde foto erbij.
          </p>
          <p style={{ margin: 0 }}>
            Het recept staat voor één persoon, want je fotografeerde één bord. Kook je vaker voor
            meer mensen, pas het aantal dan aan in het kookboek; de hoeveelheden schalen mee op de
            boodschappenlijst.
          </p>
        </H>

        <H id="briefje" titel="Het weekmenu van een briefje overnemen">
          <p style={{ margin: "0 0 8px" }}>
            Schrijf je de week liever eerst met de hand op? Op het weekmenu staat
            <strong> Van een briefje</strong>. Fotografeer je lijstje met alle dagen in beeld; de app
            leest per dag wat je opgeschreven hebt en zoekt er het recept bij.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            Wat hij zeker weet vult hij in — daar staat een knop bij om er alsnog iets anders van te
            maken. Twijfelt hij, dan vraagt hij het: "Bedoel je dit?", met de gerechten die er vlak
            achter zitten ernaast. Dat gebeurt vooral als je een rijtje ingrediënten hebt
            opgeschreven in plaats van een naam.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            Staat een gerecht nog niet in je kookboek, dan kun je het uit de lijst kiezen of het
            meteen aanmaken — dat brengt je naar het gewone invoerscherm met de naam al ingevuld.
            Sla je het op, dan kom je terug bij je briefje en is die dag ingevuld. Dagen die je nog
            open had staan mag je zo laten of door de app laten voorstellen.
          </p>
          <p style={{ margin: 0 }}>
            Ook hier verandert er niets tot je onderaan bevestigt, en dan alleen de dagen met een
            gerecht. De rest van je weekmenu blijft staan.
          </p>
        </H>

        <H id="voorstel" titel="Een week laten voorstellen">
          <p style={{ margin: "0 0 8px" }}>
            Op het weekmenu staat "Stel een week voor". De app zet zeven avonden voor je klaar uit
            je eigen recepten, met per dag waarom: hoe lang het duurt, wat je ervan vond, en dat er
            niet twee avonden achter elkaar hetzelfde op tafel komt. Doordeweeks kiest hij snelle
            gerechten, in het weekend mag het langer duren.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            Bovenaan staat wat de week gemiddeld aan punten kost en, als je kassabonnen hebt
            gescand, wat de ingrediënten ongeveer kosten. Staat er een duidelijk goedkoper gerecht
            met hetzelfde hoofdingrediënt, dan noemt hij dat erbij.
          </p>
          <p style={{ margin: 0 }}>
            Er verandert niets tot je op overnemen drukt. Bevalt het voorstel niet, dan geeft "stel
            iets anders voor" een andere week met dezelfde regels. Daarna pas je nog steeds per dag
            aan wat je wilt — het is een startpunt, geen voorschrift.
          </p>
        </H>

        <H id="weken" titel="Meerdere weken plannen">
          <p style={{ margin: "0 0 8px" }}>
            Boven het weekmenu staan pijltjes. Daarmee blader je naar volgende week — of terug naar
            vorige week om te zien wat je toen at. Elke week heeft zijn eigen planning; wat je in de
            ene week zet raakt de andere niet.
          </p>
          <p style={{ margin: 0 }}>
            De boodschappenlijst hoort bij de week die je aan het bekijken bent. Wil je de lijst voor
            volgende week, blader dan eerst naar volgende week en genereer hem daarna.
          </p>
        </H>

        <H id="lijst" titel="Lijst">
          <p style={{ margin: "0 0 8px" }}>
            <strong>Weekmenu verversen</strong> genereert de lijst uit je planning: hoeveelheden
            worden opgeteld en stuks-artikelen naar boven afgerond — 2,5 courgette wordt 3. Wat je
            zelf hebt toegevoegd blijft bij het verversen gewoon staan.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            De lijst is gegroepeerd per winkel en daarbinnen per afdeling, in de looproute die je bij
            Winkels hebt ingesteld. Items zijn sleepbaar, ook tussen winkels.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong>Lijst opschonen</strong> voegt dubbele artikelen samen en zet receptmaten om naar
            volle verpakkingen — drie theelepels paprikapoeder wordt één potje. Twijfelgevallen worden
            altijd eerst aan jou voorgelegd.
          </p>
          <p style={{ margin: 0 }}>
            De lijst synchroniseert vrijwel live: vinkt de een iets af, dan ziet de ander dat binnen
            enkele seconden. Handig als je de winkel opsplitst.
          </p>
        </H>

        <H id="voorraad" titel="Voorraad">
          <p style={{ margin: 0 }}>
            Voor terugkerende artikelen die niet uit een recept komen — wasmiddel, aluminiumfolie,
            koffie. Sla ze één keer op met winkel en afdeling. De lijst is gesorteerd per afdeling;
            stel het aantal in, vink aan, en het gaat in één keer naar de boodschappenlijst, op de
            goede plek in je looproute.
          </p>
        </H>

        <H id="winkels" titel="Winkels">
          <p style={{ margin: 0 }}>
            Stel per winkel de volgorde van de afdelingen in, zodat de boodschappenlijst jouw
            looproute volgt in plaats van een alfabet. Verplaats afdelingen omhoog of omlaag, of
            herstel de standaardvolgorde. De app kent Lidl, Jumbo, AH en Anders, met veertien
            afdelingen van Groente &amp; fruit tot Non-food.
          </p>
        </H>

        <div style={S.deel}>Tracker</div>

        <H id="punten" titel="Hoe de punten werken">
          <p style={{ margin: "0 0 4px" }}>
            Elk product krijgt punten uit zijn voedingswaarden. Calorieën, verzadigd vet en suiker
            maken iets duurder; eiwit en vezels maken het goedkoper.
          </p>
          <div style={S.formule}>
            punten = 0,024 × kcal<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ 0,20&nbsp; × verzadigd vet (g)<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ 0,10&nbsp; × effectieve suiker (g)<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;− 0,075 × eiwit (g)<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;− 0,05&nbsp; × vezels (g)
          </div>
          <p style={{ margin: "0 0 8px" }}>
            Het resultaat wordt afgekapt op nul. Groente en magere eiwitbronnen komen daardoor vanzelf
            op nul uit — geen aparte lijst met gratis producten nodig, en elk getal is zelf na te
            rekenen.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong>Effectieve suiker</strong> — etiketten geven alleen totale suikers, dus inclusief
            lactose en fruitsuiker. Kies je bij een product de juiste soort (zuivel, fruit, groente,
            peulvruchten, noten), dan wordt de van nature aanwezige suiker afgetrokken. Anders wordt
            magere kwark onterecht duur.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Puntenschaal</strong> — de enige knop om het niveau te verschuiven. Op 1,0 kom je
            rond de 40 à 50 punten per dag uit, op 0,75 rond de 30. De schaal werkt met terugwerkende
            kracht op je hele logboek.
          </p>
        </H>

        <H id="delen" titel="Delen en afdrukken">
          <p style={{ margin: 0 }}>
            In een geopend recept staan bovenaan twee knoppen erbij: delen en afdrukken. Delen zet
            het recept als gewone tekst in je deelmenu of op je klembord — geen link, want die is
            voor de ander alleen maar een loginscherm. Afdrukken geeft een schone pagina met alleen
            het recept erop, zonder knoppen en zonder menubalk.
          </p>
        </H>

        <H id="droog" titel="Droog of gekookt">
          <p style={{ margin: "0 0 8px" }}>
            In een recept schrijf je de zak: <em>300 g rijst</em> is wat je afweegt voor je gaat
            koken. In je dagboek log je het bord: <em>180 g rijst</em> is wat je opschept. Rijst
            wordt bij het koken bijna drie keer zo zwaar, dus dat verschil is groot.
          </p>
          <p style={{ margin: 0 }}>
            De app houdt die twee uit elkaar: in een recept rekent hij droog, in je dagboek kies je
            zelf tussen "droog" en "gekookt". Merk je dat een recept opeens meer punten telt dan
            eerst — dat klopt: eerder werd rijst en pasta te licht gerekend.
          </p>
        </H>

        <H id="onvolledig" titel="Recepten die nog niet kloppen">
          <p style={{ margin: "0 0 8px" }}>
            Boven de receptenlijst verschijnt een oranje balkje zodra er recepten zijn waarbij een
            ingrediënt buiten de puntentelling valt. Klap het open en je ziet per recept wélk
            ingrediënt het is.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            Zo'n recept telt te laag — en dat zie je aan het getal niet, want een licht recept ziet
            er hetzelfde uit. Vul het ingrediënt aan (potlood → Aanvullen) of zet er een maat bij
            die de app kent, en het klopt weer.
          </p>
          <p style={{ margin: 0 }}>
            Staat er een hele rij, gebruik dan <strong>Alle ontbrekende ingrediënten schatten</strong>
            in datzelfde balkje. Dat loopt je hele kookboek door. Wat het model niet kent blijft
            onbekend en wordt bij naam gemeld — daar wordt niet naar geraden. Geschatte waarden zijn
            door niemand nagekeken; ze blijven per recept aan te passen.
          </p>
        </H>

        <H id="budget" titel="Je profiel en je dagbudget">
          <p style={{ margin: "0 0 8px" }}>
            Je dagbudget wordt berekend uit je basaal metabolisme (Mifflin-St Jeor), maal je
            activiteitsfactor, min een tekort van een half procent lichaamsgewicht per week met een
            plafond van 0,75 kg. Doordat dat aan je huidige gewicht hangt, zakt het tempo vanzelf mee
            naarmate je lichter wordt.
          </p>
          <div style={S.kader}>
            <strong>Twee harde grenzen.</strong> Het tekort wordt nooit groter dan een half procent
            lichaamsgewicht per week, en je doelinname zakt nooit onder je basaal metabolisme — ook
            niet bij een streefgewicht ver onder je huidige. Zit je op of onder je streefgewicht, dan
            valt het tekort weg en staat je budget op onderhoud.
          </div>
        </H>

        <H id="loggen" titel="Zes manieren om te loggen">
          <p style={{ margin: "0 0 8px" }}>
            <strong>Snel</strong> — je vaste maaltijden, favorieten en de laatste 50 dingen die je
            logde. Eén tik logt het opnieuw; het potlood opent hetzelfde product met een andere
            hoeveelheid. In de praktijk de route die je het vaakst gebruikt.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong>Zoeken</strong> — eerst een eigen basislijst met onbewerkte Nederlandse producten,
            daarna Open Food Facts, gefilterd op Nederland. Met de punten per 100 g én per portie.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong>Scannen</strong> — de streepjescode met je camera. Kent de database de code niet,
            dan opent het handmatige formulier met de code al ingevuld; wat je invult wordt daarbij
            bewaard, zodat de volgende scan van datzelfde pak hem meteen vindt.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong>Recept</strong> — een gerecht uit je eigen kookboek, doorgerekend naar punten per
            portie.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong>Foto</strong> — een foto van je bord laten schatten. Het antwoord is nadrukkelijk
            een concept: je kunt het bewerken en het wordt pas opgeslagen als jij het hebt nagekeken.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong>Handmatig</strong> — de zeven waarden van het etiket, met punten die meerekenen
            terwijl je typt.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong>Aantal of gewicht</strong> — op het scherm waar je de hoeveelheid kiest staan twee
            standen. Bij <em>Aantal</em> typ je hoeveel stuks, met een min- en een plusknop, en staat
            ernaast wat één stuk weegt; bij <em>Hoeveelheid</em> vul je grammen in. Kent de app een
            portie die je kunt tellen ("1 snee", "1 ei"), dan begint hij op aantal. In het logboek
            staat dan <em>3 × snee</em> in plaats van 105 g.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong>Achteraf bijstellen</strong> — het potlood bij een regel op het dagoverzicht klapt
            een teller uit. Bij een regel in grammen telt hij hoe vaak die hoeveelheid meetelt (twee
            keer 55 g ei); bij stuks en porties stel je het aantal zelf bij. De punten en de
            onderdelen schalen mee.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong>Andersom: van een eetmoment een maaltijd maken</strong> — onder elk eetmoment op
            het dagoverzicht staat <em>Maaltijd of recept</em>. Wat je at wordt dan een vaste maaltijd
            bij Snel, een recept in je kookboek, of allebei. Een regel die zelf uit onderdelen bestaat
            wordt daarbij uitgeklapt, zodat de punten precies hetzelfde blijven.
          </p>
          <div style={S.kader}>
            Bewaar bij elke manier het resultaat als favoriet. Dat is de enige manier waarop loggen op
            den duur licht blijft.
          </div>
        </H>

        <H id="beweging" titel="Beweging">
          <p style={{ margin: "0 0 8px" }}>
            Log een activiteit met soort en minuten; de punten verruimen je budget van die dag. Twee
            dempers, omdat verbrandingsschattingen structureel te optimistisch zijn: de
            rustverbranding gaat eraf — tijdens dat uur wandelen verbrand je ook wat je op de bank zou
            verbruiken — en er zit een plafond van zes punten per dag op.
          </p>
        </H>

        <H id="week" titel="Week, weekbuffer en wegen">
          <p style={{ margin: "0 0 8px" }}>
            Naast je dagbudget is er een vaste <strong>weekbuffer van 28 punten</strong>. Ga je over je
            dagbudget heen, dan komt het verschil daaruit; je dagbudget gaat nooit negatief, elke dag
            begint op nul. Een zuinige dag levert niets terug — de buffer vult niet aan.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            De week loopt van weegdag tot weegdag, niet van maandag tot zondag: op de weegdag reset de
            buffer. Dagen zonder logging tellen niet mee in het weekgemiddelde — een dag die je vergat
            was geen dag zonder eten.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            In de grafiek staat onderaan een staaf <strong>in het groen</strong> wat je die dag met
            bewegen hebt verdiend. Je dagbudget zelf verandert daar niet van — de stippellijn blijft
            waar hij staat, er komt alleen ruimte bij. Op Inzicht staat hetzelfde groen in "Punten
            per weekdag", daar als gemiddelde over de twaalf weken.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong>Wegen</strong> — één getal is genoeg. De grafiek toont je metingen als punten en de
            trendlijn als hoofdfiguur. Een kilo verschil van dag tot dag is vocht, geen vet.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            Meet je weegschaal meer dan gewicht, klap dan <strong>Meer van je weegschaal</strong>
            open: vetpercentage, spiermassa en vochtgehalte. Alles optioneel — leeg betekent niet
            gemeten en telt nergens als nul mee. Bij spiermassa kies je kg of %, want die twee
            getallen lijken te veel op elkaar om te raden. <strong>BMI</strong> vul je niet in: die
            rekent de app uit je gewicht en je lengte, zodat er niet twee verschillende in omloop
            zijn. Op Inzicht staat het verloop over twaalf weken.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            Onder je laatste weging staat wat de <strong>weegschaal</strong> deed sinds de vorige
            keer, en in de lijst staat dat verschil naast elke meting. Het trendgewicht loopt daar
            met opzet op achter: het beweegt maar een kwart van een uitschieter mee. Sta je 2,4 kilo
            lager, dan zie je dat nu allebei — het echte verschil én wat de trend ervan maakt.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            Vergissing ingetikt, of een dag vergeten? Bij het invoerveld staat een <strong>datum</strong>,
            zodat je een gemiste dag alsnog kunt invullen, en elke weging in de lijst heeft een
            potlood waarmee je het gewicht én de datum aanpast. Verplaats je een weging naar een dag
            waarop al gewogen is, dan vraagt de app eerst of die vervangen mag worden — er kan er
            maar één per dag zijn.
          </p>
          <div style={S.kader}>
            <strong>De app stuurt op de trend, niet op je laatste meting.</strong> Wijkt je trendgewicht
            meer dan een kilo af van het gewicht waarop je budget rust, dan wordt het budget
            herberekend.
          </div>
        </H>

        <div style={S.deel}>Inzicht</div>

        <H id="inzicht" titel="De cijfers en het advies">
          <p style={{ margin: "0 0 8px" }}>
            Inzicht legt je eetpatroon over <strong>twaalf weken</strong> naast elkaar: punten per
            weekdag, verdeling over de dag, budget en spreiding, je weekbuffer, je logboek naast de
            weegschaal, en waar je punten heen gaan. Dat deel is puur rekenwerk.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            Bij <strong>Budget en spreiding</strong> telt &ldquo;binnen budget&rdquo; de beweging van
            die dag mee — die verruimt je budget, dus een dag boven je dagbudget kan er tóch binnen
            vallen. Wat je gemiddeld per dag met bewegen verdiende staat er als apart cijfer bij. Het
            gemiddelde en de mediaan gaan alleen over wat je at.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            Het advies rekent met alles wat er staat: je beweging (die je dagbudget verruimt),
            wélke beweging het was, de verdeling per maaltijd, en wat je weegschaal aan vet, spier
            en vocht meegaf. Twee kilo eraf is iets anders als je spiermassa meezakt.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            Bovenaan staat één advies: eerst de waarneming, dan de uitleg, dan de achtergrond, en pas
            daarna de actie. Het verschijnt na je weging op de weegdag, en per weging precies één keer.
            Elk genoemd getal wordt nagerekend tegen je eigen cijfers. Lukt dat bij een getal niet,
            dan staat dat er onder het advies bij: meestal een vuistregel van buiten of iets dat het
            model zelf uitrekende. Het kan kloppen, maar de app kan het niet nakijken.
          </p>
          <p style={{ margin: 0 }}>
            Onder het advies staat <strong>Analyseer mijn patroon</strong> als je zelf iets wilt vragen,
            en onderaan een tijdlijn met elk advies dat ooit is uitgegeven en wat het opleverde.
          </p>
        </H>

        <H id="grenzen" titel="Wat Inzicht niet doet">
          <p style={{ margin: "0 0 8px" }}>
            <strong>Geen advies zonder bewijslast.</strong> Minder dan veertien dagen historie of acht
            gelogde dagen in de laatste twee weken: dan staan de cijfers er wel, maar geen uitspraak
            over patronen.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong>Geen waarderende taal.</strong> Nergens staat of een dag goed of slecht was. Er
            staat wat er gemeten is.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong>Geen aansporing om minder te eten.</strong> Ligt je inname structureel onder je
            budget of gaat je afname te snel, dan draait de toon om: de actie is dan altijd omhoog of
            stabiliserend, en een voorstel om verder te beperken wordt geweigerd. Houdt zo'n patroon
            aan, dan is het het bespreken waard met je huisarts of een diëtist.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Geen gepiep.</strong> Meldt de app uit zichzelf iets, dan hooguit één keer per tien
            dagen, nooit vlak na je weegmomentadvies, en dezelfde aanleiding niet twee keer per maand.
            Je ziet een banner en een stipje, geen push-notificaties.
          </p>
        </H>

        <div style={S.deel}>Praktisch</div>

        <H id="kruispunt" titel="Recepten en tracker samen">
          <p style={{ margin: "0 0 8px" }}>
            De tracker rekent elk recept uit je kookboek door naar punten per portie — je ziet dat als
            een badge op de receptkaart, en je logt het via Toevoegen → Recept.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            Daarvoor moet elk ingrediënt bekend zijn. Onder het recept staat per ingrediënt of dat zo
            is; onbekende zijn aantikbaar, en er is een knop om ze allemaal in één keer te laten
            aanvullen. Zo'n aanvulling telt daarna mee in élk recept waar dat ingrediënt in voorkomt.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong>"Naar smaak" wordt gevraagd.</strong> Sla je een recept op met een maat waar
            niets van te maken valt — <em>naar smaak</em>, <em>flinke scheut</em> — dan vraagt het
            formulier om een hoeveelheid en een eenheid, met een voorstel al ingevuld. Laat je het op
            <em> telt niet mee</em> staan, dan blijft het ingrediënt in het recept, alleen niet in de
            punten.
          </p>
          <div style={S.kader}>
            Voedingswaarden die door AI zijn ingevuld krijgen het label <em>geschat</em>, en dat blijft
            staan tot jij ze bijstelt. Niemand heeft die getallen nagekeken, en dat hoor je te kunnen
            zien.
          </div>
          <p style={{ margin: 0 }}>
            Kom je onderweg een recept- of productpagina tegen, dan kun je die vanuit je browser
            delen naar Kookboek. Je krijgt dan één vraag: moet het een <em>recept in het kookboek</em>
            worden of een <em>product in de tracker</em>. Bij het kookboek wordt de pagina meteen
            uitgelezen en zie je het recept in het formulier voordat je het opslaat. Dit werkt op
            Android, mits je de app op je beginscherm hebt gezet; op iPhone plak je de link bij
            Toevoegen → Link of op <span style={S.route}>/tracker/import</span>.
          </p>
        </H>

        <H id="chat" titel="Vraag het de app">
          <p style={{ margin: "0 0 8px" }}>
            Rechtsonder staat op elk scherm een pratend bolletje. Daar kun je alles vragen over je
            kookboek, je weekmenu, je boodschappen, je voorraad en je tracker — van "wat staat er
            deze week op het menu" tot "hoe ging mijn week". Kijk je naar een recept, dan gaat
            "hoeveel punten kost dit?" over dát recept.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            Hij zoekt het antwoord op in je eigen gegevens en rekent met dezelfde puntenformule als
            de rest van de app. Staat het antwoord daar niet in, dan gaat hij het internet op en
            zet de bron eronder, zodat je ziet wat van jou is en wat van een website.
          </p>
          <div style={S.kader}>
            Hij verandert zelf niets. Moet er iets gepland, gelogd of op de lijst, dan krijg je een
            kaartje met een knop; pas als jij die indrukt gebeurt het. Loggen kan alleen met iets
            dat de app al kent — anders zouden de voedingswaarden verzonnen zijn.
          </div>
          <p style={{ margin: 0 }}>
            Gesprekken blijven bewaard: bij het openen praat je verder waar je gebleven was. Met de
            plus begin je opnieuw, en linksboven staan je eerdere gesprekken.
          </p>
        </H>

        <H id="account" titel="Inloggen, personen en back-up">
          <p style={{ margin: "0 0 8px" }}>
            De app zit achter een inlog. Iedereen heeft een eigen gebruikersnaam en wachtwoord; je
            blijft daarna negentig dagen ingelogd, dus in de praktijk zie je het loginscherm zelden.
            Er is geen "wachtwoord vergeten"-mail — bewaar het in de wachtwoordkluis van je telefoon.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            Onder <span style={S.route}>Instellingen → Wie kunnen er inloggen</span> voeg je een
            huisgenoot toe. Wat je dan deelt en wat niet: recepten, weekmenu, boodschappenlijst,
            voorraad én het eetdagboek zijn van het huishouden. Je profiel en je weeglijst zijn van
            jou alleen — met de adviezen die daaruit volgen. Twee mensen op één app zien dus hetzelfde
            kookboek en hetzelfde logboek, maar ieder de eigen weegcijfers.
          </p>
          <p style={{ margin: 0 }}>
            Onder <span style={S.route}>Instellingen → Back-up</span> haal je alles in één
            JSON-bestand op: recepten, weekmenu, boodschappen, voorraad, eetdagboek, je profiel en je
            weeglijst. Datzelfde bestand kun je terugzetten, en dan <em>vervangt</em> het wat er staat
            — wat niet in het bestand zit, verdwijnt. Bewaar het ergens anders dan in de app zelf.
          </p>
        </H>

        <H id="bon" titel="Voorraad snel vullen">
          <p style={{ margin: "0 0 8px" }}>
            Op <span style={S.route}>Voorraad</span> staat "Voorraad snel vullen". Fotografeer je
            kassabon en de app zet de producten voor je klaar — statiegeld, kortingen en het totaal
            gaan er vanzelf uit, en de kassa-afkorting wordt teruggebracht tot een gewone naam.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            Alles staat met een vinkje klaar en je kunt elke naam nog aanpassen. Pas als je op
            toevoegen drukt gaat het je voorraad in. Staat een product er al, dan wordt het aantal
            opgehoogd in plaats van dat het er twee keer komt te staan.
          </p>
          <p style={{ margin: 0 }}>
            Dezelfde knop leest ook een foto van losse producten op je aanrecht, en er zit een
            derde weg bij: één product tegelijk met de streepjescode. Waar een foto een gok blijft,
            leest een streepjescode het pak.
          </p>
        </H>

        <H id="prijzen" titel="Wat je boodschappen kosten">
          <p style={{ margin: "0 0 8px" }}>
            Wat je op een bon betaald hebt wordt onthouden per product. Onder aan je
            boodschappenlijst staat daarna wat de lijst ongeveer gaat kosten.
          </p>
          <p style={{ margin: 0 }}>
            "Ongeveer" is hier geen slag om de arm: er staat altijd bij hoeveel items nog geen
            bekende prijs hebben, en hoeveel prijzen ouder zijn dan vier maanden. Voor items zonder
            prijs wordt niets geraden — dan zou het bedrag nauwkeuriger lijken dan het is.
          </p>
        </H>

        <H id="horloge" titel="Beweging uit je horloge">
          <p style={{ margin: "0 0 8px" }}>
            Onder <span style={S.route}>Instellingen → Beweging uit je horloge</span> staat een
            plakveld. Kopieer je activiteiten uit Garmin Connect en plak ze erin — één per regel,
            met de soort, de datum en de duur. De app leest <em>45:12</em>, <em>1:05:00</em> en
            <em>90 min</em>, en wat hij niet herkent laat hij staan in plaats van te gokken.
            Dezelfde regel twee keer plakken levert één activiteit op.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            Wil je het automatisch, dan is de eenvoudigste weg een Tasker-profiel dat afgaat op een
            melding van Garmin Connect: de tekst van die melding gaat naar de app, en die zoekt er
            zelf een sport en een duur uit. Geen plug-in nodig. Lukt dat niet, dan is er de omweg
            via Health Connect met een plug-in — die staat als taak 2 en 3 in het bestand.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            Bij de sleutel staat een knop <strong>Tasker-taak downloaden</strong>: een kant-en-klaar
            bestand met je adres en sleutel er al in, dat je in Tasker importeert via Profielen → menu →
            Gegevens → Importeer project. De taak begint in de proefstand, dus de eerste keer zet hij nog niets in
            je logboek. Bovenaan staan vier acties met <strong>VUL IN</strong> in het label; daar
            zet je de variabelen van je eigen app neer.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            Gaat er iets mis, dan staat in het antwoord precies welk veld leeg binnenkwam — daar zit
            de fout vrijwel altijd, en dan is het een verkeerde variabelenaam.
          </p>
          <p style={{ margin: 0 }}>
            De punten worden altijd door de app zelf berekend, uit je gewicht en je basaal
            metabolisme. Wat je horloge als verbranding meestuurt telt niet mee: die getallen zijn
            structureel te hoog, en het dagplafond van zes punten geldt onverkort.
          </p>
        </H>

        <H id="meldingen" titel="Herinneringen">
          <p style={{ margin: "0 0 8px" }}>
            Onder <span style={S.route}>Instellingen → Meldingen</span> zet je herinneringen aan.
            Twee soorten, allebei apart: op je <strong>weegdag</strong> als er nog geen weging staat,
            en aan het <strong>eind van de dag</strong> als je dagboek nog leeg is. Standaard staat
            alles uit.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            Je krijgt hooguit één melding per soort per dag, en alleen als er echt iets ontbreekt —
            staat alles ingevuld, dan blijft het stil. Log je een week lang niets, dan houdt de app
            ook op met de dagboekherinnering: een pauze is een pauze.
          </p>
          <p style={{ margin: 0 }}>
            Met "Proefmelding sturen" controleer je meteen of het werkt. Op een iPhone werkt dit
            alleen als je Kookboek eerst via Safari op je beginscherm zet.
          </p>
        </H>

        <H id="offline" titel="Zonder bereik in de winkel">
          <p style={{ margin: "0 0 8px" }}>
            De boodschappenlijst werkt door als het bereik wegvalt. Wat je hebt opgehaald blijft in
            het geheugen van je telefoon staan, en afvinken blijft gewoon werken.
          </p>
          <p style={{ margin: 0 }}>
            Boven de lijst verschijnt dan een balkje dat je afvinkjes nog niet op de server staan.
            Ze gaan er vanzelf heen zodra je weer verbinding hebt — je hoeft niets te onthouden en
            niets opnieuw te doen.
          </p>
        </H>

        <H id="installeren" titel="Als app op je telefoon">
          <p style={{ margin: 0 }}>
            Installeer Kookboek als app: op Android via Chrome → menu → "App installeren", op iPhone via
            Safari → deelknop → "Zet op beginscherm". Je krijgt een eigen icoon en volledig scherm;
            updates gaan vanzelf mee.
          </p>
        </H>

        <H id="goed-om-te-weten" titel="Goed om te weten">
          <p style={{ margin: "0 0 8px" }}>
            De slimme functies — recepten uitlezen en zoeken, afdelingen bepalen, lijst opschonen, een
            bord schatten, ingrediënten aanvullen en het advies — draaien op AI en hebben een werkende
            API-sleutel met tegoed nodig. Zonder sleutel werkt de rest gewoon door; handmatig invoeren
            kan altijd.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            Staan er geen puntenbadges bij je recepten, dan ontbreekt je trackerprofiel: zonder profiel
            is de puntenschaal onbekend en zegt zo'n getal niets.
          </p>
          <p style={{ margin: 0 }}>
            De app heeft internet nodig. Alle gegevens staan in de cloud en blijven bewaard, ook als je
            de app verwijdert en opnieuw installeert — maar één database is één punt van falen, dus
            haal af en toe een back-up op.
          </p>
        </H>
      </div>
    </div>
  );
}
