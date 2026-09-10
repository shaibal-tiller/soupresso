'use client';

import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { translate, LANGS, DEFAULT_LANG, LANG_STORAGE_KEY } from '@/lib/i18n';
import { formatTaka, formatNumber, toLocaleDigits } from '@/lib/numerals';
import { formatDateLong, formatDateDisplay, formatDateNice } from '@/lib/dates';

const LangContext = createContext(null);

export default function LangProvider({ children }) {
  const [lang, setLangState] = useState(DEFAULT_LANG);

  useEffect(() => {
    let stored = null;
    try {
      stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (stored && LANGS.includes(stored) && stored !== DEFAULT_LANG) {
      setLangState(stored);
    }
  }, []);

  useEffect(() => {
    try {
      document.documentElement.lang = lang;
    } catch {}
  }, [lang]);

  const setLang = useCallback((next) => {
    if (!LANGS.includes(next)) return;
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {}
    setLangState(next);
  }, []);

  const value = {
    lang,
    setLang,
    t: useCallback((key) => translate(lang, key), [lang]),
    taka: useCallback((n) => formatTaka(n, lang), [lang]),
    num: useCallback((n) => formatNumber(n, lang), [lang]),
    digits: useCallback((s) => toLocaleDigits(s, lang), [lang]),
    dateLong: useCallback((d) => formatDateLong(d, lang), [lang]),
    dateDisplay: useCallback((d) => formatDateDisplay(d, lang), [lang]),
    dateNice: useCallback((d) => formatDateNice(d, lang), [lang]),
  };

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}
