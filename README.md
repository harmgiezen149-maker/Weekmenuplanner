# Kookboek

Een receptenapp met database, weekplanning en boodschappenlijst. Recepten invoeren
kan handmatig, via een foto (uit een magazine of kookboek) of via een link naar een
receptpagina. Gebouwd met Next.js 15, Upstash Redis en de Anthropic API.

## Wat de app doet

- **Recepten** opslaan met vaste, filterbare kenmerken: keuken, hoofdingrediënt,
  moeilijkheid, bereidingstijd en een eigen score (1–5 sterren).
- **Filteren en zoeken** op al die kenmerken, zodat je gerechten die je lekker vond
  snel terugvindt.
- **Weekmenu** samenstellen met een vrij instelbare startdag, en per dag het aantal
  personen kiezen.
- **Boodschappenlijst** die automatisch alle ingrediënten optelt en per recept
  schaalt naar het gekozen aantal personen. Afvinkbaar tijdens het boodschappen doen.
- **Importeren** van recepten op drie manieren: handmatig, via foto, of via een link.
- **Tracker** (`/tracker`) — een puntengebaseerde voedingstracker met een dagbudget
  dat wordt afgeleid van je lichaamsgegevens. Zie het hoofdstuk hieronder.
- **Inzicht** (`/tracker/inzicht`) — je eetpatroon over twaalf weken, teruggerekend
  tot cijfers: weekdagen, dagdelen, energiebalans en waar de punten heen gaan. Bij
  je weging op de weegdag komt daar één onderbouwd advies bij.

---

## Onderdeel 1 — Wat je nodig hebt

1. **Node.js 18.18 of nieuwer** (Node 20+ aanbevolen). Check met `node -v`.
   Download via https://nodejs.org als je het nog niet hebt.
2. Een gratis **Upstash**-account (voor de database): https://upstash.com
3. Een gratis **GitHub**-account (om de code te bewaren): https://github.com
4. Een gratis **Vercel**-account (om de app online te zetten): https://vercel.com
5. Een **Anthropic API-key** — alleen nodig voor foto- en link-import:
   https://console.anthropic.com → Settings → API Keys.
   De app werkt ook zonder; dan is alleen handmatig invoeren beschikbaar.

---

## Onderdeel 2 — De Upstash-database aanmaken

1. Log in op https://console.upstash.com
2. Klik **Create Database**. Kies een naam (bijv. `kookboek`) en een **regio dicht bij
   Frankfurt / Europa** (bijv. `eu-west-1`), zodat de app snel blijft vanaf Vercel.
3. Open de database. Scroll naar **REST API** en klik op de knop **.env**.
4. Je ziet nu twee regels:
   ```
   UPSTASH_REDIS_REST_URL="https://....upstash.io"
   UPSTASH_REDIS_REST_TOKEN="AX...."
   ```
   Houd deze bij de hand — die heb je zo nodig.

---

## Onderdeel 3 — Lokaal draaien (op je computer, test op je telefoon)

1. **Pak het project uit** en open een terminal in de projectmap
   (de map met dit `README.md`-bestand).

2. **Installeer de dependencies:**
   ```bash
   npm install
   ```

3. **Maak een bestand `.env.local`** in de projectmap. Kopieer `.env.example` of maak
   het zelf met deze inhoud (vul je eigen waarden in):
   ```
   UPSTASH_REDIS_REST_URL=https://....upstash.io
   UPSTASH_REDIS_REST_TOKEN=AX....
   ANTHROPIC_API_KEY=sk-ant-....
   ```
   De `ANTHROPIC_API_KEY` mag je weglaten als je (nog) geen foto/link-import wilt.

4. **(Optioneel) Voorbeeldrecepten inladen:**
   ```bash
   node --env-file=.env.local scripts/seed.mjs
   ```

5. **Start de app:**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 in je browser.

6. **Testen op je telefoon** (zelfde wifi-netwerk): de terminal toont ook een
   `Network`-adres zoals `http://192.168.x.x:3000`. Open dat op je telefoon.
   Tip: voor de camera/foto-functie werkt dit het best, maar sommige telefoons vragen
   een beveiligde verbinding (https) voor de camera. Dat lukt sowieso zodra de app
   live op Vercel staat (zie onderdeel 5).

---

## Onderdeel 4 — Op GitHub zetten

1. Maak een nieuwe, lege repository aan op https://github.com/new
   (bijv. `kookboek`, zonder README aan te vinken).
2. Open een terminal in de projectmap en voer uit (vervang het GitHub-adres):
   ```bash
   git init
   git add .
   git commit -m "Eerste versie kookboek"
   git branch -M main
   git remote add origin https://github.com/JOUW-GEBRUIKERSNAAM/kookboek.git
   git push -u origin main
   ```
   `.env.local` wordt **niet** meegestuurd (staat in `.gitignore`) — je sleutels
   blijven dus privé.

---

## Onderdeel 5 — Live zetten op Vercel

1. Ga naar https://vercel.com en log in met je GitHub-account.
2. Klik **Add New → Project** en kies je `kookboek`-repository. Vercel herkent
   automatisch dat het een Next.js-project is — laat alle build-instellingen op de
   standaardwaarden staan.
3. Open **Environment Variables** en voeg deze drie toe (dezelfde als in `.env.local`):
   | Naam | Waarde |
   |------|--------|
   | `UPSTASH_REDIS_REST_URL` | je Upstash REST URL |
   | `UPSTASH_REDIS_REST_TOKEN` | je Upstash REST token |
   | `ANTHROPIC_API_KEY` | je Anthropic key (optioneel) |
4. Klik **Deploy**. Na een halve minuut krijg je een URL zoals
   `https://kookboek.vercel.app`. Open die op je telefoon — daar werkt ook de camera.
5. **Tip:** voeg de pagina toe aan je beginscherm (in Safari/Chrome: deel-knop →
   "Zet op beginscherm"). Dan opent de app schermvullend, als een echte app.

Elke keer dat je nieuwe code naar GitHub pusht (`git push`), zet Vercel automatisch
de bijgewerkte versie live.

---

---

## De tracker (`/tracker`)

Een puntengebaseerde voedingstracker naast het kookboek, bereikbaar via de knop
**Tracker** in de onderbalk. Één gebruiker, geen accounts.

### Hoe de punten werken

Elk product krijgt punten uit zijn voedingswaarden. Calorieën, verzadigd vet en
suiker maken iets duurder; eiwit en vezels maken het goedkoper:

```
punten = 0,024 × kcal
       + 0,20  × verzadigd vet (g)
       + 0,10  × effectieve suiker (g)
       - 0,075 × eiwit (g)
       - 0,05  × vezels (g)
```

