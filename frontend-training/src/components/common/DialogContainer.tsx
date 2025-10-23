import { cn } from "@lib/classNames";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import { CardShell } from "./CardShell";
import styles from "./DialogContainer.module.css";

export interface DialogContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  surfaceClassName?: string;
  maxWidth?: number | string;
}

export function DialogContainer({
  children,
  className,
  surfaceClassName,
  maxWidth,
  ...rest
}: DialogContainerProps) {
  const style: CSSProperties | undefined =
    typeof maxWidth === "number"
      ? { "--dialog-max-width": `${maxWidth}px` } as CSSProperties
      : maxWidth
        ? ({ "--dialog-max-width": maxWidth } as CSSProperties)
        : undefined;

  return (
    <div className={cn(styles.backdrop, className)} {...rest}>
      <CardShell
        className={styles.dialog}
        innerClassName={cn(styles.dialogSurface, surfaceClassName)}
        tone="dialog"
        padding="lg"
        interactive={false}
        style={style}
      >
        {children}
      </CardShell>
    </div>
  );
}
