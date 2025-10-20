import { useMenuAnimation } from "@hooks/useGSAPAnimation";
import type { ReactNode } from "react";

export interface NavigationItem {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
}

interface MainNavigationProps {
  items: NavigationItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function MainNavigation({ items, activeId, onSelect }: MainNavigationProps) {
  const menuRef = useMenuAnimation();

  return (
    <nav ref={menuRef} className="main-nav" aria-label="주요 메뉴">
      <div className="main-nav-surface frosted-panel">
        <div className="main-nav-inner">
          <span className="main-nav-heading">운영 메뉴</span>
          <div className="main-nav-tabs" role="tablist">
            {items.map((item, index) => {
              const selected = item.id === activeId;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`main-nav-tab hover-lift stagger-item${selected ? " is-active neon-cyan" : ""}`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                  role="tab"
                  aria-selected={selected}
                  aria-label={`${item.label} - ${item.description}`}
                  onClick={() => onSelect(item.id)}
                >
                  <span className="main-nav-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="main-nav-labels">
                    <span className="main-nav-label">{item.label}</span>
                    <span className="main-nav-desc">{item.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