Het resultaat wordt afgekapt op nul. Daardoor komen groente en magere
eiwitbronnen vanzelf op nul uit — er is geen aparte lijst van gratis producten
nodig, en de rekensom blijft uitlegbaar.

**Effectieve suiker.** Etiketten en productdatabases geven alleen *totale*
suikers, dus inclusief lactose en fruitsuiker. Zonder correctie wordt magere
kwark onterecht duur. Kies je bij een product de juiste soort (zuivel, fruit,
groente, peulvruchten, noten), dan wordt de van nature aanwezige suiker
afgetrokken. Vul je zelf de toegevoegde suiker in, dan wint die waarde.

**Puntenschaal.** `points_scale` in de instellingen is de enige knop om het
niveau te verschuiven. Op 1,0 komt een dag rond de 40 tot 50 punten uit; op 0,75
rond de 30. De schaal werkt met terugwerkende kracht, want in de database staat
de onafgeronde, schaalvrije waarde (`points_raw`). Afronden gebeurt pas bij het
tonen, zodat afrondingsfouten zich niet opstapelen over een dag met tien regels.

### Hoe het dagbudget wordt bepaald

1. Basaal metabolisme volgens Mifflin-St Jeor, uit geslacht, gewicht, lengte en
   leeftijd.
2. Onderhoudsbehoefte = basaal metabolisme × activiteitsfactor.
3. Beoogde afname = een half procent van je lichaamsgewicht per week, met een
   plafond van 0,75 kg. Doordat dit aan je *huidige* gewicht hangt, schaalt het
   tempo automatisch mee omlaag naarmate je lichter wordt.
4. Dagbudget in punten = 0,024 × doelcalorieën × puntenschaal.

Twee grenzen worden in code afgedwongen en zijn met tests vastgelegd: het tekort
is nooit groter dan een half procent lichaamsgewicht per week, en het doel zakt
nooit onder je basaal metabolisme — ook niet bij een streefgewicht ver onder je
huidige. Zit je op of onder je streefgewicht, dan valt het tekort weg en staat het
budget op onderhoud.

### Schermen

| Route | Wat je er doet |
|---|---|
| `/tracker` | Dagoverzicht: puntenring, eiwitbalk, macro's en je regels per maaltijd |
| `/tracker/toevoegen` | Een product loggen: snel, zoeken, scannen of handmatig |
| `/tracker/week` | Punten per dag tegen je budget, weekbuffer, gemiddelde, voedingsstoffen |
| `/tracker/inzicht` | Je patroon over twaalf weken: weekdagen, dagdelen, energiebalans, bijdragers |
| `/tracker/gewicht` | Wegen, trendlijn en voortgang naar je streefgewicht |
| `/tracker/instellingen` | Profiel, activiteitsniveau, weegdag, puntenschaal, eiwitdoel |

### Zes manieren om iets te loggen

**Snel** — je vaste maaltijden, je favorieten en de laatste 50 dingen die je
gelogd hebt. Één tik logt het opnieuw bij de gekozen maaltijd; het potlood
erachter opent hetzelfde product met een andere hoeveelheid. In de praktijk de
snelste route.

**Zoeken** — doorzoekt twee bronnen tegelijk. Eerst een eigen basislijst met
onbewerkte Nederlandse producten (ei, rijst, kipfilet, groente), want daar is
Open Food Facts zwak in. Daarna Open Food Facts zelf, gefilterd op Nederland.
Resultaten tonen de punten per 100 g én per standaardportie. Is de externe
database onbereikbaar, dan komen de eigen resultaten alsnog door met een
melding erbij.

**Scannen** — de streepjescode met de camera. Zie hieronder. Waar de browser `BarcodeDetector`
heeft (Chrome op Android) wordt die gebruikt; Safari op iOS heeft hem niet, daar
wordt `@zxing/browser` pas op dat moment bijgeladen. Werkt de camera niet, dan
kun je de code overtikken. Kent de database de code niet, dan opent het
handmatige formulier met de code al ingevuld.

**Recept** — een recept uit je eigen kookboek, doorgerekend naar punten per
portie. Zie hieronder.

**Foto** — een foto van je bord laten schatten. Zie hieronder.

**Handmatig** — de zeven voedingswaarden van het etiket, met punten die
meerekenen terwijl je typt. Etiketwaarden staan per 100 g; kies je een andere
hoeveelheid, dan rekent de app het om.

Bij alle vier kun je het resultaat als favoriet bewaren, zodat het de volgende
keer bovenaan bij **Snel** staat.

### Wegen en de trendlijn

Op je weegdag verschijnt op het dagoverzicht een knop naar het weegscherm. Één
getal is genoeg. Weeg je twee keer op dezelfde dag, dan vervangt de nieuwe
meting de oude.

De grafiek toont je losse metingen als terugtredende punten en de **trendlijn**
als hoofdfiguur: een exponentieel voortschrijdend gemiddelde met een wegingsfactor
van 0,25. Een kilo verschil van dag tot dag is vocht, geen vet — de trend haalt
dat eruit. Een uitschieter van anderhalve kilo verschuift de trend maar een paar
honderd gram.

**De app stuurt op de trend, niet op je laatste meting.** Wijkt het trendgewicht
meer dan een kilo af van het gewicht waarop je huidige budget rust, dan wordt het
budget herberekend en zie je dat op het weegscherm terug. Zonder die dempingsstap
zou een dag met vocht vasthouden je budget omhoog gooien.

### De weekbuffer

Naast je dagbudget is er een vaste buffer van 28 punten per week. Ga je op een dag
over je dagbudget heen, dan komt het verschil uit die buffer; je dagbudget zelf
gaat nooit negatief, elke dag begint weer op nul. Een dag ver ónder je budget
levert niets terug — de buffer vult niet aan.

De week loopt van weegdag tot weegdag, niet van maandag tot zondag: op de weegdag
reset de buffer, dus daar hoort ook de week te beginnen. Op het dagoverzicht zie
je wat er nog over is en hoeveel dagen de week nog telt.

Dagen zonder logging tellen niet mee in het weekgemiddelde. Een dag die je vergat
bij te houden was geen dag van nul punten, dus het gemiddelde deelt door het
aantal gelogde dagen — dat aantal staat erbij, zodat je het kunt wegen.

### Vaste maaltijden

Eet je elke ochtend hetzelfde, dan hoef je dat niet elke ochtend opnieuw in te
voeren. Stel bij **Snel** een maaltijd samen uit losse onderdelen — havermout,
melk en een banaan; of brood met beleg — geef hem een naam, en hij staat
voortaan bovenaan. Één tik logt de hele maaltijd.

