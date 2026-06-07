import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  // Relative asset paths for the packaged build (loaded over file:// in Electron);
  // the dev server stays at "/" so it serves normally.
  base: command === "build" ? "./" : "/",
  plugins: [react(), tailwindcss()],
}));