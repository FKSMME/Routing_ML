import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { detectLayout, useResponsiveLayout } from "@styles/responsive";
import type { LayoutTier } from "@styles/theme";

const PERSISTENT_BREAKPOINTS: LayoutTier[] = ["desktop", "laptop"];

function isPersistentLayout(tier: LayoutTier): boolean {
  return PERSISTENT_BREAKPOINTS.includes(tier);
}

function getInitialOpenState(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  const tier = detectLayout(window.innerWidth);
  return isPersistentLayout(tier);
}

export function useResponsiveNav() {
  const layout = useResponsiveLayout();
  const [isOpen, setIsOpen] = useState<boolean>(() => getInitialOpenState());
  const previousLayout = useRef<LayoutTier | null>(null);

  useEffect(() => {
    if (isPersistentLayout(layout)) {
      setIsOpen(true);
    } else if (previousLayout.current && isPersistentLayout(previousLayout.current)) {
      setIsOpen(false);
    }
    previousLayout.current = layout;
  }, [layout]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => {
    setIsOpen((value) => !value);
  }, []);

  const state = useMemo(
    () => ({
      layout,
      isOpen,
      isPersistent: isPersistentLayout(layout),
    }),
    [layout, isOpen],
  );

  return {
    ...state,
    isDrawerMode: !state.isPersistent,
    open,
    close,
    toggle,
  } as const;
}