Bij **Onderdeel toevoegen** staan je favorieten en je recent gelogde items
bovenaan: één tik voegt zo'n item toe in de hoeveelheid die je eerder gebruikte.
Het potlood ernaast opent hetzelfde product met een andere hoeveelheid, en het
zoekveld erboven is er voor alles wat er nog niet bij staat. Zo zet je een lunch
met vast brood en vaste kaas in drie tikken in elkaar en voeg je daarna nog los
een tomaat toe.

**De punten van een maaltijd zijn de som van de onderdelen, niet een
herberekening over de opgetelde voedingswaarden.** Dat klinkt als een detail
maar scheelt echt iets. De suikercorrectie hangt aan de soort van het
onderdeel: de melksuiker in een glas melk telt niet mee, de fruitsuiker van een
banaan ook niet, maar de suiker in havermout wel. Tel je eerst alles op en pas
je daarna één soort toe, dan komt datzelfde ontbijt op **12 punten** uit in
plaats van **9**. In het dagoverzicht kun je een samengestelde regel uitklappen
om te zien waar de punten vandaan komen.

### Recepten uit je kookboek

Bij **Recept** staan de recepten uit het kookboek van deze app, doorgerekend
naar punten per portie. Elk ingrediënt wordt herkend als product, omgerekend
naar gram en apart doorgerekend — dus ook hier houdt elk ingrediënt zijn eigen
soort.

Twee stappen kunnen daarbij misgaan, en dat hoor je te zien:

- **De hoeveelheid omrekenen.** "500 g kipfilet" is exact; "2 el olijfolie" is
  een schatting (30 g), en "1 stuk" leunt op de standaardportie van het product.
  Bij elk ingrediënt staat wat er is aangenomen.
- **Het ingrediënt herkennen.** Wat niet in de productlijst staat, telt niet mee
  en wordt met naam genoemd, met de melding dat de punten dus aan de lage kant
  zijn. Liever een getal met een kanttekening dan een getal dat doet alsof het
  klopt.

#### Ontbrekende ingrediënten aanvullen

Onder de melding staat elk niet-herkend ingrediënt met een knop **Aanvullen**.
Daar vul je de voedingswaarden per 100 g in — of laat je ze schatten, en kijk je
het voorstel na voordat je opslaat.

**Dat hoeft maar één keer.** De aanvulling wordt bewaard op de naam van het
ingrediënt, niet op het recept waar je hem tegenkwam. Vul je "harissa" in bij je
kipgerecht, dan telt harissa vanaf dat moment ook mee in je kikkererwtenstoof —
en verdwijnt daar de tilde van de puntenbadge in het kookboek.

Je eigen lijst gaat vóór de ingebouwde basislijst. Vind je de standaardwaarde van
iets niet kloppen, dan overschrijf je hem simpelweg door dat ingrediënt aan te
vullen.

#### Alles in één keer laten schatten

Staat er meer dan één onbekend ingrediënt in een recept, dan staat er een knop
**Laat alle N in één keer schatten**. Die haalt de waarden voor alle onbekende
ingrediënten tegelijk op en **bewaart ze meteen** — dat is de hele winst, anders
klik je alsnog N formulieren door.

Omdat er niets tussen zit dat je eerst nakijkt, is dat zichtbaar gemaakt:

- Zo ingevulde ingrediënten krijgen bron `schatting` en staan in de lijst met
  een oranje label **geschat** erbij. Dat blijft staan tot je ze zelf bijstelt.
- Achteraf staat er hoeveel er zijn ingevuld, en welke niet lukten — met de
  reden erbij. "Even te druk" is iets anders dan "niet herkend door het model":
  het eerste kun je zo nog eens proberen, het tweede niet.
- Elke regel blijft aantikbaar om na te kijken.

Wat het model niet kent blijft onbekend; daar wordt niet naar geraden. Er lopen
vier aanvragen tegelijk en er gaan er maximaal 25 per druk op de knop; een recept
met meer ingrediënten doe je in twee rondes. De schattingen worden in één keer
weggeschreven, niet per stuk — de lijst wordt als geheel bewaard, dus tussentijds
opslaan zou betekenen dat gelijktijdige schrijfacties elkaar overschrijven.

Zonder `ANTHROPIC_API_KEY` verschijnt de knop wel maar meldt hij netjes dat
schatten niet werkt; zelf invullen blijft gewoon werken.

Het resultaat wordt gecachet met een vingerafdruk van de ingrediënten en het
aantal personen. Pas je het recept aan in het kookboek, dan klopt die
vingerafdruk niet meer en wordt er automatisch opnieuw gerekend. Hetzelfde geldt
voor je eigen ingrediëntenlijst: die heeft een revisienummer dat in de
vingerafdruk zit, dus na een aanvulling worden álle recepten opnieuw
doorgerekend. Zonder dat zou een aanvulling pas meetellen na een wijziging aan
het recept zelf.

In de **weekplanner** staat bij elke dag met gerechten een knop **Zet dagmenu in
logboek**. Die logt elk gerecht van die dag als één portie in het logboek van
vandaag, bij de bijbehorende maaltijd.

Er wordt nergens een puntwaarde van een bron overgenomen; alles komt uit de
eigen formule.

### Bewegingspunten

Op het dagoverzicht staat onder de maaltijden een blok **Beweging**. Kies wat je
gedaan hebt en hoe lang; de punten verruimen je dagbudget van die dag.

De verbranding komt uit een MET-waarde maal je gewicht maal de duur. Daar gaat
je **rustverbranding** vanaf: tijdens dat uur wandelen verbrand je ook de
calorieën die je op de bank zou hebben verbruikt, en alleen het verschil is
extra.

**Er tellen maximaal 6 bewegingspunten per dag mee.** Dat plafond is er met
reden: verbrandingsschattingen vallen structureel te hoog uit, en zonder
plafond eet je je tekort weg met een getal dat je niet kunt controleren. Bij een
gewicht rond de 95 kg raakt vrijwel elke activiteit dat plafond binnen een uur —
je verdiende punten blijven zichtbaar, maar er tellen er zes mee.

### Wat de scanner opzoekt

Een gescande streepjescode gaat langs vier bronnen, in deze volgorde:

1. **Je eigen invoer.** Wat je ooit zelf bij deze code hebt ingevuld wint altijd
   — dat is precies het product uit jouw kast.
2. **De cache** van een eerdere externe treffer. Werkt ook zonder netwerk.
3. **Open Food Facts.** Dekt A-merken goed.
4. **De supermarkten zelf** (Albert Heijn en Jumbo).

