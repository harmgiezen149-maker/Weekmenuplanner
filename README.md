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

#### Maten

De maattabel kent lepels, kopjes, verpakkingen en de Nederlandse gewichtsmaten
(ons, pond). Eenheden worden eerst genormaliseerd — kleine letters, geen punten,
geen meervoud — zodat `E.L.`, `eetlepels` en `el` allemaal dezelfde maat vinden.
Het receptformulier stelt de gangbare maten voor, maar dwingt niets af: een
import levert vrije tekst en die moet gewoon door kunnen.

**Een maat die niet herkend wordt, telt niet mee.** Vroeger viel zo'n maat terug
op 100 g per stuk, en dat liep flink mis: `2 koffielepel olijfolie` werd 200 g
olie en leverde 19,5 punten op waar er 0,6 hoort te staan — vier vijfde van een
recepttotaal, uit een getal dat nergens op sloeg. Nu blijft dat ingrediënt buiten
de telling en staat er bij welke maat niet gelezen kon worden.

Bij **stuks** ligt dat anders. Daar is 100 g een verdedigbare aanname: een stuk
groente of fruit zit meestal binnen een factor drie daarvan, terwijl een lepel er
twintig keer naast zat. Beter is het om het echte gewicht in te vullen — dat kan
per ingrediënt bij *Gewicht per stuk*, en daarna geldt het voor elk recept waar
het in zit.

De rekenregels hebben een eigen versienummer (`REKENVERSIE`) dat meetelt in de
vingerafdruk van een recept. Verbetert de omrekening, dan verschuift die
vingerafdruk en wordt elk recept opnieuw doorgerekend. Zonder dat houdt een al
doorgerekend recept zijn oude uitkomst, ook als die inmiddels fout is — de code
klopt dan wel, de cache niet.

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

#### Wat elk ingrediënt bijdraagt

Achter elk herkend ingrediënt staat hoeveel punten het bijdraagt aan één
portie — de opgegeven hoeveelheid, gedeeld door het aantal personen van het
recept. Onder de lijst staat de optelling.

Die uitsplitsing komt uit dezelfde `matchNaarComponent` als de puntentelling
zelf en wordt bij het uitlezen berekend, niet mee gecachet. Zo kan hij niet uit
de pas lopen met het totaal, en blijven bestaande gecachete recepten bruikbaar.
Een test legt vast dat de bijdragen exact optellen tot het totaal per portie —
zonder die gelijkheid is de uitsplitsing als controlemiddel waardeloos.

Een bijdrage kan onder nul uitkomen bij iets wat vooral vezels levert; die wordt
niet afgekapt, want juist zo'n regel verklaart een laag totaal. Afkappen op nul
gebeurt pas bij het recepttotaal. Er zit geen kleurcodering op hoog of laag: dat
zou een oordeel over eten worden, en dat hoort hier niet.

Hiermee is een totaal dat er raar uitziet na te lopen. De twee dingen die je dan
meestal ziet: een ingrediënt dat aan het verkeerde product hangt, of een
hoeveelheid die anders is omgerekend dan je dacht — beide staan op dezelfde
regel.

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

## Inloggen, personen en back-up

### Het slot op de deur

Alles gaat langs `middleware.ts`. Dat is één plek waar wordt bepaald of iemand
binnen mag — pagina's én API-routes — in plaats van dertig routes die het elk
apart moeten onthouden. Vergeet je er daar één, dan staat je gewicht open op het
internet; hier kán dat niet gebeuren.

Open zonder inlog zijn alleen: `/login`, `/api/auth/login`, `/api/auth/logout`,
`/api/auth/status`, `/api/auth/inrichten`, het manifest en de app-iconen. Ook
`/api/tracker/import` komt erlangs zodra er een geldige `x-tracker-token`
meekomt, want de iOS-Shortcut werkt buiten de browsersessie om.

Wie er is ingelogd gaat als header `x-kb-persoon` mee naar beneden. Die header
wordt eerst weggegooid en dan pas gezet, zodat een browser hem niet zelf kan
meesturen en zich zo voor iemand anders kan uitgeven.

### Wachtwoorden en sessies

