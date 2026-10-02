# AGENTS.md — VoiceSwap

Next.js 16 (App Router) + React 19 + TS + Tailwind v4. Solana swap terminal: voice command → Groq intent parse → Jupiter quote → safety/simulate → wallet confirm.

## Commands

- `npm run dev` / `npm run build` / `npm start` / `npm run lint` (`eslint`, no test/typecheck scripts — use `npx tsc --noEmit` and `npm run build` to verify).
- No CI, no pre-commit hooks, no test suite. `npm run build` is the gate.
- Env: `cp .env.example .env.local`. `GROQ_API_KEY` is server-only and optional (`/api/parse` falls back to a heuristic parser without it). Only `NEXT_PUBLIC_*` vars reach the client.

## Architecture (don't blur these)

- LLM parses intent ONLY (`src/app/api/parse/route.ts` + `src/lib/intent-schema.ts`). It never builds/signs transactions. Ambiguous input must return `{status:"clarify", question}` — never guess.
- Deterministic flow in `src/app/api/quote/route.ts`: `resolveToken` → `resolveAmount` (from wallet balances) → Jupiter quote → `checkSafety` → build swap tx + `simulateTransaction`. All Jupiter logic lives in `src/lib/jupiter.ts`, blocks in `src/lib/safety.ts` (slippage > user limit, price impact > 2%, amount > `NEXT_PUBLIC_MAX_SWAP_AMOUNT`).
- Client (`src/app/page.tsx`) only signs/sends via wallet adapter. Demo Mode ON = never send.
- `SolanaProviders` is mounted once in `src/app/layout.tsx` — do not add another provider in pages.
- `@/*` maps to `./src/*` (tsconfig). UI primitives in `src/components/ui/` are hand-rolled shadcn-style — there is no shadcn CLI config; add variants there, don't scaffold new systems.

## Gotchas

- `src/app/api/quote/route.ts` uses `Buffer` (Node runtime) to deserialize the Jupiter `swapTransaction`; keep API routes on the Node runtime.
- Jupiter deps: quote/swap via `https://lite-api.jup.ag/swap/v1/*`, token list via `tokens.jup.ag` with a hardcoded well-known-mint fallback in `src/lib/jupiter.ts` — keep that fallback working offline.
- Tailwind v4 (`@import "tailwindcss"` in `globals.css`); there is no `tailwind.config`.
- This checkout lives on a Windows-mounted WSL path (`/mnt/c/...` + OneDrive): `npm install` can fail with `ENOTEMPTY … rename … browserslist`. If it does, copy the repo (excluding `node_modules`/`.next`) to a Linux-fs dir (e.g. `/tmp/vs-build`), install/build there, and copy sources back.
