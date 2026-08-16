import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { MobileNav } from "@/components/mobile-nav";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
  themeColor: "#fcfcfb",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="flex min-h-screen">
          <aside className="hidden w-64 shrink-0 border-r bg-sidebar md:block">
            <div className="flex h-16 items-center gap-2 border-b px-4">
              <span className="text-lg font-semibold tracking-tight">🍜 Soupresso</span>
            </div>
            <Nav />
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <header
              className="sticky top-0 z-30 flex h-14 items-center border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden"
              style={{ paddingTop: "env(safe-area-inset-top)" }}
            >
              <span className="text-base font-semibold tracking-tight">🍜 Soupresso</span>
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
