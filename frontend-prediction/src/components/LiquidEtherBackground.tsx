import { LiquidEther } from "@routing-ml/shared";
import { useBackgroundSettings } from "@store/backgroundSettings";
import type { CSSProperties } from "react";

import ErrorBoundary from "./ErrorBoundary";

type LiquidEtherBackgroundVariant = "fixed" | "absolute";

interface LiquidEtherBackgroundProps {
  variant?: LiquidEtherBackgroundVariant;
  className?: string;
  style?: CSSProperties;
  zIndex?: number;
}

export function LiquidEtherBackground({
  variant = "fixed",
  className,
  style,
  zIndex,
}: LiquidEtherBackgroundProps) {
  const {
    enabled,
    opacity,
    colors,
    mouseForce,
    cursorSize,
    resolution,
    autoSpeed,
    autoIntensity,
    iterationsPoisson,
    isBounce,
    autoDemo,
    isViscous,
    viscous,
    iterationsViscous,
    dt,
    bfecc,
    takeoverDuration,
    autoResumeDelay,
    autoRampDuration,
  } = useBackgroundSettings();

  if (!enabled) {
    return null;
  }

  const baseStyle: CSSProperties = {
    position: variant === "fixed" ? "fixed" : "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    opacity,
    zIndex: zIndex ?? 0,
    ...style,
  };

  return (
    <ErrorBoundary fallback={null}>
      <div className={className} style={baseStyle}>
        <LiquidEther
          colors={colors}
          mouseForce={mouseForce}
          cursorSize={cursorSize}
          resolution={resolution}
          autoSpeed={autoSpeed}
          autoIntensity={autoIntensity}
          iterationsPoisson={iterationsPoisson}
          isBounce={isBounce}
          autoDemo={autoDemo}
          isViscous={isViscous}
          viscous={viscous}
          iterationsViscous={iterationsViscous}
          dt={dt}
          BFECC={bfecc}
          takeoverDuration={takeoverDuration}
          autoResumeDelay={autoResumeDelay}
          autoRampDuration={autoRampDuration}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </ErrorBoundary>
  );
}

export default LiquidEtherBackground;
