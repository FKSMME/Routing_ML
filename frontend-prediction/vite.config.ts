import { fileURLToPath, URL } from "node:url";
import fs from "node:fs";
import path from "node:path";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

const CHUNK_LIMIT = Number(process.env.VITE_CHUNK_LIMIT ?? "2000");

const isReactModule = (id: string) =>
  /node_modules\/(react|react-dom)\//.test(id) || id.includes("node_modules/react/index");

const isReactFlowModule = (id: string) => id.includes("node_modules/reactflow");

const isQueryModule = (id: string) => id.includes("node_modules/@tanstack/react-query");

const isUiModule = (id: string) =>
  id.includes("node_modules/lucide-react") || id.includes("node_modules/zustand");

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      "@components": fileURLToPath(new URL("./src/components", import.meta.url)),
      "@hooks": fileURLToPath(new URL("./src/hooks", import.meta.url)),
      "@lib": fileURLToPath(new URL("./src/lib", import.meta.url)),
      "@app-types": fileURLToPath(new URL("./src/types", import.meta.url)),
      "@store": fileURLToPath(new URL("./src/store", import.meta.url)),
      "@routing-ml/shared": fileURLToPath(new URL("../frontend-shared/src", import.meta.url)),
    },
  },
  build: {
    target: "es2020",
    minify: "esbuild",
    sourcemap: false,
    chunkSizeWarningLimit: Number.isFinite(CHUNK_LIMIT) ? CHUNK_LIMIT : 1200,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (isReactModule(id)) return "react-vendor";
          if (isReactFlowModule(id)) return "reactflow-vendor";
          if (id.includes("@react-three/drei")) return "three-drei";
          if (id.includes("@react-three/fiber")) return "three-fiber";
          if (id.includes("node_modules/ogl")) return "three-ogl";
          if (id.includes("node_modules/three")) return "three-core";
          if (id.includes("three/examples") || id.includes("three-stdlib")) return "three-extras";
          if (isQueryModule(id)) return "query-vendor";
          if (isUiModule(id)) return "ui-vendor";
          if (id.includes("frontend-shared")) return "routing-shared";
          if (id.includes("src/components/workspaces")) return "workspaces";
          return undefined;
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    open: false,
    https: {
      key: fs.readFileSync(path.resolve(__dirname, "../certs/rtml.ksm.co.kr.key")),
      cert: fs.readFileSync(path.resolve(__dirname, "../certs/rtml.ksm.co.kr.crt")),
    },
    fs: {
      allow: ["..", "../tests"],
    },
    proxy: {
      "/api": {
        target: "https://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
    },
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
    https: {
      key: fs.readFileSync(path.resolve(__dirname, "../certs/rtml.ksm.co.kr.key")),
      cert: fs.readFileSync(path.resolve(__dirname, "../certs/rtml.ksm.co.kr.crt")),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    include: [
      "tests/**/*.{test,spec}.{ts,tsx}",
      "../tests/frontend/**/*.{test,spec}.{ts,tsx}",
    ],
    coverage: {
      reporter: ["text", "lcov"],
    },
  },
});
