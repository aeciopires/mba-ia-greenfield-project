import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import Script from "next/script";

import { SessionProvider } from "@/components/auth/session-provider";
import { Header } from "@/components/layout/header";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { getSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StreamTube",
  description: "Video sharing platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full", "antialiased", inter.variable, geistMono.variable, "font-sans")}
    >
      <head>
        {/* Runs before React hydration: applies .dark or .light to <html> without flash */}
        <Script id="theme-init" strategy="beforeInteractive">{`
          (function(){
            var t=localStorage.getItem('theme');
            if(!t){t=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';}
            document.documentElement.classList.add(t);
          })();
        `}</Script>
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider>
          <SessionProvider
            initialSession={{
              userId: session.userId ?? "",
              email: session.email ?? "",
              channelSlug: session.channelSlug ?? "",
              isLoggedIn: session.isLoggedIn ?? false,
            }}
          >
            <Header />
            <main className="flex-1">{children}</main>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
