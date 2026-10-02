"use client";

import React, { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";

import "@solana/wallet-adapter-react-ui/styles.css";

export function SolanaProviders({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(
    () =>
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
      "https://api.mainnet-beta.solana.com",
    []
  );
  // Note: no PhantomWalletAdapter here on purpose — modern Phantom registers
  // itself as a Wallet Standard wallet, and adding its adapter logs
  // "Phantom was registered as a Standard Wallet..." and creates a duplicate entry.
  const wallets = useMemo(() => [new SolflareWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
