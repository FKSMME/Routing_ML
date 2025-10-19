import { useState } from 'react';
import { Hyperspeed } from './Hyperspeed';
import { HYPERSPEED_PRESETS, PRESET_KEYS, getPreset } from './hyperspeedPresets';

export function HyperspeedBackground() {
  const [selectedPreset, setSelectedPreset] = useState('cyberpunk');

  const currentPreset = getPreset(selectedPreset);

  return (
    <>
      <Hyperspeed preset={currentPreset} />

      <div className="hyperspeed-preset-selector">
        <label htmlFor="preset-select">Animation Theme</label>
        <select
          id="preset-select"
          value={selectedPreset}
          onChange={(e) => setSelectedPreset(e.target.value)}
        >
          {PRESET_KEYS.map((key) => {
            const preset = HYPERSPEED_PRESETS[key];
            return (
              <option key={key} value={key}>
                {preset.name}
              </option>
            );
          })}
        </select>
        <div className="preset-info">
          {currentPreset.description}
        </div>
      </div>
    </>
  );
}
