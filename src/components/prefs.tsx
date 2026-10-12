"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "dark" | "light";

interface Prefs {
  theme: Theme;
  setTheme: (t: Theme) => void;
  hideValues: boolean;
  toggleHideValues: () => void;
}

const PrefsCtx = createContext<Prefs | null>(null);
const KEY = "nexvyra-finance:prefs";

function read(): Partial<Prefs> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

/** Preferências do aparelho (tema e modo privacidade) — ficam só no navegador */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [hideValues, setHide] = useState(false);

  const [loaded, setLoaded] = useState(false);

  // lê as preferências salvas ao montar (localStorage só existe no navegador)
  useEffect(() => {
    const p = read();
    /* eslint-disable react-hooks/set-state-in-effect */
    if (p.theme === "light" || p.theme === "dark") setThemeState(p.theme);
    if (typeof p.hideValues === "boolean") setHide(p.hideValues);
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!loaded) return;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.hideValues = String(hideValues);
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute("content", theme === "light" ? "#f2f5fb" : "#060913");
    try {
      localStorage.setItem(KEY, JSON.stringify({ theme, hideValues }));
    } catch {}
  }, [theme, hideValues, loaded]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggleHideValues = useCallback(() => setHide((v) => !v), []);

  return (
    <PrefsCtx.Provider value={{ theme, setTheme, hideValues, toggleHideValues }}>
      {children}
    </PrefsCtx.Provider>
  );
}

export function usePrefs() {
  const ctx = useContext(PrefsCtx);
  if (!ctx) throw new Error("usePrefs fora do PrefsProvider");
  return ctx;
}

/** script inline para aplicar o tema antes de pintar a tela (evita "piscar") */
export const themeBootScript = `try{var p=JSON.parse(localStorage.getItem("${KEY}")||"{}");document.documentElement.dataset.theme=p.theme==="light"?"light":"dark";document.documentElement.dataset.hideValues=String(!!p.hideValues)}catch(e){}`;
