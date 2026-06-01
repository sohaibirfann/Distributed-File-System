import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// In the desktop app, mark the document so the background goes transparent and
// the OS window translucency (acrylic/vibrancy) shows the desktop behind.
if (typeof window !== "undefined" && window.dfsDesktop?.isDesktop) {
  document.documentElement.classList.add("is-desktop");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);