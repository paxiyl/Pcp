import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Tailwind v4 is wired through the Vite plugin; src/index.css only needs
  // `@import "tailwindcss"`, so there is no postcss config to keep in step.
  plugins: [react(), tailwindcss()],
  resolve: {
    // Mirrors "paths" in tsconfig.app.json. Both have to agree: TS resolves
    // the alias for the typecheck, Vite resolves it for the bundle.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
  },
});
