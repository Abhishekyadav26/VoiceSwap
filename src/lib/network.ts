/**
 * Solana network selection — mainnet-beta (real Jupiter swaps) or devnet
 * (safe testing: balances + parsing work, Jupiter quotes unavailable).
 *
 * Read from NEXT_PUBLIC_SOLANA_NETWORK so client components and API routes
 * agree. Works in both runtimes since NEXT_PUBLIC_* vars are inlined.
 */

export type SolanaNetwork = "mainnet-beta" | "devnet";

export function getNetwork(): SolanaNetwork {
  return process.env.NEXT_PUBLIC_SOLANA_NETWORK === "devnet"
    ? "devnet"
    : "mainnet-beta";
}

export function isDevnet(): boolean {
  return getNetwork() === "devnet";
}

/** Explorer cluster query: mainnet needs none, devnet needs ?cluster=devnet. */
export function explorerCluster(): "mainnet-beta" | "devnet" {
  return getNetwork();
}
