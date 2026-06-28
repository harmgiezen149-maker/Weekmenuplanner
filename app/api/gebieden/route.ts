import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { WINKELGEBIEDEN } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Ontvangt { namen: string[] } en geeft { gebieden: { [naam]: gebied } } terug.
// Het model kiest per naam één van de bekende winkelgebieden, of "" als onduidelijk.
export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  const { namen } = await req.json();
  if (!Array.isArray(namen) || namen.length === 0) {
    return NextResponse.json({ gebieden: {} });
  }
  // Zonder key: geef lege gebieden terug (gebruiker kiest handmatig).
  if (!key) {
    return NextResponse.json({ gebieden: Object.fromEntries(namen.map((n: string) => [n, ""])) });
  }

  const client = new Anthropic({ apiKey: key });
  const systeem =
    "Je bepaalt voor boodschappen-ingrediënten in welke supermarktafdeling ze liggen. " +
    "Kies per ingrediënt PRECIES één afdeling uit deze lijst: " + WINKELGEBIEDEN.join(", ") + ". " +
    "Als je het echt niet zeker weet, gebruik dan een lege string. " +
    'Geef UITSLUITEND geldige JSON terug in de vorm {"<naam>":"<afdeling>", ...}, geen uitleg, geen markdown.';

  try {
    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systeem,
      messages: [{ role: "user", content: "Ingrediënten:\n" + namen.map((n: string) => "- " + n).join("\n") }],
    });
    const text = res.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text).join("\n")
      .replace(/```json|```/g, "").trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const parsed = JSON.parse(text.slice(start, end + 1));
    // valideer: alleen bekende gebieden of leeg
    const geldig: Record<string, string> = {};
    for (const n of namen) {
      const g = parsed[n];
      geldig[n] = WINKELGEBIEDEN.includes(g) ? g : "";
    }
    return NextResponse.json({ gebieden: geldig });
  } catch {
    return NextResponse.json({ gebieden: Object.fromEntries(namen.map((n: string) => [n, ""])) });
  }
}
