"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIMARY_LINKS, SECONDARY_LINKS, isLinkActive } from "@/lib/nav-links";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useLang } from "@/components/language-provider";

export function MobileNav() {
  const pathname = usePathname();
  const { t } = useLang();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = SECONDARY_LINKS.some((l) => isLinkActive(pathname, l.href));

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5">
          {PRIMARY_LINKS.map(({ href, label, shortLabel, icon: Icon }) => {
            const active = isLinkActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {t(shortLabel ?? label)}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
              moreActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            {t("More")}
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader>
            <SheetTitle>{t("More")}</SheetTitle>
            <SheetDescription className="sr-only">Additional sections</SheetDescription>
          </SheetHeader>
          <div className="grid gap-1 p-4 pt-0">
            {SECONDARY_LINKS.map(({ href, label, icon: Icon }) => {
              const active = isLinkActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors",
                    active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {t(label)}
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
