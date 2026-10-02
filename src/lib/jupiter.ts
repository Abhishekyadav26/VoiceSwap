/**
 * Jupiter client — deterministic token resolution, quoting, and swap-tx building.
 * The LLM never touches this. All amounts / transactions are built here.
 */

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

export interface ResolvedAmount {
  inputMint: string;
  outputMint: string;
  fromSymbol: string;
  toSymbol: string;
  uiAmount: number;
  baseUnits: string;
  inputDecimals: number;
  outputDecimals: number;
}

// Well-known mainnet mints as a fallback if the Jupiter token API is down.
const WELL_KNOWN: Record<string, TokenInfo> = {
  SOL: {
    address: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    name: "Wrapped SOL",
    decimals: 9,
  },
  WSOL: {
    address: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    name: "Wrapped SOL",
    decimals: 9,
  },
  USDC: {
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  USDT: {
    address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    symbol: "USDT",
    name: "Tether",
    decimals: 6,
  },
  JUP: {
    address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    symbol: "JUP",
    name: "Jupiter",
    decimals: 6,
  },
  BONK: {
    address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB4p",
    symbol: "BONK",
    name: "Bonk",
    decimals: 5,
  },
  WIF: {
    address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcPo",
    symbol: "WIF",
    name: "dogwifhat",
    decimals: 6,
  },
  PYTH: {
    address: "HfHDJtQDGayBwmM6ZT7qLd9BzgE4xK4mPr7HBGD1vpm",
    symbol: "PYTH",
    name: "Pyth Network",
    decimals: 6,
  },
};

let tokenCache: Map<string, TokenInfo> | null = null;
let tokenCacheAt = 0;

async function loadTokenList(): Promise<Map<string, TokenInfo>> {
  if (tokenCache && Date.now() - tokenCacheAt < 10 * 60 * 1000) return tokenCache;
  const map = new Map<string, TokenInfo>();
  for (const t of Object.values(WELL_KNOWN)) map.set(t.symbol, t);
  try {
    const res = await fetch("https://tokens.jup.ag/tokens?tags=verified", {
      next: { revalidate: 600 },
    });
    if (res.ok) {
      const list = (await res.json()) as Array<{
        address: string;
        symbol: string;
        name: string;
        decimals: number;
      }>;
      for (const t of list) {
        if (!t.symbol || !t.address) continue;
        const sym = t.symbol.toUpperCase();
        if (!map.has(sym)) {
          map.set(sym, {
            address: t.address,
            symbol: sym,
            name: t.name,
            decimals: t.decimals,
          });
        }
      }
    }
  } catch {
    // fall back to well-known list
  }
  tokenCache = map;
  tokenCacheAt = Date.now();
  return map;
}

export async function resolveToken(symbol: string): Promise<TokenInfo | null> {
  const map = await loadTokenList();
  const clean = symbol.trim().toUpperCase();
  return map.get(clean) ?? null;
}

export function resolveAmount(params: {
  amountType: "exact" | "percent" | "all";
  amountValue: number | null;
  balanceUiAmount: number;
  inputMint: string;
  outputMint: string;
  fromSymbol: string;
  toSymbol: string;
  inputDecimals: number;
  outputDecimals: number;
}): ResolvedAmount {
  const { amountType, amountValue, balanceUiAmount } = params;
  let uiAmount: number;
  if (amountType === "all") {
    uiAmount = balanceUiAmount;
  } else if (amountType === "percent") {
    const pct = amountValue ?? 100;
    uiAmount = (balanceUiAmount * pct) / 100;
  } else {
    uiAmount = amountValue ?? 0;
  }
  // Leave a tiny SOL buffer for fees when swapping all SOL.
  if (
    params.fromSymbol === "SOL" &&
    amountType === "all" &&
    uiAmount > 0.002
  ) {
    uiAmount = Math.max(0, uiAmount - 0.002);
  }
  uiAmount = Math.floor(uiAmount * 10 ** params.inputDecimals) / 10 ** params.inputDecimals;
  const baseUnits = Math.floor(
    uiAmount * 10 ** params.inputDecimals
  ).toString();
  return {
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    fromSymbol: params.fromSymbol,
    toSymbol: params.toSymbol,
    uiAmount,
    baseUnits,
    inputDecimals: params.inputDecimals,
    outputDecimals: params.outputDecimals,
  };
}

export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{ swapInfo: { label?: string; ammKey: string } }>;
  contextSlot?: number;
  raw: unknown;
}

export async function getQuote(params: {
  inputMint: string;
  outputMint: string;
  amountBaseUnits: string;
  slippageBps: number;
}): Promise<JupiterQuote> {
  const qs = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amountBaseUnits,
    slippageBps: String(params.slippageBps),
    restrictIntermediateTokens: "true",
  });
  const res = await fetch(`https://lite-api.jup.ag/swap/v1/quote?${qs}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jupiter quote failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  return {
    inputMint: data.inputMint,
    inAmount: data.inAmount,
    outputMint: data.outputMint,
    outAmount: data.outAmount,
    otherAmountThreshold: data.otherAmountThreshold,
    slippageBps: data.slippageBps,
    priceImpactPct: String(data.priceImpactPct ?? "0"),
    routePlan: data.routePlan ?? [],
    contextSlot: data.contextSlot,
    raw: data,
  };
}

export async function buildSwapTransaction(params: {
  quoteResponse: unknown;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
}): Promise<string> {
  const res = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      quoteResponse: params.quoteResponse,
      userPublicKey: params.userPublicKey,
      wrapAndUnwrapSol: params.wrapAndUnwrapSol ?? true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jupiter swap build failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  if (!data.swapTransaction) throw new Error("Jupiter returned no swapTransaction");
  return data.swapTransaction as string;
}
