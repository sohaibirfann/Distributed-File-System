import { createContext, useContext, useState } from "react";

// Lets a page (e.g. the open group) set what the custom title bar shows.
const TitleContext = createContext(null);

export function TitleProvider({ children }) {
  const [title, setTitle] = useState(null);
  return (
    <TitleContext.Provider value={{ title, setTitle }}>
      {children}
    </TitleContext.Provider>
  );
}

export const useTitle = () => useContext(TitleContext) || { title: null, setTitle: () => {} };
