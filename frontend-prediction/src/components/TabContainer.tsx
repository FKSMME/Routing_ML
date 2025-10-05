import { ReactNode, useState } from 'react';

export interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

interface TabContainerProps {
  tabs: Tab[];
  defaultTab?: string;
  className?: string;
}

export function TabContainer({ tabs, defaultTab, className = '' }: TabContainerProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '');

  const activeTabContent = tabs.find(tab => tab.id === activeTab)?.content;

  return (
    <div className={`tab-container ${className}`}>
      {/* Tab Navigation with SF Cyberpunk Styling */}
      <div className="flex gap-2 mb-6 border-b border-dark-border pb-1">
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                relative px-6 py-3 rounded-t-lg font-medium
                transition-all duration-300 ease-in-out
                stagger-item
                ${isActive
                  ? 'text-primary-400 bg-dark-elevated border-b-2 border-primary-400 neon-cyan scale-105'
                  : 'text-dark-text-secondary bg-dark-surface hover:bg-dark-elevated hover:text-dark-text-primary hover-lift'
                }
              `}
              style={{ animationDelay: `${index * 0.05}s` }}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
            >
              <div className="flex items-center gap-2">
                {tab.icon && <span className="transition-transform duration-300 group-hover:scale-110">{tab.icon}</span>}
                <span>{tab.label}</span>
              </div>

              {/* Active indicator with glow */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary-400 to-transparent animate-pulse-slow" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content with Fade-In Animation */}
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        className="animate-fade-in"
        key={activeTab}
      >
        {activeTabContent}
      </div>
    </div>
  );
}
