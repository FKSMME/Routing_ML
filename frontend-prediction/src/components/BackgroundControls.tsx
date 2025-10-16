import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useBackgroundSettings } from "@store/backgroundSettings";

export function BackgroundControls() {
  const {
    enabled,
    opacity,
    autoRotate,
    rotateSpeed,
    modelScale,
    setEnabled,
    setOpacity,
    setAutoRotate,
    setRotateSpeed,
    setModelScale,
  } = useBackgroundSettings();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3 text-xs">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full bg-slate-900/70 px-4 py-2 text-slate-100 shadow-lg backdrop-blur transition hover:bg-slate-900/80"
      >
        <SlidersHorizontal size={16} />
        3D Background
      </button>
      {open ? (
        <div className="w-72 rounded-2xl border border-white/10 bg-slate-900/85 p-4 text-slate-100 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="font-medium">Background enabled</span>
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              <span>{enabled ? "On" : "Off"}</span>
            </label>
          </div>

          <div className="mt-4 space-y-2">
            <label className="flex items-center justify-between">
              <span>Opacity</span>
              <span>{Math.round(opacity * 100)}%</span>
            </label>
            <input
              type="range"
              min={5}
              max={80}
              value={Math.round(opacity * 100)}
              onChange={(event) => setOpacity(Number(event.target.value) / 100)}
              className="w-full"
            />
          </div>

          <div className="mt-4 space-y-2">
            <label className="flex items-center justify-between">
              <span>Model scale</span>
              <span>{modelScale.toFixed(2)}x</span>
            </label>
            <input
              type="range"
              min={30}
              max={150}
              value={Math.round(modelScale * 100)}
              onChange={(event) => setModelScale(Number(event.target.value) / 100)}
              className="w-full"
            />
          </div>

          <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between">
              <span>Auto rotate</span>
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoRotate}
                  onChange={(event) => setAutoRotate(event.target.checked)}
                />
                <span>{autoRotate ? "On" : "Off"}</span>
              </label>
            </div>
            <label className="flex items-center justify-between">
              <span>Rotate speed</span>
              <span>{rotateSpeed.toFixed(2)} rad/s</span>
            </label>
            <input
              type="range"
              min={0}
              max={40}
              value={Math.round(rotateSpeed * 100)}
              onChange={(event) => setRotateSpeed(Number(event.target.value) / 100)}
              className="w-full"
              disabled={!autoRotate}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