**Nederlandse huismerken staan vaak in geen enkele externe database.** Scan je
een pak AH-kwark, dan is de kans groot dat stap 3 en 4 allebei niets vinden. Dat
is geen fout in de app maar een gat in de gegevens.

Daarom leert de app je eigen boodschappen kennen. Vindt de scan niets, dan opent
het handmatige formulier met de code al ingevuld en staat **"Wordt onthouden bij
&lt;code&gt;"** aan. Vul je de verpakking één keer over, dan vindt de scanner dat
product voortaan zelf — meteen, zonder netwerk. Na een paar weken boodschappen
zit je vaste lijstje erin.

De supermarktbronnen in `lib/tracker/winkels.ts` gebruiken **onofficiële**
endpoints van de AH- en Jumbo-app. Die kunnen zonder aankondiging wijzigen, dus
alles faalt daar stil: lukt het niet, dan valt de app terug op handmatige
invoer. De endpoints staan bij elkaar in één `WINKELS`-tabel, zodat een
gewijzigde URL op één plek te repareren is. Lidl heeft geen bruikbare
productdienst en zit er daarom niet bij.

Let op: deze webshops zijn geen voedingsdatabases. Staat er geen voedingstabel
bij een product, dan telt het als niet gevonden — met alleen een naam en een
prijs zijn geen punten te berekenen.

### Een foto van je bord

Bij **Foto** maak je een foto van je bord en laat je de voedingswaarden schatten.
Het resultaat is nadrukkelijk een **bewerkbaar concept**: elk herkend onderdeel
staat er los in, met zijn eigen hoeveelheid, voedingswaarden en soort. Is de
zekerheid over een portiegrootte laag, dan wordt dat veld gemarkeerd. Er wordt
niets opgeslagen voordat je het hebt nagekeken — een schatting uit een foto is
een startpunt, geen meting.

Elk onderdeel houdt zijn eigen soort, dus ook hier telt de melksuiker in een
glas melk niet mee en de suiker in een koekje wel.

Hiervoor is een `ANTHROPIC_API_KEY` nodig. Zonder die sleutel geeft het scherm
een nette melding en werken de andere vijf routes gewoon door.

### Punten bij je recepten

Bij elk recept in het kookboek staat wat een portie kost: een badge op de
receptkaart en een regel in het recept zelf. Die punten worden berekend uit de
ingrediënten, precies zoals bij het loggen — er wordt niets apart opgeslagen,
dus pas je een recept aan, dan klopt het getal meteen weer.

Staat er een **tilde** voor (`~8 pt`) en is de badge donkeroranje, dan kon niet
elk ingrediënt worden herkend. Het echte aantal ligt dan hoger; in het recept
zelf staat om hoeveel ingrediënten het gaat. Vul je die aan in de basislijst,
dan klopt het getal vanzelf.

Bij een koude cache rekent de tracker alle recepten door en dat duurt een paar
seconden. Zolang dat loopt houdt de badge zijn plek met een draaiende cirkel
erin, en staat er in het recept zelf dat de punten nog berekend worden. Alle
badges zijn even breed, zodat er niets verschuift op het moment dat de getallen
binnenvallen.

Zonder ingevuld trackerprofiel verschijnen de badges niet en werkt het kookboek
verder gewoon door. De puntenschaal is dan onbekend, dus het getal zou niets
zeggen.

#### Zien en aanpassen waarmee gerekend wordt

Open je een recept, dan staat onder elk ingrediënt welk product de tracker eraan
koppelde en hoeveel gram dat werd — "Olijfolie · 2 el ≈ 30 g". Wat hij niet kent
staat er in het oranje bij als **niet bekend**.

Tik op een regel om hem aan te vullen of aan te passen. Bij een onbekend
ingrediënt krijg je een leeg formulier; bij een bekend ingrediënt staan de
huidige waarden al ingevuld, zodat je ze kunt bijstellen als je ze niet vindt
kloppen. Je eigen waarde gaat daarna vóór de basislijst.

Dat hoeft maar één keer: de aanvulling hangt aan de naam van het ingrediënt, niet
aan het recept. Zodra je opslaat wordt élk recept opnieuw doorgerekend en
verspringen de badges meteen — de tilde verdwijnt vanzelf.

Zonder ingevuld trackerprofiel blijft de ingrediëntenlijst zoals hij altijd was:
alleen namen en hoeveelheden.

### Een link delen: recept of product

Op `/tracker/import` plak je een link. **De app zoekt zelf uit wat het is:** een
receptpagina wordt per portie doorgerekend, een productpagina van een webshop
levert een product op dat je meteen kunt loggen.

**Android** — deel een pagina rechtstreeks vanuit je browser naar de app; hij
komt binnen op `/tracker/import` en wordt meteen verwerkt. Dat werkt via
`share_target` in het manifest en vereist dat je de app op je beginscherm hebt
gezet.

**iOS** kent `share_target` niet. Twee manieren:

1. **Plakken** — kopieer de link, open `/tracker/import` en tik op de plakknop.
2. **Een Shortcut** — zie hieronder.

De pagina wordt in drie stappen uitgelezen, van exact naar geraden: eerst het
`schema.org`-blok dat veel sites meeleveren, dan de ingrediëntenlijst of de
voedingswaardetabel uit de HTML, en pas als laatste het model op de platte
tekst. Op het scherm staat welke van de drie het geworden is.

#### Een product via een link

Plak de link van een productpagina — bijvoorbeeld van jumbo.com of ah.nl — en de
app leest naam, merk, verpakkingsgrootte en de voedingswaarden per 100 eruit.
Tracking-parameters (`utm_`, `gclid`, `channable` en dergelijke) worden er eerst
afgehaald.

**Staat de streepjescode op de pagina, dan wordt het product meteen bewaard.**
Veel webshops zetten die als `gtin13` in hun productgegevens. Scan je datzelfde
pak later, dan wordt het direct gevonden — importeren via een link vult dezelfde
bibliotheek als handmatig invullen na een mislukte scan.

Prijzen, bonusteksten en aanbevolen dagelijkse hoeveelheden worden genegeerd.
Punten komen altijd uit de eigen formule.

Bij een grote verpakking (500 g of meer) begint het hoeveelheidsveld op 100 in
plaats van op de hele verpakking — een fles van anderhalve liter drink je niet in
één keer leeg. De verpakkingsgrootte blijft als knop beschikbaar.

**De punten komen altijd uit de eigen formule.** Een puntwaarde of calorieënlijst
die op de bronpagina staat wordt nooit overgenomen — daar staat een test op.

#### De iOS-Shortcut instellen

