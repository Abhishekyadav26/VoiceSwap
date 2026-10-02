"use client";

import { Volume2, ShieldAlert, ShieldCheck, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNum } from "@/lib/utils";

export interface PreviewData {
  payUi: string;
  paySymbol: string;
  receiveUi: string;
  receiveSymbol: string;
  rate: string;
  priceImpactPct: string;
  slippageBps: number;
  userMaxSlippageBps: number;
  route: string[];
  networkFeeSol: number | null;
  simulation: { pass: boolean; error: string | null; logs: string[] };
  blocked: boolean;
  blockReasons: string[];
  swapTransaction: string | null;
  isDevnet: boolean;
}

export function PreviewCard({
  preview,
  demoMode,
  confirming,
  onConfirm,
  onSpeak,
}: {
  preview: PreviewData | null;
  demoMode: boolean;
  confirming: boolean;
  onConfirm: () => void;
  onSpeak: () => void;
}) {
  if (!preview) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">
            Dictate a command and hit Parse — a swap preview with quote, safety checks and simulation will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className={preview.blocked ? "border-red-300" : "border-emerald-300"}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Swap preview</CardTitle>
          <Button variant="ghost" size="sm" onClick={onSpeak} title="Read aloud">
            <Volume2 /> Read aloud
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900">
            <div className="text-xs text-zinc-500">You pay</div>
            <div className="text-lg font-semibold">{formatNum(preview.payUi)} {preview.paySymbol}</div>
          </div>
          <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900">
            <div className="text-xs text-zinc-500">You receive (est.)</div>
            <div className="text-lg font-semibold">{formatNum(preview.receiveUi)} {preview.receiveSymbol}</div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-zinc-500">Rate</dt>
          <dd className="text-right font-mono">1 {preview.paySymbol} ≈ {formatNum(preview.rate)} {preview.receiveSymbol}</dd>
          <dt className="text-zinc-500">Price impact</dt>
          <dd className="text-right font-mono">{formatNum(preview.priceImpactPct, 3)}%</dd>
          <dt className="text-zinc-500">Slippage limit</dt>
          <dd className="text-right font-mono">{(preview.userMaxSlippageBps / 100).toFixed(2)}% (quote {(preview.slippageBps / 100).toFixed(2)}%)</dd>
          <dt className="text-zinc-500">Route</dt>
          <dd className="text-right font-mono text-xs">{preview.route.join(" → ")}</dd>
          <dt className="text-zinc-500">Network fee</dt>
          <dd className="text-right font-mono">{preview.networkFeeSol != null ? `~${preview.networkFeeSol.toFixed(6)} SOL` : "—"}</dd>
        </dl>

        <div className="flex flex-wrap gap-2">
          {preview.simulation.pass ? (
            <Badge variant="success"><FlaskConical className="mr-1 size-3" /> Simulation: pass</Badge>
          ) : (
            <Badge variant="danger"><FlaskConical className="mr-1 size-3" /> Simulation: {preview.simulation.error ? "fail" : "skipped"}</Badge>
          )}
          {preview.blocked ? (
            <Badge variant="danger"><ShieldAlert className="mr-1 size-3" /> Blocked</Badge>
          ) : (
            <Badge variant="success"><ShieldCheck className="mr-1 size-3" /> Safety: ok</Badge>
          )}
          {demoMode && <Badge variant="warn">Demo mode — will not send</Badge>}
          {preview.isDevnet && <Badge variant="warn">Devnet — no Jupiter quote</Badge>}
        </div>

        {preview.simulation.error && (
          <p className="rounded-xl bg-red-50 p-3 text-xs text-red-800 dark:bg-red-950 dark:text-red-200">
            Simulation note: {preview.simulation.error.slice(0, 400)}
          </p>
        )}
        {preview.blocked && (
          <ul className="list-disc space-y-1 rounded-xl bg-red-50 p-3 pl-8 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
            {preview.blockReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}

        <Button
          size="lg"
          disabled={preview.blocked || confirming}
          onClick={onConfirm}
          variant={preview.blocked ? "secondary" : "default"}
          title={demoMode ? "Demo mode: simulates only" : "Sign and send with wallet"}
        >
          {confirming ? "Sending…" : demoMode ? "Confirm (demo — no send)" : "Confirm & swap"}
        </Button>
        {demoMode && (
          <p className="text-xs text-zinc-500">Demo Mode is on: quotes and simulation are real, but nothing is sent. Turn it off to execute for real.</p>
        )}
      </CardContent>
    </Card>
  );
}