Wachtwoorden staan als scrypt-regel in Redis (`lib/auth.ts`): met opzet traag en
geheugenzwaar, met een eigen zout per regel, en met de rekenkosten in de regel
zelf zodat ze later omhoog kunnen zonder bestaande wachtwoorden onleesbaar te
maken. Vergelijken gebeurt tijdsonafhankelijk. Bij een onbekende gebruikersnaam
wordt tóch een wachtwoord doorgerekend, anders is aan de reactietijd af te lezen
welke namen bestaan.

Een sessie is een ondoorzichtige willekeurige sleutel van 32 bytes in
`auth:sessie:<token>`, negentig dagen houdbaar, in een `httpOnly`-cookie. In de
sleutel zit geen informatie; wie erbij hoort staat in Redis. Daardoor is
uitloggen echt uitloggen: de rij verdwijnt en de sleutel is meteen waardeloos.

`lib/sessie.ts` staat los van `lib/auth.ts` omdat het ook in de Edge-omgeving van
middleware draait en daar niets uit `node:crypto` mag gebruiken.

### Wat is gedeeld en wat is persoonlijk

- **Gedeeld** (van het huishouden): recepten, weekmenu, boodschappenlijst,
  voorraad, het eetdagboek, favorieten, samengestelde maaltijden, de
  ingrediëntenlijst en de productcaches. Samen koken werkt alleen met één
  kookboek.
- **Persoonlijk** (van één mens, onder `wl:p:<persoon>:`): het profiel, de
  weeglijst, het feitenpakket van Inzicht en de adviezen. Dit gaat over één
  lichaam; een gedeelde weeglijst zou onzin opleveren.

Het eetdagboek is een bewuste keuze en de discutabele van de twee: bij twee
gebruikers komen beider regels op dezelfde dag terecht, terwijl het dagbudget
persoonlijk is. Verplaatsen is één regel werk — haal `DAY` en `DAY_INDEX` in
`lib/tracker/data.ts` naar het persoonlijke blok en ze lopen automatisch mee met
de ingelogde persoon.

Persoonlijke sleutels lopen via `persoonlijk()` in `lib/persoon.ts`, dat het id
uit de header haalt. Daardoor hoefde geen enkele aanroeper te veranderen:
`getProfile()` bleef `getProfile()`.

### Het eerste account en de verhuizing

Is er nog geen account, dan stuurt elke pagina je naar `/login` met een
inrichtscherm. Bij dat allereerste account verhuizen de gegevens mee die er al
stonden — profiel, weeglijst, adviezen — van `wl:...` naar `wl:p:<id>:...`
(`lib/migratie.ts`). Er wordt gekopieerd, niet verplaatst: de oude sleutels
blijven als vangnet staan. Daarna weigert `/api/auth/inrichten`; nieuwe personen
lopen via `/api/auth/gebruikers` en dus langs een inlog.

### Back-up

`GET /api/backup` levert één JSON-bestand met alles wat je zelf hebt ingevoerd.
Het bestand is beschrijvend, niet letterlijk: er staan recepten, dagen en
wegingen in, geen Redis-sleutels en geen scores. Dat maakt het leesbaar, bestand
tegen een wijziging in de sleutelindeling, en terugzetten een kwestie van
opnieuw opbouwen.

Er gaan geen caches in (productcache, doorgerekende recepten, feitenpakket) en
geen accounts of wachtwoorden — een wachtwoordregel hoort niet in een bestand dat
in je downloadmap belandt.

`POST /api/backup` zet terug, vervangend en niet aanvullend: wat in de app staat
en niet in het bestand, verdwijnt. Een half samengevoegde toestand is erger dan
de toestand waar je vandaan kwam, want dan weet je van geen enkel recept meer of
het de nieuwe of de oude versie is. De route eist `bevestigd: true` — dit is de
enige route in de app die met één aanroep alles kan wissen.

De pure kant (welke velden erin horen, wat een geldig bestand is) staat in
`lib/backup-formaat.ts` met tests ernaast; `lib/backup.ts` doet het Redis-werk.

---

## Meldingen en offline werken

### De service worker

