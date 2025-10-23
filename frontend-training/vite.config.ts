import { fileURLToPath, URL } from "node:url";
import fs from "node:fs";
import path from "node:path";

import { defineConfig, type HmrOptions } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

const CERT_KEY_PATH = path.resolve(__dirname, "../certs/rtml.ksm.co.kr.key");
const CERT_CERT_PATH = path.resolve(__dirname, "../certs/rtml.ksm.co.kr.crt");

const isVitest = Boolean(process.env.VITEST);

const toNumber = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const defaultDevPort = 5174;
const hmrHost = process.env.VITE_HMR_HOST ?? "rtml.ksm.co.kr";
const hmrProtocol = (process.env.VITE_HMR_PROTOCOL ?? "wss") as HmrOptions["protocol"];
const hmrPort = toNumber(process.env.VITE_HMR_PORT) ?? defaultDevPort;
const hmrClientPort = toNumber(process.env.VITE_HMR_CLIENT_PORT) ?? defaultDevPort;

const hmrOptions: HmrOptions | false = isVitest
  ? false
  : {
      protocol: hmrProtocol,
      host: hmrHost,
      port: hmrPort,
      clientPort: hmrClientPort,
    };

const testAliases: Record<string, string> = isVitest
  ? {
      reactflow: fileURLToPath(new URL("./tests/mocks/reactflow.tsx", import.meta.url)),
    }
  : {};

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: [
      { find: "@components", replacement: fileURLToPath(new URL("./src/components", import.meta.url)) },
      { find: "@hooks", replacement: fileURLToPath(new URL("./src/hooks", import.meta.url)) },
      { find: "@lib", replacement: fileURLToPath(new URL("./src/lib", import.meta.url)) },
      { find: "@app-types", replacement: fileURLToPath(new URL("./src/types", import.meta.url)) },
      { find: "@store", replacement: fileURLToPath(new URL("./src/store", import.meta.url)) },
      { find: "@routing-ml/shared", replacement: fileURLToPath(new URL("../frontend-shared/src", import.meta.url)) },
      { find: /^zustand$/, replacement: fileURLToPath(new URL("./shims/zustand-legacy.ts", import.meta.url)) },
      {
        find: /^zustand\/shallow$/,
        replacement: fileURLToPath(new URL("./shims/zustand-shallow-legacy.ts", import.meta.url)),
      },
      ...Object.entries(testAliases).map(([find, replacement]) => ({
        find,
        replacement,
      })),
    ],
    // Deduplicate React packages to prevent "multiple React copies" error
    dedupe: [
      "react",
      "react-dom",
      "zustand",
      "zustand/react",
      "zustand/vanilla",
      "use-sync-external-store",
    ],
  },
  optimizeDeps: {
    include: [
      "zustand/react",
      "zustand/vanilla",
      "zustand/shallow",
      "use-sync-external-store/shim/with-selector.js",
    ],
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
          // Three.js + OGL (3D 효과, lazy loaded)
          if (id.includes("node_modules/three") || id.includes("node_modules/ogl")) {
            return "three-vendor";
          }
          // React Query
          if (id.includes("node_modules/@tanstack/react-query")) {
            return "query-vendor";
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
    https: {
      key: fs.readFileSync(CERT_KEY_PATH),
      cert: fs.readFileSync(CERT_CERT_PATH),
    },
    hmr: hmrOptions,
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
    port: 5174,
    https: {
      key: fs.readFileSync(CERT_KEY_PATH),
      cert: fs.readFileSync(CERT_CERT_PATH),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    include: [
      "tests/frontend-training/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: [
      "tests/e2e/**/*",
      "tests/evidence/**/*",
      "tests/unit/**/*",
    ],
    coverage: {
      reporter: ["text", "lcov"],
    },
  },
});
