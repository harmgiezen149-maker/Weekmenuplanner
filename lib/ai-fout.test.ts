import { strict as assert } from "node:assert";
import { test } from "node:test";
import { AiWeigering, aiMelding, controleerWeigering } from "./ai-fout.ts";

// Letterlijk zoals de SDK hem doorgeeft, uit de productielogs van 30 september.
const LIMIET = new Error(
  '400 {"type":"error","error":{"type":"invalid_request_error","message":"You have reached your ' +
  'specified API usage limits. You will regain access on 2026-10-01 at 00:00 UTC."},' +
  '"request_id":"req_011CfZvt9HfcrE2TeKFKzSHv"}'
);

test("de bestedingslimiet wordt herkend, met het moment in Nederlandse tijd", () => {
  const m = aiMelding(LIMIET);
  assert.ok(m);
  assert.match(m, /AI-tegoed is op/);
  // 00:00 UTC is in de zomertijd 02:00 in Nederland.
  assert.match(m, /1 oktober om 02:00/);
});

test("zonder herkenbare datum blijft de melding bruikbaar", () => {
  const m = aiMelding(new Error("You have reached your specified API usage limits."));
  assert.ok(m);
  assert.doesNotMatch(m, /Vanaf/);
});

test("andere fouten zijn geen limiet", () => {
  assert.equal(aiMelding(new Error("400 invalid model")), null);
  assert.equal(aiMelding(new Error("socket hang up")), null);
  assert.equal(aiMelding(undefined), null);
  assert.equal(aiMelding("usage"), null);
});

test("een weigering wordt een eigen melding, een gewoon antwoord gooit niets", () => {
  assert.throws(
    () => controleerWeigering({ stop_reason: "refusal", stop_details: { type: "refusal", category: "general_harms", explanation: null } as never }),
    (e: unknown) => e instanceof AiWeigering && e.categorie === "general_harms",
  );
  assert.doesNotThrow(() => controleerWeigering({ stop_reason: "end_turn", stop_details: null }));

  const m = aiMelding(new AiWeigering(null));
  assert.ok(m);
  assert.match(m, /weigerde/);
  assert.doesNotMatch(m, /tegoed/);
});
