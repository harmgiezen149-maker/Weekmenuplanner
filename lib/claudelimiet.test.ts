import { strict as assert } from "node:assert";
import { test } from "node:test";
import { binnenClaudeLimiet, LIMIET, type Teller } from "./claudelimiet.ts";

function nepTeller() {
  const tellers = new Map<string, number>();
  const verloopt = new Map<string, number>();
  const t: Teller = {
    incr: async (k) => { const n = (tellers.get(k) ?? 0) + 1; tellers.set(k, n); return n; },
    expire: async (k, s) => { verloopt.set(k, s); return 1; },
  };
  return { t, tellers, verloopt };
}

test("tot de limiet mag het, daarna niet meer; het volgende uur weer wel", async () => {
  const { t, verloopt } = nepTeller();
  const uur = 1_800_000_000_000;
  for (let i = 0; i < LIMIET; i++) assert.equal((await binnenClaudeLimiet(t, uur)).ok, true);
  const te = await binnenClaudeLimiet(t, uur);
  assert.equal(te.ok, false);
  assert.ok(te.wachtSeconden > 0 && te.wachtSeconden <= 3600);
  assert.equal((await binnenClaudeLimiet(t, uur + 3_600_000)).ok, true);
  assert.equal([...verloopt.values()].every((s) => s > 3600), true, "de teller ruimt zichzelf op");
});

test("kapotte teller sluit Harm niet buiten", async () => {
  const kapot: Teller = { incr: async () => { throw new Error("weg"); }, expire: async () => 0 };
  assert.equal((await binnenClaudeLimiet(kapot)).ok, true);
});
