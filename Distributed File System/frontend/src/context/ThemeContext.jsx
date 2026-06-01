import { createContext, useContext, useEffect } from "react";

const ThemeContext = createContext(null);

// Dark-only for now — light mode has been removed. The app always renders dark;
// the .dark class stays on <html> so the existing dark: styles apply. (Light
// mode can be brought back by restoring the toggle + a stored preference.)
export function ThemeProvider({ children }) {
  useEffect(() => {
    document.documentElement.classList.add("dark");
    localStorage.removeItem("theme");
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark: true }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
