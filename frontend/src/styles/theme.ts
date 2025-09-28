import type { CSSProperties } from "react";

export type LayoutTier = "desktop" | "laptop" | "tablet" | "mobile";

interface GradientTokens {
  start: string;
  end: string;
  mid: string;
}

interface AccentTokens {
  base: string;
  hover: string;
  strong: string;
  subtle: string;
}

interface SurfaceTokens {
  base: string;
  card: string;
  menu: string;
  overlay: string;
  border: string;
  borderStrong: string;
}

interface TypographyTokens {
  family: string;
  headingColor: string;
  bodyColor: string;
  mutedColor: string;
  emphasisColor: string;
}

interface ShadowTokens {
  resting: string;
  hover: string;
  focus: string;
}

interface TransitionTokens {
  emphasis: string;
  lift: string;
  glow: string;
}

interface LayoutTokens {
  maxWidth: string;
  radius: string;
  columnGap: string;
}

export interface RoutingMLTheme {
  gradient: GradientTokens;
  accent: AccentTokens;
  surface: SurfaceTokens;
  typography: TypographyTokens;
  shadows: ShadowTokens;
  transitions: TransitionTokens;
  layout: LayoutTokens;
}

export const pastelSkyTheme: RoutingMLTheme = {
  gradient: {
    start: "oklch(0.98 0.028 220)",
    mid: "oklch(0.92 0.04 232)",
    end: "oklch(0.86 0.06 242)",
  },
  accent: {
    base: "oklch(0.72 0.12 245)",
    hover: "oklch(0.68 0.14 245)",
    strong: "oklch(0.62 0.16 245)",
    subtle: "oklch(0.80 0.07 240)",
  },
  surface: {
    base: "oklch(0.96 0.02 228)",
    card: "oklch(0.94 0.03 228 / 0.92)",
    menu: "oklch(0.97 0.01 228 / 0.88)",
    overlay: "oklch(0.90 0.04 228 / 0.75)",
    border: "oklch(0.78 0.03 228 / 0.55)",
    borderStrong: "oklch(0.68 0.04 228 / 0.66)",
  },
  typography: {
    family: "'Inter', 'Pretendard', 'Segoe UI', sans-serif",
    headingColor: "oklch(0.22 0.02 235)",
    bodyColor: "oklch(0.26 0.015 235)",
    mutedColor: "oklch(0.46 0.015 235)",
    emphasisColor: "oklch(0.18 0.025 235)",
  },
  shadows: {
    resting: "0 22px 48px -26px rgba(32, 70, 140, 0.22)",
    hover: "0 26px 55px -24px rgba(28, 66, 150, 0.32)",
    focus: "0 0 0 2px rgba(112, 168, 255, 0.18), 0 22px 48px -26px rgba(32, 70, 140, 0.28)",
  },
  transitions: {
    emphasis: "background-color 0.18s ease, color 0.18s ease",
    lift: "transform 0.18s ease, box-shadow 0.2s ease",
    glow: "box-shadow 0.25s ease",
  },
  layout: {
    maxWidth: "1200px",
    radius: "1.25rem",
    columnGap: "1.5rem",
  },
};

const baseVariableMap: Record<string, string> = {
  "--gradient-start": pastelSkyTheme.gradient.start,
  "--gradient-mid": pastelSkyTheme.gradient.mid,
  "--gradient-end": pastelSkyTheme.gradient.end,
  "--surface": pastelSkyTheme.surface.base,
  "--surface-card": pastelSkyTheme.surface.card,
  "--surface-menu": pastelSkyTheme.surface.menu,
  "--surface-overlay": pastelSkyTheme.surface.overlay,
  "--border": pastelSkyTheme.surface.border,
  "--border-strong": pastelSkyTheme.surface.borderStrong,
  "--accent": pastelSkyTheme.accent.base,
  "--accent-hover": pastelSkyTheme.accent.hover,
  "--accent-strong": pastelSkyTheme.accent.strong,
  "--accent-soft": pastelSkyTheme.accent.subtle,
  "--text-primary": pastelSkyTheme.typography.bodyColor,
  "--text-heading": pastelSkyTheme.typography.headingColor,
  "--text-muted": pastelSkyTheme.typography.mutedColor,
  "--text-emphasis": pastelSkyTheme.typography.emphasisColor,
  "--shadow-resting": pastelSkyTheme.shadows.resting,
  "--shadow-hover": pastelSkyTheme.shadows.hover,
  "--shadow-focus": pastelSkyTheme.shadows.focus,
  "--transition-emphasis": pastelSkyTheme.transitions.emphasis,
  "--transition-lift": pastelSkyTheme.transitions.lift,
  "--transition-glow": pastelSkyTheme.transitions.glow,
  "--layout-max-width": pastelSkyTheme.layout.maxWidth,
  "--layout-column-gap": pastelSkyTheme.layout.columnGap,
  "--layout-radius": pastelSkyTheme.layout.radius,
};

export function applyTheme(root?: HTMLElement | null, theme: RoutingMLTheme = pastelSkyTheme): void {
  if (typeof document === "undefined") {
    return;
  }

  const target = root ?? document.documentElement;
  const variableMap: Record<string, string> = {
    ...baseVariableMap,
    "--gradient-start": theme.gradient.start,
    "--gradient-mid": theme.gradient.mid,
    "--gradient-end": theme.gradient.end,
    "--surface": theme.surface.base,
    "--surface-card": theme.surface.card,
    "--surface-menu": theme.surface.menu,
    "--surface-overlay": theme.surface.overlay,
    "--border": theme.surface.border,
    "--border-strong": theme.surface.borderStrong,
    "--accent": theme.accent.base,
    "--accent-hover": theme.accent.hover,
    "--accent-strong": theme.accent.strong,
    "--accent-soft": theme.accent.subtle,
    "--text-primary": theme.typography.bodyColor,
    "--text-heading": theme.typography.headingColor,
    "--text-muted": theme.typography.mutedColor,
    "--text-emphasis": theme.typography.emphasisColor,
    "--shadow-resting": theme.shadows.resting,
    "--shadow-hover": theme.shadows.hover,
    "--shadow-focus": theme.shadows.focus,
    "--transition-emphasis": theme.transitions.emphasis,
    "--transition-lift": theme.transitions.lift,
    "--transition-glow": theme.transitions.glow,
    "--layout-max-width": theme.layout.maxWidth,
    "--layout-column-gap": theme.layout.columnGap,
    "--layout-radius": theme.layout.radius,
  };

  Object.entries(variableMap).forEach(([prop, value]) => {
    target.style.setProperty(prop, value);
  });

  target.style.setProperty("--font-family", theme.typography.family);
}

export const cardHoverStyle: CSSProperties = {
  transition: pastelSkyTheme.transitions.lift,
  boxShadow: pastelSkyTheme.shadows.resting,
};

export const hoverElevationStyle: CSSProperties = {
  transition: pastelSkyTheme.transitions.lift,
  boxShadow: pastelSkyTheme.shadows.hover,
};

export const focusHaloStyle: CSSProperties = {
  transition: pastelSkyTheme.transitions.glow,
  boxShadow: pastelSkyTheme.shadows.focus,
};
