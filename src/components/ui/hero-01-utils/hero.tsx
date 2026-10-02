"use client";

import Image from "next/image";
import Link from "next/link";
import { Mic, ShieldCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/controls";

export interface AvatarList {
  image: string;
  name?: string;
}

const STEPS = [
  {
    icon: Mic,
    title: "Dictate",
    text: "Say the swap — “half my SOL into USDC”.",
  },
  {
    icon: ShieldCheck,
    title: "Verify",
    text: "Jupiter quote with safety checks + simulation.",
  },
  {
    icon: Star,
    title: "Confirm",
    text: "Approve once in your wallet. Done.",
  },
];

export default function HeroSection({
  avatarList,
}: {
  avatarList: AvatarList[];
}) {
  return (
    <section className="relative flex min-h-[calc(100svh-3.5rem)] flex-col justify-center overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-72 max-w-3xl rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/10"
      />
      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-4 pb-10 pt-12 text-center md:pt-16">
        <Badge variant="muted">🎙️ Voice-powered swaps on Solana</Badge>
        <h1 className="mt-4 max-w-2xl text-4xl font-bold tracking-tight md:text-5xl">
          Just say the swap.
          <br />
          <span className="text-zinc-500">We handle the rest.</span>
        </h1>
        <p className="mt-4 max-w-xl text-base text-zinc-500">
          Dictate a command, get a Jupiter quote with deterministic safety
          checks and simulation, then confirm once in your wallet.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" nativeButton={false} render={<Link href="/terminal" />}>
            Start swapping
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() =>
              document
                .querySelector("#how")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            See how it works
          </Button>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <div className="flex -space-x-2">
            {avatarList.map((a, i) => (
              <Image
                key={i}
                src={a.image}
                alt={a.name ?? `Trader ${i + 1}`}
                width={32}
                height={32}
                loading="lazy"
                className="size-8 rounded-full border-2 border-white object-cover dark:border-zinc-950"
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="size-3.5 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <span className="text-xs text-zinc-500">
            Loved by Solana traders
          </span>
        </div>
        <dl id="how" className="mt-10 grid w-full max-w-2xl scroll-mt-20 grid-cols-1 gap-3 text-left sm:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.title}
              className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <s.icon className="size-5 text-emerald-600 dark:text-emerald-400" />
              <dt className="mt-2 text-sm font-semibold">{s.title}</dt>
              <dd className="mt-1 text-xs text-zinc-500">{s.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
