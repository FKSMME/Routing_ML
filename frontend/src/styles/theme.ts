import type { CSSProperties } from "react";

export type LayoutTier = "desktop" | "laptop" | "tablet" | "mobile";

interface GradientTokens {
  start: string;
  end: string;
  mid: string;
}

interface BrandTokens {
  primary: string;
  primaryGlow: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
}

interface AccentTokens {
  base: string;
  hover: string;
  strong: string;
  subtle: string;
}

interface SurfaceTokens {
  base: string;
  raised: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  menu: string;
  overlay: string;
  border: string;
  borderStrong: string;
  input: string;
  ring: string;
}

interface TypographyTokens {
  family: string;
  headingColor: string;
  bodyColor: string;
  mutedColor: string;
  emphasisColor: string;
}

interface NavigationTokens {
  default: string;
  hover: string;
  active: string;
}

interface StatusTokens {
  destructive: string;
  destructiveForeground: string;
}

interface ChartTokens {
  primary: string;
  secondary: string;
  tertiary: string;
  quaternary: string;
  quinary: string;
}

interface MotionTokens {
  durationXS: string;
  durationSM: string;
  durationLG: string;
  easeOut: string;
}

interface ShadowTokens {
  resting: string;
  hover: string;
  focus: string;
  glow: string;
  elegant: string;
  raised: string;
}

interface TransitionTokens {
  emphasis: string;
  lift: string;
  glow: string;
  smooth: string;
}

interface LayoutTokens {
  maxWidth: string;
  radius: string;
  columnGap: string;
}

export interface RoutingMLTheme {
  gradient: GradientTokens;
  brand: BrandTokens;
  accent: AccentTokens;
  surface: SurfaceTokens;
  typography: TypographyTokens;
  navigation: NavigationTokens;
  statuses: StatusTokens;
  charts: ChartTokens;
  motion: MotionTokens;
  shadows: ShadowTokens;
  transitions: TransitionTokens;
  layout: LayoutTokens;
}

const hsl = (value: string) => `hsl(${value})`;
const withAlpha = (value: string, alpha: number) => `hsl(${value} / ${alpha})`;

export const pastelSkyTheme: RoutingMLTheme = {
  gradient: {
    start: "195 85% 72%",
    mid: "140 65% 75%",
    end: "195 45% 92%",
  },
  brand: {
    primary: "195 100% 33%",
    primaryGlow: "195 100% 45%",
    primaryForeground: "0 0% 100%",
    secondary: "188 82% 47%",
    secondaryForeground: "0 0% 100%",
  },
  accent: {
    base: "188 82% 47%",
    hover: "195 100% 45%",
    strong: "195 100% 33%",
    subtle: "195 85% 72%",
  },
  surface: {
    base: "195 45% 98%",
    raised: "0 0% 100%",
    background: "195 45% 98%",
    foreground: "210 45% 20%",
    card: "0 0% 100%",
    cardForeground: "210 45% 20%",
    popover: "0 0% 100%",
    popoverForeground: "210 45% 20%",
    menu: "195 45% 96%",
    overlay: "195 45% 92%",
    border: "195 30% 85%",
    borderStrong: "195 30% 78%",
    input: "195 30% 95%",
    ring: "188 82% 47%",
  },
  typography: {
    family: "'Inter', 'Pretendard', 'Segoe UI', sans-serif",
    headingColor: "210 45% 18%",
    bodyColor: "210 45% 22%",
    mutedColor: "210 25% 45%",
    emphasisColor: "210 60% 15%",
  },
  navigation: {
    default: "210 40% 25%",
    hover: "210 60% 15%",
    active: "195 100% 18%",
  },
  statuses: {
    destructive: "0 84.2% 60.2%",
    destructiveForeground: "0 0% 98%",
  },
  charts: {
    primary: "195 100% 33%",
    secondary: "188 82% 47%",
    tertiary: "140 65% 45%",
    quaternary: "195 85% 72%",
    quinary: "210 45% 35%",
  },
  motion: {
    durationXS: "120ms",
    durationSM: "180ms",
    durationLG: "320ms",
    easeOut: "cubic-bezier(0.22, 0.61, 0.36, 1)",
  },
  shadows: {
    resting: `0 8px 20px ${withAlpha("195 100% 33%", 0.12)}`,
    hover: `0 12px 32px ${withAlpha("195 100% 33%", 0.18)}`,
    focus: `0 0 0 3px ${withAlpha("188 82% 47%", 0.35)}`,
    glow: `0 0 40px ${withAlpha("195 100% 45%", 0.35)}`,
    elegant: `0 10px 30px ${withAlpha("195 100% 33%", 0.3)}`,
    raised: `0 12px 28px ${withAlpha("195 100% 33%", 0.16)}`,
  },
  transitions: {
    emphasis: "background-color 0.18s ease, color 0.18s ease",
    lift: "transform 0.18s ease, box-shadow 0.2s ease",
    glow: "box-shadow 0.25s ease",
    smooth: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  },
  layout: {
    maxWidth: "1200px",
    radius: "0.75rem",
    columnGap: "1.5rem",
  },
};

