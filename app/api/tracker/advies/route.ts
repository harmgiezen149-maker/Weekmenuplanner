import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  laadFeiten, getProfile, getWegingen, getLaatsteAdviezen, werkEvaluatieBij,
  saveAdvies, getCooldown, saveCooldown, setGezienAdvies,
  nieuwId, geldigeDatum, datumSleutel,
} from "@/lib/tracker/data";
import {
  leesFeit, weegmomentOpen, afwijkingOpen, noteerAfwijking,
  type Advies, type AdviesTrigger,
} from "@/lib/tracker/advies";
import { genereerAdvies } from "@/lib/tracker/advies-model";

export const dynamic = "force-dynamic";
// Twee modelaanroepen achter elkaar bij een herkansing; de standaardlimiet van
// tien seconden is daar te krap voor.
export const maxDuration = 60;

/**
 * Zoveel adviezen worden opgehaald om de triggers te beoordelen. Ruimer dan de
 * drie die het model krijgt: een reeks afwijkingsmeldingen mag het laatste
 * weegmomentadvies niet uit beeld duwen, want dan heropent dat weegmoment.
 */
const TRIGGER_HISTORIE = 10;

/**
 * Het lopende advies, de laatste drie uit de historie, en of het weegmoment
 * openstaat. De client gebruikt dat laatste om te bepalen of hij mag genereren.
 */
export async function GET(req: NextRequest) {
  const gevraagd = req.nextUrl.searchParams.get("datum");
  const peildatum = geldigeDatum(gevraagd) ? gevraagd : datumSleutel();

  const profiel = await getProfile();
  if (!profiel) return NextResponse.json({ advies: null, historie: [], weegmoment: null });

  const [{ pakket }, wegingen, opgeslagen] = await Promise.all([
    laadFeiten(peildatum),
    getWegingen(),
    getLaatsteAdviezen(TRIGGER_HISTORIE),
  ]);
  if (!pakket) return NextResponse.json({ advies: null, historie: [], weegmoment: null });

  // De uitslag van een lopend advies schuift mee, zodat het scherm de stand van
  // nu toont in plaats van te wachten tot het volgende advies wordt gemaakt.
  const historie = await Promise.all(opgeslagen.map((a) => werkEvaluatieBij(a, peildatum)));
  const cooldown = await getCooldown();

  // Wie dit scherm opent heeft het advies gezien; de melding op /tracker mag weg.
  if (historie[0]) await setGezienAdvies(historie[0].id);

  return NextResponse.json({
    advies: historie[0] ?? null,
    historie: historie.slice(0, 3),
    weegmoment: weegmomentOpen(pakket, wegingen, profiel, historie),
    afwijking: afwijkingOpen(pakket, wegingen, profiel, historie, cooldown, new Date()),
  });
}

/**
 * Genereert het advies bij het weegmoment.
 *
 * De trigger wordt hier server-side gecontroleerd en niet door de client
 * bepaald: anders zou een herlaadknop net zo vaak een modelaanroep kosten als
 * hij wordt ingedrukt.
 */
export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY ontbreekt. Zonder die sleutel werkt het advies niet; de cijfers op Inzicht wel." },
      { status: 503 }
    );
  }

  const gevraagd = req.nextUrl.searchParams.get("datum");
  const peildatum = geldigeDatum(gevraagd) ? gevraagd : datumSleutel();

  const profiel = await getProfile();
  if (!profiel) {
    return NextResponse.json({ error: "Vul eerst je profiel in bij Instellingen." }, { status: 400 });
  }

  const [{ pakket }, wegingen, opgeslagen] = await Promise.all([
    laadFeiten(peildatum),
    getWegingen(),
    getLaatsteAdviezen(TRIGGER_HISTORIE),
  ]);
  if (!pakket) {
    return NextResponse.json({ error: "Er zijn nog geen gegevens om door te rekenen." }, { status: 400 });
  }

  // Eerst meten, dan pas vragen: het model hoort te weten wat het vorige advies
  // heeft opgeleverd voordat het een nieuwe kiest.
  const historie = await Promise.all(opgeslagen.map((a) => werkEvaluatieBij(a, peildatum)));

  const nu = new Date();
  const cooldown = await getCooldown();
  const moment = weegmomentOpen(pakket, wegingen, profiel, historie);
  const afwijking = afwijkingOpen(pakket, wegingen, profiel, historie, cooldown, nu);

  // Het weegmoment gaat voor: dat is de vaste afspraak, een afwijking is de
  // uitzondering. Zonder die volgorde zou een afwijking het weegmomentadvies
  // kunnen opeten en daarna zelf door de 48-uursregel geblokkeerd worden.
  const trigger: AdviesTrigger | null = moment.open ? "weegmoment"
    : afwijking.open ? "afwijking" : null;

  if (!trigger) {
    // Geen fout: dit is de normale uitkomst zolang er niets te melden is.
    return NextResponse.json({
      advies: null, historie: historie.slice(0, 3), weegmoment: moment, afwijking, gegenereerd: false,
    });
  }

  const client = new Anthropic({ apiKey: key });
  let uitkomst;
  try {
    uitkomst = await genereerAdvies(client, {
      pakket, profiel, vorige: historie.slice(0, 3), trigger,
      ...(trigger === "afwijking" && afwijking.vlag ? { aanleiding: afwijking.vlag } : {}),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Het advies kon niet worden opgehaald." },
      { status: 502 }
    );
  }

  if (!uitkomst.ok) {
    // Twee pogingen afgekeurd door de controle. Dan komt er geen advies, en dat
    // wordt gezegd — met de reden erbij, niet als vage storing.
    return NextResponse.json({
      advies: null, historie: historie.slice(0, 3), weegmoment: moment, afwijking, gegenereerd: false,
      afgekeurd: uitkomst.redenen,
    });
  }

  const advies: Advies = {
    id: nieuwId(),
    created_at: nu.toISOString(),
    trigger,
    ...(trigger === "weegmoment"
      ? { weeg_datum: moment.datum ?? undefined }
      : { aanleiding: afwijking.vlag ?? undefined }),
    payload: uitkomst.payload,
    fact_pack_ref: pakket.meta.reference_date,
    metric_start: leesFeit(pakket, uitkomst.payload.action.metric_key) ?? 0,
    verified: uitkomst.validatie.geverifieerd,
    onverklaarbare_getallen: uitkomst.validatie.onverklaarbaar,
    evaluation: null,
  };
  await saveAdvies(advies);
  await setGezienAdvies(advies.id);
  if (trigger === "afwijking" && afwijking.vlag) {
    await saveCooldown(noteerAfwijking(cooldown, afwijking.vlag, nu));
  }

  return NextResponse.json({
    advies,
    historie: [advies, ...historie].slice(0, 3),
    weegmoment: trigger === "weegmoment"
      ? { ...moment, open: false, reden: "dit weegmoment heeft al een advies" }
      : moment,
    afwijking: { ...afwijking, open: false, reden: "hier is zojuist over gemeld" },
    gegenereerd: true,
  });
}