`public/sw.js` doet twee dingen en verder niets. Er wordt met opzet niet
geprobeerd de hele app offline te laten werken: recepten toevoegen, punten
berekenen en advies vragen kunnen niet zonder server, en een app die half werkt
zonder te zeggen wat er niet werkt is verwarrender dan een app die eerlijk zegt
dat hij geen verbinding heeft.

1. **De boodschappenlijst blijft werken in een winkel met slecht bereik.** Van
   elke geslaagde `GET` op `/api/boodschappen`, `/api/voorraad`,
   `/api/gebiedvolgorde` en `/api/week` wordt een kopie bewaard, met een
   `x-kb-bewaard-op`-kop erbij. Valt het netwerk weg, dan komt die kopie
   tevoorschijn. Bestanden onder `/_next/static/` dragen een hash in hun naam en
   komen zonder meer uit de kopie; paginanavigaties zijn netwerk-eerst met de
   kopie als terugval. Een doorstuur naar het loginscherm wordt nooit onder de
   oorspronkelijke pagina bewaard — offline zou je anders het loginscherm zien
   op de plek van je boodschappenlijst.
2. **Pushmeldingen tonen**, en op een tik de juiste pagina openen in het venster
   dat al openstaat.

Bij uitloggen worden alle bewaarde kopieën van dat apparaat gewist.

### Afvinken zonder bereik

De boodschappenlijst sloeg wijzigingen al met een vertraging van 350 ms op. Wat
er nu bij komt: mislukt dat, dan blijft de wijziging openstaan en wordt hij
opnieuw geprobeerd — bij het `online`-signaal van de browser én elke vijftien
seconden, want bij een wankele verbinding blijft dat signaal vaker uit dan je
zou denken. Zolang er iets openstaat verschijnt er een balkje boven de lijst.
Wat op het scherm staat is ondertussen leidend, dus je kunt gewoon doorwerken.

`api.saveBoodschappen` gooit nu ook een fout bij een antwoord dat niet `ok` is.
Zonder dat nam de lijst een foutobject over als nieuwe serverstand.

### Pushmeldingen

Twee soorten, allebei apart aan of uit te zetten, allebei standaard uit:

- **Weegdag** — op je weegdag, als er nog geen weging staat.
- **Dagboek** — aan het eind van de dag, als je nog niets hebt gelogd. Blijft
  weg als je een week lang niets logt: dat is geen vergeetachtigheid meer maar
  een pauze, en daar hoort de app zich niet dagelijks in te mengen.

De teksten volgen dezelfde regel als de adviesmodule: er staat wat er is, niet
wat je zou moeten doen. Een test legt dat vast — geen uitroeptekens, geen
"vergeet niet", geen oordeel.

Het besluit óf er een melding uitgaat staat in `lib/tracker/herinnering.ts`,
puur en getest. Die functie geeft `null` terug zodra er ook maar één reden is om
te zwijgen: een gemiste herinnering merk je nauwelijks, een overbodige melding
op je telefoon wel.

### Het sleutelpaar

Web Push heeft een VAPID-sleutelpaar nodig. Dat wordt bij de eerste aanvraag
aangemaakt en in Redis bewaard onder `auth:vapid`, niet als omgevingsvariabele.
Dat scheelt een handmatige instelstap bij het live zetten, en de database bewaart
toch al wachtwoordregels en sessies. Het schrijven gaat met `NX`, zodat twee
gelijktijdige eerste aanvragen niet ieder een eigen paar maken.

Abonnementen staan per persoon onder `wl:p:<id>:push`. Een abonnement waarvan de
pushdienst zegt dat het niet meer bestaat (404 of 410) wordt opgeruimd; andere
fouten laten het staan, want een tijdelijke storing hoort je meldingen niet op te
zeggen. Die fouten worden wél teruggegeven en zijn zichtbaar via de knop
"Proefmelding sturen" — stil falen is hier het ergste wat kan gebeuren.

### De dagelijkse taak

`vercel.json` plant twee taken: `?soort=weegdag` om 06:00 UTC en
`?soort=logboek` om 18:00 UTC. Op het gratis abonnement van Vercel mag zo'n taak
één keer per dag draaien en kan hij tot een uur later uitkomen dan gepland —
daarom noemt geen enkele meldingstekst een tijdstip.

