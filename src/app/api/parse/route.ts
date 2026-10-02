import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  SYSTEM_PROMPT,
  WalletBalanceSchema,
  parseModelJson,
} from "@/lib/intent-schema";

const BodySchema = z.object({
  text: z.string().min(1).max(2000),
  balances: z.array(WalletBalanceSchema).default([]),
});

function fallbackParse(text: string) {
  const t = text.toLowerCase();
  if (!t.includes("swap") && !t.includes("convert") && !t.includes("exchange")) {
    return {
      status: "clarify" as const,
      question:
        "I only handle swaps. What would you like to swap? (e.g. “swap half my SOL into USDC”).",
    };
  }
  // swap <amt> [of] [my] <FROM> into/to/for <TO>
  const m = t.match(
    /(?:swap|convert|exchange)\s+(all|everything|max|half|quarter|\d+(?:\.\d+)?\s*(?:%|percent)?)\s*(?:of\s+)?(?:my\s+)?([a-z]{2,10})?\s*(?:into|to|for)\s+([a-z]{2,10})/
  );
  if (!m) {
    return {
      status: "clarify" as const,
      question:
        "Which token should I swap from, to which token, and how much? (e.g. “swap 1.5 SOL into USDC”).",
    };
  }
  const [, amtRaw, fromRaw, toRaw] = m;
  const fromToken = (fromRaw || "SOL").toUpperCase();
  const toToken = (toRaw || "").toUpperCase();
  if (!toToken) {
    return { status: "clarify" as const, question: "Which token should I swap into?" };
  }
  let amountType: "exact" | "percent" | "all" = "exact";
  let amountValue: number | null = null;
  const amt = amtRaw.trim();
  if (["all", "everything", "max"].includes(amt)) {
    amountType = "all";
  } else if (amt === "half") {
    amountType = "percent";
    amountValue = 50;
  } else if (amt === "quarter") {
    amountType = "percent";
    amountValue = 25;
  } else if (amt.endsWith("%") || amt.endsWith("percent")) {
    amountType = "percent";
    amountValue = parseFloat(amt);
  } else if (!isNaN(Number(amt))) {
    amountType = "exact";
    amountValue = Number(amt);
  }
  const slip = t.match(/slippage.*?(\d+(?:\.\d+)?)\s*%/);
  const maxSlippageBps = slip ? Math.round(parseFloat(slip[1]) * 100) : null;
  if (fromToken === toToken) {
    return {
      status: "clarify" as const,
      question: `Source and destination are both ${fromToken}. Which token should I swap into?`,
    };
  }
  return {
    status: "ok" as const,
    intent: {
      action: "swap" as const,
      fromToken,
      toToken,
      amountType,
      amountValue,
      maxSlippageBps,
      conditions: maxSlippageBps ? [`slippage under ${slip![1]}%`] : [],
    },
  };
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }
  const { text, balances } = parsed.data;
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  if (!apiKey) {
    // Deterministic fallback so Demo Mode works without a key.
    return NextResponse.json({ ...fallbackParse(text), fallback: true });
  }

  try {
    // Groq exposes an OpenAI-compatible chat API, so plain fetch is enough —
    // no extra SDK dependency required.
    const balanceCtx =
      balances.length > 0
        ? balances.map((b) => `${b.symbol}: ${b.uiAmount}`).join(", ")
        : "unknown (wallet not connected)";
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 512,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Command: "${text}"\nWallet balances: ${balanceCtx}\nReturn JSON only.`,
          },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`Groq API error (${res.status}): ${(await res.text()).slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const raw = data.choices?.[0]?.message?.content ?? "";
    return NextResponse.json(parseModelJson(raw));
  } catch (err) {
    console.error("Groq parse error, using fallback:", err);
    return NextResponse.json({ ...fallbackParse(text), fallback: true });
  }
}
