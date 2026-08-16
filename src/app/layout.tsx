import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fredoka } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { MobileNav } from "@/components/mobile-nav";
import { ActorBadge } from "@/components/actor-badge";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Soupresso Ledger",
  description: "Accounting ledger for the Soupresso food cart business",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Soupresso",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f5a623",
};

function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 font-heading font-semibold tracking-tight ${className ?? ""}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-amber to-brand-amber-deep text-base shadow-sm">
        🍲
      </span>
      <span className="text-brand-maroon dark:text-foreground">Soupresso</span>
    </span>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fredoka.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="flex min-h-screen">
          <aside className="hidden w-64 shrink-0 border-r bg-sidebar md:flex md:flex-col">
            <div className="flex h-16 items-center gap-2 border-b px-4">
              <Wordmark className="text-lg" />
            </div>
            <Nav />
            <div className="mt-auto border-t p-3">
              <ActorBadge />
            </div>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <header
              className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden"
              style={{ paddingTop: "env(safe-area-inset-top)" }}
            >
              <Wordmark className="text-base" />
              <ActorBadge />
            </header>
            <main className="flex-1 p-4 pb-24 md:p-8 md:pb-8">{children}</main>
          </div>
        </div>
        <MobileNav />
        <Toaster />
      </body>
    </html>
  );
}