De taak is onschadelijk als hij vaker draait: hij verstuurt hooguit één melding
per soort per persoon per dag, en dat geheugen staat in
`wl:p:<id>:melding:laatst` (twee dagen houdbaar). Dat is hier ook de
beveiliging; staat `CRON_SECRET` ingesteld in Vercel, dan wordt die
daarbovenop gecontroleerd.

De taak draait zonder browser en dus zonder sessie. Om tóch de gewone datalaag
te kunnen gebruiken is er `metPersoon(id, ...)` in `lib/persoon.ts`: binnen dat
blokje kijkt `huidigePersoon()` naar dat id in plaats van naar de header. Het id
leeft alleen binnen de callback, dus een route die dit niet aanroept kan er nooit
per ongeluk in terechtkomen.

### Wat je op je telefoon moet doen

Op Android werkt het zodra je meldingen aanzet. Op een iPhone werkt Web Push
alleen als de app via Safari op het beginscherm staat — in een gewoon
browsertabblad biedt iOS het niet aan. Het instellingenscherm zegt dat ook.

---

## Voorraad vullen met een foto, en wat het kost

### Een kassabon lezen

Onder *Voorraad → Vullen met een foto* fotografeer je een kassabon. Het model
leest hem uit en geeft een **voorstel** terug: alles staat met een vinkje klaar
en de naam is aan te passen voor je op toevoegen drukt. Dat is geen
beleefdheidsstap — bij een bon van dertig regels valt één verkeerd gelezen regel
niet op, en die zou anders ongemerkt in je voorraad én je prijsboek belanden.

Het model wordt gevraagd de kassa-afkorting terug te brengen tot een gewone
Nederlandse naam ("AH BASIS H-MELK 1L" wordt "halfvolle melk") en alles wat geen
product is weg te laten. Daar staat in `lib/bon.ts` een tweede zeef achter, want
één gemiste regel zou als "TOTAAL" in je voorraad staan. Die zeef toetst op
woordgrens, zodat "bonbons" niet sneuvelt op "bon" en "totaalbrood" niet op
"totaal".

Dezelfde knop leest ook een foto van losse producten, voor wat je in huis hebt
maar niet op een bon staat.

Een naam die al in je voorraad staat wordt niet nog een keer toegevoegd maar
opgehoogd. De vergelijking gaat op de naam zonder hoofdletters en spaties, want
zo typ je hem de tweede keer zelden precies hetzelfde.

### Het prijsboek

Wat je betaald hebt wordt onthouden per product, in `prijzen:boek`. De naam gaat
eerst door `prijsSleutel()`, die merk en verpakkingsaanduiding eraf haalt: "AH
Halfvolle melk 1L", "halfvolle melk" en "Melk halfvol" treffen dezelfde regel.
Een nieuwere prijs vervangt een oudere, maar een oudere nooit een nieuwere — een
oude bon nascannen hoort de actuele prijs niet terug te draaien.

Onder aan je boodschappenlijst staat wat hij ongeveer gaat kosten. "Ongeveer" is
daar geen slag om de arm maar de kern: er staat altijd bij hoeveel items géén
bekende prijs hebben, en hoeveel prijzen ouder zijn dan vier maanden. Een raming
die stiekem een gemiddelde invult voor onbekende items ziet er nauwkeuriger uit
dan hij is.

Prijzen gaan pas het boek in nadat jij de regels hebt nagekeken — het lezen
(`POST /api/bon`) en het opnemen (`PUT /api/bon`) zijn daarom gescheiden. Een
misgelezen prijs zou anders maandenlang je ramingen scheeftrekken.

### Aantallen in de voorraad

Een voorraadartikel kan nu een aantal en een eenheid hebben, met een drempel
waaronder het "bijna op" heet. Alle drie optioneel: artikelen van voor deze
uitbreiding hebben ze niet, en een voorraadlijst waar overal een geraden 0 bij
staat is erger dan geen aantallen. Pas als je op "tel mee" drukt gaat de app
erover praten.

### Wat hier nog niet zit

