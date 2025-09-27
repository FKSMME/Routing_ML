import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      "@components": fileURLToPath(new URL("./src/components", import.meta.url)),
      "@hooks": fileURLToPath(new URL("./src/hooks", import.meta.url)),
      "@lib": fileURLToPath(new URL("./src/lib", import.meta.url)),
      "@app-types": fileURLToPath(new URL("./src/types", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    open: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
  },
});
