"use client";

import { MoonIcon } from "@/components/icons/moon-icon";
import { SunIcon } from "@/components/icons/sun-icon";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";

export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme } = useTheme();

  function toggle() {
    // Read current state from the DOM — always correct regardless of React render cycle
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "light" : "dark");
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className={cn(
        "flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {/* CSS controls visibility — no React state, no hydration mismatch */}
      <SunIcon className="size-5 hidden dark:block" />
      <MoonIcon className="size-5 block dark:hidden" />
    </button>
  );
}
