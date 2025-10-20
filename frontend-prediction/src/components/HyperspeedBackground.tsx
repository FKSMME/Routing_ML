import { Hyperspeed } from './Hyperspeed';
import { getPreset } from './hyperspeedPresets';

interface HyperspeedBackgroundProps {
  preset?: string;
  showControls?: boolean;
}

export function HyperspeedBackground({
  preset = 'cyberpunk',
  showControls = false
}: HyperspeedBackgroundProps) {
  const currentPreset = getPreset(preset);

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 0,
      pointerEvents: showControls ? 'auto' : 'none'
    }}>
      <Hyperspeed preset={currentPreset} />
    </div>
  );
}
