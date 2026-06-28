// Voert twee voorbeeldrecepten toe aan je Upstash database.
// Gebruik (na npm install en ingevulde .env.local):
//   node --env-file=.env.local scripts/seed.mjs
//
// Veilig om meerdere keren te draaien: bestaande recepten met dezelfde id
// worden overschreven, niet gedupliceerd.

import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const RECEPTEN = [
  {
    id: "seed-puttanesca",
    titel: "Pasta alla Puttanesca",
    keuken: "Italiaans", hoofd: "Pasta", maaltijd: "Avondeten", moeilijkheid: "Makkelijk",
    tijd: 25, score: 4, personen: 4, gegeten: 0,
    ingredienten: [
      { naam: "Spaghetti", hoev: 400, eenheid: "g" },
      { naam: "Ansjovis", hoev: 6, eenheid: "filets" },
      { naam: "Kappertjes", hoev: 2, eenheid: "el" },
      { naam: "Zwarte olijven", hoev: 100, eenheid: "g" },
      { naam: "Tomatenblokjes", hoev: 800, eenheid: "g" },
      { naam: "Knoflook", hoev: 3, eenheid: "tenen" },
    ],
    bereiding:
      "Fruit knoflook en ansjovis in olijfolie. Voeg tomaat, olijven en kappertjes toe en pruttel 15 minuten. Kook ondertussen de spaghetti beetgaar en meng door de saus.",
  },
  {
    id: "seed-gyros",
    titel: "Griekse gyros schotel",
    keuken: "Grieks", hoofd: "Vlees", maaltijd: "Avondeten", moeilijkheid: "Gemiddeld",
    tijd: 40, score: 5, personen: 4, gegeten: 0,
    ingredienten: [
      { naam: "Varkensreepjes", hoev: 600, eenheid: "g" },
      { naam: "Gyroskruiden", hoev: 2, eenheid: "el" },
      { naam: "Tzatziki", hoev: 250, eenheid: "g" },
      { naam: "Pita", hoev: 8, eenheid: "stuks" },
      { naam: "Rode ui", hoev: 1, eenheid: "stuk" },
    ],
    bereiding:
      "Marineer het vlees minstens 20 minuten met gyroskruiden. Bak kort en heet in een koekenpan. Serveer met tzatziki, warme pita en gesnipperde rode ui.",
  },
];

async function main() {
  for (const r of RECEPTEN) {
    await redis.set(`recipe:${r.id}`, r);
    await redis.sadd("recipes:index", r.id);
    console.log("Toegevoegd:", r.titel);
  }
  console.log("\nKlaar. Open de app om de recepten te zien.");
}

main().catch((e) => {
  console.error("Seed mislukt:", e);
  process.exit(1);
});
