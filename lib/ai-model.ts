import type Anthropic from "@anthropic-ai/sdk";

// Het model achter alle uitlees- en schattingstaken. De chatbot kiest zijn eigen.
export const MODEL = "claude-sonnet-5-5";

/**
 * Zonder deze stand denkt het model eerst na, en dat gaat van hetzelfde
 * max_tokens-budget af als het antwoord: de JSON raakt dan halverwege op.
 * De SDK-types kennen "between_tools" nog niet.
 */
export const ZONDER_DENKEN = { type: "between_tools" } as unknown as Anthropic.ThinkingConfigParam;
