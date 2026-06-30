"use client";

import { createContext, use } from "react";

interface ThemeContextValue {
  setTheme: (theme: "dark" | "light") => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  setTheme: () => undefined,
});

export function useTheme() {
  return use(ThemeContext);
}

// No React state needed: the <html> class is the single source of truth.
// The anti-FOUC <Script> sets it before hydration; setTheme keeps it updated.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  function setTheme(next: "dark" | "light") {
    localStorage.setItem("theme", next);
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(next);
  }

  return (
    <ThemeContext value={{ setTheme }}>
      {children}
    </ThemeContext>
  );
}