Streepjescodes scannen om voorraad toe te voegen (optie 3.3 uit de optielijst)
is niet gebouwd. De scanner bestaat al aan de trackerkant
(`components/tracker/Scanner.tsx`); hem naar het kookboek halen is het werk dat
nog openstaat.

---

## Beweging uit je horloge

### Waarom niet gewoon Garmin

Garmin heeft geen koppeling voor particulieren: hun API vereist een
rechtspersoon en een aanvraagprocedure. Strava's Standard-tier is sinds 30 juni
2026 betaald (ongeveer €12 per maand). De Google Fit API is uitgezet, en de
opvolger (Google Health API) bedient Fitbit en Pixel Watch, niet Garmin. Health
Connect is Android-only en werkt alleen op het toestel zelf.

Wat wél gratis kan: Garmin Connect schrijft naar Health Connect, een Tasker-
plug-in leest daaruit, en Tasker doet een HTTP POST naar deze app. Eenmalig
priegelen, daarna vanzelf. Daarnaast is er de weg die altijd werkt: een lijst
kopiëren uit Garmin Connect en die plakken.

### De sleutel

`POST /api/tracker/beweging/extern` is de enige route in de app die zonder
sessie bereikbaar is én gegevens wegschrijft. Daarom een eigen sleutel per
persoon, die alleen dit ene kan.

De sleutel staat leesbaar in Redis (`wl:p:<id>:koppelsleutel`, met
`auth:koppel:<sleutel>` als omgekeerde opzoeking). Dat is bewust anders dan bij
wachtwoorden: je moet hem in Tasker kunnen overtypen, ook een maand later, en
een hash zou hem na één keer tonen onleesbaar maken. Wat hij kan is beperkt tot
één handeling, en "nieuwe sleutel maken" trekt de oude op datzelfde moment in.

Sleutels gaan niet mee in de back-up — het is een toegangsmiddel, en die horen
niet in een bestand dat in je downloadmap belandt.

### Niet twee keer boeken

Tasker vuurt bij een wankele verbinding zonder blikken of blozen drie keer, en
drie keer dezelfde hardloopsessie verruimt je budget met punten die je niet hebt
verdiend. Elke binnengekomen training laat daarom een merkje achter in
`wl:p:<id>:extern:<id>` (90 dagen), geschreven met `NX` zodat twee gelijktijdige
aanroepen niet allebei denken dat zij de eerste zijn. Loopt het opslaan daarna
alsnog mis, dan gaat het merkje weer weg — anders zou die training voorgoed
overgeslagen zijn.

Stuurt de bron geen eigen id mee, dan wordt er een gemaakt uit datum, soort en
duur. Niet waterdicht (twee identieke wandelingen op één dag tellen dan als
één), wel beter dan elke herhaling dubbel boeken.

### Namen herkennen

`herkenSoort()` brengt namen als `RUNNING`, `MOUNTAIN_BIKING` en
`strength_training` terug tot de acht soorten die de app kent. Dat gaat op hele
woorden, niet op substrings: "hardlopen" bevat "lopen", en een losse
substring-treffer boekte een hardloopsessie daardoor als wandelen. Er wordt
gezocht op aaneengesloten reeksen woorden, de langste eerst, zodat namen van
twee woorden ook werken.

Geen treffer betekent geen activiteit. Liever een afgewezen regel dan punten
onder een verkeerde noemer — die vind je later niet meer terug.

### De verbranding van het horloge telt niet mee

Een `kcal` of `calories` die meekomt wordt genegeerd. De app rekent zelf uit
MET, gewicht en basaal metabolisme, met de rustverbranding eraf en een plafond
van zes punten per dag. Een externe schatting zou precies om die twee dempers
heen lopen, en horloges schatten structureel te hoog.

### Een lijst plakken

`POST /api/tracker/beweging/plakken` leest een geplakte lijst — bewust zonder
model. Het formaat is regelmatig genoeg om zelf te lezen, het kost dan niets,
het werkt zonder API-sleutel, en het is te testen. Herkent `45:12`, `1:05:00`,
`90 min`, `1u30`, en datums in ISO- en Nederlandse notatie. Wat niet herkend
wordt komt terug als afgewezen regel, niet als gok.

