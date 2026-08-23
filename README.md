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
**Tracker** in de onderbalk. Eén gebruiker, geen accounts.

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
| `/tracker/gewicht` | Wegen, trendlijn en voortgang naar je streefgewicht |
| `/tracker/instellingen` | Profiel, activiteitsniveau, weegdag, puntenschaal, eiwitdoel |

### Zes manieren om iets te loggen

**Snel** — je vaste maaltijden, je favorieten en de laatste 50 dingen die je
gelogd hebt. Eén tik logt het opnieuw bij de gekozen maaltijd; het potlood
erachter opent hetzelfde product met een andere hoeveelheid. In de praktijk de
snelste route.

**Zoeken** — doorzoekt twee bronnen tegelijk. Eerst een eigen basislijst met
onbewerkte Nederlandse producten (ei, rijst, kipfilet, groente), want daar is
Open Food Facts zwak in. Daarna Open Food Facts zelf, gefilterd op Nederland.
Resultaten tonen de punten per 100 g én per standaardportie. Is de externe
database onbereikbaar, dan komen de eigen resultaten alsnog door met een
melding erbij.

**Scannen** — de streepjescode met de camera. Waar de browser `BarcodeDetector`
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

Op je weegdag verschijnt op het dagoverzicht een knop naar het weegscherm. Eén
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
voortaan bovenaan. Eén tik logt de hele maaltijd.

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

Het resultaat wordt gecachet met een vingerafdruk van de ingrediënten en het
aantal personen. Pas je het recept aan in het kookboek, dan klopt die
vingerafdruk niet meer en wordt er automatisch opnieuw gerekend.

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

### Een receptlink delen

**Android** — deel een receptpagina rechtstreeks vanuit je browser naar de app;
hij komt binnen op `/tracker/import` en wordt meteen doorgerekend. Dat werkt via
`share_target` in het manifest en vereist dat je de app op je beginscherm hebt
gezet.

**iOS** kent `share_target` niet. Twee manieren:

1. **Plakken** — kopieer de link, open `/tracker/import` en tik op de plakknop.
2. **Een Shortcut** — zie hieronder.

De pagina wordt in drie stappen uitgelezen, van exact naar geraden: eerst het
`schema.org`-receptblok dat veel receptsites meeleveren, dan de
ingrediëntenlijst uit de HTML, en pas als laatste het model op de platte tekst.
Op het scherm staat welke van de drie het geworden is.

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
basisproducten met hun waarden per 100 g of ml. Eén regel erbij is genoeg — de
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

### Opslag

Alle keys van de tracker staan onder de prefix `wl:`, volledig gescheiden van de
kookboek-keys:

- `wl:profile` — profiel en het berekende dagbudget.
- `wl:day:<YYYY-MM-DD>` — één dag: alle regels plus de opgetelde totalen.
- `wl:day:index` — sorted set met de dagen waarop iets gelogd is. Lege dagen staan
  er niet in, zodat ze straks buiten de weekgemiddelden vallen.
- `wl:favorites` — je bewaarde favorieten.
- `wl:recent` — de laatste 50 gelogde items, voor snelle herinvoer.
- `wl:food:<barcode>` — gescande producten uit Open Food Facts, 90 dagen
  houdbaar. Hierdoor werkt een barcode die je vaker scant ook zonder netwerk.
- `wl:weight:log` — sorted set met al je wegingen.
- `wl:weight:<datum>` — een losse weging met eventuele notitie.
- `wl:meals` — je vaste, samengestelde maaltijden.
- `wl:recipe:points:<id>` — een doorgerekend kookboekrecept, met de
  vingerafdruk waarmee de cache vervalt.

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

### Over de grafieken

De twee grafieken zijn met de hand geschreven SVG, zonder grafiekbibliotheek.
Twee keuzes zijn bewust:

- **"Over budget" heeft een eigen, donkerder tint** (`--over`). De lichtere
  `--gold` haalde op een witte kaart maar 2:1 contrast, te weinig voor precies
  de balk die je moet opvallen. De gekozen tint haalt ruim 3:1 en blijft ook
  voor kleurenblinde lezers goed van het accent te onderscheiden.
- **Verschil zit nooit alleen in kleur.** In de trendgrafiek verschillen de twee
  reeksen ook van vorm (punten tegen lijn); in het staafdiagram staat bij een dag
  boven budget het getal erbij.

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

Eén database = één huishouden. Wil je later meerdere gezinnen of gebruikers, dan zet
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
    tracker/dagmenu/route.ts      Dagmenu uit de weekplanner in het logboek
    tracker/beweging/route.ts     Bewegingsactiviteiten en hun punten
    tracker/foto/route.ts         Foto-schatting via de Anthropic API
    tracker/import/route.ts       Receptlink ophalen en doorrekenen
  tracker/              De trackerschermen (dag, toevoegen, instellingen)
components/
  KookboekApp.tsx       De volledige UI van het kookboek (client-component)
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
