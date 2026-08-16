"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ALL_LINKS, isLinkActive } from "@/lib/nav-links";
import { useLang } from "@/components/language-provider";

export function Nav() {
  const pathname = usePathname();
  const { t } = useLang();

  return (
    <nav className="flex flex-col gap-1 p-3">
      {ALL_LINKS.map(({ href, label, icon: Icon }) => {
        const active = isLinkActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {t(label)}
          </Link>
        );
      })}
    </nav>
  );
}