Aparte route van `/extern`, en niet dezelfde met een andere methode: die route
staat bewust open voor je horloge, en een route die half open en half achter de
inlog zit is een route waarvan niemand meer weet wat er geldt.

---

## Droog of gekookt, en welke recepten nog niet kloppen

### De grootste stille fout in de puntentelling

Een recept noteert de zak: "300 g rijst" betekent 300 g uit de zak. Jij logt het
bord: "180 g rijst" is wat je opschept. Rijst wordt bij het koken bijna drie
keer zo zwaar, pasta ruim twee keer. De basislijst kende alleen de gekookte
vorm, dus elk rijst- of pastarecept zat er een factor twee tot drie naast — naar
beneden, en aan het totaal zie je dat niet.

Nu staan beide vormen in de lijst, met een `vorm`-veld erop, en kiest de
zoekfunctie op basis van waar hij voor gebruikt wordt: `matchIngredient()` (de
receptkant) vraagt om `voorkeur: "droog"`, de zoekfunctie in de tracker laat
beide zien en jij kiest. De voorkeur is een bonus van zes punten op de score:
genoeg om een gelijkspel te beslechten, te weinig om een duidelijk betere
naamtreffer te overrulen.

`REKENVERSIE` staat daarom op 3. Die telt mee in de vingerafdruk van een recept,
dus alle gecachete puntentotalen worden opnieuw berekend.

### De basislijst

Van 52 naar 123 producten. Wat erbij is gekomen is wat een Nederlandse
thuiskeuken dagelijks gebruikt en wat tot nu toe buiten de telling viel:
knoflook, prei, champignons, aubergine, tomatenblokjes en tomatenpuree,
kokosmelk en bouillon, room en crème fraîche, mozzarella, feta, parmezaan,
tofu en tempeh, spekblokjes en chorizo, sojasaus en ketjap, bloem en suiker,
cashewnoten en pijnboompitten, wraps en pitabrood.

Waarden zijn per 100 g of 100 ml. Aanvullen blijft één regel werk in
`lib/tracker/basisproducten.ts`; de zoekfunctie pikt hem vanzelf op.

### Welke recepten nog niet compleet zijn

Boven de receptenlijst staat een paneel dat laat zien bij welke recepten een
ingrediënt buiten de telling valt — mét de namen erbij, want "er mist iets" is
geen aanwijzing en "saffraan telt niet mee" wel. Ingeklapt tenzij je hem opent:
het is een controlemiddel, geen aansporing.

Het recept met de meeste gaten staat bovenaan, want daar valt het meest te
winnen. Een puntentotaal dat te laag uitvalt omdat er ingrediënten buiten vallen
ziet er namelijk precies zo uit als een recept dat gewoon licht is.

---

## Hoe de data is opgeslagen (voor later)

In Upstash Redis:

- `recipe:<id>` — één recept als JSON.
- `recipes:index` — een set met alle recept-id's.
- `week:current` — de weekplanning (startdag + gekozen gerechten per dag).
- `boodschappen:current`, `gebiedvolgorde:current`, `voorraad:current` — de
  boodschappenlijst, de looproute per winkel en de vaste voorraadartikelen.
- `prijzen:boek` — de laatst betaalde prijs per product, uit je kassabonnen.
- `wl:*` — het gedeelde deel van de tracker (zie het hoofdstuk hierboven).
  Bewust een eigen prefix, zodat kookboek en tracker elkaars data nooit kunnen
  raken.
- `wl:p:<persoon>:*` — het persoonlijke deel: profiel, weeglijst, feitenpakket
  en adviezen.
- `auth:*` — accounts, sessies en het VAPID-sleutelpaar voor pushmeldingen.
  Buiten `wl:` gehouden: dit gaat over toegang tot de hele app, niet over
  voeding.
- `wl:p:<persoon>:push` en `wl:p:<persoon>:melding:*` — de aangemelde apparaten,
  welke meldingen aan staan en wat er vandaag al verstuurd is.
- `wl:p:<persoon>:koppelsleutel`, `auth:koppel:<sleutel>` en
  `wl:p:<persoon>:extern:<id>` — de sleutel voor je horloge, bij wie hij hoort,
  en welke trainingen al geboekt zijn.

