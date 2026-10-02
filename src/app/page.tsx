"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction } from "@solana/web3.js";
import { Mic, MicOff, Loader2, ArrowRightLeft, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch, Badge } from "@/components/ui/controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBalances } from "@/components/use-balances";
import { PreviewCard, type PreviewData } from "@/components/preview-card";
import { HistoryList, loadHistory, saveHistory, type HistoryItem } from "@/components/history-list";
import { EXPLORER_TX, formatNum } from "@/lib/utils";
import { buildPreviewSummary, speak } from "@/lib/speech";
import type { SwapIntent } from "@/lib/intent-schema";

/** Decode base64 (browser-safe, no Node Buffer needed on the client). */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Minimal Web Speech API types (standard + webkit-prefixed).
interface SpeechRecognitionResultItem {
  transcript: string;
  isFinal?: boolean;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: ArrayLike<SpeechRecognitionResultItem> & { isFinal: boolean };
}
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}
interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

function Terminal() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { balances, loading: balLoading, error: balError } = useBalances();

  const [command, setCommand] = useState("swap half my SOL into USDC if slippage is under 0.5 percent");
  const [listening, setListening] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [intent, setIntent] = useState<SwapIntent | null>(null);
  const [clarify, setClarify] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [swapTxB64, setSwapTxB64] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ sig: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [interim, setInterim] = useState("");
  const [mounted, setMounted] = useState(false);
  const recogRef = useRef<SpeechRecognitionInstance | null>(null);
  const baseCommandRef = useRef("");

  // Gate browser-only wallet UI behind mount so the server prerender and the
  // first client render match — WalletMultiButton reads window/localStorage
  // internally and otherwise triggers a hydration mismatch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Stop recognition on unmount so the mic indicator can't get stuck.
  useEffect(() => {
    return () => {
      try {
        recogRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // Load persisted history on mount. Deliberately in an effect (not a lazy
  // useState initializer) so the server prerender and first client render
  // both start empty — reading localStorage during render would hydrate-mismatch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(loadHistory());
  }, []);

  const pushHistory = useCallback((item: HistoryItem) => {
    setHistory((prev) => {
      const next = [item, ...prev].slice(0, 50);
      saveHistory(next);
      return next;
    });
  }, []);

  const toggleMic = useCallback(() => {
    if (listening) {
      try {
        recogRef.current?.stop();
      } catch {
        /* ignore */
      }
      setListening(false);
      setInterim("");
      return;
    }
    const SR = getSpeechRecognition();
    if (!SR) {
      setError(
        "Voice dictation isn't supported in this browser — type instead. (Chrome or Edge supports it; Firefox/Safari don't expose live speech recognition.)"
      );
      return;
    }
    setError(null);
    const recog = new SR();
    recog.lang = "en-US";
    recog.continuous = false;
    recog.interimResults = true;
    baseCommandRef.current = command;
    recog.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (finalText) {
        const base = baseCommandRef.current.trim();
        const next = base ? `${base} ${finalText.trim()}` : finalText.trim();
        baseCommandRef.current = next;
        setCommand(next);
        setInterim("");
      } else {
        setInterim(interimText.trim());
      }
    };
    recog.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("Microphone access was blocked — allow mic permission in the browser and try again.");
      } else if (e.error === "no-speech") {
        setError("No speech detected — try again, speaking clearly.");
      } else if (e.error !== "aborted") {
        setError(`Dictation error (${e.error}) — you can type instead.`);
      }
      setListening(false);
      setInterim("");
    };
    recog.onend = () => {
      setListening(false);
      setInterim("");
    };
    try {
      recog.start();
    } catch {
      setError("Could not start dictation — you can type instead.");
      return;
    }
    recogRef.current = recog;
    setListening(true);
  }, [listening, command]);

  const handleParse = useCallback(async () => {
    setParsing(true);
    setError(null);
    setClarify(null);
    setPreview(null);
    setSwapTxB64(null);
    setResult(null);
    setIntent(null);
    try {
      const pr = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: command, balances }),
      });
      const pj = await pr.json();
      if (pj.status === "clarify") {
        setClarify(pj.question);
        return;
      }
      if (!pj.intent) {
        setClarify("Sorry, I couldn't parse that. Try e.g. “swap half my SOL into USDC”.");
        return;
      }
      setIntent(pj.intent as SwapIntent);

      const qr = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: pj.intent,
          balances,
          walletAddress: publicKey?.toBase58(),
        }),
      });
      const qj = await qr.json();
      if (qj.status === "clarify") {
        setClarify(qj.question);
        return;
      }
      if (qj.error) {
        setError(qj.error);
        return;
      }
      setPreview(qj.preview as PreviewData);
      setSwapTxB64(qj.preview.swapTransaction);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parse failed");
    } finally {
      setParsing(false);
    }
  }, [command, balances, publicKey]);

  const handleSpeak = useCallback(() => {
    if (!preview) return;
    speak(
      buildPreviewSummary({
        fromSymbol: preview.paySymbol,
        toSymbol: preview.receiveSymbol,
        payUi: formatNum(preview.payUi),
        receiveUi: formatNum(preview.receiveUi),
        rate: `1 ${preview.paySymbol} ≈ ${formatNum(preview.rate)} ${preview.receiveSymbol}`,
        priceImpactPct: formatNum(preview.priceImpactPct, 3),
        slippageLimit: `${(preview.userMaxSlippageBps / 100).toFixed(2)} percent`,
        blocked: preview.blocked,
        simulationPass: preview.simulation.pass,
      })
    );
  }, [preview]);

  const handleConfirm = useCallback(async () => {
    if (!preview) return;
    if (preview.blocked) return;
    const summary = `${formatNum(preview.payUi)} ${preview.paySymbol} → ~${formatNum(preview.receiveUi)} ${preview.receiveSymbol}`;
    if (demoMode) {
      pushHistory({
        id: crypto.randomUUID(),
        time: new Date().toISOString(),
        command,
        summary: `${summary} (demo — not sent)`,
        signature: null,
        demo: true,
      });
      setResult(null);
      setError(null);
      return;
    }
    if (!publicKey || !sendTransaction) {
      setError("Connect your wallet first.");
      return;
    }
    if (!swapTxB64) {
      setError("No swap transaction available — reconnect wallet and parse again.");
      return;
    }
    setConfirming(true);
    setError(null);
    try {
      const tx = VersionedTransaction.deserialize(base64ToBytes(swapTxB64));
      const sig = await sendTransaction(tx, connection, { skipPreflight: false });
      setResult({ sig });
      pushHistory({
        id: crypto.randomUUID(),
        time: new Date().toISOString(),
        command,
        summary,
        signature: sig,
        demo: false,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setConfirming(false);
    }
  }, [preview, demoMode, publicKey, sendTransaction, swapTxB64, connection, command, pushHistory]);

  const walletShort = useMemo(
    () => (publicKey ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}` : null),
    [publicKey]
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900">
            <ArrowRightLeft className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">VoiceSwap</h1>
            <p className="text-sm text-zinc-500">Voice-driven swap terminal for Solana · Jupiter-powered</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={demoMode} onCheckedChange={setDemoMode} label="Demo mode" />
            <span className="font-medium">Demo Mode {demoMode ? "ON" : "OFF"}</span>
          </label>
          {mounted ? <WalletMultiButton /> : null}
        </div>
      </header>

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error}</div>
      )}

      <div className="grid gap-5 md:grid-cols-5">
        <div className="flex flex-col gap-5 md:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Dictate a swap</CardTitle>
                <Button variant="outline" size="sm" onClick={toggleMic}>
                  {listening ? <MicOff /> : <Mic />}
                  {listening ? "Stop" : "Dictate"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Textarea
                value={interim ? `${command}${command ? " " : ""}${interim}…` : command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder='Try: "swap half my SOL into USDC if slippage is under 0.5 percent"'
                rows={4}
              />
              {listening && (
                <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400" role="status">
                  <span className="relative flex size-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-red-600" />
                  </span>
                  Listening… speak your swap command.
                </p>
              )}
              <div className="flex items-center gap-2">
                <Button onClick={handleParse} disabled={parsing || !command.trim()} size="lg" className="flex-1">
                  {parsing ? <Loader2 className="animate-spin" /> : null}
                  {parsing ? "Parsing…" : "Parse"}
                </Button>
                {preview && (
                  <Button variant="outline" size="lg" onClick={handleSpeak} title="Read preview aloud">
                    <Volume2 /> Speak
                  </Button>
                )}
              </div>
              {clarify && (
                <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                  <span className="font-semibold">Need clarification: </span>{clarify}
                </div>
              )}
              {intent && (
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="muted">{intent.action}</Badge>
                  <Badge variant="muted">{intent.fromToken} → {intent.toToken}</Badge>
                  <Badge variant="muted">{intent.amountType}{intent.amountValue != null ? ` ${intent.amountValue}` : ""}</Badge>
                  {intent.maxSlippageBps != null && <Badge variant="muted">max slip {(intent.maxSlippageBps / 100).toFixed(2)}%</Badge>}
                </div>
              )}
            </CardContent>
          </Card>

          <PreviewCard
            preview={preview}
            demoMode={demoMode}
            confirming={confirming}
            onConfirm={handleConfirm}
            onSpeak={handleSpeak}
          />

          {result && (
            <Card className="border-emerald-300">
              <CardContent className="pt-5">
                <p className="text-sm font-semibold text-emerald-700">Swap sent ✓</p>
                <a
                  href={EXPLORER_TX(result.sig)}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-mono text-sm text-blue-600 underline"
                >
                  {result.sig} ↗ explorer
                </a>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-5 md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Wallet {walletShort && <span className="font-mono text-sm">({walletShort})</span>}</CardTitle>
            </CardHeader>
            <CardContent>
              {!publicKey ? (
                <p className="text-sm text-zinc-500">Connect your wallet to see balances. Balances are sent to the parser so “half” / “all” resolve exactly.</p>
              ) : balError ? (
                <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{balError}</p>
              ) : balLoading ? (
                <p className="text-sm text-zinc-500">Loading balances…</p>
              ) : balances.length === 0 ? (
                <p className="text-sm text-zinc-500">No balances found.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {balances.map((b) => (
                    <li key={b.mint ?? b.symbol} className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900">
                      <span className="font-semibold">{b.symbol}</span>
                      <span className="font-mono">{formatNum(b.uiAmount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <HistoryList items={history} />
        </div>
      </div>

      <footer className="text-center text-xs text-zinc-400">
        VoiceSwap · LLM parses intent only — Jupiter + deterministic code build, simulate &amp; send. Demo Mode ON by default.
      </footer>
    </main>
  );
}

export default function Page() {
  return <Terminal />;
}
