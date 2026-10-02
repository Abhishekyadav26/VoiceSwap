# VoiceSwap — voice-driven swap terminal for Solana

Dictate a command like **“swap half my SOL into USDC if slippage is under 0.5 percent”**,
get a Jupiter quote with safety checks + simulation, then confirm in your wallet.

## How it works

- **LLM parses intent only.** `POST /api/parse` sends the text + wallet balances to the
  Claude API and asks for structured JSON only:
  `action, fromToken, toToken, amountType (exact|percent|all), amountValue, maxSlippageBps, conditions`.
  Validated with Zod (`src/lib/intent-schema.ts`). Ambiguous/unsupported → clarification question, never a guess.
- **Deterministic code does everything else.**
  Token symbols resolve against the Jupiter token list, `half`/`all` convert to exact
  amounts from the wallet balance, and a quote comes from Jupiter (`src/lib/jupiter.ts`).
- **Safety checks** (`src/lib/safety.ts`) block the swap when:
  - quote slippage exceeds the user's limit,
  - price impact is above 2%,
  - the amount exceeds `NEXT_PUBLIC_MAX_SWAP_AMOUNT`.
- **Preview card** shows you-pay / you-receive / rate / price impact / slippage limit /
  route / network fee + transaction simulation pass/fail.
- **Confirm** signs with Solana Wallet Adapter and sends. Shows the signature with an
  explorer link and saves command + result to a history list (localStorage).
- **Demo Mode (ON by default)** fetches real quotes and simulates but never sends.
  Turn it off to execute for real.
- **Read-aloud** summary via the browser Speech API (`src/lib/speech.ts`).

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000, connect Phantom/Solflare, dictate or type a command, hit **Parse**.

## Env vars

| Var | Required | Description |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | No (falls back to heuristic parser) | Claude API key for intent parsing |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | No (defaults to mainnet-beta) | Solana RPC endpoint |
| `NEXT_PUBLIC_MAX_SWAP_AMOUNT` | No (default `1000`) | Max input UI amount per swap |

## Project layout

```
src/
  app/
    api/parse/route.ts      # Claude intent parsing + Zod validation
    api/quote/route.ts      # token resolve → amount → Jupiter quote → safety → simulate
    page.tsx                # main terminal screen
  lib/
    intent-schema.ts        # Zod intent schema + Claude prompt
    jupiter.ts              # Jupiter token list / quote / swap-tx client
    safety.ts               # deterministic safety checks
    speech.ts               # browser speech summary
    utils.ts                # cn(), explorer links
  components/
    wallet-provider.tsx     # Solana wallet adapter setup
    use-balances.ts         # SOL + SPL balance hook
    preview-card.tsx        # quote / safety / simulation card
    history-list.tsx        # command + signature history
    ui/                     # minimal shadcn-style button/card/textarea/switch/badge
```

## Security notes

- The LLM never builds or signs transactions.
- Simulation runs before confirm; blocked swaps cannot be sent from the UI.
- Demo Mode is ON by default — real sends only happen with the toggle OFF + wallet signature.