Zet eerst `TRACKER_IMPORT_TOKEN` in je omgeving op een lange, zelfverzonnen
tekst (in Vercel bij Settings → Environment Variables). Maak daarna in de
Opdrachten-app een nieuwe opdracht:

1. **Ontvang** — zet bovenaan "Toon in deelblad" aan, en laat hem URL's ontvangen.
2. **Haal inhoud van URL op** met deze instellingen:
   - URL: `https://<jouw-app>.vercel.app/api/tracker/import`
   - Methode: `POST`
   - Koptekst: `x-tracker-token` met jouw token als waarde
   - Aanvraagtekst: `JSON`, met één veld `url` waarvan de waarde de
     **Opdrachtinvoer** is
3. **Toon resultaat** — zo zie je meteen of het gelukt is.

Geef de opdracht een naam als "Naar tracker". Vanaf dan staat hij in het
deelmenu van Safari, naast alle andere deelopties.

### De eigen basislijst aanvullen

`lib/tracker/basisproducten.ts` bevat een kleine vijftig Nederlandse
basisproducten met hun waarden per 100 g of ml. Één regel erbij is genoeg — de
zoekfunctie pikt hem vanzelf op:

```ts
{ id: "rode-kool", naam: "Rode kool", ook: ["kool"], categorie: "vegetable",
  w: [31, 1.4, 0.2, 0.0, 7.0, 3.8, 2.1], portie: { grams: 150, label: "1 portie" } },
```

De volgorde in `w` is: calorieën, eiwit, vet, verzadigd vet, koolhydraten,
suiker, vezels. Een test controleert dat suiker nooit boven de koolhydraten
uitkomt, verzadigd vet nooit boven het totale vet, en dat de calorieën ruwweg
kloppen met de macro's — tikfouten vallen daardoor meteen om.

Een volledige NEVO-dataset zit er bewust niet in; die mag je zelf aanleveren.

### Inzicht

`/tracker/inzicht` legt je eetpatroon over **twaalf weken** naast elkaar. Geen
losse dag, geen reactie op één uitschieter: elke uitspraak rust op een venster
van 84 dagen.

Het scherm rust op een **feitenlaag** — `lib/tracker/feiten.ts`, één pure functie
`buildFactPack` die het logboek en de wegingen terugrekent tot een plat object
met alleen getallen. Geen conclusies, geen AI. Die scheiding is het hele punt van
de opzet: de feitenlaag is de enige laag die correct móét zijn, en die is daarom
zonder database te testen op geseede data.

Wat er te zien is:

- **Punten per weekdag**, met het aantal gelogde dagen onder elke balk. Een
  gemiddelde zonder dat getal is niet te wegen.
- **Verdeling over de dag** in vijf blokken, als aandeel van de punten — niet van
  het aantal regels, want dan zou een dag met tien kleine dingen zwaarder wegen
  dan een dag met twee grote.
- **Budget en spreiding**: naleving, gemiddelde, mediaan en standaardafwijking.
  De spreiding vertelt vaak meer dan het gemiddelde.
- **Weekbuffer**: hoeveel er per week opgaat en op welk moment van de week.
- **Logboek tegen weegschaal**: wat je inname voorspelt tegenover wat de
  trendlijn laat zien. Loopt de weegschaal achter, dan zit er meestal iets niet
  in het logboek — dat is waar deze vergelijking voor is.
- **Voedingsstoffen per dag** en **waar de punten heen gaan**, de vijftien
  producten die samen het meest gekost hebben.

**Signalen.** Onder "Wat opvalt" staan deterministisch berekende vlaggen, elk met
de cijfers erbij waar hij op rust. Ze zijn bedoeld als hints, niet als
conclusies. Twee ervan — te weinig eten en te snel afvallen — draaien de toon om
en krijgen voorrang boven alle andere.

Drie regels zitten in de code vast:

- **Geen uitspraak zonder bewijslast.** Patroonvlaggen verschijnen pas vanaf
  veertien gelogde dagen. Onder de veertien dagen historie of acht gelogde dagen
  in de laatste twee weken staat er wél een dashboard, maar met de melding
  hoeveel er nog nodig is.
- **Geen prestatiedruk bij weinig loggen.** De module meldt dat de analyse onder
  vijf gelogde dagen per week onbetrouwbaar wordt en houdt het daarbij. Geen
  herinneringen, geen aansporing, en op een leeg of splinternieuw logboek zwijgt
  hij helemaal.
- **Geen waarderende taal.** Nergens staat of een dag goed of slecht was. Er
  staat wat er gemeten is.

Waar de opzet afwijkt van wat er op papier stond: het uitputtingsmoment van de
weekbuffer staat er twee keer in. `avg_exhaustion_day` is de kalenderdag, maar
"vroeg in de week" is alleen te zien ten opzichte van de weegdag — bij een
weegdag op zondag is maandag de tweede dag van de week. Daarom staat de plaats
binnen de trackerweek er als `avg_exhaustion_position` naast, en rust het signaal
op die tweede waarde.

### Advies bij het weegmoment

Bovenaan Inzicht staat één advies. Het komt er niet elke dag bij: de trigger is
je **weging op de weegdag**, en per weging wordt er precies één gegenereerd. Die
grens ligt op de server, niet in het scherm — anders zou herladen elke keer een
modelaanroep kosten.

De opzet is vijf lagen diep, en alleen de derde is AI:

```
[1] feitenlaag      deterministisch, altijd waar
[2] trigger         wanneer er advies mag komen, en hoe vaak
[3] adviesgeneratie het model leest het feitenpakket en interpreteert vrij
[4] validatie       elk getal herleidbaar naar het pakket
[5] evaluatielus    werkte het advies van vorige keer
```

**De bewijslast.** Geen advies onder de veertien dagen historie of acht gelogde
dagen in de laatste twee weken. Het scherm zegt dan wat er nog nodig is.

**Wat het model terugkrijgt.** Het volledige feitenpakket, je profiel zonder je
naam, de laatste drie adviezen met hun uitkomst, en welke trigger dit was. Het
mag vrij interpreteren, maar niet vrij rekenen: alleen getallen die letterlijk in
het pakket staan, elk met de sleutel waar het vandaan komt.

**De validatielaag** loopt daarna alles na, server-side, vóór opslaan:

1. Elke sleutel in `facts_used` moet in het feitenpakket bestaan.
2. `metric_key` moet bestaan en een getal zijn — zonder meetbare actie is het
   advies niet te evalueren en hoort het er niet te zijn.
3. Verboden taal wordt geweigerd. Woorden die van eten of van jou een morele
   categorie maken: zondigen, cheatmeal, verdienen, slecht, braaf, falen,
   discipline, wilskracht. Op stam gematcht, want de vervoeging doet er niet toe.
   `slechts` is uitgezonderd; dat is een telwoord.
