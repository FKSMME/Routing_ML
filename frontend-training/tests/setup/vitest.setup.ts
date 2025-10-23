import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
import React from "react";
import { vi } from "vitest";

if (!globalThis.crypto) {
  // Vitest runs in Node, ensure Web Crypto APIs are available for randomUUID.
  globalThis.crypto = webcrypto as unknown as Crypto;
}

// Polyfill ResizeObserver used by some components during initialization.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverPolyfill {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  globalThis.ResizeObserver =
    ResizeObserverPolyfill as unknown as typeof ResizeObserver;
}

// Polyfill window.matchMedia for responsive hooks
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    }),
  });
}

vi.mock("@routing-ml/shared", async () => {
  const actual = await vi.importActual<typeof import("@routing-ml/shared")>("@routing-ml/shared");
  return {
    ...actual,
    LiquidEther: () => null,
  };
});

vi.mock("@react-three/fiber", () => ({
  __esModule: true,
  Canvas: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "mock-canvas" }, children),
  useFrame: () => undefined,
  useThree: () => ({ invalidate: () => undefined, gl: { domElement: document.createElement("canvas") } }),
}));

vi.mock("@react-three/drei", () => ({
  __esModule: true,
  OrbitControls: () => null,
  Html: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  Stats: () => null,
}));

vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
  const url = typeof input === "string" ? input : input.toString();
  if (url.includes("/api/auth/me")) {
    return new Response(JSON.stringify({ username: "tester", is_admin: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
