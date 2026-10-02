"use client";

import { EXPLORER_TX } from "@/lib/utils";
import { explorerCluster } from "@/lib/network";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/controls";

export interface HistoryItem {
  id: string;
  time: string;
  command: string;
  summary: string;
  signature: string | null;
  demo: boolean;
}

const KEY = "voiceswap-history";

export function loadHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as HistoryItem[];
  } catch {
    return [];
  }
}

export function saveHistory(items: HistoryItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, 50)));
  } catch { /* ignore */ }
}

export function HistoryList({ items }: { items: HistoryItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-zinc-500">No swaps yet. Confirmed commands will appear here.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((h) => (
              <li key={h.id} className="rounded-xl border border-zinc-100 p-3 text-sm dark:border-zinc-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-zinc-500">{new Date(h.time).toLocaleString()}</span>
                  {h.demo ? <Badge variant="warn">demo</Badge> : <Badge variant="success">sent</Badge>}
                </div>
                <div className="mt-1 font-medium">“{h.command}”</div>
                <div className="text-zinc-500">{h.summary}</div>
                {h.signature && (
                  <a
                    className="mt-1 inline-block font-mono text-xs text-blue-600 underline"
                    href={EXPLORER_TX(h.signature, explorerCluster())}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {h.signature.slice(0, 24)}… ↗ explorer
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
