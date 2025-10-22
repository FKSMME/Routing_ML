import { useBackgroundSettings } from "@store/backgroundSettings";
import { Droplets, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

const COLOR_LABELS = ["Primary", "Accent", "Glow"];

export function BackgroundControls() {
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
    setEnabled,
    setOpacity,
    setColors,
    setMouseForce,
    setCursorSize,
    setResolution,
    setAutoSpeed,
    setAutoIntensity,
    setIterationsPoisson,
    setBounce,
    setAutoDemo,
    setViscousEnabled,
    setViscousCoeff,
    setIterationsViscous,
  } = useBackgroundSettings();
  const [open, setOpen] = useState(false);

  const handleColorChange = (index: number, value: string) => {
    const next = [...colors];
    next[index] = value;
    setColors(next);
  };

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3 text-xs">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full bg-slate-900/75 px-4 py-2 text-slate-100 shadow-lg backdrop-blur transition hover:bg-slate-900/90"
      >
        <SlidersHorizontal size={16} />
        Liquid Ether
      </button>
      {open ? (
        <div className="w-80 max-w-sm rounded-2xl border border-white/10 bg-slate-900/85 p-4 text-slate-100 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Background</span>
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              <span>{enabled ? "On" : "Off"}</span>
            </label>
          </div>

          <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
            <fieldset className="space-y-2">
              <legend className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-300">
                <Droplets size={14} /> Colors
              </legend>
              <div className="flex gap-3">
                {colors.slice(0, 3).map((color, index) => (
                  <label key={index} className="flex flex-col items-center gap-1 text-[11px] text-slate-300">
                    <span>{COLOR_LABELS[index] ?? `Color ${index + 1}`}</span>
                    <input
                      type="color"
                      value={color}
                      onChange={(event) => handleColorChange(index, event.target.value)}
                      className="h-9 w-12 cursor-pointer rounded border border-white/10 bg-transparent"
                    />
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <label className="flex flex-col gap-1">
                <span className="flex justify-between text-slate-300">
                  <span>Opacity</span>
                  <span>{Math.round(opacity * 100)}%</span>
                </span>
                <input
                  type="range"
                  min={10}
                  max={80}
                  value={Math.round(opacity * 100)}
                  onChange={(event) => setOpacity(Number(event.target.value) / 100)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="flex justify-between text-slate-300">
                  <span>Resolution</span>
                  <span>{resolution.toFixed(2)}</span>
                </span>
                <input
                  type="range"
                  min={20}
                  max={100}
                  value={Math.round(resolution * 100)}
                  onChange={(event) => setResolution(Number(event.target.value) / 100)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="flex justify-between text-slate-300">
                  <span>Mouse Force</span>
                  <span>{mouseForce.toFixed(0)}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={60}
                  value={mouseForce}
                  onChange={(event) => setMouseForce(Number(event.target.value))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="flex justify-between text-slate-300">
                  <span>Cursor Size</span>
                  <span>{cursorSize.toFixed(0)}</span>
                </span>
                <input
                  type="range"
                  min={40}
                  max={180}
                  value={cursorSize}
                  onChange={(event) => setCursorSize(Number(event.target.value))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="flex justify-between text-slate-300">
                  <span>Auto Speed</span>
                  <span>{autoSpeed.toFixed(2)}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={150}
                  value={Math.round(autoSpeed * 100)}
                  onChange={(event) => setAutoSpeed(Number(event.target.value) / 100)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="flex justify-between text-slate-300">
                  <span>Auto Intensity</span>
                  <span>{autoIntensity.toFixed(2)}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={400}
                  value={Math.round(autoIntensity * 100)}
                  onChange={(event) => setAutoIntensity(Number(event.target.value) / 100)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="flex justify-between text-slate-300">
                  <span>Pressure</span>
                  <span>{iterationsPoisson}</span>
                </span>
                <input
                  type="range"
                  min={8}
                  max={64}
                  value={iterationsPoisson}
                  onChange={(event) => setIterationsPoisson(Number(event.target.value))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="flex justify-between text-slate-300">
                  <span>Viscous Coef</span>
                  <span>{viscous.toFixed(0)}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={120}
                  value={viscous}
                  onChange={(event) => setViscousCoeff(Number(event.target.value))}
                  disabled={!isViscous}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <label className="flex items-center justify-between gap-3">
                <span>Bounce Edges</span>
                <input
                  type="checkbox"
                  checked={isBounce}
                  onChange={(event) => setBounce(event.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>Auto Animate</span>
                <input
                  type="checkbox"
                  checked={autoDemo}
                  onChange={(event) => setAutoDemo(event.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>Viscous</span>
                <input
                  type="checkbox"
                  checked={isViscous}
                  onChange={(event) => setViscousEnabled(event.target.checked)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="flex justify-between text-slate-300">
                  <span>Viscous Iter.</span>
                  <span>{iterationsViscous}</span>
                </span>
                <input
                  type="range"
                  min={4}
                  max={64}
                  value={iterationsViscous}
                  onChange={(event) => setIterationsViscous(Number(event.target.value))}
                  disabled={!isViscous}
                />
              </label>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
