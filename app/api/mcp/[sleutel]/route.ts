import { NextRequest, NextResponse } from "next/server";
import { claudeSleutelGeldig } from "@/lib/claudesleutel";
import { verwerkMcp } from "@/lib/mcp";
import { maakKookboekGereedschap } from "@/lib/claude-gereedschap";
import {
  getAllRecepten, getRecept, saveRecept, getWeek, saveWeek, getBoodschappen, saveBoodschappen, getVoorraad, newId,
} from "@/lib/data";
import { datumSleutel } from "@/lib/tracker/datum";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// De deur voor Claude: een MCP-server op /api/mcp/<sleutel>.
//
// middleware.ts laat dit pad door zonder sessie; de sleutel in het adres is
// hier het slot. Klopt hij niet, dan is het antwoord een kale 404 — wie het
// adres raadt, leert niet eens dat hier iets bestaat.
// ---------------------------------------------------------------------------

const INFO = {
  name: "kookboek",
  version: "1.0.0",
  instructions: "Harm's household cookbook: recipes, the week menu, the shopping list and the pantry. Names and values are in Dutch. Read freely; plan_recipe, add_to_shopping_list and add_recipe change things, so only use them when Harm has approved the change.",
};

function gereedschap() {
  // Nederlandse tijd voor "deze week", ook als de server in een andere zone draait.
  const vandaag = () => datumSleutel(new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Amsterdam" })));
  return maakKookboekGereedschap({
    getAllRecepten, getRecept, saveRecept, getWeek, saveWeek, getBoodschappen, saveBoodschappen, getVoorraad, newId, vandaag,
  });
}

type Ctx = { params: Promise<{ sleutel: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { sleutel } = await ctx.params;
  if (!(await claudeSleutelGeldig(sleutel))) return new NextResponse(null, { status: 404 });
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Geen geldige JSON" } }, { status: 400 });
  }
  const uit = await verwerkMcp(body, gereedschap(), INFO);
  if (uit === null) return new NextResponse(null, { status: 202 });
  return NextResponse.json(uit, { headers: { "Cache-Control": "no-store" } });
}

// Geen stream en geen sessies: alleen POST.
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { sleutel } = await ctx.params;
  if (!(await claudeSleutelGeldig(sleutel))) return new NextResponse(null, { status: 404 });
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
export async function DELETE(req: NextRequest, ctx: Ctx) { return GET(req, ctx); }
