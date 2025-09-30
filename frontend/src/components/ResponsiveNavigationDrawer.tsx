import { useEffect, useId } from "react";

import { MainNavigation, type NavigationItem } from "./MainNavigation";

interface ResponsiveNavigationDrawerProps {
  items: NavigationItem[];
  activeId: string;
  onSelect: (id: string) => void;
  open: boolean;
  onClose: () => void;
  drawerId?: string;
}

export function ResponsiveNavigationDrawer({
  items,
  activeId,
  onSelect,
  open,
  onClose,
  drawerId,
}: ResponsiveNavigationDrawerProps) {
  const generatedId = useId();
  const resolvedId = drawerId ?? generatedId;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleSelect = (id: string) => {
    onSelect(id);
    onClose();
  };

  return (
    <div
      id={resolvedId}
      aria-hidden={!open}
      className={`responsive-nav-drawer ${open ? "is-open" : ""}`.trim()}
      data-state={open ? "open" : "closed"}
      role="dialog"
      aria-modal="true"
      aria-label="메뉴"
      hidden={!open}
    >
      <button
        type="button"
        className="responsive-nav-drawer__overlay"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
      />
      <div className="responsive-nav-drawer__panel" role="presentation">
        <div className="responsive-nav-drawer__header">
          <span className="responsive-nav-drawer__title">운영 메뉴</span>
          <button type="button" className="responsive-nav-drawer__close" onClick={onClose} aria-label="메뉴 닫기">
            ×
          </button>
        </div>
        <MainNavigation items={items} activeId={activeId} onSelect={handleSelect} />
      </div>
    </div>
  );
}
