import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  laadFeiten, getProfile, getWegingen, getActiefAdvies, getLaatsteAdviezen,
  saveAdvies, nieuwId, geldigeDatum, datumSleutel,
} from "@/lib/tracker/data";
import { leesFeit, weegmomentOpen, type Advies } from "@/lib/tracker/advies";
import { genereerAdvies } from "@/lib/tracker/advies-model";

export const dynamic = "force-dynamic";
// Twee modelaanroepen achter elkaar bij een herkansing; de standaardlimiet van
// tien seconden is daar te krap voor.
export const maxDuration = 60;

/**
 * Het lopende advies, de laatste drie uit de historie, en of het weegmoment
 * openstaat. De client gebruikt dat laatste om te bepalen of hij mag genereren.
 */
export async function GET(req: NextRequest) {
  const gevraagd = req.nextUrl.searchParams.get("datum");
  const peildatum = geldigeDatum(gevraagd) ? gevraagd : datumSleutel();

  const profiel = await getProfile();
  if (!profiel) return NextResponse.json({ advies: null, historie: [], weegmoment: null });

  const [{ pakket }, wegingen, historie] = await Promise.all([
    laadFeiten(peildatum),
    getWegingen(),
    getLaatsteAdviezen(3),
  ]);
  if (!pakket) return NextResponse.json({ advies: null, historie: [], weegmoment: null });

  return NextResponse.json({
    advies: historie[0] ?? null,
    historie,
    weegmoment: weegmomentOpen(pakket, wegingen, profiel, historie[0] ?? null),
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

  const [{ pakket }, wegingen, historie] = await Promise.all([
    laadFeiten(peildatum),
    getWegingen(),
    getLaatsteAdviezen(3),
  ]);
  if (!pakket) {
    return NextResponse.json({ error: "Er zijn nog geen gegevens om door te rekenen." }, { status: 400 });
  }

  const moment = weegmomentOpen(pakket, wegingen, profiel, historie[0] ?? null);
  if (!moment.open) {
    // Geen fout: dit is de normale uitkomst zolang er geen nieuw weegmoment is.
    return NextResponse.json({ advies: null, historie, weegmoment: moment, gegenereerd: false });
  }

  const client = new Anthropic({ apiKey: key });
  let uitkomst;
  try {
    uitkomst = await genereerAdvies(client, {
      pakket, profiel, vorige: historie, trigger: "weegmoment",
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
      advies: null, historie, weegmoment: moment, gegenereerd: false,
      afgekeurd: uitkomst.redenen,
    });
  }

  const advies: Advies = {
    id: nieuwId(),
    created_at: new Date().toISOString(),
    trigger: "weegmoment",
    weeg_datum: moment.datum ?? undefined,
    payload: uitkomst.payload,
    fact_pack_ref: pakket.meta.reference_date,
    metric_start: leesFeit(pakket, uitkomst.payload.action.metric_key) ?? 0,
    verified: uitkomst.validatie.geverifieerd,
    onverklaarbare_getallen: uitkomst.validatie.onverklaarbaar,
    evaluation: null,
  };
  await saveAdvies(advies);

  return NextResponse.json({
    advies,
    historie: [advies, ...historie].slice(0, 3),
    weegmoment: { ...moment, open: false, reden: "dit weegmoment heeft al een advies" },
    gegenereerd: true,
  });
}