4. **De guardrail staat in code, niet alleen in de prompt.** Ligt je inname
   structureel onder je budget, of gaat de afname sneller dan bedoeld, dan wordt
   een actie die de inname omlaag stuurt geweigerd — ook als het model hem
   voorstelt. Een guardrail die alleen in een instructie staat is geen guardrail.
5. Getallen uit de tekst die nergens op terug te voeren zijn maken het advies
   **ongeverifieerd**. Het wordt dan wél getoond, met die markering en de
   betreffende getallen erbij. Stilzwijgend accepteren is geen optie, en
   weggooien om één getal ook niet.

Een afgekeurd antwoord gaat één keer terug het gesprek in, mét de reden. Lukt het
dan nog niet, dan komt er geen advies en staat er waarom. Twee pogingen, niet
meer: een derde kost geld en levert zelden iets anders op.

**Kosten.** Eén tot twee modelaanroepen per weegmoment, dus vier tot acht per
maand. Zonder `ANTHROPIC_API_KEY` werkt het advies niet en blijven de cijfers op
Inzicht gewoon staan.

### Werkte het advies van vorige keer

Elk advies heeft een meetwaarde, een richting, een doelwaarde en een horizon.
Daarmee is het te evalueren, en dat gebeurt ook — anders is een advies
entertainment.

De meting loopt vanaf de dag van uitgifte tot en met de horizon, of tot vandaag
als die nog loopt. Nadrukkelijk niet terug vanaf vandaag: een advies van acht
weken geleden meten over de laatste twee weken zegt niets over wat dat advies
heeft gedaan.

De uitslag komt uit dezelfde `buildFactPack` als het pakket bij uitgifte, alleen
over een korter venster. Dat is geen detail. Zou de meting bij uitgifte anders
werken dan bij evaluatie, dan meet je het verschil tussen twee formules in plaats
van tussen twee weken.

| Uitkomst | Wanneer |
|---|---|
| verbeterd | minstens de helft van de weg naar de doelwaarde afgelegd |
| deels | tussen een tiende en de helft |
| ongewijzigd | minder dan een tiende, in welke richting dan ook |
| tegengesteld | de andere kant op bewogen |
| onvoldoende | minder dan 60% van de dagen in die periode gelogd |

Een kleine schommeling telt als *ongewijzigd*, niet als *tegengesteld*: een halve
procent de verkeerde kant op is ruis, geen richting. En *onvoldoende* is een
uitkomst, geen storing — het betekent dat er te weinig gelogd is om iets te
beweren.

De uitslag staat altijd in beeld, ook als die *tegengesteld* is. Dat is
informatie, geen oordeel. Zolang de horizon loopt schuift hij mee; zodra die om
is ligt hij vast en wordt er niet opnieuw gemeten.

**Twee keer stilstand verandert de volgende ronde.** Zijn de laatste twee gemeten
adviezen *ongewijzigd* of *tegengesteld*, dan krijgt het model de instructie om
niet hetzelfde te herhalen, mét de meetwaarden die al geprobeerd zijn. En net als
bij de guardrail staat dat niet alleen in de prompt: de validatielaag weigert
dezelfde meetwaarde met dezelfde of een grotere stap. Een merkbaar kleinere stap
mag wel — het ontwerp noemt "een andere invalshoek óf een kleinere actie", en dat
zijn twee geldige uitwegen.

### Wanneer de module zelf iets meldt

Naast het weegmoment kan de module ook uit zichzelf iets melden. Vijf
aanleidingen, in deze volgorde — de twee guardrails gaan voor:

1. de inname ligt structureel onder het dagbudget;
2. de afname gaat sneller dan bedoeld;
3. het trendgewicht is met minstens een procent gestegen;
4. de weekbuffer ging deze week al binnen drie dagen op;
5. er is in de laatste zeven dagen bijna niet gelogd.

Voor de derde stond er "≥1% gestegen over twee opeenvolgende wegingen". Dat is
gelezen als de spanne van twee weegintervallen, dus de trend van nu tegen die van
drie wegingen terug. De trendlijn is een voortschrijdend gemiddelde met factor
0,25; tussen twee lósse trendwaarden een procent stijgen zou bij 90 kg een sprong
van 3,6 kg op de weegschaal vragen, en die drempel gaat dus nooit af. Over twee
intervallen is het wél een signaal: bijna een kilo omhoog in twee weken.

**Drie dempingsregels, alle drie afgedwongen in code:**

- hooguit één afwijkingsmelding per tien dagen;
- nooit binnen twee etmalen na een advies bij het weegmoment;
- dezelfde aanleiding niet twee keer binnen dertig dagen.

Dat is geen kosmetiek. Frequente gewichts- en intakemonitoring hangt samen met
een verhoogde kans op maaltijden overslaan en overmatig bewegen; een module die
op elke overschrijding reageert bouwt dat mechanisme actief in. Een test loopt
dertig dagen aan onafgebroken aanleidingen door en komt op één melding uit als
het steeds dezelfde is, en op hooguit drie als ze wisselen.

**Het kanaal** is een banner op `/tracker` en een stip op de Inzicht-navigatie.
Geen push-notificaties: die zijn op iOS onbetrouwbaar en verhogen de meldingsdruk
zonder aantoonbare winst. De banner leest beschrijvend — er staat wat er is, niet
wat je zou moeten doen — en verdwijnt zodra je Inzicht hebt geopend.

De melding-route rekent zelf niets uit en kost dus nooit een modelaanroep; het
advies wordt pas gemaakt als je Inzicht opent.

### Zelf om een analyse vragen

Onder het advies staat **Analyseer mijn patroon**. Die knop kent geen limiet en
geen dempingsregels: die gelden voor wat de module uit zichzelf meldt, niet voor
wat je zelf komt vragen. Wel kost elke druk een modelaanroep, dus er zit geen
automatische herhaling op.

Het feitenpakket komt uit de cache zolang er sinds de vorige analyse niets nieuws
gelogd is — het doorrekenen van twaalf weken kost dan niets meer.

Een advies op verzoek verbruikt je weegmoment niet en zet de cooldown niet aan
het werk. Die twee staan er los van.

### De adviesgeschiedenis

Onderaan Inzicht staat de tijdlijn: elk advies dat ooit is uitgegeven, nieuwste
eerst, met waar het vandaan kwam, welke actie eraan hing en wat de meting
opleverde. Vijf tegelijk, met een knop om alles te tonen.

Adviezen worden nooit gewist. Dat is precies waarom deze lijst er is: pas over
meerdere adviezen heen is te zien of er iets beweegt, of dat dezelfde invalshoek
steeds opnieuw langskomt.

