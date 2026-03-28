import React, { createContext, useContext, useState } from 'react';
import type { Lang } from './translations';
import { t as translate, type TKey } from './translations';

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey) => string;
}

const LangContext = createContext<LangContextValue>({
  lang: 'vi',
  setLang: () => {},
  t: (key) => translate(key, 'vi'),
});

const STORAGE_KEY = 'tocfl_lang';

export const LangProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    return (saved === 'vi' || saved === 'zh' || saved === 'en') ? saved : 'vi';
  });

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }

  const value: LangContextValue = {
    lang,
    setLang,
    t: (key: TKey) => translate(key, lang),
  };

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
};

export function useLang() {
  return useContext(LangContext);
}