function createVariableMap(theme: RoutingMLTheme): Record<string, string> {
  const borderGradient = `linear-gradient(135deg, ${hsl(theme.brand.primary)} 0%, ${hsl(
    theme.brand.primaryGlow
  )} 45%, ${hsl(theme.brand.secondary)} 100%)`;

  return {
    "--primary": hsl(theme.brand.primary),
    "--primary-glow": hsl(theme.brand.primaryGlow),
    "--primary-foreground": hsl(theme.brand.primaryForeground),
    "--secondary": hsl(theme.brand.secondary),
    "--secondary-foreground": hsl(theme.brand.secondaryForeground),
    "--gradient-sky-start": theme.gradient.start,
    "--gradient-sky-mid": theme.gradient.mid,
    "--gradient-sky-end": theme.gradient.end,
    "--gradient-start": hsl(theme.gradient.start),
    "--gradient-mid": hsl(theme.gradient.mid),
    "--gradient-end": hsl(theme.gradient.end),
    "--surface-base": theme.surface.base,
    "--surface-raised": theme.surface.raised,
    "--surface": hsl(theme.surface.base),
    "--surface-card": hsl(theme.surface.card),
    "--card": hsl(theme.surface.card),
    "--card-foreground": hsl(theme.surface.cardForeground),
    "--popover": hsl(theme.surface.popover),
    "--popover-foreground": hsl(theme.surface.popoverForeground),
    "--surface-menu": hsl(theme.surface.menu),
    "--surface-overlay": hsl(theme.surface.overlay),
    "--background": hsl(theme.surface.background),
    "--foreground": hsl(theme.surface.foreground),
    "--border": hsl(theme.surface.border),
    "--border-strong": hsl(theme.surface.borderStrong),
    "--accent": hsl(theme.accent.base),
    "--accent-hover": hsl(theme.accent.hover),
    "--accent-strong": hsl(theme.accent.strong),
    "--accent-soft": hsl(theme.accent.subtle),
    "--text-primary": hsl(theme.typography.bodyColor),
    "--text-heading": hsl(theme.typography.headingColor),
    "--text-muted": hsl(theme.typography.mutedColor),
    "--text-muted-strong": hsl(theme.typography.mutedColor),
    "--text-emphasis": hsl(theme.typography.emphasisColor),
    "--nav-default": hsl(theme.navigation.default),
    "--nav-hover": hsl(theme.navigation.hover),
    "--nav-active": hsl(theme.navigation.active),
    "--input": hsl(theme.surface.input),
    "--ring": hsl(theme.surface.ring),
    "--destructive": hsl(theme.statuses.destructive),
    "--destructive-foreground": hsl(theme.statuses.destructiveForeground),
    "--chart-1": hsl(theme.charts.primary),
    "--chart-2": hsl(theme.charts.secondary),
    "--chart-3": hsl(theme.charts.tertiary),
    "--chart-4": hsl(theme.charts.quaternary),
    "--chart-5": hsl(theme.charts.quinary),
    "--motion-duration-xs": theme.motion.durationXS,
    "--motion-duration-sm": theme.motion.durationSM,
    "--motion-duration-lg": theme.motion.durationLG,
    "--motion-ease-out": theme.motion.easeOut,
    "--shadow-elegant": theme.shadows.elegant,
    "--shadow-glow": theme.shadows.glow,
    "--shadow-raised": theme.shadows.raised,
    "--shadow-resting": theme.shadows.resting,
    "--shadow-hover": theme.shadows.hover,
    "--shadow-focus": theme.shadows.focus,
    "--transition-emphasis": theme.transitions.emphasis,
    "--transition-lift": theme.transitions.lift,
    "--transition-glow": theme.transitions.glow,
    "--transition-smooth": theme.transitions.smooth,
    "--layout-max-width": theme.layout.maxWidth,
    "--layout-column-gap": theme.layout.columnGap,
    "--layout-radius": theme.layout.radius,
    "--radius": theme.layout.radius,
    "--glass-blur": "18px",
    "--border-gradient": borderGradient,
  };
}

const baseVariableMap = createVariableMap(pastelSkyTheme);

export function applyTheme(root?: HTMLElement | null, theme: RoutingMLTheme = pastelSkyTheme): void {
  if (typeof document === "undefined") {
    return;
  }

  const target = root ?? document.documentElement;
  const variableMap = {
    ...baseVariableMap,
    ...createVariableMap(theme),
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
