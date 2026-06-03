import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

// Accent themes. "default" = Windows blue (no data-theme attribute); others map
// to a [data-theme="…"] block in index.css that overrides the --accent vars.
export const ACCENTS = [
  { id: "default", label: "Default", swatch: "#0067C0" },
  { id: "coral",   label: "Coral", swatch: "#e8533f" },
  { id: "ember",   label: "Amber", swatch: "#e8a44d" },
];
const ACCENT_IDS = ACCENTS.map((a) => a.id);

// Apply before React paints to avoid an accent flash on load.
function applyAccent(id) {
  const root = document.documentElement;
  if (id && id !== "default") root.setAttribute("data-theme", id);
  else root.removeAttribute("data-theme");
}
try {
  const saved = localStorage.getItem("dfs_accent");
  if (saved) applyAccent(saved);
} catch { /* ignore */ }

// Dark-only for now — light mode has been removed. The accent, however, is
// themeable via the vars in index.css.
export function ThemeProvider({ children }) {
  const [accent, setAccentState] = useState(() => {
    const a = localStorage.getItem("dfs_accent");
    return ACCENT_IDS.includes(a) ? a : "default";
  });

  useEffect(() => {
    document.documentElement.classList.add("dark");
    localStorage.removeItem("theme");
  }, []);

  useEffect(() => {
    applyAccent(accent);
    localStorage.setItem("dfs_accent", accent);
  }, [accent]);

  const setAccent = (a) => setAccentState(ACCENT_IDS.includes(a) ? a : "default");

  return (
    <ThemeContext.Provider value={{ isDark: true, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
