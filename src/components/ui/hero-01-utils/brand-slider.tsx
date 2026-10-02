"use client";

import { Marquee } from "@/components/ui/marquee";

export interface BrandList {
  name: string;
}

const DOT_COLORS = [
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-sky-500",
  "bg-rose-500",
];

export default function BrandSlider({
  brandList,
}: {
  brandList: BrandList[];
}) {
  return (
    <section aria-label="Powered by" className="mx-auto w-full max-w-5xl px-4 pb-10">
      <p className="text-center text-xs font-medium uppercase tracking-widest text-zinc-400">
        Powered by
      </p>
      <Marquee pauseOnHover className="mt-4 [--duration:24s]">
        {brandList.map((b, i) => (
          <span
            key={b.name}
            className="mx-3 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
          >
            <span className={`size-2 rounded-full ${DOT_COLORS[i % DOT_COLORS.length]}`} />
            {b.name}
          </span>
        ))}
      </Marquee>
    </section>
  );
}
