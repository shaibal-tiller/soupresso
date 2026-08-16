"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Receipt,
  Soup,
  UtensilsCrossed,
  BookOpen,
  Users,
  FileBarChart,
} from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/entries", label: "Entries", icon: Receipt },
  { href: "/daily-sales", label: "Daily Sales", icon: Soup },
  { href: "/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/accounts", label: "Chart of Accounts", icon: BookOpen },
  { href: "/partners", label: "Partners & Equity", icon: Users },
  { href: "/reports", label: "Reports", icon: FileBarChart },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
      {links.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
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
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