Elke uitkomst staat er zoals hij gemeten is, ook "de andere kant op". Geen rood,
geen kruisje, geen toon — het is informatie, geen oordeel.

### Wat er niet in zit

Drie keuzes uit het ontwerp staan nog open:

- De energiebalans staat alleen op Inzicht, niet op het dagoverzicht.
- Er is geen export van de adviesgeschiedenis.
- Recepten uit je kookboek mogen wél onderdeel van een actie zijn — de
  systeeminstructie noemt ze als een van de dingen die binnen de app uitvoerbaar
  zijn — maar de module stelt geen concreet recept voor. Dat zou een tweede
  opzoekstap in de aanroep vragen.

### Opslag

Alle keys van de tracker staan onder de prefix `wl:`, volledig gescheiden van de
kookboek-keys:

- `wl:profile` — profiel en het berekende dagbudget.
- `wl:day:<YYYY-MM-DD>` — één dag: alle regels plus de opgetelde totalen.
- `wl:day:index` — sorted set met de dagen waarop iets gelogd is. Lege dagen staan
  er niet in, zodat ze straks buiten de weekgemiddelden vallen.
- `wl:favorites` — je bewaarde favorieten.
- `wl:recent` — de laatste 50 gelogde items, voor snelle herinvoer.
- `wl:food:<barcode>` — gescande producten uit een externe bron, 90 dagen
  houdbaar. Hierdoor werkt een barcode die je vaker scant ook zonder netwerk.
- `wl:eigen:<barcode>` — producten die je zelf hebt ingevuld nadat een scan
  niets opleverde. Zonder vervaltermijn: dit is jouw invoer, geen andermans
  cache.
- `wl:ingredienten` — je eigen ingrediëntenlijst voor recepten, met een
  revisienummer waarmee doorgerekende recepten vervallen.
- `wl:weight:log` — sorted set met al je wegingen.
- `wl:weight:<datum>` — een losse weging met eventuele notitie.
- `wl:meals` — je vaste, samengestelde maaltijden.
- `wl:recipe:points:<id>` — een doorgerekend kookboekrecept, met de
  vingerafdruk waarmee de cache vervalt.
- `wl:facts:<YYYY-Www>` — het gecachete feitenpakket van Inzicht, acht dagen
  houdbaar, met de vingerafdruk waarmee het vervalt zodra je iets logt.
- `wl:advice:<id>` — een uitgegeven advies, met de validatie-uitslag erbij.
  Wordt nooit verwijderd: de historie is het interessantste deel van de module.
- `wl:advice:index` — sorted set met alle adviezen, score is het tijdstip.
- `wl:advice:active` — het id van het lopende advies.
- `wl:advice:cooldown` — wanneer er voor het laatst een afwijkingsmelding was en
  waarover. Zonder dit geheugen zou de module op elke overschrijding reageren.
- `wl:advice:seen` — het id van het advies dat je al bekeken hebt; bepaalt of de
  melding op `/tracker` nog staat.

De adviesgeschiedenis wordt nooit opgeschoond. Met hooguit een paar adviezen per
maand blijft dat jarenlang een lijst van tientallen.

Twee dingen worden bewust **niet** opgeslagen maar telkens opnieuw berekend:

- Het **bufferverbruik** volgt uit de dagen zelf, niet uit een aparte weekkey.
  Zo kan het nooit uit de pas gaan lopen met je logboek.
- De **trendwaarde** hangt van de hele reeks wegingen af. Corrigeer je een oude
  weging, dan kloppen alle latere waarden meteen weer; een opgeslagen trend zou
  stil verouderen.

### Tests

De puntenformule en de budgetberekening zijn puur rekenwerk zonder database, en
staan onder test:

```bash
npm test
```

Dat draait de ingebouwde testrunner van Node — geen extra pakketten nodig. De
testset legt onder meer vast dat kipfilet 1 punt is, broccoli 0 en een koekje 6,
dat het budget nooit onder het basaal metabolisme zakt, en dat het dagtotaal op
de onafgeronde waarden wordt gerekend.

De feitenlaag van Inzicht staat er met geseede data in: de zes scenario's uit het
ontwerp (weekendpatroon, verborgen gat, plateau, te weinig, te snel, te weinig
data) hebben elk hun eigen test, plus een test die vastlegt dat de laag puur is
en een die de twaalf weken binnen een halve seconde doorrekent.

De adviesmodule staat er ook in, zonder dat er een API-sleutel aan te pas komt:
het uitlezen van een antwoord met markdown-fences eromheen, elk verboden woord
apart, de guardrail die een actie omlaag weigert maar dezelfde actie omhoog
toelaat, een getal dat nergens op terug te voeren is, en een geforceerde
prompt-injectie in een productnaam. De evaluatielus komt er met alle vijf
de uitkomsten in, plus de regel dat een vastgelopen invalshoek niet herhaald mag
worden zonder kleinere stap.

### Over de grafieken

De grafieken zijn met de hand geschreven SVG, zonder grafiekbibliotheek.
Twee keuzes zijn bewust:

- **"Over budget" heeft een eigen, donkerder tint** (`--over`). De lichtere
  `--gold` haalde op een witte kaart maar 2:1 contrast, te weinig voor precies
  de balk die je moet opvallen. De gekozen tint haalt ruim 3:1 en blijft ook
  voor kleurenblinde lezers goed van het accent te onderscheiden.
- **Verschil zit nooit alleen in kleur.** In de trendgrafiek verschillen de twee
  reeksen ook van vorm (punten tegen lijn); in het staafdiagram staat bij een dag
  boven budget het getal erbij. De verdeling over de dag in Inzicht gebruikt
  één kleurverloop van licht naar donker — de blokken zijn geordend, dus hoort
  daar geen palet van losse kleuren bij — en zet elk percentage ook in de
  legenda.

### Over de Anthropic API

De foto-schatting en de laatste stap van de link-import gebruiken de Anthropic
API, net als de foto- en link-import van het kookboek. Ze draaien op hetzelfde
model als de rest van de app.

De SDK-versie in dit project (0.32) kent nog geen structured outputs. De JSON
wordt daarom afgedwongen via de systeeminstructie en daarna defensief gelezen:
markdown-fences eromheen, tekst ervoor of erna, ontbrekende velden, negatieve
getallen en onbekende categorieën worden allemaal opgevangen. Wil je het
strakker, dan is een nieuwere SDK met `output_config` de weg — dat raakt ook de
drie bestaande aanroepen in het kookboek.

---

## Hoe de data is opgeslagen (voor later)

