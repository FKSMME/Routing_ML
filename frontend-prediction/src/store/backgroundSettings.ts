import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface LiquidBackgroundSettingsState {
  enabled: boolean;
  opacity: number;
  colors: string[];
  mouseForce: number;
  cursorSize: number;
  resolution: number;
  autoSpeed: number;
  autoIntensity: number;
  iterationsPoisson: number;
  isBounce: boolean;
  autoDemo: boolean;
  isViscous: boolean;
  viscous: number;
  iterationsViscous: number;
  dt: number;
  bfecc: boolean;
  takeoverDuration: number;
  autoResumeDelay: number;
  autoRampDuration: number;
  setEnabled: (value: boolean) => void;
  setOpacity: (value: number) => void;
  setColors: (value: string[]) => void;
  setMouseForce: (value: number) => void;
  setCursorSize: (value: number) => void;
  setResolution: (value: number) => void;
  setAutoSpeed: (value: number) => void;
  setAutoIntensity: (value: number) => void;
  setIterationsPoisson: (value: number) => void;
  setBounce: (value: boolean) => void;
  setAutoDemo: (value: boolean) => void;
  setViscousEnabled: (value: boolean) => void;
  setViscousCoeff: (value: number) => void;
  setIterationsViscous: (value: number) => void;
  setDt: (value: number) => void;
  setBfecc: (value: boolean) => void;
  setTakeoverDuration: (value: number) => void;
  setAutoResumeDelay: (value: number) => void;
  setAutoRampDuration: (value: number) => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const useBackgroundSettings = create<LiquidBackgroundSettingsState>()(
  persist(
    (set) => ({
      enabled: true,
      opacity: 0.42,
      colors: ["#5227FF", "#FF9FFC", "#B19EEF"],
      mouseForce: 20,
      cursorSize: 100,
      resolution: 0.5,
      autoSpeed: 0.5,
      autoIntensity: 2.2,
      iterationsPoisson: 32,
      isBounce: false,
      autoDemo: true,
      isViscous: false,
      viscous: 30,
      iterationsViscous: 32,
      dt: 0.014,
      bfecc: true,
      takeoverDuration: 0.25,
      autoResumeDelay: 3000,
      autoRampDuration: 0.6,
      setEnabled: (value) => set({ enabled: value }),
      setOpacity: (value) => set({ opacity: clamp(value, 0, 1) }),
      setColors: (value) => set({ colors: value.slice(0, 8) }),
      setMouseForce: (value) => set({ mouseForce: clamp(value, 0, 80) }),
      setCursorSize: (value) => set({ cursorSize: clamp(value, 25, 200) }),
      setResolution: (value) => set({ resolution: clamp(value, 0.2, 1) }),
      setAutoSpeed: (value) => set({ autoSpeed: clamp(value, 0, 2) }),
      setAutoIntensity: (value) => set({ autoIntensity: clamp(value, 0, 4) }),
      setIterationsPoisson: (value) => set({ iterationsPoisson: clamp(Math.round(value), 1, 128) }),
      setBounce: (value) => set({ isBounce: value }),
      setAutoDemo: (value) => set({ autoDemo: value }),
      setViscousEnabled: (value) => set({ isViscous: value }),
      setViscousCoeff: (value) => set({ viscous: clamp(value, 0, 120) }),
      setIterationsViscous: (value) => set({ iterationsViscous: clamp(Math.round(value), 1, 128) }),
      setDt: (value) => set({ dt: clamp(value, 0.005, 0.05) }),
      setBfecc: (value) => set({ bfecc: value }),
      setTakeoverDuration: (value) => set({ takeoverDuration: clamp(value, 0.05, 1) }),
      setAutoResumeDelay: (value) => set({ autoResumeDelay: clamp(Math.round(value), 500, 15000) }),
      setAutoRampDuration: (value) => set({ autoRampDuration: clamp(value, 0, 2) }),
    }),
    {
      name: "liquid-background-settings",
      version: 1,
    },
  ),
);
