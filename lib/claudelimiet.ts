// ---------------------------------------------------------------------------
// Snelheidslimiet voor de deur van Claude (/api/mcp/<sleutel>).
//
// Lekt het adres met de sleutel ooit uit, dan kan niemand er onbeperkt
// verzoeken op afvuren: hooguit LIMIET per uur, daarna een 429 tot het
// volgende uur. Het AI-dorp doet er normaal hooguit enkele tientallen per uur.
//
// Teller in Redis per klokuur:  claude:teller:<uur sinds 1970>  (vervalt zelf).
// Gaat het tellen mis (Redis even weg), dan gaat de deur niet dicht: zonder
// Redis werkt het kookboek toch al niet, en een kapotte teller mag Harm niet
// buitensluiten.
// ---------------------------------------------------------------------------

export const LIMIET = 300;

export type Teller = {
  incr(sleutel: string): Promise<number>;
  expire(sleutel: string, seconden: number): Promise<unknown>;
};

export async function binnenClaudeLimiet(teller: Teller, nu = Date.now()): Promise<{ ok: boolean; wachtSeconden: number }> {
  const uur = Math.floor(nu / 3_600_000);
  const wachtSeconden = Math.max(1, Math.ceil(((uur + 1) * 3_600_000 - nu) / 1000));
  try {
    const sleutel = `claude:teller:${uur}`;
    const n = await teller.incr(sleutel);
    if (n === 1) await teller.expire(sleutel, 3700);
    return { ok: n <= LIMIET, wachtSeconden };
  } catch {
    return { ok: true, wachtSeconden };
  }
}
