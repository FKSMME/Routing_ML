import { create } from "zustand";
import { persist } from "zustand/middleware";

interface BackgroundSettingsState {
  enabled: boolean;
  opacity: number;
  autoRotate: boolean;
  rotateSpeed: number;
  modelScale: number;
  setEnabled: (value: boolean) => void;
  setOpacity: (value: number) => void;
  setAutoRotate: (value: boolean) => void;
  setRotateSpeed: (value: number) => void;
  setModelScale: (value: number) => void;
}

export const useBackgroundSettings = create<BackgroundSettingsState>()(
  persist(
    (set) => ({
      enabled: true,
      opacity: 0.3,
      autoRotate: true,
      rotateSpeed: 0.15,
      modelScale: 0.6,
      setEnabled: (value) => set({ enabled: value }),
      setOpacity: (value) => set({ opacity: Math.min(1, Math.max(0, value)) }),
      setAutoRotate: (value) => set({ autoRotate: value }),
      setRotateSpeed: (value) => set({ rotateSpeed: Math.max(0, value) }),
      setModelScale: (value) => set({ modelScale: Math.max(0.1, Math.min(2, value)) }),
    }),
    {
      name: "background-settings",
      version: 1,
    },
  ),
);

