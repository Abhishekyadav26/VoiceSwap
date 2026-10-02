import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const EXPLORER_TX = (sig: string, cluster = "mainnet-beta") =>
  `https://explorer.solana.com/tx/${sig}${cluster === "devnet" ? "?cluster=devnet" : ""}`;

export function formatNum(n: string | number, digits = 6): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n);
  return v.toLocaleString("en-US", { maximumFractionDigits: digits });
}
