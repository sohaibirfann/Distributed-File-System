import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Relative asset paths so the packaged desktop app can load the build over
  // file:// (Electron). Harmless for the dev server.
  base: "./",
  plugins: [react(), tailwindcss()],
});