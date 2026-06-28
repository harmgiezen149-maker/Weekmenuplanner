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

## Hoe de data is opgeslagen (voor later)

In Upstash Redis:

- `recipe:<id>` — één recept als JSON.
- `recipes:index` — een set met alle recept-id's.
- `week:current` — de weekplanning (startdag + gekozen gerechten per dag).

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
components/
  KookboekApp.tsx       De volledige UI (client-component)
lib/
  redis.ts              Upstash-client
  types.ts              Types en vaste keuzelijsten
  data.ts               Alle databasebewerkingen op één plek
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
