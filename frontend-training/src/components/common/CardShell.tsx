import { cn } from "@lib/classNames";
import styles from "@routing-ml/shared/components/common/CardShell.module.css";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type Tone = "default" | "soft" | "overlay" | "inverted" | "dialog";

type Padding = "none" | "sm" | "md" | "lg";

const toneClassMap: Record<Tone, string | undefined> = {
  default: undefined,
  soft: styles.toneSoft,
  overlay: styles.toneOverlay,
  inverted: styles.toneInverted,
  dialog: styles.toneDialog,
};

const paddingClassMap: Record<Padding, string> = {
  none: styles.paddingNone,
  sm: styles.paddingSm,
  md: styles.paddingMd,
  lg: styles.paddingLg,
};

export type CardShellProps<T extends ElementType = "div"> = {
  as?: T;
  children: ReactNode;
  tone?: Tone;
  padding?: Padding;
  interactive?: boolean;
  className?: string;
  innerClassName?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export function CardShell<T extends ElementType = "div">({
  as,
  children,
  tone = "default",
  padding = "md",
  interactive = true,
  className,
  innerClassName,
  ...rest
}: CardShellProps<T>) {
  const Component = (as ?? "div") as ElementType;
  const toneClass = toneClassMap[tone];
  const paddingClass = paddingClassMap[padding];

  return (
    <Component className={cn(styles.shell, interactive && styles.interactive, className)} {...rest}>
      <div className={cn(styles.surface, toneClass, paddingClass, innerClassName)}>{children}</div>
    </Component>
  );
}