In Upstash Redis:

- `recipe:<id>` — één recept als JSON.
- `recipes:index` — een set met alle recept-id's.
- `week:current` — de weekplanning (startdag + gekozen gerechten per dag).
- `wl:*` — alles van de tracker (zie het hoofdstuk hierboven). Bewust een eigen
  prefix, zodat kookboek en tracker elkaars data nooit kunnen raken.

Één database = één huishouden. Wil je later meerdere gezinnen of gebruikers, dan zet
je een `userId:`-prefix voor de keys in `lib/data.ts`. De rest van de app blijft gelijk.

## Projectstructuur

```
app/
  page.tsx              Hoofdpagina
  layout.tsx            App-shell
  globals.css           Stijl + kleurpalet (CSS-variabelen)
  api/
    recipes/route.ts        GET alle / POST nieuw recept
    recipes/[id]/route.ts   PUT / DELETE per recept
    week/route.ts           GET / PUT weekplanning
    import/route.ts         Foto- en link-import via Anthropic API
    tracker/profiel/route.ts      GET / PUT profiel + berekend budget
    tracker/dag/[datum]/route.ts  GET dag, POST / PATCH / DELETE een regel
    tracker/zoeken/route.ts       Zoeken in basislijst + Open Food Facts
    tracker/barcode/[code]/route.ts  Streepjescode opzoeken, met cache
    tracker/favorieten/route.ts   Favorieten en recent gelogde items
    tracker/gewicht/route.ts      Wegingen, trendlijn en voortgang
    tracker/week/route.ts         Weeksamenvatting en bufferverbruik
    tracker/maaltijden/route.ts   Vaste, samengestelde maaltijden
    tracker/recepten/route.ts     Receptenlijst uit het kookboek
    tracker/recepten/[id]/route.ts  Eén recept doorgerekend, met cache
    tracker/recepten/punten/route.ts Punten van alle recepten in één keer
    tracker/ingredienten/route.ts    Eigen ingrediëntenlijst beheren
    tracker/ingredienten/schat/route.ts  Voedingswaarden laten schatten
    tracker/ingredienten/schat-alles/route.ts  Een heel recept in een keer
    tracker/dagmenu/route.ts      Dagmenu uit de weekplanner in het logboek
    tracker/beweging/route.ts     Bewegingsactiviteiten en hun punten
    tracker/foto/route.ts         Foto-schatting via de Anthropic API
    tracker/import/route.ts       Receptlink ophalen en doorrekenen
  tracker/              De trackerschermen (dag, toevoegen, instellingen)
components/
  KookboekApp.tsx       De volledige UI van het kookboek (client-component)
  Werkinstructie.tsx    De werkinstructie achter het info-knopje; gedeeld door
                        het kookboek en de tracker
  tracker/
    TrackerApp.tsx      Shell van de tracker: navigatie, laden, opslaan
    Dagoverzicht.tsx    Puntenring, eiwitbalk, regels per maaltijd
    Toevoegen.tsx       Keuze tussen snel, zoeken, scannen en handmatig
    Snel.tsx            Favorieten en recent gelogde items
    Zoeken.tsx          Zoeken met punten per 100 g en per portie
    Scanner.tsx         Barcode scannen, met terugval voor iOS
    Handmatig.tsx       Handmatige invoer met live punten
    Portiekiezer.tsx    Hoeveelheid en maaltijd kiezen bij een product
    Gewicht.tsx         Wegen, trendgewicht en voortgang
    Trendgrafiek.tsx    Metingen en voortschrijdend gemiddelde (SVG)
    Weekoverzicht.tsx   Week, buffer, gemiddelde en voedingsstoffen
    Weekbalken.tsx      Punten per dag tegen de budgetlijn (SVG)
    Maaltijdbouwer.tsx  Een vaste maaltijd samenstellen uit onderdelen
    Recepten.tsx        Kookboekrecepten met punten per portie
    Onderdeelkiezer.tsx Favorieten, recent en zoeken bij het samenstellen
    Aanvullen.tsx       Ingrediënt van waarden voorzien (ook in het kookboek)
    Beweging.tsx        Activiteit loggen, met het dagplafond
    Foto.tsx            Foto-schatting als bewerkbaar concept
    Import.tsx          Gedeelde receptlink doorrekenen
    Instellingen.tsx    Profiel met live budgetberekening
    Ring.tsx            De puntenring (SVG)
    stijl.ts            Inline stijlen, bovenop de CSS-variabelen
    api.ts              Fetch-helpers voor de tracker-endpoints
lib/
  redis.ts              Upstash-client
  types.ts              Types en vaste keuzelijsten
  data.ts               Alle databasebewerkingen op één plek
  tracker/
    types.ts            Datamodel van de tracker
    points.ts           De puntenformule
    budget.ts           Basaal metabolisme, tempo en dagbudget
    off.ts              Open Food Facts: omzetting naar ons formaat
    basisproducten.ts   Eigen lijst met NL-basisproducten
    gewicht.ts          Trendlijn, voortgang en tempo
    week.ts             Weekgrenzen, weekbuffer en samenvatting
    maaltijd.ts         Onderdelen optellen en schalen
    recept.ts           Ingredienten omrekenen, matchen en doorrekenen
    activiteit.ts       MET-tabel, verbranding en het dagplafond
    foto.ts             Het antwoord van de foto-schatting uitlezen
    link.ts             Recept uit een webpagina halen
    winkels.ts          Productgegevens van AH en Jumbo
    productlink.ts      Een product uit een webshoppagina halen
    ingredienten.ts     Eigen ingrediëntenlijst, op genormaliseerde naam
    ingredienten-opslag.ts  Die lijst bewaren onder wl:ingredienten
    schatting.ts        Een geschat ingrediënt uitlezen en melden
    schat-model.ts      De modelaanroep achter het schatten
    datum.ts            Datum- en getalhulpjes (ook bruikbaar in de browser)
    data.ts             Redis-bewerkingen onder de prefix wl:
    *.test.ts           Unit tests (npm test)
scripts/
  seed.mjs              Voorbeeldrecepten inladen
```

## Veelgestelde problemen

- **"ANTHROPIC_API_KEY ontbreekt" bij foto/link-import** → de key is niet ingesteld.
  Vul hem in `.env.local` (lokaal) of bij Vercel Environment Variables in en deploy
  opnieuw. Handmatig invoeren blijft altijd werken.
- **Lege lijst na deploy** → normaal: de database is nog leeg. Voeg een recept toe of
  draai het seed-script.
- **Camera opent niet lokaal** → gebruik de Vercel-URL (https), daar werkt de camera
  op telefoons zonder gedoe.
