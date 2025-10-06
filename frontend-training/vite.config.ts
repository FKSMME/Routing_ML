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
      "@store": fileURLToPath(new URL("./src/store", import.meta.url)),
    },
  },
  build: {
    target: "es2020",
    minify: "esbuild",
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React 코어
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "react-vendor";
          }
          // ReactFlow (큰 라이브러리)
          if (id.includes("node_modules/reactflow") || id.includes("node_modules/@xyflow")) {
            return "reactflow-vendor";
          }
          // UI 라이브러리
          if (id.includes("node_modules/lucide-react") || id.includes("node_modules/zustand")) {
            return "ui-vendor";
          }
          // D3, Recharts 등 차트 라이브러리
          if (id.includes("node_modules/d3") || id.includes("node_modules/recharts")) {
            return "chart-vendor";
          }
          // Anomaly Detection 컴포넌트 (lazy load용)
          if (id.includes("/components/anomaly/")) {
            return "anomaly-module";
          }
          // Blueprint 컴포넌트 (lazy load용)
          if (id.includes("/components/blueprint/")) {
            return "blueprint-module";
          }
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5174,
    open: false,
    fs: {
      allow: ["..", "../tests"],
    },
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 5174,
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

