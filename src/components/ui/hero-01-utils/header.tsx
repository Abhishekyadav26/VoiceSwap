"use client";

import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

export interface NavigationSection {
  title: string;
  href: string;
  isActive?: boolean;
}

function scrollTo(hash: string) {
  document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
}

export default function Header({
  navigationData,
}: {
  navigationData: NavigationSection[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/60 bg-white/80 backdrop-blur-md dark:border-zinc-800/60 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <a href="#top" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900">
            <ArrowRightLeft className="size-4" />
          </span>
          <span className="font-bold tracking-tight">VoiceSwap</span>
        </a>
        <nav className="hidden items-center gap-1 md:flex">
          {navigationData.map((item) => (
            <a
              key={item.title}
              href={item.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                item.isActive ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500"
              }`}
            >
              {item.title}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="hidden md:inline-flex"
            onClick={() => scrollTo("#terminal")}
          >
            Open terminal
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button variant="outline" size="sm" className="md:hidden">
                  Menu
                </Button>
              }
            />
            <SheetContent side="right">
              <nav className="mt-8 flex flex-col gap-1">
                {navigationData.map((item) => (
                  <a
                    key={item.title}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {item.title}
                  </a>
                ))}
                <Button
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => {
                    setOpen(false);
                    scrollTo("#terminal");
                  }}
                >
                  Open terminal
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
