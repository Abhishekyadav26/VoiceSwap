import { z } from "zod";

/**
 * Structured swap intent produced by the LLM.
 * The LLM must NEVER build or sign transactions — it only returns this JSON.
 */
export const SwapIntentSchema = z.object({
  action: z.literal("swap"),
  fromToken: z
    .string()
    .min(1)
    .describe("Source token symbol, e.g. SOL")
    .transform((s) => s.trim().toUpperCase()),
  toToken: z
    .string()
    .min(1)
    .describe("Destination token symbol, e.g. USDC")
    .transform((s) => s.trim().toUpperCase()),
  amountType: z.enum(["exact", "percent", "all"]),
  /** For exact: UI amount (e.g. 1.5). For percent: 1-100. For all: null. */
  amountValue: z.number().positive().nullable(),
  /** Max slippage in basis points, e.g. 50 = 0.5%. Null = use default. */
  maxSlippageBps: z.number().int().min(1).max(5000).nullable(),
  /** Free-form conditions the user stated, e.g. "only if slippage under 0.5%". */
  conditions: z.array(z.string()).default([]),
});

export type SwapIntent = z.infer<typeof SwapIntentSchema>;

export const WalletBalanceSchema = z.object({
  symbol: z.string(),
  mint: z.string().optional(),
  uiAmount: z.number().nonnegative(),
  decimals: z.number().int().min(0).max(18).optional(),
});

export type WalletBalance = z.infer<typeof WalletBalanceSchema>;

export const ClarifyResultSchema = z.object({
  status: z.literal("clarify"),
  question: z.string().min(1),
});

export const OkResultSchema = z.object({
  status: z.literal("ok"),
  intent: SwapIntentSchema,
});

export const ParseResultSchema = z.discriminatedUnion("status", [
  OkResultSchema,
  ClarifyResultSchema,
]);

export type ParseResult = z.infer<typeof ParseResultSchema>;

/**
 * Extract the first JSON object from model text and validate it.
 * Returns a clarify result instead of throwing on ambiguity.
 */
export function parseClaudeJson(raw: string): ParseResult {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return {
      status: "clarify",
      question:
        "I couldn't understand that as a swap command. Which token do you want to swap from, to which token, and how much?",
    };
  }
  try {
    const json = JSON.parse(match[0]);
    // LLM may return either the bare intent or {status, intent/question}
    if (json.status === "clarify" && typeof json.question === "string") {
      return ClarifyResultSchema.parse(json);
    }
    const intent = SwapIntentSchema.parse(json);
    if (intent.amountType === "exact" && intent.amountValue == null) {
      return {
        status: "clarify",
        question: `How much ${intent.fromToken} do you want to swap into ${intent.toToken}?`,
      };
    }
    if (intent.amountType === "percent" && intent.amountValue == null) {
      return {
        status: "clarify",
        question: `What percentage of your ${intent.fromToken} should I swap?`,
      };
    }
    if (intent.fromToken === intent.toToken) {
      return {
        status: "clarify",
        question: `Source and destination are both ${intent.fromToken}. Which token should I swap into?`,
      };
    }
    return { status: "ok", intent };
  } catch {
    return {
      status: "clarify",
      question:
        "That was ambiguous — please tell me the source token, destination token, and amount (e.g. “swap half my SOL into USDC”).",
    };
  }
}

export const SYSTEM_PROMPT = `You parse voice swap commands for a Solana swap terminal into structured JSON ONLY.

Return EXACTLY ONE JSON object, no markdown, no explanation. Two allowed shapes:
1. {"action":"swap","fromToken":"SOL","toToken":"USDC","amountType":"exact"|"percent"|"all","amountValue":number|null,"maxSlippageBps":number|null,"conditions":[]}
2. {"status":"clarify","question":"..."} — use this when anything is ambiguous or unsupported.

Rules:
- action is always "swap". Only swaps are supported; anything else → clarify.
- fromToken/toToken are UPPERCASE symbols (SOL, USDC, USDT, JUP, BONK...).
- amountType: "exact" (a fixed number of tokens, amountValue = UI amount), "percent" (amountValue = 1-100, e.g. "half" = 50), "all" (amountValue = null, e.g. "all", "everything", "max").
- Words: "half"→percent 50, "quarter"→percent 25, "all"/"everything"/"max"→all.
- maxSlippageBps: percent*100 (0.5% = 50). "if slippage is under 0.5 percent" → 50. Absent → null.
- conditions: array of any extra conditions phrased by the user.
- If a token, amount, or destination is missing/guessed → return clarify with a short question. NEVER guess.
- Balances are provided for context only; still return percent/all symbolically, never compute amounts.`;
