import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved ? saved === "dark" : true;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  function toggleTheme() {
    const next = !isDark;

    const apply = () => {
      const root = document.documentElement;
      if (next) root.classList.add("dark");
      else root.classList.remove("dark");
      localStorage.setItem("theme", next ? "dark" : "light");
      setIsDark(next);
    };

    if (document.startViewTransition) {
      document.startViewTransition(apply);
    } else {
      document.documentElement.classList.add("theme-transitioning");
      apply();
      setTimeout(() => {
        document.documentElement.classList.remove("theme-transitioning");
      }, 300);
    }
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
