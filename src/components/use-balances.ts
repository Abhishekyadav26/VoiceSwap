"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import type { WalletBalance } from "@/lib/intent-schema";

const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS1VTFL9F5AAoyW5ww6Y5p4E";

const SYMBOL_BY_MINT: Record<string, { symbol: string; decimals: number }> = {
  So11111111111111111111111111111111111111112: { symbol: "SOL", decimals: 9 },
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: "USDC", decimals: 6 },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: "USDT", decimals: 6 },
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: { symbol: "JUP", decimals: 6 },
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB4p: { symbol: "BONK", decimals: 5 },
};

export function useBalances() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setBalances([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const lamports = await connection.getBalance(publicKey);
      const out: WalletBalance[] = [
        { symbol: "SOL", mint: "So11111111111111111111111111111111111111112", uiAmount: lamports / LAMPORTS_PER_SOL, decimals: 9 },
      ];
      const [parsedLegacy, parsed2022] = await Promise.all([
        connection.getParsedTokenAccountsByOwner(publicKey, {
          programId: new PublicKey(TOKEN_PROGRAM_ID),
        }),
        connection.getParsedTokenAccountsByOwner(publicKey, {
          programId: new PublicKey(TOKEN_2022_PROGRAM_ID),
        }).catch(() => null), // Token-2022 may be unsupported on some RPCs
      ]);
      const seen = new Set<string>();
      for (const accs of [parsedLegacy, parsed2022]) {
        if (!accs) continue;
        for (const { account } of accs.value) {
          const info = (account.data as { parsed?: { info?: { mint?: string; tokenAmount?: { uiAmount?: number; decimals?: number } } } }).parsed?.info;
          const mint = info?.mint ?? "";
          const uiAmount = info?.tokenAmount?.uiAmount ?? 0;
          if (!mint || uiAmount <= 0 || seen.has(mint)) continue;
          seen.add(mint);
          const known = SYMBOL_BY_MINT[mint];
          out.push({
            symbol: known?.symbol ?? `${mint.slice(0, 4)}…${mint.slice(-4)}`,
            mint,
            uiAmount,
            decimals: info?.tokenAmount?.decimals ?? known?.decimals ?? 6,
          });
        }
      }
      setBalances(out);
    } catch (e) {
      console.error("balance fetch failed", e);
      const msg = e instanceof Error ? e.message : "Balance fetch failed";
      let via = "";
      try {
        via = ` (via ${new URL(connection.rpcEndpoint).hostname})`;
      } catch {
        /* ignore malformed endpoint */
      }
      // The public mainnet RPC rejects browser traffic (403). Tell the user
      // exactly what to do instead of leaving an empty balance list.
      setError(
        /403|access forbidden/i.test(msg)
          ? `Balance lookup was rejected by the Solana RPC (403)${via}. Set NEXT_PUBLIC_SOLANA_RPC_URL in .env.local to a dedicated mainnet RPC endpoint (e.g. Helius, Alchemy, or QuickNode) and restart the dev server.`
          : `Balance lookup failed${via}: ${msg}`
      );
      setBalances([]);
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  // Re-fetch when the wallet/connection changes. This syncs React state with
  // the external chain — a legitimate effect, not derived state.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  return { balances, loading, refresh, error };
}
