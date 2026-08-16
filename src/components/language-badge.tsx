"use client";

import { Languages } from "lucide-react";
import { useLang } from "@/components/language-provider";

export function LanguageBadge({ className }: { className?: string }) {
  const { lang, setLang } = useLang();

  return (
    <button
      type="button"
      onClick={() => setLang(lang === "en" ? "bn" : "en")}
      className={className ?? "flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"}
      aria-label="Switch language"
    >
      <Languages className="h-4 w-4" />
      {lang === "en" ? "বাংলা" : "English"}
    </button>
  );
}
