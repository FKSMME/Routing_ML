import { useEffect, useState } from "react";

import type { LayoutTier } from "./theme";

interface LayoutRule {
  tier: LayoutTier;
  minWidth: number;
  columns: string;
}

export const BREAKPOINTS: Record<LayoutTier, number> = {
  desktop: 1440,
  laptop: 1280,
  tablet: 1024,
  mobile: 0,
};

export const COLUMN_TEMPLATES: Record<LayoutTier, string> = {
  desktop: "320px 1fr 340px",
  laptop: "280px 1fr 320px",
  tablet: "minmax(0, 1fr)",
  mobile: "minmax(0, 1fr)",
};

const RULES: LayoutRule[] = [
  { tier: "desktop", minWidth: BREAKPOINTS.desktop, columns: COLUMN_TEMPLATES.desktop },
  { tier: "laptop", minWidth: BREAKPOINTS.laptop, columns: COLUMN_TEMPLATES.laptop },
  { tier: "tablet", minWidth: BREAKPOINTS.tablet, columns: COLUMN_TEMPLATES.tablet },
  { tier: "mobile", minWidth: BREAKPOINTS.mobile, columns: COLUMN_TEMPLATES.mobile },
];

export function detectLayout(width: number): LayoutTier {
  const match = RULES.find((rule) => width >= rule.minWidth);
  return match ? match.tier : "mobile";
}

export function applyLayoutAttribute(root?: HTMLElement | null, width?: number): LayoutTier {
  if (typeof document === "undefined") {
    return "desktop";
  }

  const target = root ?? document.documentElement;
  const currentWidth = width ?? window.innerWidth;
  const tier = detectLayout(currentWidth);
  target.dataset.layout = tier;
  target.style.setProperty("--layout-columns", COLUMN_TEMPLATES[tier]);
  return tier;
}

export function registerResponsiveLayout(root?: HTMLElement | null): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const target = root ?? document.documentElement;
  const handleResize = () => applyLayoutAttribute(target);
  handleResize();
  window.addEventListener("resize", handleResize, { passive: true });
  return () => {
    window.removeEventListener("resize", handleResize);
  };
}

export function useResponsiveLayout(root?: HTMLElement | null): LayoutTier {
  const [tier, setTier] = useState<LayoutTier>(() => {
    if (typeof window === "undefined") {
      return "desktop";
    }
    return detectLayout(window.innerWidth);
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const target = root ?? document.documentElement;
    const update = () => {
      const current = applyLayoutAttribute(target);
      setTier(current);
    };
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, [root]);

  return tier;
}
