// ---------------------------------------------------------------------------
// Een kleine MCP-server: de deur waardoor Claude (Harms AI-dorp op claude.ai)
// het kookboek kan lezen en, na Harms goedkeuring, iets kan toevoegen.
//
// MCP is JSON-RPC 2.0 over één POST-adres ("Streamable HTTP"). Deze server is
// staatloos: geen sessies, geen stream, elk verzoek krijgt gewoon een
// JSON-antwoord. Dat is alles wat claude.ai nodig heeft voor gereedschap.
//
// Bewust zonder extra pakket: het protocol dat we gebruiken is klein genoeg om
// hier helemaal te kunnen lezen, en dan weet je precies wat er openstaat.
// ---------------------------------------------------------------------------

export interface McpGereedschap {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Alleen lezen? Dan mag claude.ai het zonder extra vraag uitvoeren. */
  alleenLezen: boolean;
  run: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface McpServerInfo {
  name: string;
  version: string;
  instructions?: string;
}

const PROTOCOLLEN = ["2025-06-18", "2025-03-26", "2024-11-05"];

type Bericht = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

/** Een fout die als nette tekst terug mag naar Claude (bijv. "recept bestaat niet"). */
export class McpFout extends Error {}

function antwoord(id: Bericht["id"], result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}
function fout(id: Bericht["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

async function behandel(b: Bericht, gereedschap: McpGereedschap[], info: McpServerInfo) {
  if (!b || typeof b !== "object" || typeof b.method !== "string") return fout(b?.id, -32600, "Ongeldig verzoek");
  const isMelding = b.id === undefined || b.id === null;
  switch (b.method) {
    case "initialize": {
      const gevraagd = String(b.params?.protocolVersion ?? "");
      return antwoord(b.id, {
        protocolVersion: PROTOCOLLEN.includes(gevraagd) ? gevraagd : PROTOCOLLEN[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: info.name, version: info.version },
        ...(info.instructions ? { instructions: info.instructions } : {}),
      });
    }
    case "ping":
      return antwoord(b.id, {});
    case "tools/list":
      return antwoord(b.id, {
        tools: gereedschap.map((g) => ({
          name: g.name,
          title: g.title,
          description: g.description,
          inputSchema: g.inputSchema,
          annotations: { title: g.title, readOnlyHint: g.alleenLezen, destructiveHint: false, idempotentHint: g.alleenLezen, openWorldHint: false },
        })),
      });
    case "tools/call": {
      const naam = String(b.params?.name ?? "");
      const g = gereedschap.find((x) => x.name === naam);
      if (!g) return fout(b.id, -32602, `Onbekend gereedschap: ${naam}`);
      const args = (b.params?.arguments && typeof b.params.arguments === "object" ? b.params.arguments : {}) as Record<string, unknown>;
      try {
        const uit = await g.run(args);
        return antwoord(b.id, {
          content: [{ type: "text", text: JSON.stringify(uit) }],
          ...(uit && typeof uit === "object" && !Array.isArray(uit) ? { structuredContent: uit } : {}),
        });
      } catch (e) {
        // Een fout van het gereedschap zelf (verkeerde invoer, bestaat niet) is
        // een antwoord met isError, zodat Claude het kan lezen en bijsturen.
        const tekst = e instanceof McpFout ? e.message : "Er ging iets mis in het kookboek.";
        if (!(e instanceof McpFout)) console.error("mcp", naam, e);
        return antwoord(b.id, { content: [{ type: "text", text: tekst }], isError: true });
      }
    }
    default:
      if (isMelding || b.method.startsWith("notifications/")) return null;
      return fout(b.id, -32601, `Onbekende methode: ${b.method}`);
  }
}

/**
 * Verwerkt de body van één POST. Geeft `null` terug als er niets te antwoorden
 * valt (alleen meldingen): de route stuurt dan 202 zonder inhoud.
 */
export async function verwerkMcp(body: unknown, gereedschap: McpGereedschap[], info: McpServerInfo): Promise<unknown | null> {
  if (Array.isArray(body)) {
    const uit = [];
    for (const b of body) { const a = await behandel(b as Bericht, gereedschap, info); if (a) uit.push(a); }
    return uit.length ? uit : null;
  }
  return behandel(body as Bericht, gereedschap, info);
}
