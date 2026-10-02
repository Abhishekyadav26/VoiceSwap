import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { SolanaProviders } from "@/components/wallet-provider";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VoiceSwap — voice-driven swap terminal for Solana",
  description: "Dictate swaps, preview Jupiter quotes with safety checks, and confirm on Solana.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body
        className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50"
        // Extensions (Grammarly, password managers…) inject attributes into
        // <body> before React loads, which trips hydration warnings that are
        // not app bugs. Suppress only for this element's own attributes.
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <SolanaProviders>{children}</SolanaProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
