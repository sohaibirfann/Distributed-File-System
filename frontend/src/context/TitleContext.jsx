import { createContext, useContext, useState } from "react";

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
