import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { SwapIntentSchema, WalletBalanceSchema } from "@/lib/intent-schema";
import {
  buildSwapTransaction,
  getQuote,
  resolveAmount,
  resolveToken,
} from "@/lib/jupiter";
import { checkSafety } from "@/lib/safety";
import { isDevnet } from "@/lib/network";

// Uses Node `Buffer` to deserialize the Jupiter swap transaction —
// must stay on the Node runtime, not Edge.
export const runtime = "nodejs";

const BodySchema = z.object({
  intent: SwapIntentSchema,
  balances: z.array(WalletBalanceSchema).default([]),
  walletAddress: z.string().min(32).max(48).optional(),
});

function rpcUrl() {
  return (
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    process.env.SOLANA_RPC_URL ||
    "https://api.mainnet-beta.solana.com"
  );
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { intent, balances, walletAddress } = parsed.data;

  // Devnet mode: Jupiter is mainnet-only, so there is no quote, no price, and
  // nothing executable. Still resolve the amount from devnet balances and run
  // the safety checks so voice parsing can be tested safely end to end.
  if (isDevnet()) {
    const fromSym = intent.fromToken.toUpperCase();
    const toSym = intent.toToken.toUpperCase();
    const balanceUi =
      balances.find((b) => b.symbol.toUpperCase() === fromSym)?.uiAmount ?? 0;
    let uiAmount: number;
    if (intent.amountType === "all") {
      uiAmount = balanceUi;
    } else if (intent.amountType === "percent") {
      uiAmount = (balanceUi * (intent.amountValue ?? 100)) / 100;
    } else {
      uiAmount = intent.amountValue ?? 0;
    }
    if (!Number.isFinite(uiAmount) || uiAmount <= 0) {
      return NextResponse.json({
        status: "clarify",
        question: `I couldn't determine an amount — your devnet ${fromSym} balance looks empty. Use the Airdrop button to fund your wallet, then tell me an exact amount?`,
      });
    }
    const userSlippage = intent.maxSlippageBps ?? 50; // default 0.5%
    const safety = checkSafety({
      quoteSlippageBps: 0,
      userMaxSlippageBps: userSlippage,
      priceImpactPct: 0,
      inputUiAmount: uiAmount,
    });
    return NextResponse.json({
      status: "ok",
      preview: {
        payUi: uiAmount.toString(),
        paySymbol: fromSym,
        receiveUi: "—",
        receiveSymbol: toSym,
        rate: "—",
        priceImpactPct: "0",
        slippageBps: 0,
        userMaxSlippageBps: userSlippage,
        route: ["Devnet"],
        networkFeeSol: null,
        simulation: {
          pass: false,
          error: "Skipped on devnet — there is no Jupiter quote to simulate.",
          logs: [],
        },
        blocked: true,
        blockReasons: [
          "Devnet mode: Jupiter quotes are only available on mainnet, so this preview has no price and cannot be executed. Switch NEXT_PUBLIC_SOLANA_NETWORK to mainnet-beta for real swaps.",
          ...safety.reasons,
        ],
        isDevnet: true,
        swapTransaction: null,
      },
    });
  }

  // 1. Resolve token symbols deterministically against the Jupiter token list.
  const [inTok, outTok] = await Promise.all([
    resolveToken(intent.fromToken),
    resolveToken(intent.toToken),
  ]);
  if (!inTok) {
    return NextResponse.json({
      status: "clarify",
      question: `I don't recognize the token "${intent.fromToken}". Which token did you mean?`,
    });
  }
  if (!outTok) {
    return NextResponse.json({
      status: "clarify",
      question: `I don't recognize the token "${intent.toToken}". Which token did you mean?`,
    });
  }

  // 2. Convert "half"/"all"/percent into an exact amount using wallet balances.
  const bal = balances.find((b) => b.symbol.toUpperCase() === inTok.symbol);
  const balanceUi = bal?.uiAmount ?? 0;
  const resolved = resolveAmount({
    amountType: intent.amountType,
    amountValue: intent.amountValue,
    balanceUiAmount: balanceUi,
    inputMint: inTok.address,
    outputMint: outTok.address,
    fromSymbol: inTok.symbol,
    toSymbol: outTok.symbol,
    inputDecimals: inTok.decimals,
    outputDecimals: outTok.decimals,
  });
  if (!resolved.baseUnits || resolved.baseUnits === "0") {
    return NextResponse.json({
      status: "clarify",
      question: `I couldn't determine an amount — your ${inTok.symbol} balance looks empty. Connect your wallet and tell me an exact amount?`,
    });
  }

  // 3. Request a real Jupiter quote.
  const userSlippage = intent.maxSlippageBps ?? 50; // default 0.5%
  let quote;
  try {
    quote = await getQuote({
      inputMint: resolved.inputMint,
      outputMint: resolved.outputMint,
      amountBaseUnits: resolved.baseUnits,
      slippageBps: userSlippage,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Quote failed" },
      { status: 502 }
    );
  }

  const outUi =
    Number(quote.outAmount) / 10 ** outTok.decimals;
  const inUi = Number(quote.inAmount) / 10 ** inTok.decimals;
  const rate = inUi > 0 ? outUi / inUi : 0;
  const priceImpactPct = Number(quote.priceImpactPct) || 0;

  // 4. Safety checks (deterministic blocks).
  const safety = checkSafety({
    quoteSlippageBps: quote.slippageBps,
    userMaxSlippageBps: userSlippage,
    priceImpactPct,
    inputUiAmount: resolved.uiAmount,
  });

  // 5. Build the swap transaction + simulate (no signing here).
  let swapTransaction: string | null = null;
  let simulation: { pass: boolean; error: string | null; logs: string[] } = {
    pass: false,
    error: "Simulation skipped — connect wallet to simulate.",
    logs: [],
  };
  let networkFeeSol: number | null = null;

  if (walletAddress) {
    try {
      swapTransaction = await buildSwapTransaction({
        quoteResponse: quote.raw,
        userPublicKey: walletAddress,
      });
      const connection = new Connection(rpcUrl(), "confirmed");
      const buf = Buffer.from(swapTransaction, "base64");
      const tx = VersionedTransaction.deserialize(buf);
      const sim = await connection.simulateTransaction(tx, { sigVerify: false });
      simulation = {
        pass: !sim.value.err,
        error: sim.value.err ? JSON.stringify(sim.value.err) : null,
        logs: sim.value.logs ?? [],
      };
      const fee = await connection.getFeeForMessage(tx.message, "confirmed");
      networkFeeSol = fee.value != null ? fee.value / 1e9 : null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Simulation failed";
      simulation = {
        pass: false,
        // The public mainnet RPC rejects browser/serverless traffic (403) —
        // point at a dedicated RPC instead of showing a raw JSON-RPC dump.
        error: /403|access forbidden/i.test(msg)
          ? "Simulation skipped: the public Solana RPC rejected the request (403). Set NEXT_PUBLIC_SOLANA_RPC_URL to a dedicated RPC endpoint (e.g. Helius, Alchemy, or QuickNode)."
          : msg,
        logs: [],
      };
    }
  }

  const route = quote.routePlan
    .map((r) => r.swapInfo.label ?? r.swapInfo.ammKey.slice(0, 6))
    .filter(Boolean);

  return NextResponse.json({
    status: "ok",
    preview: {
      payUi: inUi.toString(),
      paySymbol: inTok.symbol,
      receiveUi: outUi.toString(),
      receiveSymbol: outTok.symbol,
      rate: rate.toString(),
      priceImpactPct: priceImpactPct.toString(),
      slippageBps: quote.slippageBps,
      userMaxSlippageBps: userSlippage,
      route: route.length ? route : ["Jupiter"],
      networkFeeSol,
      simulation,
      blocked: !safety.allowed,
      blockReasons: safety.reasons,
      isDevnet: false,
      inputMint: resolved.inputMint,
      outputMint: resolved.outputMint,
      inputBaseUnits: resolved.baseUnits,
      quoteResponse: quote.raw,
      swapTransaction,
    },
  });
}
