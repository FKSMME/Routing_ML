import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";

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