Eén database = één huishouden, met meerdere personen erin. Wil je later echt
gescheiden huishoudens, dan is de weg dezelfde als bij `wl:p:` — een tussenstuk
in de sleutel, met één plek die hem invult.

## Projectstructuur

```
middleware.ts           Het slot: elke pagina en elke API-route gaat hierlangs
vercel.json             De twee dagelijkse taken voor de herinneringen
public/sw.js            Service worker: bewaarde lijst offline + pushmeldingen
app/
  page.tsx              Hoofdpagina
  login/page.tsx        Inloggen, of het allereerste account aanmaken
  layout.tsx            App-shell
  globals.css           Stijl + kleurpalet (CSS-variabelen)
  api/
    auth/login/route.ts     POST inloggen (zet de sessiecookie)
    auth/logout/route.ts    POST uitloggen (wist de sessie in Redis)
    auth/status/route.ts    GET wie ben ik / is de app al ingericht
    auth/inrichten/route.ts POST het allereerste account, met verhuizing
    auth/gebruikers/route.ts GET lijst / POST persoon erbij / DELETE inlog weg
    auth/wachtwoord/route.ts POST eigen wachtwoord wijzigen
    backup/route.ts         GET back-up downloaden / POST terugzetten
    bon/route.ts            POST kassabon of productfoto lezen / PUT prijzen opnemen
    prijzen/route.ts        GET het prijsboek, voor de raming op de lijst
    koppeling/route.ts      GET/POST/DELETE de sleutel voor je horloge
    tracker/beweging/extern/route.ts   POST vanaf je horloge, met eigen sleutel
    tracker/beweging/plakken/route.ts  POST een geplakte lijst uit Garmin Connect
    push/route.ts           GET sleutel+voorkeur / POST aanmelden / DELETE afmelden
    push/proef/route.ts     POST een proefmelding naar je eigen apparaten
    cron/herinnering/route.ts  De dagelijkse taak die de meldingen verstuurt
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
  Login.tsx             Het loginscherm (staat los van de rest van de app)
  Bonscanner.tsx        Kassabon of productfoto omzetten in voorraadartikelen
  ServiceWorker.tsx     Registreert public/sw.js; toont zelf niets
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
    Account.tsx         Account, personen en back-up onder Instellingen
    Meldingen.tsx       Pushmeldingen aan- en uitzetten, met proefknop
    Koppeling.tsx       Lijst plakken en de sleutel voor je horloge
    Ring.tsx            De puntenring (SVG)
    stijl.ts            Inline stijlen, bovenop de CSS-variabelen
    api.ts              Fetch-helpers voor de tracker-endpoints
lib/
  redis.ts              Upstash-client
  types.ts              Types en vaste keuzelijsten
  data.ts               Alle databasebewerkingen op één plek
  auth.ts               Wachtwoorden hashen en controleren (scrypt, server-only)
  sessie.ts             Sessies; Edge-veilig, want middleware gebruikt dit
  cookie.ts             De sessiecookie zetten en wissen
  gebruikers.ts         Accounts aanmaken, opzoeken en verwijderen
  persoon.ts            Wie is ingelogd, en welke sleutels zijn van die persoon
  migratie.ts           Eenmalige verhuizing naar het eerste account
  backup-formaat.ts     Vorm van een back-upbestand + inlezen (puur, getest)
  backup.ts             Back-up maken en terugzetten (Redis)
  push.ts               VAPID-sleutelpaar, abonnementen en versturen
  afbeelding.ts         Foto's schalen en comprimeren (browser)
  bon.ts                Een kassabon uitlezen en niet-producten wegfilteren (puur)
  prijzen.ts            Prijsboek, naamsleutels en de raming (puur)
  prijsboek.ts          Het prijsboek bewaren en bonnen erin opnemen (Redis)
  koppelsleutel.ts      De sleutel waarmee je horloge mag insturen
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
    herinnering.ts      Wanneer gaat er een melding uit, en wat staat erin (puur)
    meldingen.ts        Voorkeuren en het geheugen tegen dubbele meldingen
    koppeling.ts        Externe activiteiten en geplakte lijsten lezen (puur)
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
