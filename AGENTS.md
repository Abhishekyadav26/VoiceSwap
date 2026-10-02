# AGENTS.md — VoiceSwap

Next.js 16 (App Router) + React 19 + TS + Tailwind v4. Solana swap terminal: voice command → Groq intent parse → Jupiter quote → safety/simulate → wallet confirm.

## Commands

- `npm run dev` / `npm run build` / `npm start` / `npm run lint` (`eslint`, no test/typecheck scripts — use `npx tsc --noEmit` and `npm run build` to verify).
- No test suite, no CI, no pre-commit hooks. `npm run build` is the gate.
- Env: `cp .env.example .env.local`. `GROQ_API_KEY` and `JUPITER_API_KEY` are server-only and optional. Only `NEXT_PUBLIC_*` vars reach the client, and they are baked in at startup — **restart `npm run dev` after any `.env.local` change**.

## Architecture (don't blur these)

- LLM parses intent ONLY (`src/app/api/parse/route.ts` + `src/lib/intent-schema.ts`). It never builds/signs transactions. Ambiguous input must return `{status:"clarify", question}` — never guess. Default model `openai/gpt-oss-120b` with automatic fallback to `openai/gpt-oss-20b` (llama-3.3-70b-versatile was retired by Groq in Aug 2026 — do not revert to it).
- Deterministic flow in `src/app/api/quote/route.ts`: `resolveTokenWithBalance` (FROM prefers wallet-balance mints) / `resolveToken` (TO via list) → `resolveAmount` → Jupiter quote → `checkSafety` → build swap tx + `simulateTransaction`. All Jupiter logic lives in `src/lib/jupiter.ts`, blocks in `src/lib/safety.ts` (slippage > user limit, price impact > 2%, amount > `NEXT_PUBLIC_MAX_SWAP_AMOUNT`).
- Client (`src/app/terminal/page.tsx`) only signs/sends via wallet adapter, then `confirmTransaction` before reporting success. Demo Mode ON = never send.
- Routes: `/` is the landing page (`src/components/ui/hero-01.tsx`, full-viewport hero), `/terminal` is the swap app. Landing CTAs/nav link to `/terminal` via `next/link`; terminal anchor ids (`terminal`, `preview`, `wallet`) support `/terminal#…` deep links plus a ← Home link.
- Network switch via `NEXT_PUBLIC_SOLANA_NETWORK` (`mainnet-beta` | `devnet`, see `src/lib/network.ts`). Devnet mode: balances/airdrop/parse work, but Jupiter is mainnet-only so previews carry no price and sends stay blocked. Explorer links follow the network.
- `SolanaProviders` is mounted once in `src/app/layout.tsx` — do not add another provider in pages.
- `@/*` maps to `./src/*` (tsconfig).

## UI (shadcn CLI-managed)

- `components.json` (style `base-nova`, CSS variables, icon library `lucide`). Add components with `npx shadcn@latest add <name>` — don't hand-roll duplicates in `src/components/ui/`. Magic UI items aren't in the default namespace: use full URLs (`npx shadcn@latest add "https://magicui.design/r/<name>.json"`).
- `src/lib/utils.ts` is CLI-managed (`export { cn } from "cn"`). Our `EXPLORER_TX` / `formatNum` live at the bottom of that file — `shadcn init` overwrites it, so re-append them after any re-init.
- Extra primitives (`controls.tsx` Switch/Badge, `card.tsx`, `textarea.tsx`) remain hand-rolled — add variants there. Landing pieces live in `src/components/ui/hero-01.tsx` + `hero-01-utils/` (header/hero/brand-slider).
- Primitives are Base-UI-backed: link-styled buttons use the `render` prop **plus `nativeButton={false}`** (`<Button render={<Link href=… />} nativeButton={false} />`), NOT Radix `asChild` — pasted Radix-era snippets won't typecheck, and omitting the flag logs a native-button warning.
- Theming via `next-themes` `ThemeProvider` (`attribute="class"`, system default) in `layout.tsx`; `globals.css` already has the `@custom-variant dark` this needs. Toggle lives in the terminal header; `<html>` needs `suppressHydrationWarning` for it.

## Gotchas (all verified the hard way)

- `src/app/api/quote/route.ts` uses `Buffer` (Node runtime) to deserialize the Jupiter `swapTransaction`; keep API routes on the Node runtime.
- Jupiter: quote/swap via `https://lite-api.jup.ag/swap/v1/*`, or `https://api.jup.ag/swap/v1/*` with `x-api-key` header when server-only `JUPITER_API_KEY` is set. Quotes carry `excludeRouters=jupiterz` (RFQ routes return maker-co-signed txs a wallet can't complete). The API echoes `slippageBps` back as a **string** — `src/lib/jupiter.ts` coerces with `Number()`, don't remove that.
- `tokens.jup.ag` is DNS-dead — FROM resolution prefers wallet balances, TO falls back to the hardcoded well-known mints in `src/lib/jupiter.ts`. Every mint in that file must construct via `new PublicKey()` (a past typo caused `Invalid public key input` on every balance fetch); verify with node before adding any mint, never from memory.
- SPL Token-2022 program ID is `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` (from `@solana/spl-token`, not memory). A synchronous `new PublicKey()` throw inside `Promise.all` argument evaluation bypasses per-promise `.catch()` — keep program-ID constants out of await expressions or pre-validate them.
- RPC: the public mainnet endpoint 403s browser traffic — use a dedicated RPC (Helius/Alchemy/QuickNode). The Helius **devnet faucet requires a paid plan**; the airdrop button therefore falls back to `https://api.devnet.solana.com`, then to faucet.solana.com guidance. Don't "simplify" that chain away.
- Wallet: no `PhantomWalletAdapter` — modern Phantom self-registers via Wallet Standard and the adapter logs a duplicate-registration warning (official APP.md: standard wallets are automatic; legacy adapters only for non-standard wallets). If Solflare ever warns the same way, drop the adapters array to `[]`.
- `WalletMultiButton` reads `window`/localStorage internally — it is gated behind `mounted` in `terminal/page.tsx`; don't render it unconditionally or the hydration mismatch returns. `<body>` carries `suppressHydrationWarning` for extension-injected attributes (Grammarly etc.) — leave it.
- Internal navigation must use `next/link` (`@next/next/no-html-link-for-pages` is an error); external/remote images need `next/image` + a `remotePatterns` entry in `next.config.ts` (currently allows `randomuser.me` portraits).
- API clients must parse via the `readApiJson` helper (empty/non-JSON bodies otherwise surface as `Failed to execute 'json' on 'Response'`); upstream reads in `src/lib/jupiter.ts` go through `readUpstreamJson` for clear 502s.
- Tailwind v4 (`@import "tailwindcss"` in `globals.css`); there is no `tailwind.config`.
