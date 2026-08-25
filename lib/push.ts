// ---------------------------------------------------------------------------
// Pushmeldingen.
//
// Het sleutelpaar (VAPID) wordt één keer aangemaakt en in Redis bewaard, niet
// als omgevingsvariabele. Dat scheelt een handmatige instelstap bij het live
// zetten, en de database bewaart toch al wachtwoordregels en sessies. Zou het
// paar ooit weg zijn, dan raken alleen de bestaande abonnementen ongeldig: de
// browser meldt zich dan opnieuw aan.
//
// Abonnementen staan per persoon. Eén mens heeft er meestal twee of drie —
// telefoon, laptop, tablet — dus ze passen in één lijst.
// ---------------------------------------------------------------------------

import webpush from "web-push";
import { redis } from "./redis";
import { persoonlijk, persoonSleutel } from "./persoon";
import type { Herinnering } from "./tracker/herinnering";

const VAPID_KEY = "auth:vapid";

/** Waar de pushdienst terechtkan als er iets mis is met onze meldingen. */
const CONTACT = "mailto:kookboek@localhost";

export interface Abonnement {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  /** Wanneer dit apparaat zich aanmeldde; alleen om te tonen. */
  sinds: string;
}

interface Sleutelpaar {
  publiek: string;
  prive: string;
}

/**
 * Het sleutelpaar, en het wordt aangemaakt als het er nog niet is.
 *
 * Met NX geschreven, zodat twee gelijktijdige eerste aanvragen niet ieder een
 * eigen paar maken en de een de ander overschrijft — dan zouden de eerste
 * abonnementen meteen ongeldig zijn.
 */
export async function sleutelpaar(): Promise<Sleutelpaar> {
  const bestaand = await redis.get<Sleutelpaar>(VAPID_KEY);
  if (bestaand?.publiek && bestaand?.prive) return bestaand;

  const nieuw = webpush.generateVAPIDKeys();
  const paar: Sleutelpaar = { publiek: nieuw.publicKey, prive: nieuw.privateKey };
  const gezet = await redis.set(VAPID_KEY, paar, { nx: true });
  if (gezet) return paar;

  // Iemand anders was net eerder; die van hem geldt.
  return (await redis.get<Sleutelpaar>(VAPID_KEY)) ?? paar;
}

export async function publiekeSleutel(): Promise<string> {
  return (await sleutelpaar()).publiek;
}

// -- abonnementen ------------------------------------------------------------

const ABONNEMENTEN = "push";

export async function getAbonnementen(persoon?: string): Promise<Abonnement[]> {
  const sleutel = persoon
    ? persoonSleutel(persoon, ABONNEMENTEN)
    : await persoonlijk(ABONNEMENTEN);
  return (await redis.get<Abonnement[]>(sleutel)) ?? [];
}

async function bewaarAbonnementen(persoon: string, lijst: Abonnement[]): Promise<void> {
  await redis.set(persoonSleutel(persoon, ABONNEMENTEN), lijst);
}

/**
 * Meldt een apparaat aan. Hetzelfde endpoint twee keer opslaan zou elke melding
 * dubbel laten binnenkomen, dus dat vervangt de bestaande regel.
 */
export async function abonneer(persoon: string, abo: Omit<Abonnement, "sinds">): Promise<number> {
  const lijst = await getAbonnementen(persoon);
  const zonder = lijst.filter((a) => a.endpoint !== abo.endpoint);
  const nieuw = [...zonder, { ...abo, sinds: new Date().toISOString() }];
  await bewaarAbonnementen(persoon, nieuw);
  return nieuw.length;
}

export async function zegOp(persoon: string, endpoint: string): Promise<number> {
  const lijst = await getAbonnementen(persoon);
  const nieuw = endpoint
    ? lijst.filter((a) => a.endpoint !== endpoint)
    : [];
  await bewaarAbonnementen(persoon, nieuw);
  return nieuw.length;
}

// -- versturen ---------------------------------------------------------------

export interface Verzending {
  verstuurd: number;
  opgeruimd: number;
  /** Waarom het misging, als het misging. Voor de proefknop in Instellingen. */
  fouten: string[];
}

/**
 * Stuurt een melding naar alle apparaten van één persoon.
 *
 * Een abonnement waarvan de pushdienst zegt dat het niet meer bestaat (404 of
 * 410) wordt opgeruimd. Zonder dat blijft de app tot in lengte van dagen naar
 * een afgedankte telefoon sturen.
 *
 * Andere fouten laten het abonnement staan: een tijdelijke storing bij de
 * pushdienst hoort niet je meldingen op te zeggen.
 */
export async function stuurNaarPersoon(
  persoon: string, melding: Herinnering
): Promise<Verzending> {
  const lijst = await getAbonnementen(persoon);
  if (lijst.length === 0) return { verstuurd: 0, opgeruimd: 0, fouten: [] };

  const paar = await sleutelpaar();
  webpush.setVapidDetails(CONTACT, paar.publiek, paar.prive);

  const inhoud = JSON.stringify({
    titel: melding.titel, tekst: melding.tekst, pad: melding.pad, soort: melding.soort,
  });

  let verstuurd = 0;
  const verlopen: string[] = [];
  const fouten: string[] = [];
  for (const abo of lijst) {
    try {
      await webpush.sendNotification(
        { endpoint: abo.endpoint, keys: abo.keys }, inhoud, { TTL: 6 * 60 * 60 }
      );
      verstuurd++;
    } catch (e) {
      const code = (e as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) {
        verlopen.push(abo.endpoint);
        continue;
      }
      // Stil falen is hier het ergste wat kan gebeuren: dan denk je dat je
      // meldingen aan staan en hoor je pas over weken niets.
      fouten.push(`${new URL(abo.endpoint).host}: ${code ?? ""} ${bericht(e)}`.trim());
    }
  }

  if (verlopen.length > 0) {
    await bewaarAbonnementen(persoon, lijst.filter((a) => !verlopen.includes(a.endpoint)));
  }
  return { verstuurd, opgeruimd: verlopen.length, fouten };
}

function bericht(e: unknown): string {
  if (e && typeof e === "object" && "body" in e && typeof (e as { body: unknown }).body === "string") {
    return String((e as { body: string }).body).slice(0, 200);
  }
  return e instanceof Error ? e.message : String(e);
}
