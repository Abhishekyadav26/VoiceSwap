"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Switch({
  checked,
  onCheckedChange,
  className,
  label,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ?? "toggle"}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors",
        checked ? "bg-emerald-600" : "bg-zinc-300 dark:bg-zinc-700",
        className
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "success" | "warn" | "danger" | "muted" }) {
  const map = {
    default: "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900",
    success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100",
    warn: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100",
    danger: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
    muted: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  } as const;
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", map[variant], className)}
      {...props}
    />
  );
}
