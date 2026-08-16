import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Receipt,
  Soup,
  Wallet,
  UtensilsCrossed,
  BookOpen,
  Users,
  FileBarChart,
} from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
}

// Shown as bottom tabs on mobile, and first in the desktop sidebar.
export const PRIMARY_LINKS: NavLink[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/entries", label: "Entries", icon: Receipt },
  { href: "/daily-sales", label: "Daily Sales", shortLabel: "Sales", icon: Soup },
  { href: "/cash-bank", label: "Cash & Bank", shortLabel: "Cash", icon: Wallet },
];

// Tucked under "More" on mobile, shown after the primary links on desktop.
export const SECONDARY_LINKS: NavLink[] = [
  { href: "/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/accounts", label: "Chart of Accounts", icon: BookOpen },
  { href: "/partners", label: "Partners & Equity", icon: Users },
  { href: "/reports", label: "Reports", icon: FileBarChart },
];

export const ALL_LINKS: NavLink[] = [...PRIMARY_LINKS, ...SECONDARY_LINKS];

export function isLinkActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
