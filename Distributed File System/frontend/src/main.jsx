import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// In the desktop app, mark the document so the background goes transparent and
// the Windows 11 Mica material shows behind the window (the Settings-app frost).
if (typeof window !== "undefined" && window.dfsDesktop?.isDesktop) {
  document.documentElement.classList.add("is-desktop");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);