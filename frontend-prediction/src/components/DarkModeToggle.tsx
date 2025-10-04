import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function DarkModeToggle() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // 초기값: localStorage 또는 시스템 설정
    const isDark =
      localStorage.getItem("darkMode") === "true" ||
      (!localStorage.getItem("darkMode") && window.matchMedia("(prefers-color-scheme: dark)").matches);

    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);

    if (newDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("darkMode", "true");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("darkMode", "false");
    }
  };

  return (
    <button
      onClick={toggleDarkMode}
      className="
        relative p-2 rounded-lg
        bg-gray-200 dark:bg-dark-elevated
        hover:bg-gray-300 dark:hover:bg-dark-border
        transition-all duration-300 ease-in-out
        group
      "
      aria-label={darkMode ? "라이트 모드로 전환" : "다크 모드로 전환"}
    >
      <div className="relative w-5 h-5">
        <Sun
          className={`
            absolute inset-0 text-yellow-500
            transition-all duration-300 ease-in-out
            ${darkMode ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}
          `}
          size={20}
        />
        <Moon
          className={`
            absolute inset-0 text-primary-400
            transition-all duration-300 ease-in-out
            ${darkMode ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}
          `}
          size={20}
        />
      </div>

      {/* Glow effect */}
      <div className={`
        absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100
        transition-opacity duration-300
        ${darkMode ? "shadow-glow" : "shadow-glow-purple"}
      `} />
    </button>
  );
}
