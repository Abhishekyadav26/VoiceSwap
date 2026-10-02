/**
 * Safety checks — deterministic, no LLM involved.
 * A swap is blocked when ANY of these hold:
 *  - quote slippage exceeds the user's limit
 *  - price impact is above 2%
 *  - input amount exceeds the configured max
 */

export const MAX_PRICE_IMPACT_PCT = 2;

/** Max input in UI units (per swap). Configurable via NEXT_PUBLIC_MAX_SWAP_AMOUNT. */
export function getMaxInputUiAmount(): number {
  const raw = process.env.NEXT_PUBLIC_MAX_SWAP_AMOUNT;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 1000;
}

export interface SafetyInput {
  quoteSlippageBps: number;
  userMaxSlippageBps: number;
  priceImpactPct: number;
  inputUiAmount: number;
}

export interface SafetyResult {
  allowed: boolean;
  reasons: string[];
}

export function checkSafety(input: SafetyInput): SafetyResult {
  const reasons: string[] = [];
  if (input.quoteSlippageBps > input.userMaxSlippageBps) {
    reasons.push(
      `Quote slippage ${(input.quoteSlippageBps / 100).toFixed(2)}% exceeds your limit of ${(input.userMaxSlippageBps / 100).toFixed(2)}%.`
    );
  }
  if (input.priceImpactPct > MAX_PRICE_IMPACT_PCT) {
    reasons.push(
      `Price impact ${input.priceImpactPct.toFixed(2)}% is above the ${MAX_PRICE_IMPACT_PCT}% safety cap.`
    );
  }
  const max = getMaxInputUiAmount();
  if (input.inputUiAmount > max) {
    reasons.push(
      `Amount ${input.inputUiAmount} exceeds the configured max of ${max} per swap.`
    );
  }
  if (input.inputUiAmount <= 0) {
    reasons.push("Amount must be greater than zero (insufficient balance or bad parse).");
  }
  return { allowed: reasons.length === 0, reasons };
}
