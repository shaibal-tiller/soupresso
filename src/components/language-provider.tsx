"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { LANG_COOKIE, t as translate, type Lang } from "@/lib/i18n-shared";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (en: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ initialLang, children }: { initialLang: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const router = useRouter();

  const setLang = useCallback(
    (next: Lang) => {
      const oneYear = 60 * 60 * 24 * 365;
      document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${oneYear}; SameSite=Lax`;
      setLangState(next);
      router.refresh();
    },
    [router],
  );

  const t = useCallback((en: string) => translate(lang, en), [lang]);

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export function useLang(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within a LanguageProvider");
  return ctx;
}
